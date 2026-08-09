import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 tranche 3c: the flagged-items table.
 *
 * Backs TC_AR_078–105 (feature.md FR-6.1 … FR-6.13, FR-10.6, NFR-8, NFR-9; trd.md
 * TR-18, and API-4's server-side contract).
 *
 * The boundary that shapes this whole file: **the table does not filter, search or
 * paginate.** It holds one page and asks the server for the next (FR-6.4), so the
 * observable effect of a pill click or a keystroke is a REQUEST with the right
 * arguments — asserted on the thunk — plus the store state the request derives
 * from. Asserting locally-filtered rows would test an implementation the spec
 * forbids.
 */
const { mockLoadItems } = vi.hoisted(() => ({ mockLoadItems: vi.fn(() => () => {}) }));

vi.mock('../../../../../v3/store/thunks/audit.thunks', () => ({
  loadAuditFindings: () => () => {},
  startAuditScan: () => () => {},
  pollAuditJob: () => () => {},
  loadAuditItems: mockLoadItems,
  rerunAudit: () => () => {},
  proceedFromAudit: () => () => {},
}));

import auditReducer, {
  auditActions,
  AuditCheckView,
  AuditDecisionsView,
  AuditFilter,
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

const checks = (counts: Partial<Record<keyof typeof LABELS, number>> = {}): AuditCheckView[] => [
  { id: 'unusedAssets', label: LABELS.unusedAssets, state: 'done', count: counts.unusedAssets ?? 4 },
  { id: 'unpublishedEntries', label: LABELS.unpublishedEntries, state: 'done', count: counts.unpublishedEntries ?? 6 },
  { id: 'emptyContentTypes', label: LABELS.emptyContentTypes, state: 'done', count: counts.emptyContentTypes ?? 1 },
  { id: 'unusedGlobalFields', label: LABELS.unusedGlobalFields, state: 'done', count: counts.unusedGlobalFields ?? 1 },
];

const TOTALS: AuditTotalsView = {
  contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36,
};

const NO_DECISIONS: AuditDecisionsView = { categories: {}, itemOverrides: {} };

const entryRow = (n: number, over: Partial<AuditItemView> = {}): AuditItemView => ({
  key: `entry:blog:e${n}:en`,
  category: 'unpublishedEntries',
  type: 'Entry',
  title: `Q3 launch recap ${n}`,
  uid: `blt55e10ab${n}`,
  contentType: 'Blog post',
  locale: 'en',
  status: 'Never published',
  ...over,
});

const assetRow = (n: number, over: Partial<AuditItemView> = {}): AuditItemView => ({
  key: `asset:a${n}`,
  category: 'unusedAssets',
  type: 'Asset',
  title: `old-hero-banner-${n}.jpg`,
  uid: `blt7c2a91f${n}`,
  status: 'Unused',
  ...over,
});

const ctRow = (): AuditItemView => ({
  key: 'contentType:flights',
  category: 'emptyContentTypes',
  type: 'Content type',
  title: 'Flights',
  uid: 'flights',
  status: '0 entries',
});

const ALL_COUNTS = { all: 12, entries: 6, assets: 4, contentTypes: 1, globalFields: 1 };

const mkStore = () => configureStore({ reducer: { audit: auditReducer } });

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <AuditPanel projectId="P1" />
    </Provider>
  );

const seed = (
  store: ReturnType<typeof mkStore>,
  opts: {
    items?: AuditItemView[];
    page?: number;
    pageCount?: number;
    total?: number;
    counts?: Record<AuditFilter, number>;
    decisions?: AuditDecisionsView;
    checkCounts?: Partial<Record<keyof typeof LABELS, number>>;
  } = {}
) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks: checks(opts.checkCounts),
      totals: TOTALS,
      variantsInspected: true,
      decisions: opts.decisions ?? NO_DECISIONS,
    })
  );
  store.dispatch(
    auditActions.itemsLoaded({
      items: opts.items ?? [entryRow(1), assetRow(1), ctRow()],
      page: opts.page ?? 1,
      pageCount: opts.pageCount ?? 1,
      total: opts.total ?? 12,
      counts: opts.counts ?? ALL_COUNTS,
    })
  );
};

