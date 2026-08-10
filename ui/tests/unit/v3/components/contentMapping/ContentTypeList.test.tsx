import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1d: the list, search, paging
 * and selection.
 *
 * Backs TC_CTS_024–051, TC_CTS_167, TC_CTS_168, TC_CTS_171, TC_CTS_172
 * (feature.md FR-3.1 … FR-3.9, FR-4.1 … FR-4.7; trd.md TR-6 … TR-9, TC-1, TC-2).
 *
 * The whole inventory is held client-side (trd.md TC-1), so paging, search and
 * select-all are pure client state and nothing here needs a network mock beyond
 * the thunks. That is the point of TC-1 and it is what makes these assertions
 * synchronous.
 *
 * The distinction that repeatedly matters below is SCOPE: `Select all` and the
 * search must operate on the complete set of content types, not on the rows
 * currently rendered. A list that only ever acts on what is visible passes a
 * surprising number of naive tests, so several negatives here exist purely to
 * pin the difference.
 */
const { mockLoadInventory, mockPersist, mockProceed } = vi.hoisted(() => ({
  mockLoadInventory: vi.fn(() => () => Promise.resolve(true)),
  mockPersist: vi.fn(() => () => Promise.resolve(true)),
  mockProceed: vi.fn(() => () => Promise.resolve(true)),
}));

vi.mock('../../../../../v3/store/thunks/contentMapping.thunks', () => ({
  loadContentTypeInventory: mockLoadInventory,
  persistContentTypeSelection: mockPersist,
  proceedFromContentMapping: mockProceed,
}));

import contentMappingReducer, {
  contentMappingActions,
  ContentTypeInventoryItem,
} from '../../../../../v3/store/slice/contentMapping.slice';
import ContentMappingPanel from '../../../../../v3/components/contentMapping/ContentMappingPanel';

const mkStore = () => configureStore({ reducer: { contentMapping: contentMappingReducer } });

/** `n` content types named "CT 0" … "CT n-1", with uids `ct_0` … */
const many = (n: number): ContentTypeInventoryItem[] =>
  Array.from({ length: n }, (_, i) => ({
    uid: `ct_${i}`,
    title: `CT ${i}`,
    references: [],
    existsInDestination: false,
  }));

const F1: ContentTypeInventoryItem[] = [
  { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
  { uid: 'landing_page', title: 'Landing Page', references: [], existsInDestination: true },
  { uid: 'person', title: 'Person', references: [], existsInDestination: false },
  { uid: 'press_release', title: 'Press Release', references: [], existsInDestination: false },
];

const seed = (
  store: ReturnType<typeof mkStore>,
  contentTypes: ContentTypeInventoryItem[],
  over: Record<string, unknown> = {}
) =>
  store.dispatch(
    contentMappingActions.inventoryLoaded({
      contentTypes,
      destinationRead: true,
      ...over,
    } as never)
  );

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <ContentMappingPanel projectId="P1" />
    </Provider>
  );

/** Every content type checkbox, excluding the select-all control. */
const typeBoxes = () =>
  screen.getAllByRole('checkbox').filter((cb) => !/select all/i.test(cb.getAttribute('aria-label') ?? cb.textContent ?? ''));

