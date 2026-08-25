import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import migrationDataSlice, { setNewMigrationData } from '../../../store/slice/migrationDataSlice';
import authSlice from '../../../store/slice/authSlice';
import { DEFAULT_NEW_MIGRATION } from '../../../context/app/app.interface';

// react-router and react-router-dom resolve to separate module instances/contexts in this
// test environment (unrelated to the behavior under test) — mocked directly rather than
// fighting router setup for a component that only needs a stable projectId and a no-op navigate.
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ projectId: 'proj1' }),
}));
vi.mock('../../../hooks/userNavigation', () => ({ default: () => {} }));

import MigrationLogViewer from '../MigrationLogViewer';

const { mockSocketOn, mockSocketHandlers } = vi.hoisted(() => {
  const handlers: Record<string, (arg: any) => void> = {};
  return {
    mockSocketHandlers: handlers,
    mockSocketOn: vi.fn((event: string, handler: (arg: any) => void) => {
      handlers[event] = handler;
    }),
  };
});

vi.mock('socket.io-client', () => ({
  default: () => ({ on: mockSocketOn, disconnect: vi.fn(), connect: vi.fn() }),
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

const renderViewer = (store: ReturnType<typeof buildStore>) =>
  render(
    <Provider store={store}>
      <MigrationLogViewer serverPath="http://localhost:5001" handleStepChange={() => {}} />
    </Provider>
  );

describe('MigrationLogViewer — reconciliation status branches not covered by the same-batch race test', () => {
  it('records a failed reconciliation with the error message when the process reports it could not complete', async () => {
    const store = buildStore();
    renderViewer(store);

    mockSocketHandlers['logUpdate'](
      JSON.stringify({
        level: 'error',
        message: 'Automatic post-migration reconciliation failed to complete: no readable report was produced',
        timestamp: '2026-01-01T00:00:00.000Z',
      })
    );

    await waitFor(() => {
      const state = store.getState() as any;
      expect(state.migration.newMigrationData.migration_execution.reconciliation?.status).toBe('failed');
    });

    const finalState = store.getState() as any;
    expect(finalState.migration.newMigrationData.migration_execution.reconciliation).toMatchObject({
      status: 'failed',
      error: 'Automatic post-migration reconciliation failed to complete: no readable report was produced',
    });
  });

  it('preserves startedAt across two SEPARATE socket emissions (not just when batched into one)', async () => {
    const store = buildStore();
    renderViewer(store);

    // First emission: only the "Starting..." line, exactly as chokidar would report it the
    // instant reconciliation kicks off, well before it finishes.
    mockSocketHandlers['logUpdate'](
      JSON.stringify({
        level: 'info',
        message: 'Starting automatic post-migration reconciliation against live stack stack1 ...',
        timestamp: '2026-01-01T00:00:01.000Z',
      })
    );

    await waitFor(() => {
      const state = store.getState() as any;
      expect(state.migration.newMigrationData.migration_execution.reconciliation?.status).toBe('running');
    });

    // Second, later emission — a separate 'logUpdate' event, not appended to the first.
    mockSocketHandlers['logUpdate'](
      JSON.stringify({
        level: 'info',
        message:
          'Automatic post-migration reconciliation finished: 1 critical, 0 error, 0 warning finding(s). Report: /tmp/report2.xlsx',
        timestamp: '2026-01-01T00:00:05.000Z',
      })
    );

    await waitFor(() => {
      const state = store.getState() as any;
      expect(state.migration.newMigrationData.migration_execution.reconciliation?.status).toBe('completed');
    });

    const finalState = store.getState() as any;
    expect(finalState.migration.newMigrationData.migration_execution.reconciliation).toMatchObject({
      status: 'completed',
      startedAt: '2026-01-01T00:00:01.000Z',
      completedAt: '2026-01-01T00:00:05.000Z',
      summary: { critical: 1, error: 0, warning: 0 },
      reportPath: '/tmp/report2.xlsx',
    });
  });
});
