import { FC, useEffect } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions, SourceMode } from '../../store/slice/source.slice';
import { loadPersistedGraph } from '../../store/thunks/source.thunks';
import StackPanel from './StackPanel';
import FilePanel from './FilePanel';
import GraphView from './GraphView';

const badgeFor = (
  running: boolean,
  jobStatus?: string,
  hasGraph?: boolean
): { label: string; tone: string } => {
  if (running || jobStatus === 'running' || jobStatus === 'queued')
    return { label: 'Reading…', tone: '#b45309' };
  if (jobStatus === 'failed') return { label: 'Failed', tone: '#b91c1c' };
  if (hasGraph || jobStatus === 'succeeded') return { label: 'Ready', tone: '#15803d' };
  return { label: 'Not started', tone: '#6b7280' };
};

const SourcePanel: FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useV3Dispatch();
  const { mode, stack, file, running, jobStatus, graph, error } = useV3Selector((s) => s.source);

  // UC-4 / TC_SRC_037 — restore a previously-persisted graph on return.
  useEffect(() => {
    if (!graph && projectId) dispatch(loadPersistedGraph(projectId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = badgeFor(running, jobStatus, !!graph);
  const sourceName =
    mode === 'stack'
      ? stack.stackApiKey || 'No stack selected'
      : file.fileName || 'No file selected';

  const seg = (m: SourceMode, text: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => dispatch(sourceActions.setMode(m))}
      style={{
        flex: 1,
        padding: '8px 12px',
        border: 'none',
        cursor: 'pointer',
        borderRadius: 6,
        fontWeight: 600,
        background: mode === m ? '#fff' : 'transparent',
        boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,.12)' : 'none',
        color: mode === m ? '#111827' : '#6b7280',
      }}
    >
      {text}
    </button>
  );

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: '#7c3af0' }}>
            Source
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{sourceName}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {mode === 'stack' ? 'Live Contentstack stack' : 'Contentstack export bundle'}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: badge.tone, borderRadius: 999, padding: '3px 10px' }}>
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3, maxWidth: 360 }}>
        {seg('stack', 'From a stack')}
        {seg('file', 'From a file')}
      </div>

      {error && <div style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}

      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}>
        {mode === 'stack' ? <StackPanel projectId={projectId} /> : <FilePanel projectId={projectId} />}
      </div>

      <div style={{ marginTop: 16, padding: 16, border: '1px solid #e5e7eb', borderRadius: 10 }}>
        {graph ? (
          <GraphView graph={graph as any} />
        ) : (
          <div style={{ color: '#6b7280', fontSize: 12.5, textAlign: 'center', padding: '24px 0' }}>
            Relationship between content types will be shown here once the export completes.
          </div>
        )}
      </div>
    </div>
  );
};

export default SourcePanel;
