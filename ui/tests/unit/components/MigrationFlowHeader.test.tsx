import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router';
import MigrationFlowHeader from '../../../src/components/MigrationFlowHeader';

/**
 * A completed migration must not be re-runnable from the primary CTA. It used to relabel
 * itself "Restart Migration" and re-enable on completion, which invited an accidental
 * second run of a finished migration. Starting another (delta) iteration is now a separate
 * secondary action — that path must stay reachable, because incrementing `iteration` is the
 * only way into the delta flow.
 */
vi.mock('@contentstack/venus-components', () => ({
  Button: ({ children, disabled, onClick, ...rest }: any) => (
    <button disabled={disabled} onClick={onClick} aria-label={rest['aria-label']}>
      {children}
    </button>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
}));

const makeStore = (migrationCompleted: boolean, stepValue = 'Start Migration') =>
  configureStore({
    reducer: {
      authentication: () => ({ selectedOrganisation: { value: 'org1' } }),
      migration: () => ({
        newMigrationData: {
          iteration: 1,
          stepValue,
          legacy_cms: { projectStatus: migrationCompleted ? 5 : 4 },
          migration_execution: { migrationStarted: false, migrationCompleted },
          destination_stack: {},
          testStacks: [],
          project_current_step: 5,
        },
      }),
    },
  });

const renderHeader = (opts: {
  migrationCompleted: boolean;
  onStartNewIteration?: () => void;
  stepValue?: string;
}) =>
  render(
    <Provider store={makeStore(opts.migrationCompleted, opts.stepValue)}>
      <MemoryRouter initialEntries={['/projects/p1/migration/steps/5']}>
        <Routes>
          <Route
            path="/projects/:projectId/migration/steps/:stepId"
            element={
              <MigrationFlowHeader
                projectData={{ name: 'Demo', current_step: 5 } as any}
                handleOnClick={vi.fn()}
                isLoading={false}
                isCompleted={false}
                legacyCMSRef={{ current: null }}
                finalExecutionStarted={false}
                onStartNewIteration={opts.onStartNewIteration}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MigrationFlowHeader — completed migration', () => {
  it('disables the primary CTA once the migration has completed', () => {
    renderHeader({ migrationCompleted: true });
    expect(screen.getByLabelText('Save and Continue')).toBeDisabled();
  });

  it('never relabels the CTA to "Restart Migration"', () => {
    renderHeader({ migrationCompleted: true });
    expect(screen.queryByText(/restart migration/i)).toBeNull();
  });

  it('leaves the CTA enabled while the migration has NOT completed', () => {
    renderHeader({ migrationCompleted: false });
    expect(screen.getByLabelText('Save and Continue')).not.toBeDisabled();
  });
});

describe('MigrationFlowHeader — delta iteration entry point', () => {
  it('offers "Start New Iteration" once the migration has completed', () => {
    renderHeader({ migrationCompleted: true, onStartNewIteration: vi.fn() });
    expect(screen.getByLabelText('Start New Iteration')).toBeInTheDocument();
  });

  it('does not offer it before the migration completes', () => {
    renderHeader({ migrationCompleted: false, onStartNewIteration: vi.fn() });
    expect(screen.queryByLabelText('Start New Iteration')).toBeNull();
  });

  it('invokes the callback when clicked, so the delta flow stays reachable', async () => {
    const onStartNewIteration = vi.fn();
    renderHeader({ migrationCompleted: true, onStartNewIteration });
    await userEvent.click(screen.getByLabelText('Start New Iteration'));
    expect(onStartNewIteration).toHaveBeenCalledTimes(1);
  });

  it('is not rendered when no callback is supplied', () => {
    renderHeader({ migrationCompleted: true });
    expect(screen.queryByLabelText('Start New Iteration')).toBeNull();
  });
});
