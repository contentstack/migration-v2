import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import ExportLogView from '../../../../../v3/components/source/ExportLogView';

/**
 * TDD — v3 ExportLogView progress bar. The export job runs in backend batches
 * (see api/v3/services/export.service.ts `setProgress` calls); this bar
 * relays that live 0–100 value between the "Activity log" title and the
 * level-filter capsules, rather than the log view having no progress
 * indicator at all.
 */
describe('v3 ExportLogView — progress bar', () => {
  it('(positive) no job started yet renders no progress bar', () => {
    render(<ExportLogView logs={[]} running={false} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  // Negative — contrast: once a job has a progress value, the bar renders
  // between the title and the level-filter capsules, reflecting that value —
  // labeled with the actual batch in flight, not a generic "Exporting…".
  it('(negative) a running job with a live progress value renders the bar at that value', () => {
    render(
      <ExportLogView
        logs={[{ ts: '00:00:01', level: 'INFO', msg: 'Starting…' }]}
        running
        progress={45}
        jobStatus="running"
      />
    );
    const bar = screen.getByRole('progressbar', { name: 'Export progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('Assets & global fields')).toBeInTheDocument();
  });

  it('(positive) progress updates live as the job advances through batches', () => {
    const { rerender } = render(<ExportLogView logs={[]} running progress={25} jobStatus="running" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    rerender(<ExportLogView logs={[]} running progress={80} jobStatus="running" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });

  // Negative — contrast: a finished job freezes the bar at its final value
  // and swaps the label/color to reflect completion, rather than disappearing.
  it('(negative) a succeeded job shows "Exported successfully" instead of the running label', () => {
    render(<ExportLogView logs={[]} running={false} progress={100} jobStatus="succeeded" />);
    expect(screen.getByText('Exported successfully')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.queryByText('Exporting…')).toBeNull();
  });

  it('(negative) a failed job shows "Export failed" rather than the running label', () => {
    render(<ExportLogView logs={[]} running={false} progress={62} jobStatus="failed" />);
    expect(screen.getByText('Export failed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
  });

  // Regression: the design's status row pairs the % chip with a live elapsed-
  // time clock — this locks in that both render together once a run exists,
  // rather than just the bare percentage.
  it('(positive) a run in progress shows an elapsed-time clock next to the status row', () => {
    render(<ExportLogView logs={[]} running progress={45} jobStatus="running" />);
    expect(screen.getByText(/^\d+(\.\d)?s$/)).toBeInTheDocument();
  });

  // Negative — before any run, there's no elapsed clock (nothing to time yet).
  it('(negative) no elapsed-time clock renders before any run has happened', () => {
    render(<ExportLogView logs={[]} running={false} />);
    expect(screen.queryByText(/^\d+(\.\d)?s$/)).toBeNull();
  });
});
