import { FC, useEffect } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { sourceActions } from '../../store/slice/source.slice';
import {
  loadRegions, loadStackModules, selectOrg, selectRegion, selectStack, startExportAndPoll,
} from '../../store/thunks/source.thunks';
import { forcedKeys, toggleModule } from '../../utils/moduleSelection';

const ScopeCard: FC<{ active: boolean; title: string; sub: string; onClick: () => void }> = ({ active, title, sub, onClick }) => (
  <div onClick={onClick} role="button" style={{
    flex: 1, minWidth: 0, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
    padding: '12px 13px', borderRadius: 'var(--radius-lg)',
    border: `1.5px solid ${active ? 'var(--brand-strong)' : 'var(--border-subtle)'}`,
    background: active ? 'var(--brand-subtle)' : 'var(--surface-card)',
  }}>
    <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${active ? 'var(--brand-strong)' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
      {active && <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--brand-strong)', display: 'block' }} />}
    </span>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 1 }}>{sub}</div>
    </div>
  </div>
);

const ModuleRow: FC<{ label: string; count: number; checked: boolean; forced: boolean; onToggle: () => void }> = ({ label, count, checked, forced, onToggle }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', cursor: forced ? 'not-allowed' : 'pointer', background: checked ? 'var(--brand-subtle)' : 'transparent' }}>
    <input type="checkbox" aria-label={label} checked={checked} disabled={forced} onChange={onToggle}
      style={{ width: 16, height: 16, accentColor: 'var(--brand-strong)' }} />
    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
      {label}{forced && <i style={{ fontStyle: 'normal', fontSize: 10.5, fontWeight: 700, color: 'var(--text-subtle)', marginLeft: 6 }}>required by entries</i>}
    </span>
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', padding: '2px 9px', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
  </label>
);

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
  const canStart = !!stack.region && !!stack.org && !!stack.stackApiKey && (!specific || stack.selectedModules.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      <div>
        <label className="v3-label" htmlFor="v3-region">Region *</label>
        <select id="v3-region" aria-label="Region" className="v3-field" value={stack.region} onChange={(e) => dispatch(selectRegion(e.target.value))}>
          <option value="">Select a region…</option>
          {stack.regions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label className="v3-label" htmlFor="v3-org">Organization *</label>
        <select id="v3-org" aria-label="Organization" className="v3-field" value={stack.org} disabled={!stack.region} onChange={(e) => dispatch(selectOrg(e.target.value))}>
          <option value="">{stack.region ? 'Select an organization…' : 'Select a region first'}</option>
          {stack.orgs.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div>
        <label className="v3-label" htmlFor="v3-stack">Stack *</label>
        <select id="v3-stack" aria-label="Stack" className="v3-field" value={stack.stackApiKey} disabled={!stack.org} onChange={(e) => dispatch(selectStack(e.target.value))}>
          <option value="">{stack.org ? 'Select a stack…' : 'Select an organization first'}</option>
          {stack.stacks.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {stack.stackApiKey && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>All content types, entries and assets in this stack will be read.</div>}
      </div>

      {stack.stackApiKey && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', padding: '9px 12px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', color: 'var(--brand-strong)' }}><path d="M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v1a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Branch</span>
          <select aria-label="Branch" value={stack.branch} onChange={(e) => dispatch(sourceActions.setStackField({ field: 'branch', value: e.target.value }))}
            className="v3-field" style={{ width: 'auto', height: 30, padding: '0 28px 0 10px', marginLeft: 'auto', fontWeight: 700 }}>
            {(stack.branches.length ? stack.branches : [{ value: 'main', label: 'main' }]).map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="v3-label" style={{ margin: 0 }}>What do you want to export?</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <ScopeCard active={!specific} title="Whole stack" sub="Everything in the stack" onClick={() => dispatch(sourceActions.setStackField({ field: 'scope', value: 'whole' }))} />
          <ScopeCard active={specific} title="Specific module" sub="Choose what to include" onClick={() => { dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' })); if (!stack.modules.length) dispatch(loadStackModules()); }} />
        </div>
        {specific && (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 240, overflowY: 'auto' }}>
            {stack.modulesError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', padding: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--danger)' }}>{stack.modulesError}</span>
                <button
                  type="button"
                  onClick={() => dispatch(loadStackModules())}
                  style={{ border: '1px solid var(--border-default)', background: 'var(--surface-card)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--brand-strong)', cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            ) : stack.modulesLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
                <span style={{ width: 13, height: 13, border: '2px solid var(--border-default)', borderTopColor: 'var(--brand-strong)', borderRadius: '50%', animation: 'v3-spin .7s linear infinite' }} />
                Loading modules…
              </div>
            ) : stack.modules.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No modules found.</div>
            ) : (
              stack.modules.map((m) => (
                <ModuleRow key={m.key} label={m.label} count={m.count} checked={stack.selectedModules.includes(m.key)} forced={forced.has(m.key)}
                  onToggle={() => dispatch(sourceActions.setStackField({ field: 'selectedModules', value: toggleModule(stack.modules, stack.selectedModules, m.key) }))} />
              ))
            )}
          </div>
        )}
      </div>

      <button type="button" className="v3-btn" disabled={!canStart || running} onClick={() => dispatch(startExportAndPoll(projectId))}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {running && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.5)', borderTopColor: '#fff', borderRadius: '50%', animation: 'v3-spin .7s linear infinite' }} />}
        {running ? 'Reading source…' : 'Start export'}
      </button>
    </div>
  );
};

export default StackPanel;