/** Fixture F2: 120 excludable flagged items — 100 entries, 20 assets. */
const seedF2 = (store: ReturnType<typeof mkStore>, page = 1) => {
  const rows =
    page === 3
      ? Array.from({ length: 20 }, (_, i) => assetRow(i))
      : Array.from({ length: 50 }, (_, i) => entryRow(i));
  store.dispatch(
    auditActions.findingsLoaded({
      checks: checks({ unpublishedEntries: 100, unusedAssets: 20, emptyContentTypes: 0, unusedGlobalFields: 0 }),
      totals: TOTALS,
      variantsInspected: true,
      decisions: NO_DECISIONS,
    })
  );
  store.dispatch(
    auditActions.itemsLoaded({
      items: rows,
      page,
      pageCount: 3,
      total: 120,
      counts: { all: 120, entries: 100, assets: 20, contentTypes: 0, globalFields: 0 },
    })
  );
};

const table = () => screen.getByRole('region', { name: /all flagged items/i });
const rows = () => within(table()).getAllByRole('row').slice(1); // drop the header row
const lastItemsRequest = () => mockLoadItems.mock.calls.at(-1)?.[0] as any;

beforeEach(() => {
  mockLoadItems.mockClear();
});

// ───────────────────────── structure ─────────────────────────

describe('v3 audit table — structure', () => {
  it('TC_AR_078 (positive): the table is expanded by default and shows its rows', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(within(table()).getByRole('table')).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  // Negative — taxonomy #4 (forbidden state): collapsing hides the rows but keeps the
  // section and its summary, so the user can still see what was found.
  it('TC_AR_078 (negative): a collapsed table hides its rows but keeps the section heading', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /hide table/i }));

    expect(screen.getByText('All flagged items')).toBeInTheDocument();
    expect(within(table()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('TC_AR_079 (positive): the collapse control label flips between Hide table and Show table', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /hide table/i }));
    expect(screen.getByRole('button', { name: /show table/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /show table/i }));
    expect(screen.getByRole('button', { name: /hide table/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): collapsing must not reset the filter,
    the search or the decisions. AC-4.6 requires per-item decisions to survive a
    collapse; resetting the filter would additionally throw away the user's place.
  */
  it('TC_AR_079 (negative): collapsing and expanding preserves the filter, search and decisions', async () => {
    const store = mkStore();
    seed(store, { decisions: { categories: {}, itemOverrides: { 'asset:a1': 'exclude' } } });
    store.dispatch(auditActions.setFilter('assets'));
    store.dispatch(auditActions.setSearch('hero'));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /hide table/i }));
    await userEvent.click(screen.getByRole('button', { name: /show table/i }));

    const s = store.getState().audit;
    expect(s.filter).toBe('assets');
    expect(s.search).toBe('hero');
    expect(s.decisions.itemOverrides['asset:a1']).toBe('exclude');
  });

  it('TC_AR_080 (positive): the table exposes the six specified columns', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    const headers = within(table()).getAllByRole('columnheader').map((h) => h.textContent?.trim());
    expect(headers).toEqual(['Include?', 'Type', 'Title / UID', 'Content type', 'Locale', 'Status']);
  });

  /*
    Negative — taxonomy #5 (information disclosure): no seventh column. FR-10.6 limits
    the page to these six fields, so an extra column is the mechanism by which
    customer content would reach the DOM.
  */
  it('TC_AR_080 (negative): the table exposes no column beyond the six permitted', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(within(table()).getAllByRole('columnheader')).toHaveLength(6);
  });
});

// ───────────────────────── pagination ─────────────────────────

