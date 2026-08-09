import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 tranche 3d: the footer gate and write timing.
 *
 * Backs TC_AR_109–111 and TC_AR_128–135
 * (feature.md FR-7.5, FR-8.1 … FR-8.4, AC-6.1 … AC-6.5, EC-7, EC-11; trd.md TR-20).
 *
 * Write timing is the contested part. feature.md contradicts itself — UC-2's
 * postcondition says a category toggle persists, AC-6.4 says the primary action
 * persists — and the contradiction is recorded unresolved as prd.md PQ-6 / trd.md
 * TQ-2. These tests are written to the TRD's chosen reading, **save on Continue**
 * (TC-6), and TC_AR_111's negative asserts the cost of that choice explicitly
 * rather than leaving it implied.
 */
const { mockProceed, mockPersist } = vi.hoisted(() => ({
  mockProceed: vi.fn(() => () => Promise.resolve(true)),
  mockPersist: vi.fn(() => () => Promise.resolve(true)),
}));

vi.mock('../../../../../v3/store/thunks/audit.thunks', () => ({
  loadAuditFindings: () => () => {},
  startAuditScan: () => () => {},
  pollAuditJob: () => () => {},
  loadAuditItems: () => () => {},
  rerunAudit: () => () => {},
  proceedFromAudit: mockProceed,
  persistAuditDecisions: mockPersist,
}));

import auditReducer, {
  auditActions,
  AuditCheckView,
  AuditDecisionsView,
  AuditTotalsView,
} from '../../../../../v3/store/slice/audit.slice';
import AuditPanel from '../../../../../v3/components/audit/AuditPanel';
import WizardFooter from '../../../../../v3/components/wizard/WizardFooter';
import { StepGateProvider } from '../../../../../v3/components/wizard/StepGateContext';
import { WIZARD_STEPS, statusLineFor } from '../../../../../v3/components/wizard/steps';

const LABELS = {
  unusedAssets: 'Unused assets — referenced by any entry?',
  unpublishedEntries: 'Unpublished entries — has publish details?',
  emptyContentTypes: 'Empty content types — any entries at all?',
  unusedGlobalFields: 'Unused global fields — referenced by a schema?',
} as const;

const F1_CHECKS = (): AuditCheckView[] => [
  { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'done', count: 4 },
  { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: 6 },
  { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'done', count: 1 },
  { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: 1 },
];

const F1_TOTALS: AuditTotalsView = {
  contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36,
};

const NO_DECISIONS: AuditDecisionsView = { categories: {}, itemOverrides: {} };
const ALL_EXCLUDED: AuditDecisionsView = {
  categories: { unpublishedEntries: 'exclude', unusedAssets: 'exclude' },
  itemOverrides: {},
};

const mkStore = () => configureStore({ reducer: { audit: auditReducer } });

/*
  Mounts the panel the way the app does: inside a real `StepGateProvider`, with the real
  `WizardFooter` as a sibling. Every assertion below is unchanged — they query the action
  by role and name, not by which component drew it.

  This composition IS the contract under test. These tests previously rendered the panel
  alone, against a footer the panel drew itself. They all passed while the footer the user
  actually clicks navigated WITHOUT persisting anything, because the panel registered no
  gate and the chrome fell through to its open-gate default. A footer test that does not
  mount the footer under test cannot see that.

  `onAdvanced` is captured rather than stubbed away: "did the wizard move on" is the
  outcome half of every save assertion here, and it is the half that was silently wrong.
*/
const advanced = vi.fn();

const renderPanel = (store: ReturnType<typeof mkStore>) => {
  const auditIndex = WIZARD_STEPS.findIndex((s) => s.id === 'audit');
  return render(
    <Provider store={store}>
      <StepGateProvider onAdvanced={advanced}>
        <AuditPanel projectId="P1" />
        <WizardFooter
          activeIndex={auditIndex}
          isFirst={false}
          onBack={() => {}}
          stepContext={{}}
        />
      </StepGateProvider>
    </Provider>
  );
};

const seedAnalyzing = (store: ReturnType<typeof mkStore>) =>
  store.dispatch(
    auditActions.scanStarted({
      jobId: 'job-1',
      checks: F1_CHECKS().map((c) => ({ ...c, state: 'queued', count: undefined })),
    })
  );

const seedReady = (store: ReturnType<typeof mkStore>, decisions = NO_DECISIONS) =>
  store.dispatch(
    auditActions.findingsLoaded({
      checks: F1_CHECKS(),
      totals: F1_TOTALS,
      variantsInspected: true,
      decisions,
    })
  );

const auditStep = () => WIZARD_STEPS.find((s) => s.id === 'audit')!;

beforeEach(() => {
  advanced.mockClear();
  mockProceed.mockClear();
  mockPersist.mockClear();
  mockProceed.mockImplementation(() => () => Promise.resolve(true));
});

// ───────────────────────── the gate ─────────────────────────

