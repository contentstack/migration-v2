import { CSSProperties, FC, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import type { V3Dispatch, V3RootState } from '../../store';
import {
  auditActions,
  resolvedCheckCount,
  AuditCategory,
  AuditCheckView,
  AuditFilter,
} from '../../store/slice/audit.slice';
import { toastActions } from '../../store/slice/toast.slice';
import {
  loadAuditFindings,
  loadAuditItems,
  proceedFromAudit,
  rerunAudit,
} from '../../store/thunks/audit.thunks';
import {
  deriveImpact,
  excludeAllFlagged,
  hasAnyExclusion,
  includeEverything,
  isExcludable,
  isItemExcluded,
  setItemOverride,
  toggleCategory,
} from '../../utils/auditDecisions';
import { WIZARD_STEPS, statusLineFor } from '../wizard/steps';
import { useRegisterStepGate } from '../wizard/StepGateContext';
import { isDestinationComplete } from '../../store/slice/destination.slice';
import { loadPersistedDestination } from '../../store/thunks/destination.thunks';
import AuditImpact from './AuditImpact';
import AuditCategoryCard from './AuditCategoryCard';
import AuditInfoCard from './AuditInfoCard';
import AuditItemsTable from './AuditItemsTable';

/**
 * v3 Audit step panel (cs-audit-report trd.md TR-15, TR-20).
 *
 * Renders exactly one of three states — analyzing, ready, error — DERIVED from `phase`
 * plus `error`, never from a stored flag. Same derive-don't-store discipline the project
 * dashboard uses for status and resume step: a stored view flag is a second source of
 * truth that drifts.
 *
 * The footer is the CHROME's, not this panel's. The panel publishes a step gate — whether
 * it may advance, why not, the work to do, and the status line it alone can resolve — and
 * `WizardFooter` renders it. An earlier version drew its own footer too, which put two
 * "Continue to Destination" buttons on the page: the chrome's registered no gate, so it
 * navigated without persisting anything.
 *
 * All footer copy still comes from the shared wizard step definition rather than from
 * strings here (FR-8.3). feature.md A-6 makes that authoritative because the reference
 * design's own label — "Continue to content mapping" — contradicts its own tracker, which
 * places Destination immediately after Audit.
 */
export interface AuditPanelProps {
  projectId: string;
}

const auditStep = () => WIZARD_STEPS.find((s) => s.id === 'audit')!;

const EXCLUDABLE_ORDER: AuditCategory[] = [
  'unpublishedEntries',
  'unusedAssets',
  'unusedTaxonomies',
];
const INFORMATIONAL_ORDER: AuditCategory[] = ['emptyContentTypes', 'unusedGlobalFields'];

/** Card copy the design specifies. Kept beside the categories they describe. */
const CARD_COPY: Record<AuditCategory, { noun: string; guidance: string }> = {
  unpublishedEntries: {
    noun: 'entries',
    guidance:
      'Never published to any environment — likely drafts. Consider publishing them first, or skip them here.',
  },
  unusedAssets: {
    noun: 'assets',
    guidance: 'No entry references these files. Usually safe to leave behind.',
  },
  emptyContentTypes: {
    noun: 'content types',
    guidance: 'No entries yet — fine to migrate the model.',
  },
  unusedGlobalFields: {
    noun: 'global fields',
    guidance: 'Every global field is referenced. Nothing to do.',
  },
  unusedTaxonomies: {
    noun: 'taxonomies',
    guidance: 'No term in these taxonomies is referenced by any entry. Usually safe to leave behind.',
  },
};

const CATEGORY_TITLE: Record<AuditCategory, string> = {
  unpublishedEntries: 'unpublished entries',
  unusedAssets: 'unused assets',
  emptyContentTypes: 'empty content types',
  unusedGlobalFields: 'unused global fields',
  unusedTaxonomies: 'unused taxonomies',
};

/*
  Styling values are the reference design's own, expressed through this project's tokens
  — which are a byte-for-byte match of the design system's token file, so nothing here is
  a one-off hex. Inline styles rather than a stylesheet because that is the convention
  Source and Destination already follow (36 and 39 style objects); adding CSS classes here
  would introduce a second way of doing the same thing.
*/
/*
  Named `pageShell`, not `page`: the component destructures a `page` NUMBER out of the
  slice for pagination, which shadowed a style const of that name and silently handed
  React the number 1 as a style prop. TypeScript did not catch it because both names were
  in scope legitimately.
*/
const pageShell: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: '22px 24px 72px',
  fontFamily: 'var(--font-sans)',
  color: 'var(--text-body)',
};

