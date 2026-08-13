import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 tranche 3a: the panel's three states and the
 * impact panel.
 *
 * Backs TC_AR_051, 059–062 and TC_AR_143–155
 * (feature.md FR-3.1, FR-3.5 … FR-3.7, FR-10.1 … FR-10.6; trd.md TR-14, TR-15).
 *
 * Thunks are mocked to no-ops so mount effects never touch the network; a real
 * store drives the rendered state, matching the DestinationPanel suite's pattern.
 * Every query is by role or visible text — what a user perceives — never by class.
 *
 * Copy asserted here is verbatim from feature.md, which is authoritative over the
 * reference design where the two disagree (A-6).
 */
vi.mock('../../../../../v3/store/thunks/audit.thunks', () => ({
  loadAuditFindings: () => () => {},
  startAuditScan: () => () => {},
  pollAuditJob: () => () => {},
  loadAuditItems: () => () => {},
  rerunAudit: () => () => {},
  proceedFromAudit: () => () => {},
}));

import destinationReducer, { destinationActions } from '../../../../../v3/store/slice/destination.slice';
import auditReducer, {
  auditActions,
  AuditCheckView,
  AuditDecisionsView,
  AuditTotalsView,
} from '../../../../../v3/store/slice/audit.slice';
import AuditPanel from '../../../../../v3/components/audit/AuditPanel';

const CHECK_LABELS = {
  unusedAssets: 'Unused assets — referenced by any entry?',
  unpublishedEntries: 'Unpublished entries — has publish details?',
  emptyContentTypes: 'Empty content types — any entries at all?',
  unusedGlobalFields: 'Unused global fields — referenced by a schema?',
} as const;

/** All four checks queued — the state the analyzing view opens in. */
const queuedChecks = (): AuditCheckView[] =>
  (Object.keys(CHECK_LABELS) as (keyof typeof CHECK_LABELS)[]).map((id) => ({
    id,
    label: CHECK_LABELS[id],
    state: 'queued',
  }));

/** Fixture F1's four resolved checks: 4 unused assets, 6 unpublished, 1 + 1. */
const F1_CHECKS = (): AuditCheckView[] => [
  { id: 'unusedAssets', label: CHECK_LABELS.unusedAssets, state: 'done', count: 4 },
  { id: 'unpublishedEntries', label: CHECK_LABELS.unpublishedEntries, state: 'done', count: 6 },
  { id: 'emptyContentTypes', label: CHECK_LABELS.emptyContentTypes, state: 'done', count: 1 },
  { id: 'unusedGlobalFields', label: CHECK_LABELS.unusedGlobalFields, state: 'done', count: 1 },
];

/** Fixture F1's totals — denominator 36. */
const F1_TOTALS: AuditTotalsView = {
  contentTypes: 4,
  globalFields: 2,
  assets: 10,
  entryRecords: 20,
  denominator: 36,
};

const NO_DECISIONS: AuditDecisionsView = { categories: {}, itemOverrides: {} };

/*
  The destination reducer is included because the Audit panel now freezes once the
  DESTINATION is complete — the two steps lock together (2026-08-13). Audit reads that
  state rather than owning a flag of its own, following the codebase's existing rule of
  deriving progress from persisted documents rather than storing a step number.
*/
const mkStore = () =>
  configureStore({ reducer: { audit: auditReducer, destination: destinationReducer } });

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <AuditPanel projectId="P1" />
    </Provider>
  );

/** Puts the store into the analyzing state with the given per-check states. */
const seedAnalyzing = (
  store: ReturnType<typeof mkStore>,
  states?: AuditCheckView['state'][]
) => {
  store.dispatch(auditActions.scanStarted({ jobId: 'job-1', checks: queuedChecks() }));
  if (states) {
    store.dispatch(
      auditActions.scanProgress(
        queuedChecks().map((c, i) => ({ ...c, state: states[i] ?? 'queued' }))
      )
    );
  }
};

/** Puts the store into the ready state on fixture F1. */
const seedReady = (
  store: ReturnType<typeof mkStore>,
  decisions: AuditDecisionsView = NO_DECISIONS
) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks: F1_CHECKS(),
      totals: F1_TOTALS,
      variantsInspected: false,
      decisions,
    })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────── the analyzing state ─────────────────────────