describe('v3 audit table — pagination', () => {
  it('TC_AR_081 (positive): fixture F2 shows 50 rows and reports page 1 of 3', () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    expect(rows()).toHaveLength(50);
    expect(within(table()).getByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  // Negative — taxonomy #3 (boundary): the page size is not the total. A table showing
  // all 120 rows has silently defeated pagination.
  it('TC_AR_081 (negative): a 120-item set never renders more than one page of rows at once', () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    expect(rows().length).toBeLessThanOrEqual(50);
    // The summary, specifically — an unanchored /120/ also matches the "All 120" pill.
    expect(within(table()).getByText('120 flagged')).toBeInTheDocument();
  });

  it('TC_AR_082 (positive): moving to the last page requests it and shows the remainder', async () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: /next page/i }));

    expect(lastItemsRequest()).toMatchObject({ page: 2 });
  });

  /*
    Negative — taxonomy #3 (boundary): paging controls must not offer a move past
    either end. Requesting page 0 or page 4 of 3 is a client error the server would
    reject (TC_AR_170), so the control must not produce it.
  */
  it('TC_AR_082 (negative): the paging controls do not offer a move beyond either end', () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    expect(within(table()).getByRole('button', { name: /previous page/i })).toBeDisabled();

    // Wrapped in act(): a raw store dispatch is not an RTL event, so without this React
    // has not re-rendered by the time the synchronous assertion below runs.
    act(() => {
      store.dispatch(auditActions.setPage(3));
    });
    expect(within(table()).getByRole('button', { name: /next page/i })).toBeDisabled();
  });
});

// ───────────────────────── server-side query ─────────────────────────

describe('v3 audit table — filtering and searching are server-side', () => {
  it('TC_AR_083 (positive): choosing a filter requests that filter from the server', async () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: /^assets/i }));

    expect(lastItemsRequest()).toMatchObject({ filter: 'assets' });
  });

  /*
    Negative — taxonomy #4 (forbidden state): changing the filter must reset to page 1.
    Staying on page 3 while narrowing to a single-page result set asks the server for a
    page that does not exist — an empty table for what looks like a working filter.
  */
  it('TC_AR_083 (negative): changing the filter resets to page 1 rather than keeping the old page', async () => {
    const store = mkStore();
    seedF2(store, 3);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: /^assets/i }));

    expect(store.getState().audit.page).toBe(1);
    expect(lastItemsRequest()).toMatchObject({ filter: 'assets', page: 1 });
  });

  it('TC_AR_084 (positive): typing a search term requests it from the server', async () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    await userEvent.type(within(table()).getByRole('searchbox'), 'hero');

    expect(lastItemsRequest()).toMatchObject({ q: 'hero' });
  });

  // Negative — taxonomy #4 (forbidden state): a new search resets to page 1, for the
  // same reason a filter change does.
  it('TC_AR_084 (negative): a new search term resets to page 1', async () => {
    const store = mkStore();
    seedF2(store, 3);
    renderPanel(store);

    await userEvent.type(within(table()).getByRole('searchbox'), 'hero');

    expect(store.getState().audit.page).toBe(1);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the table must NOT filter its own rows. It
    holds one page; filtering locally would hide rows the server already selected and
    make the count disagree with what is shown (FR-6.4).
  */
  it('TC_AR_083b (negative): the table does not locally filter the page it was given', async () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1), assetRow(1), ctRow()] });
    renderPanel(store);

    store.dispatch(auditActions.setFilter('assets'));

    // The server has not yet answered, so all three given rows remain on screen.
    expect(rows()).toHaveLength(3);
  });

  it('TC_AR_083b (positive): rows rendered are exactly those the server returned', () => {
    const store = mkStore();
    seed(store, { items: [assetRow(1), assetRow(2)] });
    renderPanel(store);

    expect(rows()).toHaveLength(2);
    expect(within(table()).getByText('old-hero-banner-1.jpg')).toBeInTheDocument();
    expect(within(table()).getByText('old-hero-banner-2.jpg')).toBeInTheDocument();
  });
});