const h2Style: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: 'var(--text-strong)',
  letterSpacing: '-.015em',
};

const subtitle: CSSProperties = {
  fontSize: 13.5,
  color: 'var(--text-body)',
  lineHeight: 1.55,
  marginTop: 4,
  maxWidth: 640,
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  margin: '20px 0 10px',
};

const analyzingCard: CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-sm)',
  padding: '30px 26px',
};

const spinner: CSSProperties = {
  width: 22,
  height: 22,
  border: '2.5px solid var(--surface-inset)',
  borderTopColor: 'var(--brand-strong)',
  borderRadius: '50%',
  animation: 'v3-spin .8s linear infinite',
  flex: 'none',
};

/** The running check gets the sunken background and a pulse, as in the design. */
const checkRow = (running: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '13px 14px',
  borderRadius: 'var(--radius-md)',
  background: running ? 'var(--surface-sunken)' : 'transparent',
  // Background-only pulse — see the v3-audit-check-pulse note in theme.css for why this
  // is not the shared v3-pulse.
  animation: running ? 'v3-audit-check-pulse 1.4s ease-in-out infinite' : undefined,
});

const CHECK_STATE_COLOR: Record<AuditCheckView['state'], string> = {
  queued: 'var(--text-subtle)',
  checking: 'var(--brand-stronger)',
  done: 'var(--success)',
  notPresent: 'var(--warning)',
  unavailable: 'var(--warning)',
};

const helperStrip: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: 'var(--text-body)',
  background: 'var(--surface-sunken)',
  borderRadius: 'var(--radius-lg)',
  padding: '11px 15px',
  marginBottom: 22,
};

const infoGrid: CSSProperties = {
  display: 'grid',
  // The design's two columns, but expressed so they collapse to one below ~570px. A hard
  // `1fr 1fr` would keep two columns at 375px, where each card holds a title, a sentence
  // and a pill in about 170px. auto-fit gets the responsive behaviour without a media
  // query, which an inline style object cannot express.
  gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
  gap: 10,
};

const disclosure: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 12.5,
  color: 'var(--text-body)',
  background: 'var(--info-surface)',
  border: '1px solid color-mix(in oklch, var(--info) 25%, transparent)',
  borderRadius: 'var(--radius-lg)',
  padding: '12px 15px',
};

const secondaryButton: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  padding: '0 14px',
  height: 34,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  background: 'var(--surface-card)',
  color: 'var(--text-body)',
  cursor: 'pointer',
};

const CHECK_STATE_LABEL: Record<AuditCheckView['state'], string> = {
  queued: 'Queued',
  checking: 'Checking…',
  done: 'Done',
  notPresent: 'Not present',
  unavailable: 'Unavailable',
};