describe('v3 AuditPanel — analyzing state', () => {
  it('TC_AR_143 (positive): the analyzing state shows all four check rows with their states', () => {
    const store = mkStore();
    seedAnalyzing(store, ['checking', 'queued', 'queued', 'queued']);
    renderPanel(store);

    for (const label of Object.values(CHECK_LABELS)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(screen.getAllByText('Queued')).toHaveLength(3);
  });

  it('TC_AR_144 (positive): the counter reads "0 of 4 checks" before any check resolves', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    expect(screen.getByText('0 of 4 checks')).toBeInTheDocument();
  });

  it('TC_AR_145 (positive): with two checks resolved the counter and each row reflect it', () => {
    const store = mkStore();
    seedAnalyzing(store, ['done', 'done', 'checking', 'queued']);
    renderPanel(store);

    expect(screen.getByText('2 of 4 checks')).toBeInTheDocument();
    expect(screen.getAllByText('Done')).toHaveLength(2);
    expect(screen.getByText('Checking…')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });

  it('TC_AR_146 (positive): the analyzing state explains that the audit runs automatically and caches', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    expect(
      screen.getByText(/runs automatically/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/cached until/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): none of the ready state's content may
    appear while the scan is still running. Rendering the impact panel early would
    show a denominator of nothing and an excluded count of zero — a completed-looking
    audit of a stack that has not been examined.
  */
  it('TC_AR_143 (negative): the analyzing state renders no impact panel, cards or table', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    // Anchor first: prove the analyzing state IS on screen. Without this the
    // absence assertions below pass against a component that renders nothing at
    // all, which is a vacuous green rather than a verified one.
    expect(screen.getByText('0 of 4 checks')).toBeInTheDocument();

    expect(screen.queryByText('Worth a look')).not.toBeInTheDocument();
    expect(screen.queryByText('Just so you know')).not.toBeInTheDocument();
    expect(screen.queryByText('All flagged items')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready to migrate/i)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the counter counts RESOLVED checks, and a
    check resolved as `notPresent` or `unavailable` is resolved. Counting only
    `done` would leave the counter stuck below 4 on a partial export and the page
    would appear to hang forever.
  */
  it('TC_AR_145 (negative): notPresent and unavailable checks count as resolved in the counter', () => {
    const store = mkStore();
    seedAnalyzing(store, ['done', 'notPresent', 'unavailable', 'checking']);
    renderPanel(store);

    expect(screen.getByText('3 of 4 checks')).toBeInTheDocument();
  });
});

// ───────────────────────── the ready state ─────────────────────────

describe('v3 AuditPanel — ready state', () => {
  it('TC_AR_147 (positive): the ready state renders the impact panel, both card sections and the table', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('Worth a look')).toBeInTheDocument();
    expect(screen.getByText('Just so you know')).toBeInTheDocument();
    expect(screen.getByText('All flagged items')).toBeInTheDocument();
  });

  it('TC_AR_148 (positive): the ready state offers a "Re-run audit" action', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByRole('button', { name: /re-run audit/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): "Re-run audit" must not be offered
    while a scan is already running. Two concurrent scans race on the same cache
    file, and the user has no way to tell which result they are looking at.
  */
  it('TC_AR_149 (negative): the analyzing state offers no "Re-run audit" action', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    // Anchor: the analyzing state is rendered, so the button's absence is a real
    // finding rather than a consequence of nothing being rendered.
    expect(screen.getByText('0 of 4 checks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-run audit/i })).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #5 (information disclosure): the page may show only the
    fields FR-6.2 names. An entry's body, an asset's binary or any other field from
    the source record must never reach the DOM (FR-10.6, NFR-7).
  */
  it('TC_AR_155 (negative): no customer content beyond the permitted columns reaches the DOM', () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(
      auditActions.itemsLoaded({
        items: [
          {
            key: 'entry:blog:e1:en',
            category: 'unpublishedEntries',
            type: 'Entry',
            title: 'Q3 launch recap',
            uid: 'blt55e10ab',
            contentType: 'Blog post',
            locale: 'en',
            status: 'Never published',
          },
        ],
        page: 1,
        pageCount: 1,
        total: 1,
        counts: { all: 1, entries: 1, assets: 0, contentTypes: 0, globalFields: 0 },
      })
    );
    const { container } = renderPanel(store);

    // The permitted fields are present…
    expect(screen.getByText('Q3 launch recap')).toBeInTheDocument();
    // …and nothing else from a source record is. The item view carries no body
    // field at all, so this asserts the shape holds end to end.
    expect(container.textContent).not.toContain('publish_details');
    expect(container.textContent).not.toContain('_in_progress');
    expect(container.textContent).not.toContain('created_by');
  });
});

// ───────────────────────── the error state ─────────────────────────

describe('v3 AuditPanel — error state', () => {
  /*
    Negative — taxonomy #6 (dependency failure): the export folder is missing
    (EC-1). The page must explain that the exported data could not be read and offer
    the route back to the Source step — FR-10.4's two halves. An error with no way
    out strands the user on a step whose gate is closed.
  */
  it('TC_AR_150 (negative): a missing export shows an explanation and a route back to Source', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_missing'));
    renderPanel(store);

    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /source/i })
    ).toBeInTheDocument();
  });

  it('TC_AR_151 (positive): a half-written export reaches the same error state as a missing one', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_unreadable'));
    renderPanel(store);

    // EC-2 is explicitly "treated as EC-1" — a partial folder must never be
    // presented as a completed audit.
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /source/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the error state must not carry any
    audit content. An impact panel beside an error reads as "the audit ran and here
    are the results", which is exactly the false clean bill of health FR-10.5
    forbids.
  */
  it('TC_AR_152 (negative): the error state renders no impact panel, cards or table', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_missing'));
    renderPanel(store);

    // Anchor: the error state is rendered.
    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();

    expect(screen.queryByText(/Ready to migrate/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Worth a look')).not.toBeInTheDocument();
    expect(screen.queryByText('All flagged items')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): a network error or a 500 on the
    findings request (EC-10). It must be retryable and must not render as an empty
    ready state — which would show "0 of 36 excluded, everything migrates" for a
    stack nobody looked at.
  */
  it('TC_AR_153 (negative): a failed findings request is retryable and not an empty ready state', async () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('internal'));
    renderPanel(store);

    expect(screen.queryByText('Worth a look')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again|retry/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the step is reached for a project whose
    export never ran (EC-17). The page shows the error rather than an empty audit —
    the wizard's own gate governs entry, but if the step IS reached it must not
    pretend.
  */
  it('TC_AR_154 (negative): reaching the step with no export at all shows the error, not an empty audit', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_missing'));
    renderPanel(store);

    expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing excluded yet/i)).not.toBeInTheDocument();
  });

  it('TC_AR_150b (positive): a successful load replaces a previous error state entirely', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_missing'));
    seedReady(store);
    renderPanel(store);

    expect(screen.queryByText(/could not be read/i)).not.toBeInTheDocument();
    expect(screen.getByText('Worth a look')).toBeInTheDocument();
  });
});

// ───────────────────────── the impact panel ─────────────────────────

describe('v3 AuditPanel — impact panel', () => {
  it('TC_AR_051 (positive): the impact panel shows the migrating count, the total and a progress bar', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText(/of 36 items/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('TC_AR_059 (positive): with nothing excluded the impact line is verbatim', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(
      screen.getByText('Nothing excluded yet — everything migrates unless you skip it.')
    ).toBeInTheDocument();
  });

  it('TC_AR_060 (positive): excluding exactly one item uses the singular form', () => {
    const store = mkStore();
    seedReady(store, {
      categories: {},
      itemOverrides: { 'asset:a1': 'exclude' },
    });
    renderPanel(store);

    expect(
      screen.getByText('1 item excluded and will not be migrated.')
    ).toBeInTheDocument();
  });

  it('TC_AR_061 (positive): excluding six items uses the plural form with the count', () => {
    const store = mkStore();
    seedReady(store, {
      categories: { unpublishedEntries: 'exclude' },
      itemOverrides: {},
    });
    renderPanel(store);

    expect(
      screen.getByText('6 items excluded and will not be migrated.')
    ).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the singular and plural forms must not
    be interchangeable. "1 items excluded" is the classic pluralisation bug, and it
    is the kind of defect that survives review because the number is right.
  */
  it('TC_AR_060 (negative): a count of one never renders the plural wording', () => {
    const store = mkStore();
    seedReady(store, { categories: {}, itemOverrides: { 'asset:a1': 'exclude' } });
    renderPanel(store);

    // Anchor on the correct singular line, so the plural's absence is meaningful.
    expect(
      screen.getByText('1 item excluded and will not be migrated.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/1 items excluded/)).not.toBeInTheDocument();
  });

  it('TC_AR_062 (positive): the impact figures update in the same render as a decision change', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText(/Nothing excluded yet/)).toBeInTheDocument();

    // A decision change from anywhere — a card switch, a row checkbox or the bulk
    // button — flows through the same working set.
    store.dispatch(
      auditActions.setDecisions({
        categories: { unpublishedEntries: 'exclude' },
        itemOverrides: {},
      })
    );

    expect(await screen.findByText('30')).toBeInTheDocument();
    expect(screen.getByText('6 items excluded and will not be migrated.')).toBeInTheDocument();
    expect(screen.queryByText(/Nothing excluded yet/)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the ready state must not carry the
    analyzing state's furniture. A leftover spinner or "n of 4 checks" counter beside
    a completed impact panel tells the user the scan is still running when it is not.
  */
  it('TC_AR_147 (negative): the ready state shows no progress counter or spinner', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('Worth a look')).toBeInTheDocument();
    expect(screen.queryByText(/of 4 checks/)).not.toBeInTheDocument();
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): excluding and then re-including must
    return the figures EXACTLY to their starting values, including the verbatim
    nothing-excluded line. AC-2.3 requires the pre-audit state to be restored, and a
    panel that returned to "0 items excluded and will not be migrated." instead of
    the nothing-excluded copy would have drifted.
  */
  it('TC_AR_062 (negative): excluding then re-including restores the exact starting figures', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    store.dispatch(
      auditActions.setDecisions({ categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} })
    );
    expect(await screen.findByText('30')).toBeInTheDocument();

    store.dispatch(auditActions.setDecisions({ categories: {}, itemOverrides: {} }));

    expect(await screen.findByText('36')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing excluded yet — everything migrates unless you skip it.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/0 items excluded/)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the progress bar must expose its value to
    assistive technology, not merely be a coloured div. NFR-8 requires WCAG 2.1 AA,
    and a bar whose only representation is width is invisible to a screen reader —
    the migrating proportion is the panel's headline claim.
  */
  it('TC_AR_051 (negative): the progress bar exposes its value, not only a visual width', () => {
    const store = mkStore();
    seedReady(store, { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} });
    renderPanel(store);

    const bar = screen.getByRole('progressbar');
    // 30 of 36 = 83%.
    expect(bar).toHaveAttribute('aria-valuenow', '83');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  /*
    Negative — taxonomy #3 (boundary): a check that did not run contributes no
    number to the panel. Its `count` is absent, and reading an absent count as a
    number yields NaN — "NaN of 36 items" — which is the visible symptom of the
    FR-2.11 violation the wire format was shaped to prevent.
  */
  it('TC_AR_051 (negative): an unavailable check contributes no NaN to the impact figures', () => {
    const store = mkStore();
    store.dispatch(
      auditActions.findingsLoaded({
        checks: [
          { id: 'unusedAssets', label: CHECK_LABELS.unusedAssets, state: 'unavailable' },
          { id: 'unpublishedEntries', label: CHECK_LABELS.unpublishedEntries, state: 'notPresent' },
          { id: 'emptyContentTypes', label: CHECK_LABELS.emptyContentTypes, state: 'done', count: 0 },
          { id: 'unusedGlobalFields', label: CHECK_LABELS.unusedGlobalFields, state: 'done', count: 0 },
        ],
        totals: F1_TOTALS,
        variantsInspected: false,
        decisions: NO_DECISIONS,
      })
    );
    const { container } = renderPanel(store);

    expect(container.textContent).not.toContain('NaN');
    expect(screen.getByText(/of 36 items/i)).toBeInTheDocument();
  });
});

/**
 * Audit freezes with the destination, not with itself — rows TC_AR_197–199.
 *
 * The requirement is deliberately asymmetric to Source: finishing the AUDIT changes
 * nothing, because the operator must be able to revise include/exclude decisions right up
 * until the destination is settled. Both pages lock at the same moment, and that moment is
 * the destination being saved.
 */
const seedDestinationSaved = (store: ReturnType<typeof mkStore>) =>
  store.dispatch(destinationActions.setProceeded(true));

/*
  Items must be loaded for the row checkboxes to exist at all. Without this, a test that
  asserts "every checkbox is disabled" passes over an EMPTY list and proves nothing — which
  is exactly what happened on the first run here, and why each pair below also asserts the
  controls are present.
*/
const seedItems = (store: ReturnType<typeof mkStore>) =>
  store.dispatch(
    auditActions.itemsLoaded({
      items: [
        {
          key: 'entry:blog:e1:en',
          category: 'unpublishedEntries',
          type: 'Entry',
          title: 'Draft post',
          uid: 'blt-e1',
          contentType: 'Blog post',
          locale: 'en',
          status: 'Never published',
        },
      ],
      page: 1,
      pageCount: 1,
      total: 1,
      // The filter chips read these; omitting them crashes the table.
      counts: { all: 1, entries: 1, assets: 0, contentTypes: 0, globalFields: 0 },
    } as never)
  );

describe('v3 AuditPanel — frozen once the destination is saved', () => {
  it('TC_AR_197 (positive): disables the audit decision controls', () => {
    const store = mkStore();
    seedReady(store);
    seedItems(store);
    seedDestinationSaved(store);
    renderPanel(store);

    const boxes = screen.queryAllByRole('checkbox');
    expect(boxes.length, 'no checkboxes rendered, so this assertion would be vacuous').toBeGreaterThan(0);
    for (const box of boxes) expect(box).toBeDisabled();
  });

  /*
    ⚠️ The assertion that encodes the whole requirement. A COMPLETED AUDIT with no saved
    destination must stay fully editable — the decisions are exactly what the operator
    revisits before committing to a destination. Freezing on the audit's own completion
    would be the obvious implementation and the wrong one.
  */
  it('TC_AR_197 (negative): leaves the controls editable when the audit is done but the destination is not', () => {
    const store = mkStore();
    seedReady(store);
    seedItems(store);
    renderPanel(store);

    const boxes = screen.queryAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box).not.toBeDisabled();
  });

  it('TC_AR_198 (positive): explains why the decisions are read-only', () => {
    const store = mkStore();
    seedReady(store);
    seedDestinationSaved(store);
    renderPanel(store);

    expect(screen.getByTestId('audit-frozen-notice').textContent).toMatch(/destination/i);
  });

  /*
    Negative — taxonomy #1 (missing information): no notice before the freeze. The reason
    for Audit's lock lives on a DIFFERENT page, so a disabled control here with no
    explanation reads as a bug — but a permanent notice would be noise on every visit.
  */
  it('TC_AR_198 (negative): shows no read-only notice while the decisions are still editable', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.queryByTestId('audit-frozen-notice')).toBeNull();
  });

  /*
    TC_AR_200, added 2026-08-13 after testing found the freeze was incomplete. The row
    checkboxes and the bulk control locked, but the per-CATEGORY switch on each "Worth a
    look" card stayed live — and that switch is the coarsest decision on the page, excluding
    a whole category at once. Freezing the fine-grained controls while leaving the coarse one
    open is worse than not freezing at all.
  */
  it('TC_AR_200 (positive): disables the category include/exclude switch once the destination is saved', () => {
    const store = mkStore();
    seedReady(store);
    seedDestinationSaved(store);
    renderPanel(store);

    // Guard against a vacuous pass: with no cards rendered, `.every` would be trivially
    // true and this test would pass against an unmodified component.
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
    switches.forEach((el) => expect(el).toBeDisabled());
  });

  /*
    Negative — taxonomy #4 (forbidden state): the switch must stay operable before the
    destination is saved. It is the primary control of the audit step, so freezing it early
    would make the whole page useless — the operator revises exactly these decisions before
    choosing a destination.
  */
  it('TC_AR_200 (negative): leaves the category switch operable while the decisions are editable', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
    switches.forEach((el) => expect(el).not.toBeDisabled());
  });

  it('TC_AR_199 (positive): disables the re-run control once the destination is saved', () => {
    const store = mkStore();
    seedReady(store);
    seedDestinationSaved(store);
    renderPanel(store);

    expect(screen.getByRole('button', { name: /re-?run/i })).toBeDisabled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): re-running before the destination is saved is
    a legitimate action, and it is how the operator refreshes findings after changing the
    source. It must not be frozen early.
  */
  it('TC_AR_199 (negative): leaves the re-run control usable before the destination is saved', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByRole('button', { name: /re-?run/i })).not.toBeDisabled();
  });
});
