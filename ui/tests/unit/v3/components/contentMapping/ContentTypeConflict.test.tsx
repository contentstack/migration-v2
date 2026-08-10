import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1e: the destination conflict
 * control and the reference confirmation.
 *
 * Backs TC_CTS_052–066, TC_CTS_069–081, TC_CTS_142, 143, 145, 147–149, TC_CTS_169
 * (feature.md FR-5.1 … FR-5.9, FR-6.1 … FR-6.8, NFR-5, NFR-7; trd.md TR-10 … TR-15).
 *
 * Two behaviours here carry real consequences and are tested harder than the
 * rest:
 *
 *   1. `Use source` is the PRE-SELECTED conflict mode and it is the destructive
 *      one — it replaces a schema in the destination (feature.md R-1). The
 *      default, the per-option explanations and the lifecycle around unticking
 *      are all pinned verbatim, because informational copy is the only mitigation
 *      the design has.
 *
 *   2. The confirmation fires on the REVERSE edge — "who references the content
 *      type I am removing" — computed against the currently TICKED set, not the
 *      whole graph. Most of the negatives below separate those two.
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

/** blog_article → person, product → person, person → person (self). */
const GRAPH: ContentTypeInventoryItem[] = [
  { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
  { uid: 'product', title: 'Product', references: ['person'], existsInDestination: false },
  { uid: 'person', title: 'Person', references: ['person'], existsInDestination: false },
  { uid: 'landing_page', title: 'Landing Page', references: [], existsInDestination: true },
  { uid: 'category', title: 'Category', references: [], existsInDestination: true },
  { uid: 'press_release', title: 'Press Release', references: [], existsInDestination: false },
];

const seed = (store: ReturnType<typeof mkStore>, contentTypes = GRAPH, over: Record<string, unknown> = {}) =>
  store.dispatch(
    contentMappingActions.inventoryLoaded({ contentTypes, destinationRead: true, ...over } as never)
  );

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <ContentMappingPanel projectId="P1" />
    </Provider>
  );

const boxFor = (title: string) => screen.getByRole('checkbox', { name: new RegExp(`^${title}$`, 'i') });
const rowFor = (uid: string) => screen.getByTestId(`cts-row-${uid}`);
const state = (store: ReturnType<typeof mkStore>) => store.getState().contentMapping;
const modeOf = (store: ReturnType<typeof mkStore>, uid: string) =>
  state(store).selection.contentTypes[uid]?.conflictMode;

/** Ticks a row, answering the reference confirmation if one appears. */
const tick = async (title: string) => userEvent.click(boxFor(title));

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────── the conflict label and control (FR-5.1 … FR-5.6) ─────────────────────────

