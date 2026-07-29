import { FC, useEffect, useMemo, useRef, useState } from 'react';

import { JobLogLine, LogLevel } from '../../store/slice/source.slice';

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
const ExportLogView: FC<{ logs: JobLogLine[]; running: boolean }> = ({ logs, running }) => {
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