const boxFor = (title: string) => screen.getByRole('checkbox', { name: new RegExp(`^${title}$`, 'i') });
const selectAll = () => screen.getByRole('checkbox', { name: /select all/i });
const selection = (store: ReturnType<typeof mkStore>) =>
  Object.keys(store.getState().contentMapping.selection.contentTypes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────── initial render and paging (FR-3.1 … FR-3.3) ─────────────────────────

describe('v3 content mapping — the list and its paging', () => {
  it('TC_CTS_024 (positive): renders one page of rows for a 120-content-type export', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    expect(typeBoxes()).toHaveLength(25);
  });

  /*
    Negative — taxonomy #3 (boundary): the page must be the FIRST 25 in export
    order, not an arbitrary 25. A list that sliced from the wrong end would still
    render the right count and hide the last content types behind a load-more the
    operator has no reason to press.
  */
  it('TC_CTS_024 (negative): renders the first page in export order, not an arbitrary slice', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    expect(screen.getByRole('checkbox', { name: /^CT 0$/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^CT 25$/ })).not.toBeInTheDocument();
  });

  it('TC_CTS_025 (positive): states how many of the total are shown', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    expect(screen.getByText('Showing 25 of 120')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the total must be the export's size, not
    the rendered count. "Showing 25 of 25" on a 120-type export tells the
    operator they have seen everything when they have seen a fifth of it.
  */
  it('TC_CTS_025 (negative): does not report the rendered count as the total', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    // Anchored: the element must exist and report the export's total, so the
    // absence assertion cannot be satisfied by rendering nothing.
    expect(screen.getByText(/^Showing \d+ of 120$/)).toBeInTheDocument();
    expect(screen.queryByText('Showing 25 of 25')).not.toBeInTheDocument();
  });

  it('TC_CTS_026 (positive): appends the next page when load-more is pressed', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(typeBoxes()).toHaveLength(50);
    expect(screen.getByText('Showing 50 of 120')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): load-more must APPEND, not replace.
    A page that swapped the visible rows would keep the count assertion above
    honest at 50 only by coincidence, and would lose the first page's rows.
  */
  it('TC_CTS_026 (negative): keeps the first page visible rather than replacing it', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(screen.getByRole('checkbox', { name: /^CT 0$/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^CT 49$/ })).toBeInTheDocument();
  });

  it('TC_CTS_027 (positive): offers no load-more control when the export is smaller than a page', () => {
    const store = mkStore();
    seed(store, many(10));
    renderPanel(store);

    // Anchored on the rows: an unrendered panel also has no load-more control.
    expect(typeBoxes()).toHaveLength(10);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): all ten rows must still render. Suppressing
    the control by rendering nothing would satisfy the assertion above while
    showing the operator an empty list.
  */
  it('TC_CTS_027 (negative): still renders every row when the export is smaller than a page', () => {
    const store = mkStore();
    seed(store, many(10));
    renderPanel(store);

    expect(typeBoxes()).toHaveLength(10);
  });

  it('TC_CTS_028 (positive): withdraws load-more once every content type is shown', async () => {
    const store = mkStore();
    seed(store, many(60));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(typeBoxes()).toHaveLength(60);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the control must survive while rows remain.
    Withdrawing it one page early strands the tail of the list with no way to
    reach it except search.
  */
  it('TC_CTS_028 (negative): keeps load-more available while any content type is still unshown', async () => {
    const store = mkStore();
    seed(store, many(60));
    renderPanel(store);

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(typeBoxes()).toHaveLength(50);
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });
});

// ───────────────────────── search (FR-3.4 … FR-3.8, EC-15) ─────────────────────────

describe('v3 content mapping — search', () => {
  const searchBox = () => screen.getByRole('searchbox');

  it('TC_CTS_029 (positive): lists only the content types whose title matches the term', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'blog');

    expect(typeBoxes()).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: /^Blog Article$/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): non-matching content types must be
    removed from the DOM, not merely hidden. A row that is still present but
    visually hidden stays reachable by keyboard and by every query below, which
    makes the filtered select-all in TC_CTS_047 impossible to reason about.
  */
  it('TC_CTS_029 (negative): removes non-matching rows rather than hiding them', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'blog');

    expect(screen.queryByRole('checkbox', { name: /^Person$/ })).not.toBeInTheDocument();
  });

  it('TC_CTS_030 (positive): matches regardless of the term’s case', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'BLOG');

    expect(screen.getByRole('checkbox', { name: /^Blog Article$/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): case-insensitivity must not become
    match-everything. A `toLowerCase()` applied to only one side of the
    comparison silently matches nothing, and a broken comparison that matches all
    would pass the positive above.
  */
  it('TC_CTS_030 (negative): does not match content types whose title lacks the term', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'BLOG');

    expect(typeBoxes()).toHaveLength(1);
  });

  it('TC_CTS_031 (positive): finds a content type that is beyond the loaded page', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(searchBox(), 'CT 90');

    expect(screen.getByRole('checkbox', { name: /^CT 90$/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): searching must not implicitly load
    pages. If the search worked by expanding the visible window it would return
    the right row here but leave the list permanently expanded once cleared,
    which TC_CTS_034 would then fail on.
  */
  it('TC_CTS_031 (negative): finds it without expanding the paged window', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(searchBox(), 'CT 90');
    await userEvent.clear(searchBox());

    expect(typeBoxes()).toHaveLength(25);
  });

  it('TC_CTS_032 (positive): hides the paging controls while a search is active', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await userEvent.type(searchBox(), 'CT 1');

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing \d+ of \d+/)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the paging controls must come back
    when the search is cleared. Hiding them permanently would strand a 120-type
    list at whatever page it happened to be on.
  */
  it('TC_CTS_032 (negative): restores the paging controls once the search is cleared', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(searchBox(), 'CT 1');
    await userEvent.clear(searchBox());

    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('TC_CTS_033 (positive): lists every match rather than one page of them', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    // "CT 1" matches CT 1 and CT 10–19 and CT 100–119 — 31 in total.
    await userEvent.type(searchBox(), 'CT 1');

    expect(typeBoxes().length).toBeGreaterThan(25);
  });

  /*
    Negative — taxonomy #3 (boundary): "every match" must be exact, not merely
    "more than a page". Pinning the precise figure is what distinguishes a real
    filter from one that returns everything.
  */
  it('TC_CTS_033 (negative): lists exactly the matching content types and no others', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(searchBox(), 'CT 1');

    // CT 1, CT 10–19 (10), CT 100–119 (20) = 31
    expect(typeBoxes()).toHaveLength(31);
  });

  it('TC_CTS_034 (positive): restores the previously loaded page size when the search is cleared', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await userEvent.type(searchBox(), 'CT 3');
    await userEvent.clear(searchBox());

    expect(typeBoxes()).toHaveLength(50);
  });

  /*
    Negative — taxonomy #3 (boundary): it must not reset to the initial page
    either. Collapsing back to 25 after a search throws away the operator's
    scrolling and is the more likely bug of the two.
  */
  it('TC_CTS_034 (negative): does not collapse back to the initial page size', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    await userEvent.type(searchBox(), 'CT 3');
    await userEvent.clear(searchBox());

    expect(typeBoxes()).not.toHaveLength(25);
  });

  it('TC_CTS_035 (positive): shows an empty-result state when nothing matches', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'zzzznomatch');

    expect(typeBoxes()).toHaveLength(0);
    expect(screen.getByTestId('cts-no-results')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the no-results state must not
    appear while rows are present. A permanently-rendered empty state would sit
    under a full list telling the operator nothing matched.
  */
  it('TC_CTS_035 (negative): shows no empty-result state while rows are present', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), 'blog');

    expect(screen.queryByTestId('cts-no-results')).not.toBeInTheDocument();
  });

  it('TC_CTS_036 (positive): treats regular-expression metacharacters as literal text', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), '.*');

    expect(typeBoxes()).toHaveLength(0);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the literal characters must still
    match when a title genuinely contains them. Treating the term as literal is
    not the same as discarding it.
  */
  it('TC_CTS_036 (negative): still matches a title that literally contains the metacharacters', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'weird', title: 'Report .* Draft', references: [], existsInDestination: false },
      ...F1,
    ]);
    renderPanel(store);

    await userEvent.type(searchBox(), '.*');

    expect(screen.getByRole('checkbox', { name: /Report \.\* Draft/ })).toBeInTheDocument();
  });

  it('TC_CTS_037 (positive): completes without error on an unbalanced parenthesis', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'paren', title: 'Launch (Beta)', references: [], existsInDestination: false },
      ...F1,
    ]);
    renderPanel(store);

    await userEvent.type(searchBox(), '(');

    expect(screen.getByRole('checkbox', { name: /Launch \(Beta\)/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): an unbalanced parenthesis compiled as
    a pattern throws, and a component that throws during render unmounts the
    whole panel. Asserting the search box survives proves the term never reached
    a regular-expression constructor.
  */
  it('TC_CTS_037 (negative): leaves the panel mounted rather than throwing on an invalid pattern', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.type(searchBox(), '(');

    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(typeBoxes()).toHaveLength(0);
  });

  it('TC_CTS_167 (positive): does not match a term that appears only in the uid', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'zz_internal_code', title: 'Marketing Page', references: [], existsInDestination: false },
    ]);
    renderPanel(store);

    await userEvent.type(searchBox(), 'zz_internal');

    expect(typeBoxes()).toHaveLength(0);
  });

  /*
    Negative — taxonomy #3 (boundary): the same content type must match on its
    TITLE. Without this, TC_CTS_167's positive is satisfied by a search that
    matches nothing at all.
  */
  it('TC_CTS_167 (negative): still matches that content type on its display title', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'zz_internal_code', title: 'Marketing Page', references: [], existsInDestination: false },
    ]);
    renderPanel(store);

    await userEvent.type(searchBox(), 'marketing');

    expect(typeBoxes()).toHaveLength(1);
  });
});

