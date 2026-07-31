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

const CheckIcon: FC = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const CrossIcon: FC = () => (
  <svg width="7" height="7" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></svg>
);

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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--brand-subtle)', color: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-strong)' }}>Activity log</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {running ? 'Streaming live…' : logs.length ? 'Last run' : 'Nothing has run yet'}
          </div>
        </div>
        {running && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-strong)', animation: 'v3-spin 1.1s ease-in-out infinite alternate' }} />
        )}
      </div>

      {progress !== undefined && (() => {
        const pct = Math.max(0, Math.min(100, progress));
        const stageIndex = stageIndexFor(pct);
        const stageState = (i: number): 'done' | 'active' | 'failed' | 'upcoming' => {
          if (jobStatus === 'succeeded') return 'done';
          if (jobStatus === 'failed') return i < stageIndex ? 'done' : i === stageIndex ? 'failed' : 'upcoming';
          if (i < stageIndex) return 'done';
          if (i === stageIndex) return 'active';
          return 'upcoming';
        };
        const currentLabel =
          jobStatus === 'succeeded' ? 'Complete'
            : jobStatus === 'failed' ? 'Failed'
              : jobStatus === 'queued' ? 'Queued…'
                : STAGES[stageIndex]?.label ?? 'Exporting…';
        const statusColor = jobStatus ? STATUS_COLOR[jobStatus] : 'var(--brand-strong)';
        const badgeColor = jobStatus === 'failed' ? 'var(--danger)' : jobStatus === 'succeeded' ? DONE_COLOR : 'var(--brand-strong)';
        const prevAt = (i: number) => (i === 0 ? 0 : STAGES[i - 1].at);
        // Each stage owns its own segment of the meter — fully filled once
        // passed, proportionally filled mid-flight (so the segment currently
        // in progress visibly grows rather than snapping straight to full),
        // empty until reached.
        const segmentFill = (i: number): number => {
          if (jobStatus === 'succeeded') return 100;
          if (i < stageIndex) return 100;
          if (i > stageIndex) return 0;
          const span = STAGES[i].at - prevAt(i);
          return span <= 0 ? 100 : Math.max(0, Math.min(100, ((pct - prevAt(i)) / span) * 100));
        };

        return (
          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: statusColor }}>{currentLabel}</span>
            </div>

            <div
              role="progressbar"
              aria-label="Export progress"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ position: 'relative', paddingTop: 24 }}
            >
              {/* percentage callout that rides along the leading edge, like a
                  tooltip pinned to the fill — the "live" cue reads at a glance
                  instead of a static number parked at one end. */}
              <div
                style={{
                  position: 'absolute', top: 0, left: `clamp(15px, ${pct}%, calc(100% - 15px))`,
                  transform: 'translateX(-50%)', transition: 'left .4s cubic-bezier(.4,0,.2,1)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1,
                }}
              >
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-mono)',
                  letterSpacing: '.01em', background: badgeColor, borderRadius: 6, padding: '3px 7px',
                  boxShadow: 'var(--shadow-sm)', whiteSpace: 'nowrap', transition: 'background .25s ease',
                }}>
                  {Math.round(pct)}%
                </span>
                <span style={{ width: 7, height: 7, background: badgeColor, transform: 'rotate(45deg)', marginTop: -4, borderRadius: 1, transition: 'background .25s ease' }} />
              </div>

              {/* segmented meter — one rounded pill per real backend batch
                  boundary, same-ramp track/fill (violet throughout). */}
              <div role="list" aria-label="Export stages" style={{ display: 'flex', gap: 3 }}>
                {STAGES.map((s, i) => {
                  const state = stageState(i);
                  const fillPct = segmentFill(i);
                  const fillColor = state === 'failed' ? 'var(--danger)' : state === 'done' ? DONE_COLOR : 'var(--brand-strong)';
                  return (
                    <div
                      key={s.label}
                      role="listitem"
                      aria-label={`${s.label}: ${state}`}
                      data-state={state}
                      title={s.label}
                      style={{
                        flex: 1, height: 10, borderRadius: 5, position: 'relative', overflow: 'hidden',
                        background: 'var(--surface-sunken)',
                      }}
                    >
                      <div
                        className={state === 'active' ? 'v3-progress-fill--running' : undefined}
                        style={{
                          height: '100%', width: `${fillPct}%`, borderRadius: 5, position: 'relative', overflow: 'hidden',
                          background: state === 'active' ? undefined : fillColor,
                          boxShadow: state === 'active' ? '0 0 8px 1px color-mix(in oklch, var(--brand-strong) 55%, transparent)' : 'none',
                          transition: 'width .4s cubic-bezier(.4,0,.2,1), background .2s ease',
                        }}
                      />
                      {(state === 'done' || state === 'failed') && (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {state === 'done' ? <CheckIcon /> : <CrossIcon />}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

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
  );
};

export default ExportLogView;
