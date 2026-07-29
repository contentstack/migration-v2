import { FC, useRef, useState } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions } from '../../store/slice/source.slice';
import { startExportAndPoll, uploadFile } from '../../store/thunks/source.thunks';
import { forcedKeys, toggleModule } from '../../utils/moduleSelection';

const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 };

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

  const reset = () => {
    dispatch(sourceActions.clearFile());
    setPicked(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        aria-label="Migration file"
        style={{ display: 'none' }}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      {!file.fileName ? (
        <div
          role="button"
          onClick={() => inputRef.current?.click()}
          style={{ border: '1.5px dashed #c4b5fd', borderRadius: 10, padding: '26px 16px', textAlign: 'center', cursor: 'pointer', background: '#faf5ff' }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Drop a migration file or click to browse</div>
          <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 2 }}>Accepts a Contentstack export bundle (.zip)</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid #d1d5db', borderRadius: 8, padding: '11px 13px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{file.fileName}</div>
            <div style={{ fontSize: 11.5, color: '#6b7280' }}>
              {((file.sizeBytes ?? 0) / (1024 * 1024)).toFixed(1)} MB · selected just now
            </div>
          </div>
          {!file.validated && (
            <button type="button" aria-label="Remove file" onClick={reset} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', fontSize: 18 }}>
              ×
            </button>
          )}
        </div>
      )}

      {file.validated && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '9px 12px', background: '#f9fafb', fontSize: 12.5, fontWeight: 800, borderBottom: '1px solid #e5e7eb' }}>
            What's in this file
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {file.manifest.map((r) => (
              <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280' }}>{r.name}</span>
                <b>{r.count}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      {file.validated && (
        <div>
          <label style={label}>What do you want to import?</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['all', 'specific'] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                aria-pressed={file.scope === sc}
                onClick={() => dispatch(sourceActions.setFileField({ field: 'scope', value: sc }))}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', border: `1.5px solid ${file.scope === sc ? '#7c3af0' : '#e5e7eb'}`, background: file.scope === sc ? '#f5f3ff' : '#fff' }}
              >
                {sc === 'all' ? 'Everything in this file' : 'Specific modules'}
              </button>
            ))}
          </div>
        </div>
      )}

      {file.validated && specific && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {file.modules.map((m) => {
            const checked = file.selectedModules.includes(m.key);
            const isForced = forced.has(m.key);
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                <input
                  type="checkbox"
                  aria-label={m.label}
                  checked={checked}
                  disabled={isForced}
                  onChange={() =>
                    dispatch(sourceActions.setFileField({
                      field: 'selectedModules',
                      value: toggleModule(file.modules, file.selectedModules, m.key),
                    }))
                  }
                />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {m.label}
                  {isForced && <i style={{ fontStyle: 'normal', fontSize: 10.5, fontWeight: 700, color: '#9ca3af', marginLeft: 6 }}>required by entries</i>}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', borderRadius: 999, padding: '2px 9px' }}>{m.count}</span>
              </label>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {file.validated ? (
          <>
            <button type="button" onClick={reset} disabled={running} style={{ flex: 1, padding: '11px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Upload another file
            </button>
            <button
              type="button"
              onClick={() => dispatch(startExportAndPoll(projectId))}
              disabled={!canProceed || running}
              style={{ flex: 1, padding: '11px 12px', borderRadius: 8, border: 'none', cursor: !canProceed || running ? 'not-allowed' : 'pointer', background: !canProceed || running ? '#c4b5fd' : '#7c3af0', color: '#fff', fontWeight: 700 }}
            >
              {running ? 'Building…' : 'Build content graph'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => picked && dispatch(uploadFile(picked))}
            disabled={!picked || running}
            style={{ flex: 1, padding: '11px 12px', borderRadius: 8, border: 'none', cursor: !picked || running ? 'not-allowed' : 'pointer', background: !picked || running ? '#c4b5fd' : '#7c3af0', color: '#fff', fontWeight: 700 }}
          >
            {running ? 'Validating…' : 'Extract & validate'}
          </button>
        )}
      </div>
    </div>
  );
};

export default FilePanel;