// ───────────────────────── selection (FR-4.1 … FR-4.7) ─────────────────────────

describe('v3 content mapping — selection', () => {
  it('TC_CTS_040 (positive): renders every row unticked when nothing is persisted', () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    expect(typeBoxes().every((cb) => !(cb as HTMLInputElement).checked)).toBe(true);
    expect(typeBoxes()).toHaveLength(4);
  });

  /*
    Negative — taxonomy #1 (missing input): an empty selection is not the same as
    no inventory. Anchored on the row count so an unrendered list cannot satisfy
    "everything is unticked".
  */
  it('TC_CTS_040 (negative): renders the rows rather than an empty list', () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    expect(screen.getByRole('checkbox', { name: /^Blog Article$/ })).toBeInTheDocument();
  });

  it('TC_CTS_041 (positive): adds a content type to the working selection when ticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(selection(store)).toEqual(['blog_article']);
    expect((boxFor('Blog Article') as HTMLInputElement).checked).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): ticking must not write to the
    server. TC-5 saves on the explicit control and on advance only, and an
    autosave here would mean one full project-file rewrite per checkbox.
  */
  it('TC_CTS_041 (negative): writes nothing to the server when a row is ticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(mockPersist).not.toHaveBeenCalled();
  });

  it('TC_CTS_042 (positive): removes a content type from the working selection when unticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);
    await userEvent.click(boxFor('Press Release'));

    await userEvent.click(boxFor('Press Release'));

    expect(selection(store)).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): unticking one row must leave the
    others alone. A handler keyed on the rendered index rather than the uid
    unticks the wrong row as soon as a search reorders the list.
  */
  it('TC_CTS_042 (negative): leaves other selected content types untouched when one is unticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);
    await userEvent.click(boxFor('Press Release'));
    await userEvent.click(boxFor('Landing Page'));

    await userEvent.click(boxFor('Press Release'));

    expect(selection(store)).toEqual(['landing_page']);
  });

  it('TC_CTS_043 (positive): does not tick a referenced content type when its referrer is ticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.click(boxFor('Blog Article'));

    expect((boxFor('Person') as HTMLInputElement).checked).toBe(false);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the working selection must contain
    only the ticked content type. Asserting the checkbox alone would miss a
    version that added the dependency to the selection without rendering it as
    ticked — which is worse, because the operator would never see it.
  */
  it('TC_CTS_043 (negative): adds only the ticked content type to the working selection', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(selection(store)).toEqual(['blog_article']);
  });

  it('TC_CTS_044 (positive): select-all covers every content type, not only the loaded page', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.click(selectAll());

    expect(selection(store)).toHaveLength(120);
  });

  /*
    Negative — taxonomy #3 (boundary): the specific trap is selecting only what is
    rendered. Naming a content type from beyond the first page makes that
    failure explicit rather than relying on the count.
  */
  it('TC_CTS_044 (negative): includes content types beyond the rendered page', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.click(selectAll());

    expect(selection(store)).toContain('ct_119');
  });

  it('TC_CTS_045 (positive): renders newly appended rows as ticked after select-all', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    const appended = screen.getByRole('checkbox', { name: /^CT 30$/ }) as HTMLInputElement;
    expect(appended.checked).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): appending a page must not alter the
    selection. A load-more that re-seeded row state would quietly deselect
    everything the operator had chosen.
  */
  it('TC_CTS_045 (negative): does not change the working selection when a page is appended', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(selectAll());
    const before = selection(store).length;

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(selection(store)).toHaveLength(before);
  });

  it('TC_CTS_046 (positive): unticking select-all empties the working selection', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(selectAll());

    expect(selection(store)).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): clearing everything must not raise
    the reference confirmation, even though the fixture is full of reference
    edges. FR-6.7 exempts select-all precisely because otherwise the operator
    would face one dialog per dependent content type.
  */
  it('TC_CTS_046 (negative): raises no reference confirmation when select-all is cleared', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(selectAll());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(selection(store)).toEqual([]);
  });

  it('TC_CTS_047 (positive): select-all under an active search covers only the matches', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.click(selectAll());

    // CT 11 and CT 110–119 = 11 matches.
    expect(selection(store)).toHaveLength(11);
  });

  /*
    Negative — taxonomy #3 (boundary): the unmatched remainder must stay unticked.
    A select-all that ignored the filter would select all 120 and still satisfy a
    loose "some are selected" assertion.
  */
  it('TC_CTS_047 (negative): leaves content types outside the search unticked', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.click(selectAll());

    expect(selection(store)).not.toContain('ct_0');
  });

  it('TC_CTS_048 (positive): labels select-all with the match count while a search is active', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');

    expect(screen.getByRole('checkbox', { name: 'Select all (11 matching)' })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the matching label must not persist
    once the search is cleared, or the control claims a scope it no longer has.
  */
  it('TC_CTS_048 (negative): drops the matching label once the search is cleared', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.clear(screen.getByRole('searchbox'));

    expect(screen.queryByRole('checkbox', { name: /matching/i })).not.toBeInTheDocument();
  });

  it('TC_CTS_049 (positive): leaves select-all unchecked while one content type is unselected', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(boxFor('CT 0'));

    expect((selectAll() as HTMLInputElement).checked).toBe(false);
  });

  /*
    Negative — taxonomy #3 (boundary): 119 of 120 is the boundary that separates
    "all" from "most". Anchored on the selection size so the unchecked state
    cannot be produced by an empty selection.
  */
  it('TC_CTS_049 (negative): is unchecked at 119 of 120 rather than because nothing is selected', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(boxFor('CT 0'));

    expect(selection(store)).toHaveLength(119);
  });

  it('TC_CTS_050 (positive): checks select-all once every content type is selected', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.click(selectAll());

    expect((selectAll() as HTMLInputElement).checked).toBe(true);
  });

  /*
    Negative — taxonomy #3 (boundary): select-all must reflect the scope it acts
    on. Under a search that matches 11 content types, selecting all 11 must check
    it — even though 109 others remain unselected.
  */
  it('TC_CTS_050 (negative): checks select-all when every match is selected under a search', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.click(selectAll());

    expect((selectAll() as HTMLInputElement).checked).toBe(true);
  });

  it('TC_CTS_051 (positive): keeps only the matched content types selected after the search is cleared', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.click(selectAll());
    await userEvent.clear(screen.getByRole('searchbox'));

    expect(selection(store)).toHaveLength(11);
  });

  /*
    Negative — taxonomy #4 (forbidden state): clearing the search must not widen
    the selection to everything now visible. That is the subtle version of the
    same bug — the selection following the viewport rather than the operator.
  */
  it('TC_CTS_051 (negative): does not select the rows that reappear when the search is cleared', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 11');
    await userEvent.click(selectAll());
    await userEvent.clear(screen.getByRole('searchbox'));

    expect((boxFor('CT 0') as HTMLInputElement).checked).toBe(false);
  });

  it('TC_CTS_168 (positive): labels select-all with the export total when no search is active', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    expect(screen.getByRole('checkbox', { name: 'Select all (120)' })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the label must not report the rendered
    count. "Select all (25)" on a 120-type export understates what the control
    will actually do — the most consequential mislabel on this screen.
  */
  it('TC_CTS_168 (negative): does not label select-all with the rendered row count', () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);

    // Anchored: the control must exist and be labelled with the export total.
    expect(screen.getByRole('checkbox', { name: 'Select all (120)' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select all (25)' })).not.toBeInTheDocument();
  });

  it('TC_CTS_038 (positive): keeps a ticked row ticked after a page is appended', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(boxFor('CT 3'));

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect((boxFor('CT 3') as HTMLInputElement).checked).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): appending must not tick anything
    that was not ticked. The inverse of the positive, and the one that catches a
    row keyed by index instead of uid.
  */
  it('TC_CTS_038 (negative): does not tick previously unticked rows when a page is appended', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderPanel(store);
    await userEvent.click(boxFor('CT 3'));

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(selection(store)).toEqual(['ct_3']);
  });

  it('TC_CTS_039 (positive): renders appended rows ticked when everything is selected', async () => {
    const store = mkStore();
    seed(store, many(60));
    renderPanel(store);
    await userEvent.click(selectAll());

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(typeBoxes().every((cb) => (cb as HTMLInputElement).checked)).toBe(true);
    expect(typeBoxes()).toHaveLength(50);
  });

  /*
    Negative — taxonomy #4 (forbidden state): with a PARTIAL selection the
    appended rows must render unticked. Otherwise "appended rows inherit the tick
    state" would be implemented as "appended rows are always ticked".
  */
  it('TC_CTS_039 (negative): renders appended rows unticked when only some are selected', async () => {
    const store = mkStore();
    seed(store, many(60));
    renderPanel(store);
    await userEvent.click(boxFor('CT 0'));

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect((boxFor('CT 30') as HTMLInputElement).checked).toBe(false);
  });
});