// ───────────────────────── filter pills ─────────────────────────

describe('v3 audit table — filter pills', () => {
  it('TC_AR_085 (positive): five pills are shown, each labelled with its count', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    for (const [label, n] of [
      // Anchored: an unanchored /all/i also matches the "Exclude all flagged" button
      // that must sit in this same region, so the query has to be precise about which
      // control it means.
      [/^all\b/i, 12], [/^entries/i, 6], [/^assets/i, 4], [/^content types/i, 1], [/^global fields/i, 1],
    ] as const) {
      const pill = within(table()).getByRole('button', { name: label });
      expect(pill.textContent).toContain(String(n));
    }
  });

  /*
    Negative — taxonomy #1 (empty input): a pill whose count is zero is still shown.
    The design lists "Global fields 0" explicitly — hiding it would make the absence of
    a category indistinguishable from a category that was never offered.
  */
  it('TC_AR_085 (negative): a pill with a count of zero is still rendered', () => {
    const store = mkStore();
    seed(store, { counts: { all: 6, entries: 6, assets: 0, contentTypes: 0, globalFields: 0 } });
    renderPanel(store);

    const pill = within(table()).getByRole('button', { name: /^global fields/i });
    expect(pill.textContent).toContain('0');
  });

  it('TC_AR_086 (positive): pill counts describe the whole flagged set, not the current page', () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    // 50 entry rows are on screen, but the pill reports all 100.
    expect(rows()).toHaveLength(50);
    expect(within(table()).getByRole('button', { name: /^entries/i }).textContent).toContain('100');
  });

  // Negative — taxonomy #4 (forbidden state): paging must not change a pill's count.
  it('TC_AR_086 (negative): moving between pages leaves the pill counts unchanged', () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);
    const before = within(table()).getByRole('button', { name: /^entries/i }).textContent;

    seedF2(store, 3);

    expect(within(table()).getByRole('button', { name: /^entries/i }).textContent).toBe(before);
  });

  it('TC_AR_087 (positive): the chosen pill is marked as selected', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: /^assets/i }));

    expect(within(table()).getByRole('button', { name: /^assets/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  /*
    Negative — taxonomy #7 (conflict): exactly one pill may be selected. Two selected
    pills present a filter state the server contract cannot express.
  */
  it('TC_AR_087 (negative): selecting a pill deselects the previously selected one', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: /^assets/i }));
    const pressed = within(table())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');

    expect(pressed).toHaveLength(1);
  });
});

// ───────────────────────── search ─────────────────────────

