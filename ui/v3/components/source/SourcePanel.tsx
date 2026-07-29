import { FC, useEffect, useRef, useState } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions, SourceMode, LiveCounts } from '../../store/slice/source.slice';
import { loadPersistedGraph } from '../../store/thunks/source.thunks';
import StackPanel from './StackPanel';
import FilePanel from './FilePanel';
import GraphView from './GraphView';
import ExportLogView from './ExportLogView';
import RegionLoginModal from './RegionLoginModal';
import StatTiles from './StatTiles';

const ZERO_COUNTS: LiveCounts = {
  contentTypes: 0,
  assets: 0,
  entries: 0,
  globalFields: 0,
  references: 0,
};

const badgeFor = (running: boolean, jobStatus?: string, hasGraph?: boolean) => {
  if (running || jobStatus === 'running' || jobStatus === 'queued')
    return { label: 'Reading…', bg: 'var(--warning-surface)', fg: 'var(--warning)' };
  if (jobStatus === 'failed') return { label: 'Failed', bg: 'var(--danger-surface)', fg: 'var(--danger)' };
  if (hasGraph || jobStatus === 'succeeded') return { label: 'Ready', bg: 'var(--success-surface)', fg: 'var(--success)' };
  return { label: 'Not started', bg: 'var(--surface-sunken)', fg: 'var(--text-muted)' };
};

const SourcePanel: FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useV3Dispatch();
  const { mode, stack, file, running, jobStatus, jobLogs, jobLiveCounts, graph, error } =
    useV3Selector((s) => s.source);

  const activityRef = useRef<HTMLDivElement>(null);
  const graphColRef = useRef<HTMLDivElement>(null);
  const prevRunning = useRef(false);
  const awaitingGraphScroll = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!graph && projectId) dispatch(loadPersistedGraph(projectId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export just started: the activity log is the main focus while it runs —
  // take the user straight to it. Only fires on the false→true transition
  // (not on every re-render while already running).
  useEffect(() => {
    if (running && !prevRunning.current) {
      awaitingGraphScroll.current = true;
      setFullscreen(false); // don't leave the user stuck viewing a stale graph full-screen
      activityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prevRunning.current = running;
  }, [running]);

  // Export just finished: bring the user to the content graph. Gated on
  // awaitingGraphScroll (only set by an export started THIS session) so
  // restoring a previously-persisted graph on mount does not also scroll.
  useEffect(() => {
    if (graph && awaitingGraphScroll.current) {
      awaitingGraphScroll.current = false;
      graphColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [graph]);

  const badge = badgeFor(running, jobStatus, !!graph);
  const sourceName =
    mode === 'stack' ? stack.stackApiKey || 'No stack selected' : file.fileName || 'No file selected';

  const seg = (m: SourceMode, text: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => dispatch(sourceActions.setMode(m))}
      style={{
        flex: 1, padding: '8px 12px', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
        fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-sans)',
        background: mode === m ? 'var(--surface-card)' : 'transparent',
        boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
        color: mode === m ? 'var(--text-strong)' : 'var(--text-muted)',
      }}
    >
      {text}
    </button>
  );

  const showActivity = running || jobLogs.length > 0;
  const showLiveTiles = !graph && (running || jobStatus === 'queued' || jobStatus === 'running');

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <RegionLoginModal />
      <div style={{ marginBottom: 14 }}>
        <div className="v3-eyebrow" style={{ marginBottom: 3 }}>Migration setup</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 2px', color: 'var(--text-strong)' }}>
          Choose your source
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>
          Read from a live Contentstack stack or an existing export bundle, then preview the content graph.
        </p>
      </div>

      <div className="v3-card" style={{ overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'linear-gradient(160deg, var(--brand-subtle), transparent 75%)' }}>
          <div style={{ position: 'relative', width: 56, height: 46, flex: 'none' }}>
            <div style={{ position: 'absolute', left: 5, top: 16, width: 46, height: 28, borderRadius: 8, background: 'var(--brand-subtle)', border: '1px solid var(--border-subtle)' }} />
            <div style={{ position: 'absolute', left: 2, top: 8, width: 52, height: 28, borderRadius: 8, background: 'var(--violet-200)', border: '1px solid var(--border-subtle)' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: 56, height: 28, borderRadius: 8, background: 'linear-gradient(150deg, var(--violet-500), var(--violet-700))', boxShadow: 'var(--shadow-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.8" /><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" stroke="currentColor" strokeWidth="1.8" /></svg>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="v3-eyebrow">Source</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sourceName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
              {mode === 'stack' ? 'Live Contentstack stack' : 'Contentstack export bundle'}
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: badge.fg, background: badge.bg, borderRadius: 'var(--radius-pill)', padding: '4px 11px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />{badge.label}
          </span>
        </div>

        {/* board: form column + graph column (form column collapses while the graph is fullscreen) */}
        <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
          {!fullscreen && (
            <div style={{ flex: '1 1 460px', minWidth: 320, padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
              <div style={{ display: 'flex', gap: 3, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: 3 }}>
                {seg('stack', 'From a stack')}
                {seg('file', 'From a file')}
              </div>

              {error && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--danger)', background: 'var(--danger-surface)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: 12.5 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  {error}
                </div>
              )}

              {mode === 'stack' ? <StackPanel projectId={projectId} /> : <FilePanel projectId={projectId} />}
            </div>
          )}

          <div
            ref={graphColRef}
            style={{
              flex: fullscreen ? '1 1 100%' : '1 1 420px', minWidth: 320,
              borderLeft: fullscreen ? 'none' : '1px solid var(--border-subtle)',
              background: 'linear-gradient(180deg, var(--brand-subtle), transparent 42%)', padding: 18,
            }}
          >
            {graph ? (
              <GraphView graph={graph as any} fullscreen={fullscreen} onToggleFullscreen={() => setFullscreen((f) => !f)} />
            ) : showLiveTiles ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid var(--border-default)', borderTopColor: 'var(--brand-strong)', borderRadius: '50%', animation: 'v3-spin .7s linear infinite', flex: 'none' }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>Reading source…</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>numbers update as items are discovered</span>
                </div>
                <StatTiles counts={(jobLiveCounts ?? ZERO_COUNTS) as unknown as Record<string, number>} live />
                <div style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
                  The content graph will render here once the export completes — watch the activity log below for live detail.
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', color: 'var(--text-subtle)' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" /><path d="M7 6h5a3 3 0 0 1 3 3v.5M7 18h5a3 3 0 0 0 3-3v-.5" /></svg>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, maxWidth: '28ch', color: 'var(--text-muted)' }}>
                  Relationship between content types will be shown here once the export completes.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* activity log — a separate full-width section below the Source card */}
      {showActivity && (
        <div ref={activityRef} className="v3-card" style={{ marginTop: 16, padding: 18 }}>
          <ExportLogView logs={jobLogs} running={running} />
        </div>
      )}
    </div>
  );
};

export default SourcePanel;
