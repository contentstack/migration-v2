import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 tranche 4: the shared wizard toast.
 *
 * Backs TC_AR_136–142 (feature.md FR-9.1 … FR-9.4; trd.md TR-21).
 *
 * P1 throughout ([prd.md §6](../../../../../../docs/features/cs-audit-report/prd.md)),
 * and deliberately last so that deferring it cannot block the rest. FR-9.4 is the
 * requirement that makes deferral safe, and it stays P0: the toast may never be the
 * only sign of a state change.
 *
 * The panel and the toast are rendered together, because the trigger cases are about
 * an audit action producing a message and the display cases are about the toast
 * showing and clearing it. Timers are faked — a real 2600ms wait would make the suite
 * slow and flaky, and `TOAST_DISMISS_MS` is the contract, not the wall clock.
 */
vi.mock('../../../../../v3/store/thunks/audit.thunks', () => ({
  loadAuditFindings: () => () => {},
  startAuditScan: () => () => {},
  pollAuditJob: () => () => {},
  loadAuditItems: () => () => {},
  rerunAudit: () => () => {},
  proceedFromAudit: () => () => Promise.resolve(true),
  persistAuditDecisions: () => () => Promise.resolve(true),
}));

import auditReducer, {
  auditActions,
  AuditCheckView,
  AuditDecisionsView,
  AuditItemView,
  AuditTotalsView,
} from '../../../../../v3/store/slice/audit.slice';
import toastReducer, {
  toastActions,
  TOAST_DISMISS_MS,
  TOAST_QUEUE_MAX,
} from '../../../../../v3/store/slice/toast.slice';
import AuditPanel from '../../../../../v3/components/audit/AuditPanel';
import WizardToast from '../../../../../v3/components/wizard/WizardToast';

const LABELS = {
  unusedAssets: 'Unused assets — referenced by any entry?',
  unpublishedEntries: 'Unpublished entries — has publish details?',
  emptyContentTypes: 'Empty content types — any entries at all?',
  unusedGlobalFields: 'Unused global fields — referenced by a schema?',
} as const;

const F1_CHECKS = (over: Partial<Record<keyof typeof LABELS, number>> = {}): AuditCheckView[] => [
  { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'done', count: over.unusedAssets ?? 4 },
  { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: over.unpublishedEntries ?? 6 },
  { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'done', count: 1 },
  { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: 1 },
];

const F1_TOTALS: AuditTotalsView = {
  contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36,
};

const NO_DECISIONS: AuditDecisionsView = { categories: {}, itemOverrides: {} };

const row = (n: number): AuditItemView => ({
  key: `entry:blog:e${n}:en`,
  category: 'unpublishedEntries',
  type: 'Entry',
  title: `Draft ${n}`,
  uid: `e${n}`,
  contentType: 'blog',
  locale: 'en',
  status: 'Never published',
});

const mkStore = () =>
  configureStore({ reducer: { audit: auditReducer, toast: toastReducer } });

const renderAll = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <AuditPanel projectId="P1" />
      <WizardToast />
    </Provider>
  );

const seedReady = (
  store: ReturnType<typeof mkStore>,
  opts: { decisions?: AuditDecisionsView; counts?: Partial<Record<keyof typeof LABELS, number>> } = {}
) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks: F1_CHECKS(opts.counts),
      totals: F1_TOTALS,
      variantsInspected: true,
      decisions: opts.decisions ?? NO_DECISIONS,
    })
  );
  store.dispatch(
    auditActions.itemsLoaded({
      items: [row(1)],
      page: 1,
      pageCount: 1,
      total: 12,
      counts: { all: 12, entries: 6, assets: 4, contentTypes: 1, globalFields: 1 },
    })
  );
};

const card = (name: RegExp) => screen.getByRole('group', { name });
const clickSwitch = (name: RegExp) =>
  userEvent.click(card(name).querySelector('[role="switch"]')!);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ───────────────────────── triggers ─────────────────────────