const AuditPanel: FC<AuditPanelProps> = ({ projectId }) => {
  const dispatch = useDispatch<V3Dispatch>();
  const audit = useSelector((s: V3RootState) => s.audit);
  /*
    Audit freezes with the DESTINATION, not with its own completion — the two steps lock
    together. Until the destination is committed the operator must be able to revise
    include/exclude decisions, which is exactly what they revisit before choosing one.
  */
  const frozen = useSelector((s: V3RootState) => isDestinationComplete(s.destination));
  const {
    phase, error, checks, totals, variantsInspected, decisions,
    tableOpen, filter, search, page, pageCount, total, counts, items, saving,
  } = audit;

  useEffect(() => {
    if (phase === 'idle') dispatch(loadAuditFindings(projectId) as never);
  }, [dispatch, phase, projectId]);

  /*
    Audit's freeze is decided by the DESTINATION document, which is not otherwise fetched
    when the operator lands here directly (a reload, or a link into the wizard). Without
    this the page would render fully editable on a project whose destination is long
    since committed. The thunk is a read-only loader and a no-op when nothing is saved.
  */
  useEffect(() => {
    dispatch(loadPersistedDestination(projectId) as never);
  }, [dispatch, projectId]);

  const impact = useMemo(
    () => deriveImpact(totals?.denominator ?? 0, checks, decisions),
    [totals?.denominator, checks, decisions]
  );

  const step = auditStep();
  const ready = phase === 'ready';
  const analyzing = phase === 'analyzing';
  const failed = phase === 'error';

  const checkById = (id: AuditCategory) => checks.find((c) => c.id === id);

  const setDecisions = (next: typeof decisions) =>
    dispatch(auditActions.setDecisions(next));

  const onToggleCategory = (id: AuditCategory) => {
    const nowExcluded = decisions.categories[id] === 'exclude';
    const next = toggleCategory(decisions, id, nowExcluded ? 'include' : 'exclude');
    setDecisions(next);
    const count = checkById(id)?.count ?? 0;
    dispatch(
      toastActions.show(
        nowExcluded
          ? `Including all ${count} ${CARD_COPY[id].noun} again`
          : `Excluding all ${count} ${CARD_COPY[id].noun}`
      )
    );
  };

  const REVIEW_FILTER: Partial<Record<AuditCategory, AuditFilter>> = {
    unusedAssets: 'assets',
    unpublishedEntries: 'entries',
    unusedTaxonomies: 'taxonomies',
  };

  const onReviewItems = (id: AuditCategory) => {
    const next: AuditFilter = REVIEW_FILTER[id] ?? 'entries';
    dispatch(auditActions.setTableOpen(true));
    dispatch(auditActions.setFilter(next));
    dispatch(loadAuditItems({ projectId, filter: next, q: search, page: 1 }) as never);
  };

  const onToggleItem = (key: string, category: AuditCategory) => {
    if (!isExcludable(category)) return;
    const excluded = isItemExcluded(key, category, decisions);
    setDecisions(setItemOverride(decisions, key, excluded ? 'include' : 'exclude'));
  };

  const anyExclusion = hasAnyExclusion(checks, decisions);

  const onBulk = () => {
    if (anyExclusion) {
      setDecisions(includeEverything());
      dispatch(toastActions.show('Restored everything — nothing excluded'));
      return;
    }
    setDecisions(excludeAllFlagged(checks, decisions));
    const flagged = EXCLUDABLE_ORDER.reduce(
      (n, id) => n + (checkById(id)?.count ?? 0),
      0
    );
    dispatch(toastActions.show(`Excluding all ${flagged} flagged items`));
  };

  // A filter or search change resets to page 1. Keeping the old page would ask the
  // server for one that no longer exists — an empty table for a working filter.
  const onFilter = (next: AuditFilter) => {
    dispatch(auditActions.setFilter(next));
    dispatch(loadAuditItems({ projectId, filter: next, q: search, page: 1 }) as never);
  };

  const onSearch = (raw: string) => {
    // Whitespace alone is not a search: sent as-is it would match nothing and show the
    // no-results copy for what the user experiences as an empty box.
    const next = raw.trim() ? raw : '';
    dispatch(auditActions.setSearch(next));
    dispatch(loadAuditItems({ projectId, filter, q: next, page: 1 }) as never);
  };

  const onPage = (next: number) => {
    dispatch(auditActions.setPage(next));
    dispatch(loadAuditItems({ projectId, filter, q: search, page: next }) as never);
  };

  const statusLine = statusLineFor(step, {
    auditReady: ready,
    excludedCount: impact.excluded,
    migratingCount: impact.migrating,
  });

  /*
    The panel publishes a gate; the CHROME renders the footer. This panel used to
    draw its own footer as well, which put two "Continue to Destination" buttons on
    the page doing different things: the chrome's registered no gate, so it fell
    through to `OPEN_GATE` and navigated without ever calling `proceedFromAudit` —
    silently dropping the user's exclusions on the way to Content mapping.

    `advance` resolves false on a failed persist, which is what stops the chrome
    navigating; the error below is what tells the user why. Decisions are left
    exactly as they were (AC-6.5, EC-11).
  */
  const advance = useCallback(async () => {
    const advanced = (await dispatch(
      proceedFromAudit(projectId) as never
    )) as unknown as boolean;
    if (!advanced) {
      dispatch(
        auditActions.setError('Could not save your audit decisions. Please try again.')
      );
    }
    return advanced;
  }, [dispatch, projectId]);

  useRegisterStepGate({
    // `saving` closes the gate rather than only disabling a button, so a second
    // advance is refused even when the orchestrator is invoked directly.
    satisfied: ready && !saving,
    blockedReason: ready ? undefined : step.blockedExplanation,
    advance,
    statusLine,
  });

  // ───────────────────────── error ─────────────────────────

  if (failed) {
    const retryable = error === 'internal';
    return (
      <div style={pageShell}>
        <h2 style={h2Style}>Source stack health check</h2>
        <div
          style={{
            ...analyzingCard,
            marginTop: 18,
            borderColor: 'var(--danger)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--danger-surface)',
              color: 'var(--danger)',
              fontSize: 18,
            }}
          >
            !
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)' }}>
              We could not read your exported data
            </p>
            <p role="alert" style={{ ...subtitle, marginTop: 4 }}>
              The exported data could not be read, so the audit could not run. Re-export
              your source and the audit will run again automatically.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                style={secondaryButton}
                onClick={() => dispatch(auditActions.reset())}
              >
                Back to Source
              </button>
              {retryable && (
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() => dispatch(loadAuditFindings(projectId) as never)}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────── analyzing ─────────────────────────

  if (analyzing || phase === 'idle') {
    return (
      <div style={pageShell}>
        <h2 style={h2Style}>Source stack health check</h2>
        <p style={{ ...subtitle, marginBottom: 18 }}>
          We are scanning your exported source for content that is usually safe to leave
          behind. Nothing here is changed or deleted — you decide what comes over.
        </p>
        <section style={analyzingCard} aria-label="Analyzing your source export">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}
          >
            <span style={spinner} className="v3-audit-spinner" aria-hidden="true" />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>
              Analyzing your source export…
            </span>
            <span
              style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}
            >
              {resolvedCheckCount(checks)} of 5 checks
            </span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {checks.map((c) => (
              <li
                key={c.id}
                className={c.state === 'checking' ? 'v3-audit-check--running' : undefined}
                style={checkRow(c.state === 'checking')}
              >
                <span
                  style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-strong)' }}
                >
                  {c.label}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    fontWeight: 700,
                    color: CHECK_STATE_COLOR[c.state],
                  }}
                >
                  {CHECK_STATE_LABEL[c.state]}
                </span>
              </li>
            ))}
          </ul>
          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            Runs automatically — no button needed. Results are cached until your source
            export changes.
          </p>
        </section>
      </div>
    );
  }

  // ───────────────────────── ready ─────────────────────────

  const excludableCards = EXCLUDABLE_ORDER.map(checkById).filter(
    (c): c is AuditCheckView => !!c && c.state === 'done' && (c.count ?? 0) > 0
  );

  return (
    <div style={pageShell}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <h2 style={h2Style}>Source stack health check</h2>
          <p style={subtitle}>
            We scanned your exported source for content that is usually safe to leave
            behind. Nothing here is changed or deleted — you decide what comes over.
          </p>
        </div>
        <button
          type="button"
          disabled={frozen}
          onClick={() => {
            // Announced at the click, so the acknowledgement belongs to the interaction
            // rather than to the scan completing (TC_AR_140).
            dispatch(toastActions.show('Re-scanning your source export'));
            dispatch(rerunAudit(projectId) as never);
          }}
          /*
            Muted while frozen so the control does not merely fail silently on click.
            Same tokens the rest of v3 uses for a disabled control.
          */
          style={
            frozen
              ? {
                  ...secondaryButton,
                  color: 'var(--text-subtle)',
                  borderColor: 'var(--border-subtle)',
                  cursor: 'default',
                }
              : secondaryButton
          }
        >
          Re-run audit
        </button>
      </div>

      {/*
        Shown only while frozen. The reason for the lock lives on the NEXT page, so
        without this line a whole page of dead controls reads as a broken audit rather
        than a completed decision. Suppressed before the freeze, where it would be noise.
      */}
      {frozen && (
        <p data-testid="audit-frozen-notice" style={helperStrip}>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>🔒</span>
          <span>
            These choices are locked because your destination stack is already set up. To
            change what comes over, start a new migration.
          </span>
        </p>
      )}

      <AuditImpact impact={impact} />

      <p style={helperStrip}>
        <span aria-hidden="true" style={{ color: 'var(--brand-strong)' }}>✓</span>
        <span>
          <strong>Everything is included by default.</strong> Switch off a group, or
          uncheck a single item, to leave it behind — you can turn anything back on any
          time.
        </span>
      </p>

      <section aria-label="Worth a look">
        <h3 style={{ ...sectionLabel, marginTop: 0 }}>Worth a look</h3>
        {excludableCards.map((c) => (
          <AuditCategoryCard
            key={c.id}
            id={c.id}
            title={`${c.count} ${CATEGORY_TITLE[c.id]}`}
            count={c.count ?? 0}
            noun={CARD_COPY[c.id].noun}
            guidance={CARD_COPY[c.id].guidance}
            excluded={decisions.categories[c.id] === 'exclude'}
            // FR-2.12 — disclosed only when variant data really was absent, so the
            // caveat does not become permanent noise the user learns to ignore.
            variantCaveat={c.id === 'unusedAssets' && !variantsInspected}
            onToggle={() => onToggleCategory(c.id)}
            onReview={() => onReviewItems(c.id)}
            readOnly={frozen}
          />
        ))}
      </section>

      <section aria-label="Just so you know">
        <h3 style={sectionLabel}>Just so you know</h3>
        <div style={infoGrid}>
        {INFORMATIONAL_ORDER.map((id) => {
          const c = checkById(id);
          if (!c) return null;
          return (
            <AuditInfoCard
              key={id}
              id={id}
              // The titles are written to follow a count ("3 empty content types"), so a
              // check that produced no count leaves the phrase starting mid-sentence.
              // Capitalising keeps the words exactly as specified and reads as a heading.
              title={
                c.state === 'done'
                  ? `${c.count} ${CATEGORY_TITLE[id]}`
                  : CATEGORY_TITLE[id].charAt(0).toUpperCase() + CATEGORY_TITLE[id].slice(1)
              }
              state={c.state}
              count={c.count}
              guidance={CARD_COPY[id].guidance}
            />
          );
        })}
        </div>
      </section>

      <AuditItemsTable
        open={tableOpen}
        items={items}
        page={page}
        pageCount={pageCount}
        total={total}
        counts={counts}
        filter={filter}
        search={search}
        decisions={decisions}
        anyExclusion={anyExclusion}
        bulkAvailable={excludableCards.length > 0}
        onToggleOpen={() => dispatch(auditActions.setTableOpen(!tableOpen))}
        onFilter={onFilter}
        onSearch={onSearch}
        onPage={onPage}
        onToggleItem={onToggleItem}
        readOnly={frozen}
        onBulk={onBulk}
      />

      <p style={disclosure}>
        <span aria-hidden="true" style={{ color: 'var(--info)', marginTop: 1 }}>ⓘ</span>
        <span>
          Continuing carries these decisions into <strong>Content mapping</strong> —
          anything you exclude here will not appear there.
        </span>
      </p>

      {/*
        A failed save. No phase guard needed: the error PHASE returned above, so anything
        reaching here is a recoverable failure alongside a rendered audit — not the
        unreadable-export state. It lives in the panel rather than the chrome footer
        because it is this step's failure to report, and the chrome has no channel for it.
      */}
      {error && (
        <p
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--danger)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default AuditPanel;
