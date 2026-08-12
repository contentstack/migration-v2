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

  /*
    ── The stage caption (Source Export Revamp) ──────────────────────────────

    This component derived its caption from the progress PERCENTAGE against a
    hardcoded STAGES table of the old export pipeline's phase boundaries
    (15 → "Connecting", 40 → "Reading content types", 65 → "Assets & global
    fields", 82 → "Reading entries", …).

    Those boundaries no longer exist. Stack exports now advance
    `10 + (i+1)/total × 65` per completed CLI run, so a whole-stack export sits at
    75% for its entire duration and rendered "Reading entries" the whole time —
    while a content-types-only export walked through "Assets & global fields" and
    "Reading entries" without exporting either. The caption asserted work that was
    not happening.

    The server now sends the caption, because only the job knows which module the
    CLI is on. The percentage table survives ONLY as the fallback for file-mode
    exports, whose phases are unchanged.
  */
  it('(stage, positive) renders the server-provided stage caption instead of guessing from progress', () => {
    render(
      <ExportLogView
        logs={[]}
        running
        progress={75}
        jobStatus="running"
        stage="Exporting global fields"
      />
    );

    expect(screen.getByText('Exporting global fields')).toBeInTheDocument();
    // 75% would previously have rendered "Reading entries" — the exact defect.
    expect(screen.queryByText('Reading entries')).toBeNull();
  });

  /*
    Negative — taxonomy #1 (missing input): with no stage from the server the
    component must still caption the run, not go blank. File-mode exports send no
    stage, and an empty caption would read as a stalled export.
  */
  it('(stage, negative) falls back to a progress-derived caption when the server sends no stage', () => {
    render(<ExportLogView logs={[]} running progress={15} jobStatus="running" />);

    expect(screen.getByText('Reading content types')).toBeInTheDocument();
  });

  /*
    The log cap has to be VISIBLE. A silently truncated log would have someone
    conclude the CLI never printed something it did — the log is the only evidence
    they have about what the export actually did.
  */
  it('(dropped, positive) says how many earlier lines the cap discarded', () => {
    render(
      <ExportLogView
        logs={[{ ts: '00:00:01', level: 'INFO', msg: 'Exported content type: Blog Post' }]}
        running
        progress={50}
        jobStatus="running"
        droppedLogs={1234}
      />
    );

    expect(screen.getByText(/1,?234 earlier line/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): nothing dropped means no notice at all.
    A permanent "0 lines omitted" would train the reader to ignore the one message
    that matters when it is real.
  */
  it('(dropped, negative) shows no truncation notice when nothing was dropped', () => {
    render(
      <ExportLogView
        logs={[{ ts: '00:00:01', level: 'INFO', msg: 'Exported content type: Blog Post' }]}
        running
        progress={50}
        jobStatus="running"
        droppedLogs={0}
      />
    );

    expect(screen.queryByText(/earlier line/i)).toBeNull();
  });
});