describe('v3 audit footer — the gate', () => {
  it('TC_AR_128 (positive): while analyzing the primary action is disabled and says why', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    const action = screen.getByRole('button', { name: auditStep().actionLabel! });
    expect(action).toBeDisabled();
    expect(screen.getByText(auditStep().blockedExplanation!)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the gate must open once the audit is
    ready, whatever the user decided. A gate that stayed shut would trap them on a
    step whose only remaining action is to continue.
  */
  it('TC_AR_128 (negative): once ready the primary action is enabled and carries no blocked explanation', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByRole('button', { name: auditStep().actionLabel! })).toBeEnabled();
    expect(screen.queryByText(auditStep().blockedExplanation!)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): excluding everything must NOT close the
    gate (EC-7). Dropping all flagged content is a legitimate outcome, and a page that
    blocked it would be second-guessing the user's own decision.
  */
  it('TC_AR_135 (negative): excluding every flagged item leaves the primary action enabled', () => {
    const store = mkStore();
    seedReady(store, ALL_EXCLUDED);
    renderPanel(store);

    expect(screen.getByRole('button', { name: auditStep().actionLabel! })).toBeEnabled();
  });

  it('TC_AR_135 (positive): the error state closes the gate', () => {
    const store = mkStore();
    store.dispatch(auditActions.scanFailed('export_missing'));
    renderPanel(store);

    expect(screen.getByRole('button', { name: auditStep().actionLabel! })).toBeDisabled();
  });
});

// ───────────────────────── the status line ─────────────────────────

describe('v3 audit footer — the status line', () => {
  it('TC_AR_129 (positive): while analyzing the status line is the analyzing copy verbatim', () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    expect(
      screen.getByText('Generating audit — you can continue once it finishes')
    ).toBeInTheDocument();
  });

  it('TC_AR_130 (positive): ready with nothing excluded reads "Audit complete — nothing excluded"', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('Audit complete — nothing excluded')).toBeInTheDocument();
  });

  it('TC_AR_131 (positive): ready with all ten excluded reads the excluded and migrating counts', () => {
    const store = mkStore();
    seedReady(store, ALL_EXCLUDED);
    renderPanel(store);

    expect(screen.getByText('Audit complete — 10 excluded, 26 will migrate')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the nothing-excluded line and the counted
    line are mutually exclusive. "Audit complete — 0 excluded, 36 will migrate" is
    technically true and is the wrong string — FR-8.2 specifies a distinct sentence for
    the zero case.
  */
  it('TC_AR_130 (negative): the zero case never renders the counted wording', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('Audit complete — nothing excluded')).toBeInTheDocument();
    expect(screen.queryByText(/0 excluded/)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the analyzing copy must vanish once the
    audit is ready. A footer still reading "Generating audit" beside an enabled action
    tells the user two contradictory things at once.
  */
  it('TC_AR_129 (negative): the analyzing status line is absent once the audit is ready', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByText('Audit complete — nothing excluded')).toBeInTheDocument();
    expect(
      screen.queryByText('Generating audit — you can continue once it finishes')
    ).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #7 (conflict): the footer's numbers and the impact panel's must
    agree. They are the same two figures rendered in two places, so deriving them
    separately is how they come to disagree — and the user has no way to know which to
    believe.
  */
  it('TC_AR_131 (negative): the footer counts never disagree with the impact panel', () => {
    const store = mkStore();
    seedReady(store, ALL_EXCLUDED);
    renderPanel(store);

    // 36 - 10 = 26, stated in both places.
    expect(screen.getByText('Audit complete — 10 excluded, 26 will migrate')).toBeInTheDocument();
    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('10 items excluded and will not be migrated.')).toBeInTheDocument();
  });

  it('TC_AR_132 (positive): the footer copy comes from the shared wizard step definition', () => {
    const store = mkStore();
    seedReady(store, ALL_EXCLUDED);
    renderPanel(store);

    // The exact string the chrome's own resolver produces for this context — so the
    // panel cannot drift from the step definition (FR-8.3, A-6).
    const expected = statusLineFor(auditStep(), {
      auditReady: true,
      excludedCount: 10,
      migratingCount: 26,
    })!;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the panel must not hold its own copy of the
    action label. feature.md A-6 makes the step definition authoritative because the
    reference design's own label ("Continue to content mapping") contradicts its
    tracker, which places Destination next.
  */
  it('TC_AR_132 (negative): the design\'s contradictory label never appears', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(screen.getByRole('button', { name: auditStep().actionLabel! })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue to content mapping/i })
    ).not.toBeInTheDocument();
  });
});

// ───────────────────────── advancing ─────────────────────────

describe('v3 audit footer — advancing', () => {
  it('TC_AR_133 (positive): the primary action persists the decisions and then advances', async () => {
    const store = mkStore();
    seedReady(store, { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} });
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: auditStep().actionLabel! }));

    expect(mockProceed).toHaveBeenCalledWith('P1');
    /*
      The "and then advances" half of this test's own name, which it did not previously
      assert — and that omission is exactly how the duplicate-footer bug survived: the
      wizard advanced without the save, and nothing here looked at the advance.
    */
    expect(advanced).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #6 (dependency failure): a failed persist must not advance, and
    must not silently revert what the user chose (EC-11, AC-6.5). Reverting would look
    like the exclusions were never made.
  */
  it('TC_AR_134 (negative): a failed persist surfaces the error and leaves the decisions intact', async () => {
    const store = mkStore();
    const decisions: AuditDecisionsView = {
      categories: { unpublishedEntries: 'exclude' },
      itemOverrides: { 'asset:a1': 'exclude' },
    };
    seedReady(store, decisions);
    mockProceed.mockImplementation(() => () => Promise.resolve(false));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: auditStep().actionLabel! }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(store.getState().audit.decisions).toEqual(decisions);
    // A failed save must not carry the user forward — losing the exclusions on the way to
    // Content mapping is the specific harm this whole gate exists to prevent.
    expect(advanced).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the action must not be clickable twice in
    flight. A second click while saving issues a second write, and with a full-replace
    endpoint the later one can land first.
  */
  it('TC_AR_133 (negative): the primary action is not re-triggerable while saving', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(auditActions.setSaving(true));
    renderPanel(store);

    const action = screen.getByRole('button', { name: auditStep().actionLabel! });
    expect(action).toBeDisabled();

    await userEvent.click(action);
    expect(mockProceed).not.toHaveBeenCalled();
    expect(advanced).not.toHaveBeenCalled();
  });
});