describe('v3 wizard toast — what raises one', () => {
  it('TC_AR_136 (positive): excluding a category raises a toast naming the count and category', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);

    await clickSwitch(/unpublished entries/i);

    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent(/6/);
    expect(toast).toHaveTextContent(/entries/i);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the message must name what happened, not a
    generic acknowledgement. "Saved" or "Done" confirms that *something* occurred while
    leaving the user to work out what — which is worse than no toast, because it
    interrupts without informing.
  */
  it('TC_AR_136 (negative): the toast is not a generic acknowledgement', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);

    await clickSwitch(/unpublished entries/i);

    const text = (await screen.findByRole('status')).textContent ?? '';
    expect(text).not.toMatch(/^(saved|done|ok|success)\.?$/i);
    expect(text).toMatch(/6/);
  });

  it('TC_AR_137 (positive): re-including a category raises its own toast', async () => {
    const store = mkStore();
    seedReady(store, {
      decisions: { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} },
    });
    renderAll(store);

    await clickSwitch(/unpublished entries/i);

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): including and excluding must not produce the
    SAME message. A toast that reads identically in both directions tells the user
    nothing about which way the switch just moved — and the switch is the one control
    on this page whose direction carries all the meaning.
  */
  it('TC_AR_137 (negative): including and excluding produce different messages', async () => {
    const excludeStore = mkStore();
    seedReady(excludeStore);
    const { unmount } = renderAll(excludeStore);
    await clickSwitch(/unpublished entries/i);
    const excludeText = (await screen.findByRole('status')).textContent;
    unmount();

    const includeStore = mkStore();
    seedReady(includeStore, {
      decisions: { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} },
    });
    renderAll(includeStore);
    await clickSwitch(/unpublished entries/i);
    const includeText = (await screen.findByRole('status')).textContent;

    expect(includeText).not.toBe(excludeText);
  });

  it('TC_AR_138 (positive): Exclude all flagged raises a toast', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);

    await userEvent.click(screen.getByRole('button', { name: 'Exclude all flagged' }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the bulk toast must name the whole flagged
    total, not the number of rows on screen. Same hazard as the card count — the table
    pages at 50, so a toast reading "Excluding 50 items" for a 120-item set is wrong in
    exactly the way that looks right.
  */
  it('TC_AR_138 (negative): the bulk toast names the whole flagged total, not the visible rows', async () => {
    const store = mkStore();
    seedReady(store, { counts: { unpublishedEntries: 100, unusedAssets: 20 } });
    renderAll(store);

    await userEvent.click(screen.getByRole('button', { name: 'Exclude all flagged' }));

    const text = (await screen.findByRole('status')).textContent ?? '';
    expect(text).toMatch(/120/);
    expect(text).not.toMatch(/\b1\b item/);
  });

  it('TC_AR_139 (positive): Include everything raises a toast', async () => {
    const store = mkStore();
    seedReady(store, {
      decisions: { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} },
    });
    renderAll(store);

    await userEvent.click(screen.getByRole('button', { name: 'Include everything' }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('TC_AR_140 (positive): Re-run audit raises a toast when the re-run starts', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);

    await userEvent.click(screen.getByRole('button', { name: /re-run audit/i }));

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the re-run toast fires when the scan
    STARTS, not when it finishes. Firing on completion would announce a re-run at the
    moment the ready state replaces the analyzing state — duplicating information the
    page has just shown, and saying nothing at the moment the user actually needs the
    acknowledgement.
  */
  it('TC_AR_140 (negative): no re-run toast is raised merely by a scan completing', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);

    // Anchor: a user-initiated re-run DOES raise one, proving the mechanism is live.
    // Without this, the absence assertion below passes against a toast that never
    // works at all.
    await userEvent.click(screen.getByRole('button', { name: /re-run audit/i }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(TOAST_DISMISS_MS + 10);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Now a scan cycle with no user action preceding it raises nothing.
    store.dispatch(auditActions.scanStarted({ jobId: 'j2', checks: F1_CHECKS() }));
    seedReady(store);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ───────────────────────── display and dismissal ─────────────────────────

describe('v3 wizard toast — display and dismissal', () => {
  it('TC_AR_141 (positive): a toast dismisses itself after the contracted delay with no interaction', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);
    act(() => {
      store.dispatch(toastActions.show('Excluding all 6 entries'));
    });

    expect(await screen.findByRole('status')).toHaveTextContent('Excluding all 6 entries');

    await act(async () => {
      vi.advanceTimersByTime(TOAST_DISMISS_MS + 10);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the toast must still be present just BEFORE its
    delay elapses. Without this the positive above is satisfied by a toast that never
    rendered at all, or by one that vanished instantly.
  */
  it('TC_AR_141 (negative): the toast is still present just before its delay elapses', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);
    act(() => {
      store.dispatch(toastActions.show('Excluding all 6 entries'));
    });

    await act(async () => {
      vi.advanceTimersByTime(TOAST_DISMISS_MS - 100);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Excluding all 6 entries');
  });

  /*
    Negative — taxonomy #3 (boundary): rapid actions must not pile up an unbounded stack
    of overlapping toasts. A user who excludes a category, includes everything and
    re-runs in quick succession would otherwise cover the page with acknowledgements
    that outlive the interaction.
  */
  it('TC_AR_141b (negative): the queue is bounded rather than growing without limit', () => {
    const store = mkStore();
    for (let i = 0; i < TOAST_QUEUE_MAX + 4; i++) {
      store.dispatch(toastActions.show(`message ${i}`));
    }

    expect(store.getState().toast.queue).toHaveLength(TOAST_QUEUE_MAX);
    // The most recent survive — the oldest are the least relevant.
    expect(store.getState().toast.queue.at(-1)?.text).toBe(
      `message ${TOAST_QUEUE_MAX + 3}`
    );
  });

  /*
    Negative — taxonomy #4 (forbidden state): FR-9.4, and the requirement that makes
    deferring the whole toast to P1 safe.

    With the toast suppressed entirely, the same action must still be evident: the
    impact panel and the control itself both reflect it. If this fails, the toast has
    become load-bearing and can no longer be a fast-follow.
  */
  it('TC_AR_142 (negative): with the toast suppressed the state change is still evident', async () => {
    const store = mkStore();
    seedReady(store);
    render(
      <Provider store={store}>
        <AuditPanel projectId="P1" />
        {/* No WizardToast mounted at all. */}
      </Provider>
    );

    await clickSwitch(/unpublished entries/i);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    // The impact panel moved…
    expect(screen.getByText('6 items excluded and will not be migrated.')).toBeInTheDocument();
    // …and so did the control.
    expect(
      card(/unpublished entries/i).querySelector('[role="switch"]')
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('TC_AR_142 (positive): a dismissed toast leaves the queue empty', async () => {
    const store = mkStore();
    seedReady(store);
    renderAll(store);
    act(() => {
      store.dispatch(toastActions.show('Excluding all 6 entries'));
    });

    await act(async () => {
      vi.advanceTimersByTime(TOAST_DISMISS_MS + 10);
    });

    expect(store.getState().toast.queue).toEqual([]);
  });
});
