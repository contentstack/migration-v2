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
  it('(negative) a succeeded job shows "Complete" at 100% instead of the running label', () => {
    render(<ExportLogView logs={[]} running={false} progress={100} jobStatus="succeeded" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.queryByText('Exporting…')).toBeNull();
  });

  it('(negative) a failed job shows "Failed" rather than the running label', () => {
    render(<ExportLogView logs={[]} running={false} progress={62} jobStatus="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
  });

  // The stage stepper gives each real backend batch boundary its own dot —
  // stages already passed are "done", the batch in flight is "active", and
  // batches not yet reached are "upcoming".
  it('(stepper, positive) stages before the current progress are marked done and the current one active', () => {
    render(<ExportLogView logs={[]} running progress={45} jobStatus="running" />);
    const stages = screen.getAllByRole('listitem');
    expect(stages).toHaveLength(6);
    expect(stages[0]).toHaveAttribute('data-state', 'done'); // "Connecting to source" (at 15)
    expect(stages[1]).toHaveAttribute('data-state', 'done'); // "Reading content types" (at 40)
    expect(stages[2]).toHaveAttribute('data-state', 'active'); // "Assets & global fields" (at 65)
    expect(stages[3]).toHaveAttribute('data-state', 'upcoming');
  });

  // Negative — contrast: a failed job marks its current stage "failed" (not
  // "active"/"done"), while every stage genuinely completed beforehand stays
  // "done" rather than the whole stepper flattening to an error state.
  it('(stepper, negative) a failed job marks only the in-flight stage as failed, earlier stages stay done', () => {
    render(<ExportLogView logs={[]} running={false} progress={70} jobStatus="failed" />);
    const stages = screen.getAllByRole('listitem');
    expect(stages[0]).toHaveAttribute('data-state', 'done');
    expect(stages[1]).toHaveAttribute('data-state', 'done');
    expect(stages[2]).toHaveAttribute('data-state', 'done');
    expect(stages[3]).toHaveAttribute('data-state', 'failed'); // "Reading entries" (at 82) — the batch in flight at 70%
    expect(stages[4]).toHaveAttribute('data-state', 'upcoming');
  });

  it('(stepper, positive) a succeeded job marks every stage done', () => {
    render(<ExportLogView logs={[]} running={false} progress={100} jobStatus="succeeded" />);
    const stages = screen.getAllByRole('listitem');
    expect(stages.every((s) => s.getAttribute('data-state') === 'done')).toBe(true);
  });
});
