import { FC, useCallback, useEffect } from 'react';

import { useV3Dispatch, useV3Selector } from '../../store/hooks';
import { canProceed, destinationActions, destStackLabel } from '../../store/slice/destination.slice';
import {
  loadDestRegions,
  loadPersistedDestination,
  loadSourceContext,
  proceedToContentMapping,
  selectDestOrg,
  selectDestRegion,
  selectDestStack,
} from '../../store/thunks/destination.thunks';
import BranchMapping from './BranchMapping';
import CreateStackModal from './CreateStackModal';
import DestinationSummary from './DestinationSummary';
import DestRegionLoginModal from './DestRegionLoginModal';
import ImportAuthCards from './ImportAuthCards';
import LanguageMapping from './LanguageMapping';
import StackContents from './StackContents';
import { useRegisterStepGate } from '../wizard/StepGateContext';
// Shared themed dropdown, introduced by cs-source-selection. Reused here rather
// than duplicated (v3-internal reuse). Worth relocating to a shared folder —
// see tdd.md — but that touches Source's imports, so left where its owner put it.
import V3Select from '../source/V3Select';

/** Sentinel option that opens the create-stack modal instead of selecting a stack. */
const CREATE_SENTINEL = '__create__';

/**
 * v3 Destination panel (Content Map & Audit — Destination panel).
 *
 * Region → Organization → Stack (existing, or created via the modal) → import
 * authentication → branch mapping → language mapping → Proceed. Gated on every
 * required field AND the persisted source being ready (FR-6.1), re-evaluated
 * live so a source that becomes ready while this panel is open enables Proceed
 * without a reload (EC-6).
 */