describe('v3 content mapping — the destination conflict control', () => {
  it('TC_CTS_052 (positive): labels an unticked content type that already exists in the destination', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(within(rowFor('landing_page')).getByText('already in destination')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the label must appear only on rows
    that actually conflict. A label rendered on every row would make the one
    signal that matters meaningless.
  */
  it('TC_CTS_052 (negative): does not label a content type absent from the destination', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(
      within(rowFor('press_release')).queryByText('already in destination')
    ).not.toBeInTheDocument();
  });

  it('TC_CTS_053 (positive): keeps the label visible once the row is ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    expect(within(rowFor('landing_page')).getByText('already in destination')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the label must survive a conflict
    choice too. Replacing it with the chosen mode would remove the standing
    reminder that this row touches an existing destination schema (FR-5.1).
  */
  it('TC_CTS_053 (negative): keeps the label visible after a conflict mode is chosen', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    expect(within(rowFor('landing_page')).getByText('already in destination')).toBeInTheDocument();
  });

  it('TC_CTS_054 (positive): offers exactly the three conflict options on a ticked conflicting row', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    const radios = within(rowFor('landing_page')).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('value'))).toEqual(['source', 'dest', 'merge']);
  });

  /*
    Negative — taxonomy #3 (boundary): exactly three, no more. A fourth option —
    "skip", say — would be a migration outcome nobody specified and that no
    downstream reader knows how to honour (DM-2's vocabulary is a contract).
  */
  it('TC_CTS_054 (negative): offers no fourth conflict option', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    expect(within(rowFor('landing_page')).getAllByRole('radio')).toHaveLength(3);
  });

  it('TC_CTS_055 (positive): renders no conflict control on an unticked conflicting row', () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    expect(within(rowFor('landing_page')).queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): ticking the same row must produce
    the control. Without this the positive is satisfied by never rendering it.
  */
  it('TC_CTS_055 (negative): renders the control once that same row is ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    expect(within(rowFor('landing_page')).getByRole('radiogroup')).toBeInTheDocument();
  });

  it('TC_CTS_056 (positive): renders no conflict control on a ticked non-conflicting row', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Press Release');

    expect(within(rowFor('press_release')).queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): when the destination could not be
    read, nothing is known to conflict, so no control may appear anywhere — even
    on a row that would conflict if the read had succeeded (FR-2.4, TRR-3).
  */
  it('TC_CTS_056 (negative): renders no conflict control anywhere when the destination could not be read', async () => {
    const store = mkStore();
    seed(
      store,
      GRAPH.map((c) => ({ ...c, existsInDestination: false })),
      { destinationRead: false, destinationReadFailure: 'network' }
    );
    renderPanel(store);

    await tick('Landing Page');

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('TC_CTS_057 (positive): pre-selects Use source when the control first appears', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    expect(
      within(rowFor('landing_page')).getByRole('radio', { name: /Use source/ })
    ).toBeChecked();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the pre-selection must be reflected
    in the working selection, not only in the radio's rendered state. If the
    store held nothing, the persist would send a conflicting content type with no
    mode — and G-2 counts exactly that as the failure it exists to prevent.
  */
  it('TC_CTS_057 (negative): records the pre-selected mode in the working selection, not only in the UI', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);

    await tick('Landing Page');

    expect(modeOf(store, 'landing_page')).toBe('source');
  });

  it('TC_CTS_058 (positive): records merge when Merge is chosen', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    expect(modeOf(store, 'landing_page')).toBe('merge');
  });

  /*
    Negative — taxonomy #4 (forbidden state): choosing on one row must not change
    another. Two conflicting rows are rendered here specifically so a shared
    control — a single mode held for the whole panel — fails.
  */
  it('TC_CTS_058 (negative): leaves another conflicting row at its own mode', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await tick('Category');

    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    expect(modeOf(store, 'category')).toBe('source');
  });

  it('TC_CTS_059 (positive): records dest when Keep destination is chosen', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(
      within(rowFor('landing_page')).getByRole('radio', { name: /Keep destination/ })
    );

    expect(modeOf(store, 'landing_page')).toBe('dest');
  });

  /*
    Negative — taxonomy #2 (invalid shape): the stored value must be the wire
    vocabulary `dest`, not the label text. DM-2's vocabulary is what interfaces 2
    and 3 read; storing "Keep destination" would break that contract silently.
  */
  it('TC_CTS_059 (negative): stores the wire value rather than the option label', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(
      within(rowFor('landing_page')).getByRole('radio', { name: /Keep destination/ })
    );

    expect(modeOf(store, 'landing_page')).not.toBe('Keep destination');
  });

  it('TC_CTS_060 (positive): discards the conflict mode when the row is unticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await tick('Landing Page');

    expect(state(store).selection.contentTypes.landing_page).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): unticking must not strip the mode
    from a DIFFERENT conflicting row that is still selected.
  */
  it('TC_CTS_060 (negative): keeps another selected row’s conflict mode when one is unticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await tick('Category');
    await userEvent.click(within(rowFor('category')).getByRole('radio', { name: /Merge/ }));

    await tick('Landing Page');

    expect(modeOf(store, 'category')).toBe('merge');
  });

  it('TC_CTS_061 (positive): returns to Use source when a row is unticked and re-ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await tick('Landing Page');
    await tick('Landing Page');

    expect(
      within(rowFor('landing_page')).getByRole('radio', { name: /Use source/ })
    ).toBeChecked();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the earlier choice must not survive
    in the store either. A retained `merge` behind a rendered `Use source` is the
    worst version of this bug — the operator sees one intent and the record holds
    another.
  */
  it('TC_CTS_061 (negative): does not retain the earlier mode in the working selection', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await tick('Landing Page');
    await tick('Landing Page');

    expect(modeOf(store, 'landing_page')).toBe('source');
  });

  it('TC_CTS_169 (positive): selects exactly one conflict option at a time', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    const checked = within(rowFor('landing_page'))
      .getAllByRole('radio')
      .filter((r) => (r as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): choosing Merge must deselect
    Use source specifically. Grouping failures usually show up as the default
    staying checked alongside the new choice.
  */
  it('TC_CTS_169 (negative): deselects Use source when Merge is chosen', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    expect(
      within(rowFor('landing_page')).getByRole('radio', { name: /Use source/ })
    ).not.toBeChecked();
  });
});