describe('v3 audit table — search', () => {
  // Written out rather than table-driven so each name carries its own TC id in the
  // source, not only at runtime.
  it('TC_AR_088 (positive): a term matching an item title is sent to the server', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.type(within(table()).getByRole('searchbox'), 'launch');
    expect(lastItemsRequest()).toMatchObject({ q: 'launch' });
  });

  it('TC_AR_089 (positive): a term matching an item uid is sent to the server', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.type(within(table()).getByRole('searchbox'), 'blt55e10ab');
    expect(lastItemsRequest()).toMatchObject({ q: 'blt55e10ab' });
  });

  it('TC_AR_090 (positive): a term matching an item type is sent to the server', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.type(within(table()).getByRole('searchbox'), 'Asset');
    expect(lastItemsRequest()).toMatchObject({ q: 'Asset' });
  });

  it('TC_AR_091 (positive): a term matching an item content type is sent to the server', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.type(within(table()).getByRole('searchbox'), 'Blog post');
    expect(lastItemsRequest()).toMatchObject({ q: 'Blog post' });
  });

  it('TC_AR_092 (positive): the term is sent verbatim, with case folding left to the server', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.type(within(table()).getByRole('searchbox'), 'HERO');

    // Case-insensitivity is the server's job (FR-6.6); mangling the term here would
    // make the client and server disagree about what was searched.
    expect(lastItemsRequest()).toMatchObject({ q: 'HERO' });
  });

  /*
    Negative — taxonomy #1 (empty input): a whitespace-only term is not a search. Sent
    as-is it would match nothing and show the no-results copy for what the user
    experiences as an empty box.
  */
  it('TC_AR_088 (negative): a whitespace-only search is treated as no search', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.type(within(table()).getByRole('searchbox'), '   ');

    expect(lastItemsRequest()?.q ?? '').toBe('');
  });

  // Negative — taxonomy #1 (missing input): clearing the box restores the unfiltered
  // request rather than leaving the last term in force.
  it('TC_AR_089 (negative): clearing the search box requests the unfiltered set', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    const box = within(table()).getByRole('searchbox');
    await userEvent.type(box, 'hero');
    await userEvent.clear(box);

    expect(lastItemsRequest()?.q ?? '').toBe('');
  });

  /*
    Negative — taxonomy #2 (invalid shape): search covers the four fields FR-6.6 names
    and no others. Including `status` would make "Never published" a search term that
    silently returns every unpublished row — plausible-looking and out of spec.
  */
  it('TC_AR_090 (negative): the searchable fields are declared as the four in the contract', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.type(within(table()).getByRole('searchbox'), 'Never published');

    // The client sends the term; it must not add a field list of its own devising.
    const req = lastItemsRequest();
    expect(req).toMatchObject({ q: 'Never published' });
    expect(req).not.toHaveProperty('fields');
  });

  it('TC_AR_098 (positive): a result set of zero shows the no-results copy verbatim', () => {
    const store = mkStore();
    seed(store, { items: [], total: 0, counts: { all: 0, entries: 0, assets: 0, contentTypes: 0, globalFields: 0 } });
    renderPanel(store);

    expect(within(table()).getByText('No items match your filters.')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #1 (empty input): the no-results copy must not appear while rows
    are present. Showing both is the classic loading-state bug and it makes the table
    contradict itself.
  */
  it('TC_AR_098 (negative): the no-results copy is absent whenever rows are present', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(rows()).toHaveLength(3);
    expect(within(table()).queryByText('No items match your filters.')).not.toBeInTheDocument();
  });
});

// ───────────────────────── rows ─────────────────────────

