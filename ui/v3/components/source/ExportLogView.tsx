import { FC, useEffect, useMemo, useRef, useState } from 'react';

import { JobLogLine, LogLevel } from '../../store/slice/source.slice';

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Mirrors the real backend batch boundaries in
 * api/v3/services/export.service.ts (`setProgress` calls) — each threshold is
 * the % at which that batch finishes, so the label always names the batch
 * actually in flight rather than a generic "Exporting…". */
const STAGES: { at: number; label: string }[] = [
  { at: 15, label: 'Connecting to source' },
  { at: 40, label: 'Reading content types' },
  { at: 65, label: 'Assets & global fields' },
  { at: 82, label: 'Reading entries' },
  { at: 92, label: 'Writing export bundle' },
  { at: 100, label: 'Building content graph' },
];

const stageIndexFor = (pct: number): number => {
  const i = STAGES.findIndex((s) => pct < s.at);
  return i === -1 ? STAGES.length - 1 : i;
};

/** "Done"/"succeeded" deliberately stays inside the violet family (darker,
 * settled violet-700) rather than the generic green --success token — this
 * panel is entirely violet-themed, and a bright green stage/bar reads as an
 * unrelated design system leaking in. Red is kept for --danger/failed since
 * that contrast is meaningful (a real error), not just decorative. */
const DONE_COLOR = 'var(--violet-700, #6427D1)';

const STATUS_COLOR: Record<JobStatus, string> = {
  queued: 'var(--text-subtle)',
  running: 'var(--brand-strong)',
  succeeded: DONE_COLOR,
  failed: 'var(--danger)',
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  DEBUG: 'var(--text-subtle)',
  INFO: 'var(--text-body)',
  WARN: 'var(--warning)',
  ERROR: 'var(--danger)',
  SUCCESS: 'var(--success)',
};

const TABS: { key: 'all' | LogLevel; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'INFO', label: 'Info' },
  { key: 'DEBUG', label: 'Debug' },
  { key: 'ERROR', label: 'Error' },
];

/**
 * Live export/extract log console — streams real log lines from the backend
 * job as it runs (timestamp, level, message), auto-scrolling, with level
 * filter tabs. Mirrors the Claude Design "Content Map and Audit" log viewer.
 */
interface ExportLogViewProps {
  logs: JobLogLine[];
  running: boolean;
  /** 0–100, relayed live from the backend job as it advances through its
   * export batches. Undefined before any export has started this session. */
  progress?: number;
  jobStatus?: JobStatus;
}

/** Formats live elapsed time the way the design's clock chip does — sub-10s
 * runs keep one decimal (so a ~1s run doesn't read as a frozen "1s"), longer
 * ones round to whole seconds, and anything over a minute switches to m/s. */
const formatElapsed = (ms: number): string => {
  const s = ms / 1000;
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
};

const ClockIcon: FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
  </svg>
);

