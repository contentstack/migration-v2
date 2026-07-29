import { FC, useRef, useState } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions } from '../../store/slice/source.slice';
import { startExportAndPoll, uploadFile } from '../../store/thunks/source.thunks';
import { forcedKeys, toggleModule } from '../../utils/moduleSelection';

const FilePanel: FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useV3Dispatch();
  const file = useV3Selector((s) => s.source.file);
  const running = useV3Selector((s) => s.source.running);
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);

  const specific = file.scope === 'specific';
  const forced = forcedKeys(file.modules, file.selectedModules);
  const canProceed = file.validated && (!specific || file.selectedModules.length > 0);

  const onPick = (f: File | null) => {
    if (!f) return;
    setPicked(f);
    dispatch(sourceActions.setFileSelected({ fileName: f.name, sizeBytes: f.size }));
  };
  const reset = () => { dispatch(sourceActions.clearFile()); setPicked(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      <input ref={inputRef} type="file" accept=".zip" aria-label="Migration file" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

      <label className="v3-label" style={{ margin: 0 }}>Migration file <span style={{ color: 'var(--danger)' }}>*</span></label>

      {!file.fileName ? (
        <div role="button" onClick={() => inputRef.current?.click()} style={{ border: '1.5px dashed var(--border-brand)', borderRadius: 'var(--radius-lg)', padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--brand-subtle)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--brand-strong)', marginBottom: 7 }}><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>Drop a migration file or click to browse</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 2 }}>Accepts a Contentstack export bundle (.zip)</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '11px 13px', background: 'var(--surface-card)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'var(--brand-subtle)', color: 'var(--brand-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 3v4a1 1 0 0 0 1 1h4M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.fileName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-subtle)' }}>{((file.sizeBytes ?? 0) / (1024 * 1024)).toFixed(1)} MB · selected just now</div>
          </div>
          {!file.validated && (
            <button type="button" aria-label="Remove file" onClick={reset} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      )}

      {file.validated && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-strong)' }}>What's in this file</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-subtle)' }}>
            {file.manifest.map((r) => (
              <div key={r.name} style={{ background: 'var(--surface-card)', padding: '8px 13px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <b style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{r.count}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {file.validated && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="v3-label" style={{ margin: 0 }}>What do you want to import?</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['all', 'specific'] as const).map((sc) => (
              <div key={sc} role="button" onClick={() => dispatch(sourceActions.setFileField({ field: 'scope', value: sc }))}
                style={{ flex: 1, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', padding: '12px 13px', borderRadius: 'var(--radius-lg)', border: `1.5px solid ${file.scope === sc ? 'var(--brand-strong)' : 'var(--border-subtle)'}`, background: file.scope === sc ? 'var(--brand-subtle)' : 'var(--surface-card)' }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${file.scope === sc ? 'var(--brand-strong)' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  {file.scope === sc && <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brand-strong)', display: 'block' }} />}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{sc === 'all' ? 'Everything in this file' : 'Specific modules'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {file.validated && specific && (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
          {file.modules.map((m) => {
            const checked = file.selectedModules.includes(m.key);
            const isForced = forced.has(m.key);
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: isForced ? 'not-allowed' : 'pointer', background: checked ? 'var(--brand-subtle)' : 'transparent' }}>
                <input type="checkbox" aria-label={m.label} checked={checked} disabled={isForced} style={{ width: 16, height: 16, accentColor: 'var(--brand-strong)' }}
                  onChange={() => dispatch(sourceActions.setFileField({ field: 'selectedModules', value: toggleModule(file.modules, file.selectedModules, m.key) }))} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
                  {m.label}{isForced && <i style={{ fontStyle: 'normal', fontSize: 10.5, fontWeight: 700, color: 'var(--text-subtle)', marginLeft: 6 }}>required by entries</i>}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', padding: '2px 9px', fontVariantNumeric: 'tabular-nums' }}>{m.count}</span>
              </label>
            );
          })}
        </div>
      )}

      {file.validated && (
        <button
          type="button"
          aria-label="Remove file"
          onClick={reset}
          disabled={running}
          style={{ alignSelf: 'flex-start', border: 'none', background: 'none', padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: running ? 'not-allowed' : 'pointer', textDecoration: 'underline', opacity: running ? 0.5 : 1 }}
        >
          Remove file
        </button>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {file.validated ? (
          <button type="button" className="v3-btn" onClick={() => dispatch(startExportAndPoll(projectId))} disabled={!canProceed || running} style={{ flex: 1 }}>
            {running ? 'Reading source…' : 'Start export'}
          </button>
        ) : (
          <button type="button" className="v3-btn" onClick={() => picked && dispatch(uploadFile(picked))} disabled={!picked || running} style={{ flex: 1 }}>
            {running ? 'Validating…' : 'Extract & validate'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FilePanel;