const DestinationPanel: FC<{ projectId: string }> = ({ projectId }) => {
  const dispatch = useV3Dispatch();
  const d = useV3Selector((s) => s.destination);

  useEffect(() => {
    if (!d.regions.length) dispatch(loadDestRegions());
    // A project id is all these reads need since the organization segment left
    // their paths (cs-project-dashboard FR-9.13).
    if (projectId) {
      dispatch(loadSourceContext(projectId));
      dispatch(loadPersistedDestination(projectId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stackLabel = destStackLabel(d);
  const ready = canProceed(d);

  /*
    Wizard-chrome wiring (migration-wizard-chrome trd.md TR-9). This panel
    publishes its gate so the persistent footer's action and the in-panel button
    below are the same decision and the same work — they cannot disagree, and
    the shared re-entrancy guard means a double click cannot mint two management
    tokens. Rendered outside the chrome (as in this panel's unit tests) the
    registration is a no-op and `runProceed` calls the work directly.
  */
  const advance = useCallback(
    async () => (await dispatch(proceedToContentMapping(projectId))) === true,
    [dispatch, projectId]
  );
  const runProceed = useRegisterStepGate({
    satisfied: ready && !d.saving,
    blockedReason: !d.source.ready ? 'Prepare the source first to continue.' : undefined,
    advance,
  });

  const regionMismatch = !!d.region && !!d.source.region && d.region !== d.source.region;
  const srcRegionLabel = d.regions.find((r) => r.value === d.source.region)?.label || d.source.region;
  const destRegionLabel = d.regions.find((r) => r.value === d.region)?.label || d.region;

  const onStackChange = (v: string) => {
    if (v === CREATE_SENTINEL) {
      dispatch(destinationActions.openCreateStack());
      return;
    }
    if (!v) return;
    dispatch(selectDestStack(v));
  };

  const orgPlaceholder = !d.region
    ? 'Select a region first'
    : d.orgs.length === 0
      ? 'No organizations found'
      : 'Select an organization…';

  // "Create a new stack" is always the last entry once an org is chosen (FR-1.3).
  const stackOptions = d.org
    ? [...d.stacks, { value: CREATE_SENTINEL, label: '+ Create a new stack' }]
    : d.stacks;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <DestRegionLoginModal />
      <CreateStackModal />

      <div style={{ marginBottom: 14 }}>
        <div className="v3-eyebrow" style={{ marginBottom: 3 }}>
          Migration setup
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-.02em',
            margin: '0 0 2px',
            color: 'var(--text-strong)',
          }}
        >
          Set up destination
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13.5 }}>
          Create the new stack your content will be copied into.
        </p>
      </div>

      <div className="v3-card" style={{ overflow: 'hidden' }}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 13,
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(160deg, var(--success-surface), transparent 75%)',
          }}
        >
          <div style={{ position: 'relative', width: 56, height: 46, flex: 'none' }}>
            <div style={{ position: 'absolute', left: 5, top: 16, width: 46, height: 28, borderRadius: 8, background: 'var(--success-surface)', border: '1px solid var(--border-subtle)' }} />
            <div style={{ position: 'absolute', left: 2, top: 8, width: 52, height: 28, borderRadius: 8, background: 'color-mix(in oklch, var(--success) 22%, var(--surface-card))', border: '1px solid var(--border-subtle)' }} />
            <div style={{ position: 'absolute', left: 0, top: 0, width: 56, height: 28, borderRadius: 8, background: 'var(--success)', boxShadow: '0 4px 12px color-mix(in oklch, var(--success) 40%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 3 21 7.5 12 12 3 7.5 12 3ZM3 12l9 4.5L21 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 15v6M15 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--success)' }}>
              Destination
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-strong)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stackLabel || 'No stack selected'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
              {[destRegionLabel, d.orgs.find((o) => o.value === d.org)?.label]
                .filter(Boolean)
                .join(' · ') || 'Choose a region and organization'}
            </div>
          </div>
          {/* Matches the design system's Badge (tone=neutral|success, dot): 24px
              pill, 12px/600 text, 0 10px padding. */}
          <span
            style={{
              height: 24,
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: ready ? 'var(--success)' : 'var(--text-body)',
              background: ready ? 'var(--success-surface)' : 'var(--surface-sunken)',
              borderRadius: 'var(--radius-pill)',
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />
            {ready ? 'Ready' : 'Idle'}
          </span>
        </div>

        <div style={{ padding: 20, display: 'flex', gap: 22, flex: 1, width: '100%', alignItems: 'stretch', flexWrap: 'wrap' }}>
          {/* form column */}
          <div style={{ flex: 1, minWidth: 340, maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="v3-label" htmlFor="v3-dest-region">
                Region *
              </label>
              <V3Select
                id="v3-dest-region"
                ariaLabel="Region"
                value={d.region}
                placeholder="Select a region…"
                options={d.regions}
                onChange={(v) => dispatch(selectDestRegion(v))}
              />
            </div>

            <div>
              <label className="v3-label" htmlFor="v3-dest-org">
                Organization *
              </label>
              <V3Select
                id="v3-dest-org"
                ariaLabel="Organization"
                value={d.org}
                placeholder={orgPlaceholder}
                options={d.orgs}
                disabled={!d.region}
                onChange={(v) => dispatch(selectDestOrg(v))}
              />
            </div>

            <div>
              <label className="v3-label" htmlFor="v3-dest-stack">
                Stack *
              </label>
              <V3Select
                id="v3-dest-stack"
                ariaLabel="Stack"
                value={d.stackApiKey}
                placeholder={d.org ? 'Select a stack…' : 'Select an organization first'}
                options={stackOptions}
                disabled={!d.org}
                onChange={onStackChange}
              />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 6 }}>
                Pick an existing stack in this organization, or create a new one.
              </div>
            </div>

            <ImportAuthCards />
            <BranchMapping />
            <LanguageMapping />

            <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {regionMismatch && (
                <div
                  data-testid="cross-region-banner"
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    background: 'var(--info-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                  }}
                >
                  <span style={{ color: 'var(--info)', flex: 'none', marginTop: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div style={{ fontSize: 11.5, color: 'var(--text-body)', lineHeight: 1.45 }}>
                    <b style={{ color: 'var(--text-strong)' }}>Cross-region migration.</b> Content
                    moves from <b>{srcRegionLabel}</b> to <b>{destRegionLabel}</b>. Confirm
                    data-residency requirements first.
                  </div>
                </div>
              )}

              {d.error && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    color: 'var(--danger)',
                    background: 'var(--danger-surface)',
                    border: '1px solid var(--danger)',
                    borderRadius: 'var(--radius-md)',
                    padding: '9px 12px',
                    fontSize: 12.5,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {d.error}
                </div>
              )}

              <button
                type="button"
                className="v3-btn"
                disabled={!ready || d.saving}
                onClick={() => runProceed()}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                Proceed to content mapping
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {!d.source.ready && (
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center' }}>
                  Prepare the source first to continue.
                </div>
              )}
            </div>
          </div>

          {/* sidebar */}
          <div style={{ flex: 1, minWidth: 300, maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StackContents />
            <DestinationSummary />
            <div
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-strong)' }}>
                After you proceed
              </div>
              {[
                { n: '1', b: 'Audit', t: ' — review what will migrate and what’s excluded.' },
                { n: '2', b: 'Map content', t: ' — align content types and fields.' },
                { n: '3', b: 'Preview & migrate', t: ' — copy content into the new stack.' },
              ].map((s) => (
                <div key={s.n} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flex: 'none',
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--brand-subtle)',
                      color: 'var(--brand-strong)',
                      fontSize: 11,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {s.n}
                  </span>
                  <div style={{ fontSize: 12, color: 'var(--text-body)', lineHeight: 1.45 }}>
                    <b style={{ color: 'var(--text-strong)' }}>{s.b}</b>
                    {s.t}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DestinationPanel;