// ───────────────────────── row structure (FR-4.1, FR-5.3, FR-7.3) ─────────────────────────

describe('v3 content mapping — row structure', () => {
  it('TC_CTS_171 (positive): a row shows a checkbox, the display title and the uid', () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    const row = screen.getByTestId('cts-row-blog_article');
    expect(within(row).getByRole('checkbox')).toBeInTheDocument();
    expect(within(row).getByText('Blog Article')).toBeInTheDocument();
    expect(within(row).getByText('blog_article')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the uid must be shown as well as the
    title, not instead of it. Two content types can carry the same display title,
    and the uid is the only thing that tells them apart (feature.md A-2).
  */
  it('TC_CTS_171 (negative): shows the uid even when two content types share a title', () => {
    const store = mkStore();
    seed(store, [
      { uid: 'page_a', title: 'Page', references: [], existsInDestination: false },
      { uid: 'page_b', title: 'Page', references: [], existsInDestination: false },
    ]);
    renderPanel(store);

    expect(within(screen.getByTestId('cts-row-page_a')).getByText('page_a')).toBeInTheDocument();
    expect(within(screen.getByTestId('cts-row-page_b')).getByText('page_b')).toBeInTheDocument();
  });

  it('TC_CTS_172 (positive): an unticked, non-conflicting row carries no conflict or drill-in controls', () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    const row = screen.getByTestId('cts-row-press_release');
    expect(within(row).queryByText(/already in destination/i)).not.toBeInTheDocument();
    expect(within(row).queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(within(row).queryByText(/map fields/i)).not.toBeInTheDocument();
    expect(within(row).queryByText(/entries/i)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the same row MUST gain the drill-in
    affordances once ticked. Without this the positive is satisfied by a row that
    never renders them at all, and FR-7.1 would go untested.
  */
  it('TC_CTS_172 (negative): the same row gains the drill-in affordances once ticked', async () => {
    const store = mkStore();
    seed(store, F1);
    renderPanel(store);

    await userEvent.click(boxFor('Press Release'));

    const row = screen.getByTestId('cts-row-press_release');
    expect(within(row).getByText(/map fields/i)).toBeInTheDocument();
    expect(within(row).getByText(/entries/i)).toBeInTheDocument();
  });
});