describe('v3 audit table — rows', () => {
  it('TC_AR_093 (positive): an excludable row exposes a checkbox labelled with its state', () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1)] });
    renderPanel(store);

    const row = rows()[0];
    expect(within(row).getByRole('checkbox')).toBeEnabled();
    expect(within(row).getByText('Included')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #5 (permission denial): a non-excludable row's checkbox is
    disabled and explains itself. A-4 makes content types permanently included, so the
    control must communicate that rather than simply not respond.
  */
  it('TC_AR_094 (negative): a content-type row has a disabled checkbox with an explanation', () => {
    const store = mkStore();
    seed(store, { items: [ctRow()] });
    renderPanel(store);

    const box = within(rows()[0]).getByRole('checkbox');
    expect(box).toBeDisabled();
    expect(box.getAttribute('aria-label') ?? box.getAttribute('title') ?? '').toMatch(
      /always included/i
    );
  });

  /*
    Negative — taxonomy #4 (forbidden state): clicking a disabled checkbox changes
    nothing at all — not the row, not the decisions, not the impact figures.
  */
  it('TC_AR_095 (negative): clicking a locked row checkbox changes no state', async () => {
    const store = mkStore();
    seed(store, { items: [ctRow()] });
    renderPanel(store);

    await userEvent.click(within(rows()[0]).getByRole('checkbox'));

    expect(store.getState().audit.decisions).toEqual(NO_DECISIONS);
  });

  /*
    Negative — taxonomy #2 (invalid shape): an asset row has no content type and no
    locale (DM-3), so those cells must be empty rather than carrying a neighbouring
    row's values. A table that reuses the last non-empty value is a real and quiet bug
    — the row reads as belonging to a content type it has nothing to do with.
  */
  it('TC_AR_091 (negative): an asset row leaves Content type and Locale empty rather than reusing a neighbour\'s', () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1), assetRow(1)] });
    renderPanel(store);

    const assetCells = within(rows()[1]).getAllByRole('cell').map((c) => c.textContent?.trim());
    // Columns: Include? | Type | Title/UID | Content type | Locale | Status
    expect(assetCells[3]).not.toMatch(/Blog post/);
    expect(assetCells[4]).not.toMatch(/^en$/);
  });

  /*
    Negative — taxonomy #4 (forbidden state): excluding one row must not disturb its
    siblings. Every row writes into one shared override map, so a handler that replaced
    the map rather than setting one key would silently re-include everything else.
  */
  it('TC_AR_096 (negative): excluding one row leaves the other rows\' decisions untouched', async () => {
    const store = mkStore();
    seed(store, {
      items: [entryRow(1), entryRow(2)],
      decisions: { categories: {}, itemOverrides: { 'entry:blog:e2:en': 'exclude' } },
    });
    renderPanel(store);

    await userEvent.click(within(rows()[0]).getByRole('checkbox'));

    expect(store.getState().audit.decisions.itemOverrides).toEqual({
      'entry:blog:e1:en': 'exclude',
      'entry:blog:e2:en': 'exclude',
    });
  });

  it('TC_AR_096 (positive): excluding a row updates its state label', async () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1)] });
    renderPanel(store);

    await userEvent.click(within(rows()[0]).getByRole('checkbox'));

    expect(within(rows()[0]).getByText('Excluded')).toBeInTheDocument();
    expect(store.getState().audit.decisions.itemOverrides['entry:blog:e1:en']).toBe('exclude');
  });

  it('TC_AR_097 (positive): an excluded row states its state in text, not only in colour', () => {
    const store = mkStore();
    seed(store, {
      items: [entryRow(1)],
      decisions: { categories: {}, itemOverrides: { 'entry:blog:e1:en': 'exclude' } },
    });
    renderPanel(store);

    const row = rows()[0];
    expect(within(row).getByText('Excluded')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  /*
    Negative — taxonomy #2 (invalid shape): each row's checkbox needs an accessible name
    identifying WHICH item it governs. Fifty checkboxes reading "Included" leave a
    screen-reader user unable to tell what they are about to drop (NFR-8).
  */
  it('TC_AR_097 (negative): each row checkbox is named for its own item, not just its state', () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1), assetRow(1)] });
    renderPanel(store);

    const names = rows().map((r) => {
      const box = within(r).getByRole('checkbox');
      return box.getAttribute('aria-label') ?? '';
    });

    expect(names[0]).toMatch(/Q3 launch recap 1/);
    expect(names[1]).toMatch(/old-hero-banner-1\.jpg/);
  });
});

// ───────────────────────── the bulk button ─────────────────────────

