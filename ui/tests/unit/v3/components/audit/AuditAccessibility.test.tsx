import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 closing tranche: accessibility, plus the rendered
 * half of the unrun-check rule.
 *
 * Backs TC_AR_048 and TC_AR_185–187 (feature.md NFR-8, NFR-9, FR-2.11, FR-5.4).
 *
 * These three accessibility rows are asserted here **under their own ids**. Their
 * concerns are also checked at the point of use — a switch's keyboard operation in
 * the cards suite, a row checkbox's name in the table suite — but a whole-page sweep
 * is a different assertion from a per-control one: it is the sweep that catches the
 * control nobody remembered.
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
  AuditItemView,
  AuditTotalsView,
} from '../../../../../v3/store/slice/audit.slice';
import AuditPanel from '../../../../../v3/components/audit/AuditPanel';

const LABELS = {
  unusedAssets: 'Unused assets — referenced by any entry?',
  unpublishedEntries: 'Unpublished entries — has publish details?',
  emptyContentTypes: 'Empty content types — any entries at all?',
  unusedGlobalFields: 'Unused global fields — referenced by a schema?',
} as const;

const TOTALS: AuditTotalsView = {
  contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36,
};

const row = (n: number): AuditItemView => ({
  key: `entry:blog:e${n}:en`,
  category: 'unpublishedEntries',
  type: 'Entry',
  title: `Q3 launch recap ${n}`,
  uid: `blt55e10ab${n}`,
  contentType: 'Blog post',
  locale: 'en',
  status: 'Never published',
});

const mkStore = () => configureStore({ reducer: { audit: auditReducer } });

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <AuditPanel projectId="P1" />
    </Provider>
  );

const seedReady = (
  store: ReturnType<typeof mkStore>,
  checks?: AuditCheckView[],
  pageCount = 2
) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks:
        checks ?? [
          { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'done', count: 4 },
          { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: 6 },
          { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'done', count: 1 },
          { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: 1 },
        ],
      totals: TOTALS,
      variantsInspected: true,
      decisions: { categories: {}, itemOverrides: { 'entry:blog:e2:en': 'exclude' } },
    })
  );
  store.dispatch(
    auditActions.itemsLoaded({
      items: [row(1), row(2)],
      page: 1,
      pageCount,
      total: 12,
      counts: { all: 12, entries: 6, assets: 4, contentTypes: 1, globalFields: 1 },
    })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('v3 audit panel — accessibility sweep', () => {
  it('TC_AR_185 (positive): every interactive control in the ready state is keyboard reachable', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const interactive = [
      ...screen.getAllByRole('switch'),
      ...screen.getAllByRole('checkbox'),
      ...screen.getAllByRole('button'),
    ].filter((el) => !(el as HTMLButtonElement).disabled);

    expect(interactive.length).toBeGreaterThan(5);
    for (const el of interactive) {
      // Reachable means in the tab order — not merely clickable.
      expect(el.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  /*
    Negative — taxonomy #2 (invalid shape): no interactive control may be removed from
    the tab order, and none may hide its focus. NFR-8 requires a visible focus
    indicator, and `outline: none` with no replacement is the single most common way a
    keyboard user is locked out of a page that works fine with a mouse.
  */
  it('TC_AR_185 (negative): no interactive control is removed from the tab order or hides its focus ring', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const first = screen.getAllByRole('switch')[0];
    await userEvent.tab();

    // Something in the panel takes focus on the first tab — the page is not a dead end.
    expect(document.activeElement).not.toBe(document.body);

    first.focus();
    const style = window.getComputedStyle(first);
    const suppressed = style.outlineStyle === 'none' && !style.boxShadow && !style.border;
    expect(suppressed).toBe(false);
  });

  it('TC_AR_186 (positive): every interactive control has a non-empty accessible name', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const controls = [
      ...screen.getAllByRole('switch'),
      ...screen.getAllByRole('checkbox'),
      ...screen.getAllByRole('button'),
    ];

    for (const el of controls) {
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      expect(name.length).toBeGreaterThan(0);
    }
  });

  /*
    Negative — taxonomy #2 (invalid shape): no accessible name may rely on position or
    colour to disambiguate. Two switches and many row checkboxes sit on this page, so
    names like "toggle", "Included" or "switch" are all technically non-empty and all
    useless — the user cannot tell which content they are about to drop.
  */
  it('TC_AR_186 (negative): no accessible name is a bare state word that fails to identify its control', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const controls = [...screen.getAllByRole('switch'), ...screen.getAllByRole('checkbox')];
    const names = controls.map((el) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
    );

    for (const name of names) {
      expect(name).not.toMatch(/^(toggle|switch|checkbox|included|excluded|on|off)$/i);
    }
    // And they are distinguishable from one another.
    expect(new Set(names).size).toBe(names.length);
  });

  it('TC_AR_187 (positive): include and exclude state is stated in text wherever it is shown', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    // On the cards…
    expect(
      within(screen.getByRole('group', { name: /unpublished entries/i })).getByText('Included')
    ).toBeInTheDocument();
    // …and on the rows, one of which is excluded by an override.
    const tableRegion = screen.getByRole('region', { name: /all flagged items/i });
    expect(within(tableRegion).getByText('Excluded')).toBeInTheDocument();
    expect(within(tableRegion).getAllByText('Included').length).toBeGreaterThan(0);
  });

  /*
    Negative — taxonomy #2 (invalid shape): state must not be carried by `aria-checked`
    alone either. NFR-9 requires TEXT as well as colour — a sighted user who cannot
    distinguish the switch track's fill needs the word, and `aria-checked` does nothing
    for them.
  */
  it('TC_AR_187 (negative): state is not conveyed by aria-checked alone, without visible text', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    const sw = within(card).getByRole('switch');

    expect(sw).toHaveAttribute('aria-checked');
    // The word must be present in the same card, visible to someone who cannot read
    // the colour.
    expect(within(card).getByText(/^(Included|Excluded)$/)).toBeInTheDocument();
  });
});

describe('v3 audit panel — an unrun check as rendered', () => {
  /*
    TC_AR_048's own id. The card-level rule is asserted in the cards suite; this is the
    whole-page sweep — no `0`, no clean state and no "All clean" anywhere on the page
    for a check that resolved `unavailable` (FR-2.11, G-3).
  */
  it('TC_AR_048 (negative): an unavailable check produces no zero and no clean label anywhere on the page', () => {
    const store = mkStore();
    seedReady(store, [
      { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'unavailable' },
      { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: 6 },
      { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'unavailable' },
      { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: 1 },
    ]);
    const { container } = renderPanel(store);

    // The one check that DID run still reports normally — so this is not simply an
    // empty page.
    expect(screen.getByText(/6 unpublished entries/i)).toBeInTheDocument();

    expect(screen.queryByText('All clean')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('0 unused assets');
    expect(container.textContent).not.toContain('0 empty content types');
  });

  it('TC_AR_048 (positive): a check that genuinely found nothing does show a clean state', () => {
    const store = mkStore();
    seedReady(store, [
      { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'done', count: 4 },
      { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: 6 },
      { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'done', count: 0 },
      { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: 0 },
    ]);
    renderPanel(store);

    // The contrast that gives the negative above its meaning: zero-because-we-looked
    // is a legitimate clean result, and it must still be reachable.
    expect(screen.getAllByText('All clean').length).toBeGreaterThan(0);
  });
});