const ExportLogView: FC<ExportLogViewProps> = ({ logs, running, progress, jobStatus }) => {
  const [filter, setFilter] = useState<'all' | LogLevel>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => (filter === 'all' ? logs : logs.filter((l) => l.level === filter)),
    [logs, filter]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el && running) el.scrollTop = el.scrollHeight;
  }, [logs, running]);

  // Live elapsed time for the clock chip — starts on the false→true running
  // transition, ticks while running, and freezes at its last value once the
  // job finishes (rather than resetting or continuing to climb).
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef<number | null>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (running && !wasRunning.current) {
      startedAt.current = performance.now();
      setElapsedMs(0);
    }
    wasRunning.current = running;
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current != null) setElapsedMs(performance.now() - startedAt.current);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  // The backend only reports progress at a handful of real batch boundaries
  // (see STAGES), so the raw value jumps straight from e.g. 35 to 65 instead
  // of climbing steadily. Tweening the on-screen number/bar between those
  // jumps is what actually makes it read as "live" rather than stepped.
  const [displayPct, setDisplayPct] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef<number>();
  const initialized = useRef(false);

  useEffect(() => {
    if (progress === undefined) return;
    const target = Math.max(0, Math.min(100, progress));

    if (!initialized.current) {
      // First time this run has a progress value (e.g. mounting mid-poll) —
      // snap instead of animating up from 0.
      initialized.current = true;
      displayRef.current = target;
      setDisplayPct(target);
      return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // A backward jump (a fresh run starting over) snaps instantly too —
    // only forward motion animates, so it never looks like it's undoing.
    const start = target < displayRef.current ? target : displayRef.current;
    if (start === target) {
      displayRef.current = target;
      setDisplayPct(target);
      return;
    }

    const startTime = performance.now();
    const duration = 650;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = start + (target - start) * eased;
      displayRef.current = val;
      setDisplayPct(val);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress]);

  // Real batch data once a run has happened this session — drives both the
  // thin top-edge strip and the status row (dot, label, % chip, clock).
  const pct = progress !== undefined ? Math.max(0, Math.min(100, progress)) : 0;
  const stageIndex = stageIndexFor(pct);
  const currentLabel =
    jobStatus === 'succeeded' ? 'Exported successfully'
      : jobStatus === 'failed' ? 'Export failed'
        : jobStatus === 'queued' ? 'Queued…'
          : STAGES[stageIndex]?.label ?? 'Exporting…';
  const statusColor = jobStatus ? STATUS_COLOR[jobStatus] : 'var(--brand-strong)';
  const isRunning = jobStatus !== 'succeeded' && jobStatus !== 'failed';
  const barColor = jobStatus === 'failed' ? 'var(--danger)' : jobStatus === 'succeeded' ? DONE_COLOR : 'var(--brand-strong)';

  return (
    <div>
      {/* thin top-edge progress strip — flush with the card's own top edge
          (the card wrapping this component is unpadded + overflow:hidden for
          exactly this reason), matching the Claude Design reference rather
          than a padded, boxed meter sitting inside the content. */}
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-label="Export progress"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 3, background: 'var(--surface-sunken)' }}
        >
          <div
            className={isRunning ? 'v3-progress-fill--running' : undefined}
            style={{
              height: '100%', width: `${displayPct}%`,
              background: isRunning ? undefined : barColor,
              transition: 'background .2s ease',
            }}
          />
        </div>
      )}

      <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {progress !== undefined ? (
          <>
            <span
              style={{
                width: 8, height: 8, borderRadius: '50%', flex: 'none', background: statusColor,
                animation: isRunning ? 'v3-pulse 1.4s ease-in-out infinite' : undefined,
              }}
            />
            <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>{currentLabel}</div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)', background: barColor, borderRadius: 'var(--radius-pill)', padding: '3px 9px', transition: 'background .2s ease' }}>
              {Math.round(displayPct)}%
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              <ClockIcon />{formatElapsed(elapsedMs)}
            </span>
          </>
        ) : (
          <>
            <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--brand-subtle)', color: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Activity log</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nothing has run yet</div>
            </div>
          </>
        )}
      </div>

      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <span
              key={t.key}
              role="button"
              onClick={() => setFilter(t.key)}
              style={{
                fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                background: filter === t.key ? 'var(--brand-strong)' : 'var(--surface-sunken)',
                color: filter === t.key ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        style={{ maxHeight: 300, minHeight: 240, overflowY: 'auto', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}
      >
        {visible.length === 0 && logs.length === 0 && (
          <div style={{ padding: '34px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, color: 'var(--text-subtle)', textAlign: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.5 }}><path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Waiting to start</div>
            <div style={{ fontSize: 12, maxWidth: 320 }}>
              Configure the source, then press <b style={{ color: 'var(--text-body)' }}>Start export</b> to watch each stage stream here.
            </div>
          </div>
        )}
        {visible.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '2px 0', fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--text-subtle)', flex: 'none' }}>{l.ts}</span>
            <span style={{ flex: 'none', width: 62, fontWeight: 700, color: LEVEL_COLOR[l.level] }}>{l.level}</span>
            <span style={{ flex: 1, minWidth: 0, color: 'var(--text-body)', wordBreak: 'break-word' }}>{l.msg}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

export default ExportLogView;