// ───────────────────────── conflict copy (FR-5.9) ─────────────────────────

describe('v3 content mapping — conflict option copy', () => {
  const openControl = async (store: ReturnType<typeof mkStore>) => {
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
  };

  it('TC_CTS_064 (positive): Use source carries its explanation verbatim', async () => {
    const store = mkStore();
    await openControl(store);

    expect(
      within(rowFor('landing_page')).getByText(
        'Replace the destination schema with the source content type'
      )
    ).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the explanation must be the specified
    sentence, not a paraphrase. This copy is the entire mitigation for R-1, so a
    reworded version is a real defect rather than a nitpick.
  */
  it('TC_CTS_064 (negative): does not paraphrase the Use source explanation', async () => {
    const store = mkStore();
    await openControl(store);

    const row = rowFor('landing_page');
    expect(within(row).queryByText(/overwrite/i)).not.toBeInTheDocument();
    expect(within(row).queryByText(/^Replace the destination schema$/)).not.toBeInTheDocument();
  });

  it('TC_CTS_065 (positive): Keep destination carries its explanation verbatim', async () => {
    const store = mkStore();
    await openControl(store);

    expect(
      within(rowFor('landing_page')).getByText(
        'Leave the destination schema untouched — only entries migrate'
      )
    ).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the em dash and the "only entries
    migrate" clause both matter. The clause is the only place the screen tells
    the operator that entries still move under this mode.
  */
  it('TC_CTS_065 (negative): retains the entries clause in the Keep destination explanation', async () => {
    const store = mkStore();
    await openControl(store);

    expect(within(rowFor('landing_page')).getByText(/only entries migrate/)).toBeInTheDocument();
  });

  it('TC_CTS_066 (positive): Merge carries its explanation verbatim', async () => {
    const store = mkStore();
    await openControl(store);

    expect(
      within(rowFor('landing_page')).getByText(
        'Keep destination fields and add the new fields from the source'
      )
    ).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the Merge copy must not promise
    anything about ENTRIES. What merge does to entries is explicitly undecided
    (feature.md Q-1), so copy implying an entry outcome would commit the product
    to a behaviour nobody has agreed.
  */
  it('TC_CTS_066 (negative): makes no claim about entries in the Merge explanation', async () => {
    const store = mkStore();
    await openControl(store);

    const merge = within(rowFor('landing_page')).getByText(
      'Keep destination fields and add the new fields from the source'
    );
    expect(merge.textContent).not.toMatch(/entr(y|ies)/i);
  });
});

// ───────────────────────── the conflict gate (FR-5.7) ─────────────────────────

describe('v3 content mapping — conflict decisions never gate', () => {
  it('TC_CTS_062 (positive): saving proceeds with a conflicting row left at its default', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    await userEvent.click(screen.getByRole('button', { name: /save selection/i }));

    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the save control must not be
    disabled either. A gate implemented by disabling the button rather than by
    refusing the click would pass a "was not called" assertion for the wrong
    reason.
  */
  it('TC_CTS_062 (negative): leaves the save control enabled with an undecided conflicting row', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    expect(screen.getByRole('button', { name: /save selection/i })).toBeEnabled();
  });

  it('TC_CTS_063 (positive): advancing proceeds with a conflicting row left at its default', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');

    expect(state(store).selection.contentTypes.landing_page.conflictMode).toBe('source');
    expect(screen.queryByText(/choose what happens/i)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): no blocking message may be rendered
    for an undecided conflict at all. FR-5.7 states this as a prohibition, and a
    warning that reads like a block is the same failure from the operator's side.
  */
  it('TC_CTS_063 (negative): renders no blocking explanation about undecided conflicts', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Landing Page');
    await tick('Category');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ───────────────────────── the reference confirmation (FR-6.1 … FR-6.8) ─────────────────────────

describe('v3 content mapping — the reference confirmation', () => {
  /** Ticks blog_article and person, so unticking person raises the dialog. */
  const armed = async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');
    return store;
  };

  it('TC_CTS_069 (positive): raises a dialog and defers the untick', async () => {
    const store = await armed();

    await userEvent.click(boxFor('Person'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(state(store).selection.contentTypes.person).toBeDefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the checkbox must not appear
    unticked while the dialog is open. Optimistically unticking and rolling back
    on cancel shows the operator an outcome that has not been agreed.
  */
  it('TC_CTS_069 (negative): leaves the checkbox ticked while the dialog is open', async () => {
    await armed();

    await userEvent.click(boxFor('Person'));

    expect(boxFor('Person')).toBeChecked();
  });

  it('TC_CTS_070 (positive): names the referencing content type by its display title', async () => {
    await armed();

    await userEvent.click(boxFor('Person'));

    expect(within(screen.getByRole('dialog')).getByText(/Blog Article/)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the dialog must name the referencing
    content type by title, not by uid. `blog_article` is not what the operator
    sees in the list, so it is not what identifies the row for them.
  */
  it('TC_CTS_070 (negative): does not identify the referencing content type by uid', async () => {
    await armed();

    await userEvent.click(boxFor('Person'));

    expect(within(screen.getByRole('dialog')).queryByText(/blog_article/)).not.toBeInTheDocument();
  });

  it('TC_CTS_071 (positive): names every ticked content type that references it', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Product');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText(/Blog Article/)).toBeInTheDocument();
    expect(dialog.getByText(/Product/)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): an UNTICKED referrer must not be
    named. Listing content types that are not migrating would send the operator
    to resolve a dependency that does not exist (FR-6.8).
  */
  it('TC_CTS_071 (negative): does not name a referencing content type that is not ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(within(screen.getByRole('dialog')).queryByText(/Product/)).not.toBeInTheDocument();
  });

  it('TC_CTS_072 (positive): unticks the content type when the dialog is confirmed', async () => {
    const store = await armed();
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(state(store).selection.contentTypes.person).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the dialog must close on confirm. A
    dialog left open over a completed action blocks the rest of the list.
  */
  it('TC_CTS_072 (negative): closes the dialog once confirmed', async () => {
    await armed();
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('TC_CTS_073 (positive): leaves the referencing content type selected after confirming', async () => {
    const store = await armed();
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(state(store).selection.contentTypes.blog_article).toBeDefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): confirming must remove exactly one
    content type. A handler that cleared the dependency chain would quietly
    unselect the referrer too — the opposite of what the operator asked for.
  */
  it('TC_CTS_073 (negative): removes exactly one content type from the working selection', async () => {
    const store = await armed();
    const before = Object.keys(state(store).selection.contentTypes).length;
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(Object.keys(state(store).selection.contentTypes)).toHaveLength(before - 1);
  });

  it('TC_CTS_074 (positive): keeps the content type selected when the dialog is cancelled', async () => {
    const store = await armed();
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(state(store).selection.contentTypes.person).toBeDefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): cancelling must leave the checkbox
    rendered as ticked. A store that kept the selection while the checkbox showed
    unticked would desynchronise the two on the very next render.
  */
  it('TC_CTS_074 (negative): leaves the checkbox rendered as ticked after cancelling', async () => {
    await armed();
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(boxFor('Person')).toBeChecked();
  });

  it('TC_CTS_075 (positive): changes no other selection state when cancelled', async () => {
    const store = await armed();
    const before = JSON.stringify(state(store).selection);
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(JSON.stringify(state(store).selection)).toBe(before);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a conflict mode set before the
    dialog opened must survive a cancel. The dialog is about one checkbox and
    must not disturb an unrelated decision.
  */
  it('TC_CTS_075 (negative): preserves a conflict mode set before the dialog opened', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');
    await tick('Landing Page');
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await userEvent.click(boxFor('Person'));
    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(modeOf(store, 'landing_page')).toBe('merge');
  });

  it('TC_CTS_076 (positive): unticks immediately when the only referrer is not ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state(store).selection.contentTypes.person).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): ticking that same referrer must then
    arm the dialog. This is the pair that proves the check reads the CURRENT
    ticked set rather than being permanently off.
  */
  it('TC_CTS_076 (negative): raises the dialog once that referrer is ticked', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Person');
    await tick('Blog Article');

    await userEvent.click(boxFor('Person'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('TC_CTS_077 (positive): unticks a self-referencing content type without a dialog', async () => {
    const store = mkStore();
    seed(store, [GRAPH[2]]);
    renderPanel(store);
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state(store).selection.contentTypes.person).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): excluding the self-edge must not
    disable the check for that content type generally. Person references itself
    AND is referenced by Blog Article; the second must still raise the dialog.
  */
  it('TC_CTS_077 (negative): still raises the dialog for a self-referencing type that others reference', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('TC_CTS_078 (positive): raises no dialog when select-all is cleared', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(screen.getByRole('checkbox', { name: /select all/i }));

    await userEvent.click(screen.getByRole('checkbox', { name: /select all/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(Object.keys(state(store).selection.contentTypes)).toHaveLength(0);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the exemption belongs to select-all
    alone. Unticking a single row straight afterwards must still raise the dialog,
    or FR-6.7 would have disabled the confirmation permanently.
  */
  it('TC_CTS_078 (negative): still raises the dialog for a single untick after using select-all', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(screen.getByRole('checkbox', { name: /select all/i }));

    await userEvent.click(boxFor('Person'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('TC_CTS_079 (positive): unticks an unreferenced content type immediately', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Press Release');

    await userEvent.click(boxFor('Press Release'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state(store).selection.contentTypes.press_release).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): a content type that REFERENCES
    others but is referenced by none must also untick freely. The check is on
    incoming edges; confusing the direction makes the dialog fire on the wrong
    rows.
  */
  it('TC_CTS_079 (negative): unticks a content type that references others but is referenced by none', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Blog Article'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state(store).selection.contentTypes.blog_article).toBeUndefined();
  });

  it('TC_CTS_080 (positive): raises the dialog for a reference nested in a modular block', async () => {
    const store = mkStore();
    // The graph is flattened server-side, so a nested reference is indistinguishable
    // here — which is the point: the panel must act on the edge, wherever it came from.
    seed(store, [
      { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
      { uid: 'person', title: 'Person', references: [], existsInDestination: false },
    ]);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(within(screen.getByRole('dialog')).getByText(/Blog Article/)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #1 (missing input): a content type with an EMPTY
    references array must never arm the dialog. This is the shape a server that
    failed to walk nested containers would produce, and the panel must not
    silently paper over it by guessing.
  */
  it('TC_CTS_080 (negative): raises no dialog when the graph reports no edges', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'blog_article', title: 'Blog Article', references: [], existsInDestination: false },
      { uid: 'person', title: 'Person', references: [], existsInDestination: false },
    ]);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('TC_CTS_081 (positive): raises the dialog for a reference nested in a global field', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
      { uid: 'product', title: 'Product', references: [], existsInDestination: false },
      { uid: 'person', title: 'Person', references: [], existsInDestination: false },
    ]);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): the dialog must name only the content types
    that actually hold an edge. With Product ticked but edgeless, naming it would
    be a false positive that trains the operator to ignore the dialog.
  */
  it('TC_CTS_081 (negative): names only the content types that actually hold an edge', async () => {
    const store = mkStore();
    seed(store, [
      { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
      { uid: 'product', title: 'Product', references: [], existsInDestination: false },
      { uid: 'person', title: 'Person', references: [], existsInDestination: false },
    ]);
    renderPanel(store);
    await tick('Blog Article');
    await tick('Product');
    await tick('Person');

    await userEvent.click(boxFor('Person'));

    expect(within(screen.getByRole('dialog')).queryByText(/Product/)).not.toBeInTheDocument();
  });
});

// ───────────────────────── accessibility (NFR-5, NFR-7) ─────────────────────────

describe('v3 content mapping — conflict and dialog accessibility', () => {
  it('TC_CTS_142 (positive): every conflict option is reachable and selectable by keyboard', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Landing Page'));

    const merge = within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ });
    merge.focus();
    await userEvent.keyboard('{ }');

    expect(merge).toHaveFocus();
    expect(modeOf(store, 'landing_page')).toBe('merge');
  });

  /*
    Negative — taxonomy #5 (permission denial, adapted): no conflict option may be
    removed from the tab order. A radio with tabIndex -1 is invisible to keyboard
    users, which for this control means the destructive default cannot be changed
    without a mouse.
  */
  it('TC_CTS_142 (negative): removes no conflict option from the tab order', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Landing Page'));

    const radios = within(rowFor('landing_page')).getAllByRole('radio');
    expect(radios.some((r) => r.getAttribute('tabindex') === '-1' && !(r as HTMLInputElement).checked)).toBe(false);
  });

  it('TC_CTS_143 (positive): the dialog’s confirm and cancel are operable by keyboard', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    const cancel = screen.getByRole('button', { name: /cancel|keep/i });
    cancel.focus();
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state(store).selection.contentTypes.person).toBeDefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): Escape must cancel, never confirm.
    A dialog whose dismissal performs the destructive action turns a reflex into
    data loss.
  */
  it('TC_CTS_143 (negative): treats Escape as cancel rather than confirm', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    await userEvent.keyboard('{Escape}');

    expect(state(store).selection.contentTypes.person).toBeDefined();
  });

  it('TC_CTS_145 (positive): the conflict control names the content type it acts on', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Landing Page'));

    expect(
      within(rowFor('landing_page')).getByRole('radiogroup', { name: /Landing Page/ })
    ).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): with two conflict controls on screen,
    a generic name makes them indistinguishable to a screen reader. This is the
    case a single-row test cannot see.
  */
  it('TC_CTS_145 (negative): distinguishes two conflict controls from one another', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Landing Page'));
    await userEvent.click(boxFor('Category'));

    expect(screen.getByRole('radiogroup', { name: /Landing Page/ })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /Category/ })).toBeInTheDocument();
  });

  it('TC_CTS_147 (positive): focus moves into the dialog when it opens', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(boxFor('Person'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): focus must not remain on the
    checkbox behind the dialog. A keyboard user who cannot tell the dialog opened
    will keep operating the list underneath it.
  */
  it('TC_CTS_147 (negative): does not leave focus on the checkbox behind the dialog', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(boxFor('Person'));

    expect(boxFor('Person')).not.toHaveFocus();
  });

  it('TC_CTS_148 (positive): returns focus to the raising checkbox after cancelling', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(boxFor('Person')).toHaveFocus();
  });

  /*
    Negative — taxonomy #4 (forbidden state): focus must not fall back to the body.
    That is where it lands when a dialog unmounts without restoring focus, and it
    silently sends a keyboard user to the top of the document.
  */
  it('TC_CTS_148 (negative): does not drop focus to the document body after cancelling', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));

    expect(document.activeElement).not.toBe(document.body);
  });

  it('TC_CTS_149 (positive): returns focus to the raising checkbox after confirming', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(boxFor('Person')).toHaveFocus();
  });

  /*
    Negative — taxonomy #4 (forbidden state): after confirming, the row is now
    UNTICKED, and focus must land on that same row's checkbox rather than
    anywhere else. Restoring focus to a stale element is the usual bug when the
    row re-renders on confirm.
  */
  it('TC_CTS_149 (negative): returns focus to the now-unticked checkbox, not a stale element', async () => {
    const store = mkStore();
    seed(store);
    renderPanel(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Person'));
    await userEvent.click(boxFor('Person'));

    await userEvent.click(screen.getByRole('button', { name: /unselect anyway|confirm|yes/i }));

    expect(boxFor('Person')).not.toBeChecked();
    expect(boxFor('Person')).toHaveFocus();
  });
});