describe('v3 audit table — the bulk button', () => {
  it('TC_AR_099 (positive): with nothing excluded the bulk button reads Exclude all flagged', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(within(table()).getByRole('button', { name: 'Exclude all flagged' })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the label must reflect decisions made
    ANYWHERE, including a card switch. A label derived only from the table's own clicks
    goes stale the moment a card is toggled, and then contradicts the impact panel.
  */
  it('TC_AR_099 (negative): the label flips when a decision is made outside the table', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    act(() => {
      store.dispatch(
        auditActions.setDecisions({ categories: { unusedAssets: 'exclude' }, itemOverrides: {} })
      );
    });

    expect(within(table()).getByRole('button', { name: 'Include everything' })).toBeInTheDocument();
    expect(
      within(table()).queryByRole('button', { name: 'Exclude all flagged' })
    ).not.toBeInTheDocument();
  });

  it('TC_AR_100 (positive): after any exclusion the bulk button reads Include everything', async () => {
    const store = mkStore();
    seed(store, { items: [entryRow(1)] });
    renderPanel(store);

    await userEvent.click(within(rows()[0]).getByRole('checkbox'));

    expect(within(table()).getByRole('button', { name: 'Include everything' })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #1 (empty input): with no excludable items flagged there is
    nothing to exclude, so the button must not offer to. A live "Exclude all flagged"
    over an empty set does nothing and looks broken.
  */
  it('TC_AR_100 (negative): with no excludable items flagged the bulk button is not offered', () => {
    const store = mkStore();
    seed(store, {
      items: [ctRow()],
      checkCounts: { unpublishedEntries: 0, unusedAssets: 0, emptyContentTypes: 1, unusedGlobalFields: 1 },
      counts: { all: 2, entries: 0, assets: 0, contentTypes: 1, globalFields: 1 },
    });
    renderPanel(store);

    expect(
      within(table()).queryByRole('button', { name: /exclude all flagged/i })
    ).not.toBeInTheDocument();
  });

  it('TC_AR_101 (positive): Exclude all flagged acts on the whole set, not the visible page', async () => {
    const store = mkStore();
    seedF2(store, 1);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Exclude all flagged' }));

    // Expressed as category states, which is what makes it cover all 120 rather than
    // the 50 on screen (FR-6.12).
    expect(store.getState().audit.decisions.categories).toEqual({
      unpublishedEntries: 'exclude',
      unusedAssets: 'exclude',
    });
  });

  /*
    Negative — taxonomy #4 (forbidden state): the bulk action must ignore the active
    filter. Acting only on the filtered subset would contradict the button's own label.
  */
  it('TC_AR_102 (negative): Exclude all flagged ignores the active filter and search', async () => {
    const store = mkStore();
    seedF2(store, 1);
    store.dispatch(auditActions.setFilter('assets'));
    store.dispatch(auditActions.setSearch('hero'));
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Exclude all flagged' }));

    expect(store.getState().audit.decisions.categories).toEqual({
      unpublishedEntries: 'exclude',
      unusedAssets: 'exclude',
    });
  });

  it('TC_AR_103 (positive): on fixture F1 Exclude all flagged excludes both excludable categories', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Exclude all flagged' }));

    expect(store.getState().audit.decisions.categories).toEqual({
      unpublishedEntries: 'exclude',
      unusedAssets: 'exclude',
    });
  });

  /*
    Negative — taxonomy #4 (forbidden state): the bulk action must not touch the
    non-excludable categories. Writing a state for them would store an instruction the
    resolver is required to ignore — and the endpoint rejects (TC_AR_172b).
  */
  it('TC_AR_105 (negative): Exclude all flagged writes no state for content types or global fields', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Exclude all flagged' }));

    const cats = store.getState().audit.decisions.categories;
    expect(cats).not.toHaveProperty('emptyContentTypes');
    expect(cats).not.toHaveProperty('unusedGlobalFields');
  });

  it('TC_AR_104 (positive): Include everything clears both category states and every override', async () => {
    const store = mkStore();
    seed(store, {
      decisions: {
        categories: { unpublishedEntries: 'exclude' },
        itemOverrides: { 'asset:a1': 'exclude', 'asset:a2': 'exclude', 'asset:a3': 'exclude' },
      },
    });
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Include everything' }));

    expect(store.getState().audit.decisions).toEqual({ categories: {}, itemOverrides: {} });
  });

  /*
    Negative — taxonomy #1 (missing input): Include everything must also clear a state
    consisting of overrides alone, with no category state set. Clearing only
    `categories` is the easy half-implementation and it leaves the excluded rows
    excluded while the button claims otherwise.
  */
  it('TC_AR_104 (negative): Include everything clears overrides even with no category state set', async () => {
    const store = mkStore();
    seed(store, {
      decisions: { categories: {}, itemOverrides: { 'entry:blog:e1:en': 'exclude' } },
    });
    renderPanel(store);

    await userEvent.click(within(table()).getByRole('button', { name: 'Include everything' }));

    expect(store.getState().audit.decisions.itemOverrides).toEqual({});
  });
});