// ───────────────────────── write timing (PQ-6 / TQ-2) ─────────────────────────

describe('v3 audit footer — when decisions are written', () => {
  it('TC_AR_109 (positive): toggling decisions without clicking Continue writes nothing to the server', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    // Anchor: the ready footer is on screen, so "nothing was written" is a finding
    // about behaviour rather than a consequence of nothing having rendered.
    expect(screen.getByText('Audit complete — nothing excluded')).toBeInTheDocument();

    // Several changes from several sources.
    act(() => {
      store.dispatch(
        auditActions.setDecisions({
          categories: { unusedAssets: 'exclude' },
          itemOverrides: { 'entry:blog:e1:en': 'exclude' },
        })
      );
    });

    // The changes really landed in the working set…
    expect(store.getState().audit.decisions.categories.unusedAssets).toBe('exclude');
    /*
      …and the footer reflects them, so the panel is live.

      5, not 4: the whole unused-assets category (4 flagged) plus one individually
      excluded entry record. The original expectation of 4 was simply wrong arithmetic
      on my part — it counted the category and ignored the override.
    */
    expect(screen.getByText(/Audit complete — 5 excluded/)).toBeInTheDocument();
    // Save-on-Continue (trd.md TC-6): still nothing persisted.
    expect(mockProceed).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });

  it('TC_AR_110 (positive): clicking the primary action writes exactly once', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    store.dispatch(
      auditActions.setDecisions({ categories: { unusedAssets: 'exclude' }, itemOverrides: {} })
    );
    await userEvent.click(screen.getByRole('button', { name: auditStep().actionLabel! }));

    expect(mockProceed).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the write must not happen from a state
    that has no decisions to write. Clicking through while the scan is still running
    would persist an empty decision set over whatever the project already held.
  */
  it('TC_AR_110 (negative): no write is attempted while the audit is still analyzing', async () => {
    const store = mkStore();
    seedAnalyzing(store);
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: auditStep().actionLabel! }));

    expect(mockProceed).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #1 (missing input): the honest cost of save-on-Continue.

    Unsaved changes are lost on a reload, and the panel must NOT claim otherwise. The
    assertion is that the working set differs from the persisted set while changes are
    pending — the signal any "unsaved changes" affordance would need, and the evidence
    that this choice is visible in the model rather than hidden.

    If PQ-6 / TQ-2 is resolved the other way (autosave), this test is the one that must
    change, and it is named here so that is a deliberate act.
  */
  it('TC_AR_111 (negative): pending changes are distinguishable from persisted ones', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    expect(store.getState().audit.decisions).toEqual(
      store.getState().audit.persistedDecisions
    );

    store.dispatch(
      auditActions.setDecisions({ categories: { unusedAssets: 'exclude' }, itemOverrides: {} })
    );

    const s = store.getState().audit;
    expect(s.decisions).not.toEqual(s.persistedDecisions);
    expect(s.persistedDecisions).toEqual(NO_DECISIONS);
  });

  it('TC_AR_111 (positive): a successful write makes the working and persisted sets agree again', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const next: AuditDecisionsView = {
      categories: { unusedAssets: 'exclude' },
      itemOverrides: {},
    };
    store.dispatch(auditActions.setDecisions(next));
    store.dispatch(auditActions.decisionsPersisted(next));

    const s = store.getState().audit;
    expect(s.decisions).toEqual(s.persistedDecisions);
    expect(s.saving).toBe(false);
  });
});
