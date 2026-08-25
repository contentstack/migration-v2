import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import migrationDataSlice, { setNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { DEFAULT_NEW_MIGRATION } from '../../../context/app/app.interface';
import MigrationExecution from '../index';

const mockGetReconciliationReport = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api/migration.service', () => ({
  getReconciliationReport: mockGetReconciliationReport
}));

/**
 * Reconciliation now runs automatically once a SAP SmartEdit migration
 * completes (see runCli.service.ts's triggerPostMigrationReconciliation) —
 * previously it only ran if someone remembered to invoke /reconcile by hand.
 * These tests pin what the Execute Migration step actually shows for each
 * `reconciliation.status` the backend can report, so a change to that
 * rendering logic is caught here instead of only being noticed by someone
 * clicking through the app.
 */
vi.mock('../../LogScreen/MigrationLogViewer', () => ({
  default: () => <div data-testid="mock-log-viewer" />
}));

const buildStore = (reconciliation?: any) => {
  const rootReducer = combineReducers({ migration: migrationDataSlice });
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(
    setNewMigrationData({
      ...DEFAULT_NEW_MIGRATION,
      isprojectMapped: false,
      migration_execution: {
        migrationStarted: false,
        migrationCompleted: true,
        reconciliation
      }
    })
  );
  return store;
};

const renderWithStore = (reconciliation?: any) =>
  render(
    <Provider store={buildStore(reconciliation)}>
      <MigrationExecution handleStepChange={() => {}} />
    </Provider>
  );

describe('MigrationExecution — automatic reconciliation status', () => {
  it('renders nothing reconciliation-related when the project has no reconciliation data (non-SAP-SmartEdit, or not yet run)', async () => {
    renderWithStore(undefined);
    await waitFor(() => expect(screen.getByTestId('mock-log-viewer')).toBeInTheDocument());
    expect(screen.queryByText(/Reconciliation/i)).not.toBeInTheDocument();
  });

  it('shows a running indicator while reconciliation is in progress', async () => {
    renderWithStore({ status: 'running', startedAt: '2026-01-01T00:00:00.000Z' });
    await waitFor(() =>
      expect(
        screen.getByText(/Automatically verifying the migrated data against the live stack/i)
      ).toBeInTheDocument()
    );
  });

  it('shows a clean pass when reconciliation completes with zero findings', async () => {
    renderWithStore({
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      summary: { critical: 0, error: 0, warning: 0 }
    });
    await waitFor(() =>
      expect(screen.getByText(/Reconciliation passed — no issues found/i)).toBeInTheDocument()
    );
  });

  it('surfaces critical/error/warning counts and the report path when findings exist', async () => {
    renderWithStore({
      status: 'completed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      summary: { critical: 1, error: 2, warning: 3 },
      reportPath: '/tmp/live-reconciliation-stack1-123.json'
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Reconciliation: 1 critical, 2 error, 3 warning finding\(s\)/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('/tmp/live-reconciliation-stack1-123.json')).toBeInTheDocument();
  });

  it("shows a failure message when reconciliation couldn't complete", async () => {
    renderWithStore({
      status: 'failed',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      error: 'no readable report was produced'
    });
    await waitFor(() =>
      expect(
        screen.getByText(/Reconciliation could not complete — check server logs/i)
      ).toBeInTheDocument()
    );
  });

  describe('downloading the .xlsx report', () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;

    beforeEach(() => {
      vi.clearAllMocks();
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('renders a clickable link (not plain text) when the report is a real .xlsx, and downloads it on click', async () => {
      mockGetReconciliationReport.mockResolvedValue({ status: 200, data: new Blob(['fake xlsx bytes']) });
      renderWithStore({
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
        summary: { critical: 0, error: 0, warning: 0 },
        reportPath: '/Reconcile files/stack1.reconcile.xlsx'
      });

      const link = await screen.findByText('/Reconcile files/stack1.reconcile.xlsx');
      fireEvent.click(link);

      await waitFor(() => expect(mockGetReconciliationReport).toHaveBeenCalled());
      await waitFor(() => expect(window.URL.createObjectURL).toHaveBeenCalled());
    });

    it('falls back to plain (non-clickable) text when the report is not an .xlsx (e.g. JSON fallback)', async () => {
      renderWithStore({
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
        summary: { critical: 0, error: 0, warning: 0 },
        reportPath: '/logs/live-reconciliation-stack1-123.json'
      });

      const text = await screen.findByText('/logs/live-reconciliation-stack1-123.json');
      fireEvent.click(text);

      expect(mockGetReconciliationReport).not.toHaveBeenCalled();
    });

    const renderWithXlsxReport = () =>
      renderWithStore({
        status: 'completed',
        startedAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:05:00.000Z',
        summary: { critical: 0, error: 0, warning: 0 },
        reportPath: '/Reconcile files/stack1.reconcile.xlsx'
      });

    it('shows an error notification and does not attempt a download when the API returns a non-200 status', async () => {
      mockGetReconciliationReport.mockResolvedValue({ status: 500, data: undefined });
      renderWithXlsxReport();

      const link = await screen.findByText('/Reconcile files/stack1.reconcile.xlsx');
      fireEvent.click(link);

      await waitFor(() => expect(screen.getAllByText('Could not download the reconciliation report').length).toBeGreaterThan(0));
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('shows an error notification when the API responds 200 but with no data', async () => {
      mockGetReconciliationReport.mockResolvedValue({ status: 200, data: undefined });
      renderWithXlsxReport();

      const link = await screen.findByText('/Reconcile files/stack1.reconcile.xlsx');
      fireEvent.click(link);

      await waitFor(() => expect(screen.getAllByText('Could not download the reconciliation report').length).toBeGreaterThan(0));
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('shows an error notification when the getReconciliationReport call itself rejects', async () => {
      mockGetReconciliationReport.mockRejectedValue(new Error('network error'));
      renderWithXlsxReport();

      const link = await screen.findByText('/Reconcile files/stack1.reconcile.xlsx');
      fireEvent.click(link);

      await waitFor(() => expect(screen.getAllByText('Could not download the reconciliation report').length).toBeGreaterThan(0));
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });
});
