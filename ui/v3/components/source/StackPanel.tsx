import { FC, useEffect } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions } from '../../store/slice/source.slice';
import {
  loadRegions,
  loadStackModules,
  selectOrg,
  selectRegion,
  selectStack,
  startExportAndPoll,
} from '../../store/thunks/source.thunks';
import { forcedKeys, toggleModule } from '../../utils/moduleSelection';

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 14,
};
const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#374151',
  display: 'block',
  marginBottom: 5,
};

const StackPanel: FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useV3Dispatch();
  const stack = useV3Selector((s) => s.source.stack);
  const running = useV3Selector((s) => s.source.running);

  useEffect(() => {
    if (!stack.regions.length) dispatch(loadRegions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const specific = stack.scope === 'specific';
  const forced = forcedKeys(stack.modules, stack.selectedModules);
  const canStart =
    !!stack.region &&
    !!stack.org &&
    !!stack.stackApiKey &&
    (!specific || stack.selectedModules.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={label} htmlFor="v3-region">Region *</label>
        <select
          id="v3-region"
          aria-label="Region"
          style={selectStyle}
          value={stack.region}
          onChange={(e) => dispatch(selectRegion(e.target.value))}
        >
          <option value="">Select a region…</option>
          {stack.regions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={label} htmlFor="v3-org">Organization *</label>
        <select
          id="v3-org"
          aria-label="Organization"
          style={selectStyle}
          value={stack.org}
          disabled={!stack.region}
          onChange={(e) => dispatch(selectOrg(e.target.value))}
        >
          <option value="">{stack.region ? 'Select an organization…' : 'Select a region first'}</option>
          {stack.orgs.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={label} htmlFor="v3-stack">Stack *</label>
        <select
          id="v3-stack"
          aria-label="Stack"
          style={selectStyle}
          value={stack.stackApiKey}
          disabled={!stack.org}
          onChange={(e) => dispatch(selectStack(e.target.value))}
        >
          <option value="">{stack.org ? 'Select a stack…' : 'Select an organization first'}</option>
          {stack.stacks.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {stack.stackApiKey && (
          <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 6 }}>
            All content types, entries and assets in this stack will be read.
          </div>
        )}
      </div>

      {stack.stackApiKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: 8, padding: '8px 12px' }}>
          <span style={{ fontSize: 12.5, color: '#6b7280' }}>Branch</span>
          <select
            aria-label="Branch"
            value={stack.branch}
            onChange={(e) => dispatch(sourceActions.setStackField({ field: 'branch', value: e.target.value }))}
            style={{ ...selectStyle, width: 'auto', padding: '5px 8px' }}
          >
            {(stack.branches.length ? stack.branches : [{ value: 'main', label: 'main' }]).map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label style={label}>What do you want to export?</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['whole', 'specific'] as const).map((sc) => (
            <button
              key={sc}
              type="button"
              aria-pressed={stack.scope === sc}
              onClick={() => {
                dispatch(sourceActions.setStackField({ field: 'scope', value: sc }));
                if (sc === 'specific' && !stack.modules.length) dispatch(loadStackModules());
              }}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                border: `1.5px solid ${stack.scope === sc ? '#7c3af0' : '#e5e7eb'}`,
                background: stack.scope === sc ? '#f5f3ff' : '#fff',
              }}
            >
              {sc === 'whole' ? 'Whole stack' : 'Specific module'}
            </button>
          ))}
        </div>
      </div>

      {specific && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {stack.modules.map((m) => {
            const checked = stack.selectedModules.includes(m.key);
            const isForced = forced.has(m.key);
            return (
              <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                <input
                  type="checkbox"
                  aria-label={m.label}
                  checked={checked}
                  disabled={isForced}
                  onChange={() =>
                    dispatch(sourceActions.setStackField({
                      field: 'selectedModules',
                      value: toggleModule(stack.modules, stack.selectedModules, m.key),
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

      <button
        type="button"
        disabled={!canStart || running}
        onClick={() => dispatch(startExportAndPoll(projectId))}
        style={{
          padding: '11px 12px',
          borderRadius: 8,
          border: 'none',
          cursor: !canStart || running ? 'not-allowed' : 'pointer',
          background: !canStart || running ? '#c4b5fd' : '#7c3af0',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {running ? 'Reading source…' : 'Start export'}
      </button>
    </div>
  );
};

export default StackPanel;
