import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import migrationDataSlice, { setNewMigrationData } from '../../../store/slice/migrationDataSlice';
import authSlice from '../../../store/slice/authSlice';
import { DEFAULT_NEW_MIGRATION } from '../../../context/app/app.interface';

// react-router and react-router-dom resolve to separate module instances/contexts in this
// test environment (unrelated to the fix under test) — mocked directly rather than fighting
// router setup for a component that only needs a stable projectId and a no-op navigate here.
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ projectId: 'proj1' }),
}));
vi.mock('../../../hooks/userNavigation', () => ({ default: () => {} }));

import MigrationLogViewer from '../MigrationLogViewer';

/**
 * Regression test for a real bug: the "migration completed" flip and the
 * reconciliation-status updates both read-then-write the SAME
 * migration_execution redux object, in two separate effects reacting to the
 * same `logs` change. Because updateNewMigrationData shallow-merges at the
 * top level (migration_execution is replaced wholesale, not deep-merged),
 * whichever effect dispatched SECOND silently overwrote the first one's
 * change — in practice the reconciliation effect ran after the completion
 * effect, so the moment reconciliation started, migrationCompleted got
 * clobbered back to false even though it had just been set true. This
 * showed up as: reconciliation status displays correctly, but the "Migration
 * Execution process is completed" banner never appears. Both effects are now
 * merged into one, dispatched once — this test drives a realistic socket
 * payload where ALL of these lines arrive in a single 'logUpdate' emission
 * (exactly what happens on a fast local migration) and asserts BOTH pieces
 * of state land correctly, not just whichever happened to write last.
 */
const { mockIo, mockSocketOn, mockSocketHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (arg: any) => void> = {};
  return {
    mockSocketHandlers: handlers,
    mockSocketOn: vi.fn((event: string, handler: (arg: any) => void) => {
      handlers[event] = handler;
    }),
    mockIo: vi.fn(),
  };
});

vi.mock('socket.io-client', () => ({
  default: (...args: unknown[]) => {
    mockIo(...args);
    return { on: mockSocketOn, disconnect: vi.fn(), connect: vi.fn() };
  },
}));

const buildStore = () => {
  const rootReducer = combineReducers({ migration: migrationDataSlice, authentication: authSlice });
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(
    setNewMigrationData({
      ...DEFAULT_NEW_MIGRATION,
      migration_execution: { migrationStarted: true, migrationCompleted: false },
    })
  );
  return store;
};

describe('MigrationLogViewer — completion + reconciliation status do not clobber each other', () => {
  it('lands both migrationCompleted=true AND reconciliation=completed when both lines arrive in the same socket batch', async () => {
    const store = buildStore();

    render(
      <Provider store={store}>
        <MigrationLogViewer serverPath="http://localhost:5001" handleStepChange={() => {}} />
      </Provider>
    );

    // Exactly the realistic scenario: a fast local migration writes "Migration Process
    // Completed" and the ENTIRE reconciliation lifecycle before the next chokidar poll
    // fires, so the server emits all of it in ONE 'logUpdate' chunk.
    const batch = [
      JSON.stringify({ level: 'info', message: 'Migration Process Completed', timestamp: '2026-01-01T00:00:00.000Z' }),
      JSON.stringify({
        level: 'info',
        message: 'Starting automatic post-migration reconciliation against live stack stack1 ...',
        timestamp: '2026-01-01T00:00:01.000Z',
      }),
      JSON.stringify({
        level: 'info',
        message:
          'Automatic post-migration reconciliation finished: 0 critical, 0 error, 0 warning finding(s). Report: /tmp/report.xlsx',
        timestamp: '2026-01-01T00:00:02.000Z',
      }),
    ].join('\n');

    mockSocketHandlers['logUpdate'](batch);

    await waitFor(() => {
      const state = store.getState() as any;
      expect(state.migration.newMigrationData.migration_execution.migrationCompleted).toBe(true);
    });

    const finalState = store.getState() as any;
    expect(finalState.migration.newMigrationData.migration_execution.migrationCompleted).toBe(true);
    expect(finalState.migration.newMigrationData.migration_execution.migrationStarted).toBe(false);
    expect(finalState.migration.newMigrationData.migration_execution.reconciliation).toMatchObject({
      status: 'completed',
      // Regression: currentReconciliation used to be read straight from redux on every
      // iteration of the same forEach pass, so when "Starting..." and "finished..." land in
      // the same batch, the "finished" branch never saw the startedAt the "Starting" branch
      // had just computed a few lines earlier — it fell back to '' instead.
      startedAt: '2026-01-01T00:00:01.000Z',
      summary: { critical: 0, error: 0, warning: 0 },
      reportPath: '/tmp/report.xlsx',
    });
  });
});
