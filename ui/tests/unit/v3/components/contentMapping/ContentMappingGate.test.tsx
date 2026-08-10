import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1e (part 2): the drill-in
 * affordances, the footer gate, the save control and the panel's failure states.
 *
 * Backs TC_CTS_083–088, TC_CTS_090–102, TC_CTS_107–111, TC_CTS_138, 139, 141,
 * 144, 146, 154–162, TC_CTS_170, TC_CTS_174
 * (feature.md FR-7.1 … FR-7.4, FR-8.1 … FR-8.7, FR-9.1 … FR-9.8, NFR-2, NFR-5,
 * NFR-6, NFR-8, EC-1 … EC-3, EC-11, EC-12, EC-14; trd.md TR-16 … TR-20, TRR-2).
 *
 * The gate tests mount the panel inside a REAL `StepGateProvider` alongside the
 * REAL `WizardFooter`. That is deliberate and it is trd.md TRR-2: the audit step
 * shipped a duplicate footer whose primary action navigated without persisting,
 * and every one of its footer tests passed — because they rendered the panel
 * alone, against a footer the panel drew itself. A gate test that does not mount
 * the gate cannot see that class of bug.
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
import WizardFooter from '../../../../../v3/components/wizard/WizardFooter';
import { StepGateProvider } from '../../../../../v3/components/wizard/StepGateContext';
import { WIZARD_STEPS } from '../../../../../v3/components/wizard/steps';

const mkStore = () => configureStore({ reducer: { contentMapping: contentMappingReducer } });

const F1: ContentTypeInventoryItem[] = [
  { uid: 'blog_article', title: 'Blog Article', references: ['person'], existsInDestination: false },
  { uid: 'landing_page', title: 'Landing Page', references: [], existsInDestination: true },
  { uid: 'person', title: 'Person', references: [], existsInDestination: false },
  { uid: 'press_release', title: 'Press Release', references: [], existsInDestination: false },
];

const many = (n: number): ContentTypeInventoryItem[] =>
  Array.from({ length: n }, (_, i) => ({
    uid: `ct_${i}`,
    title: `CT ${i}`,
    references: [],
    existsInDestination: false,
  }));

const seed = (
  store: ReturnType<typeof mkStore>,
  contentTypes: ContentTypeInventoryItem[] = F1,
  over: Record<string, unknown> = {}
) =>
  store.dispatch(
    contentMappingActions.inventoryLoaded({ contentTypes, destinationRead: true, ...over } as never)
  );

const advanced = vi.fn();

/** The real composition: panel + real gate provider + real wizard footer. */
const renderWithChrome = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <StepGateProvider onAdvanced={advanced}>
        <ContentMappingPanel projectId="P1" />
        <WizardFooter
          activeIndex={WIZARD_STEPS.findIndex((s) => s.id === 'content-mapping')}
          isFirst={false}
          onBack={() => {}}
          stepContext={{}}
        />
      </StepGateProvider>
    </Provider>
  );

const boxFor = (title: string) => screen.getByRole('checkbox', { name: new RegExp(`^${title}$`, 'i') });
const rowFor = (uid: string) => screen.getByTestId(`cts-row-${uid}`);
const primary = () => screen.getByTestId('wizard-primary-action');
const statusLine = () => screen.getByTestId('wizard-footer-status');
const sel = (store: ReturnType<typeof mkStore>) =>
  Object.keys(store.getState().contentMapping.selection.contentTypes);

beforeEach(() => {
  vi.clearAllMocks();
  advanced.mockClear();
  /*
    Implementations, not just calls. `vi.clearAllMocks()` resets recorded calls but
    KEEPS any implementation a previous test installed — so a test that made the
    persist hang or fail would silently leak that into the next one. Restoring the
    defaults here is what makes every test below pass alone and in any order.
  */
  mockLoadInventory.mockImplementation(() => () => Promise.resolve(true));
  mockPersist.mockImplementation(() => () => Promise.resolve(true));
  mockProceed.mockImplementation(() => () => Promise.resolve(true));
});

// ───────────────────────── drill-in affordances (FR-7.1 … FR-7.4) ─────────────────────────

describe('v3 content mapping — the disabled drill-in affordances', () => {
  it('TC_CTS_083 (positive): renders both affordances on a ticked row', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    const row = within(rowFor('blog_article'));
    expect(row.getByText(/map fields/i)).toBeInTheDocument();
    expect(row.getByText(/entries/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): they must belong to the ticked row
    only. Rendering them on every row would advertise a destination for content
    types that are not migrating.
  */
  it('TC_CTS_083 (negative): renders no affordances on the rows that are not ticked', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(within(rowFor('person')).queryByText(/map fields/i)).not.toBeInTheDocument();
  });

  it('TC_CTS_084 (positive): renders both affordances disabled', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    const row = within(rowFor('blog_article'));
    expect(row.getByRole('button', { name: /map fields/i })).toBeDisabled();
    expect(row.getByRole('button', { name: /entries/i })).toBeDisabled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): they must not be rendered as links.
    An anchor is followable by middle-click and by the keyboard regardless of a
    disabled attribute, which HTML anchors do not honour at all.
  */
  it('TC_CTS_084 (negative): does not render the affordances as followable links', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    expect(within(rowFor('blog_article')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('TC_CTS_085 (positive): activating map fields changes nothing', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    const before = document.body.innerHTML;

    await userEvent.click(within(rowFor('blog_article')).getByRole('button', { name: /map fields/i }));

    expect(document.body.innerHTML).toBe(before);
  });

  /*
    Negative — taxonomy #4 (forbidden state): it must not toggle the row's
    selection either. A click that fell through to the row handler would untick
    the content type the operator was trying to inspect.
  */
  it('TC_CTS_085 (negative): activating map fields does not toggle the row selection', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(within(rowFor('blog_article')).getByRole('button', { name: /map fields/i }));

    expect(sel(store)).toEqual(['blog_article']);
  });

  it('TC_CTS_086 (positive): activating entries changes nothing', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    const before = document.body.innerHTML;

    await userEvent.click(within(rowFor('blog_article')).getByRole('button', { name: /entries/i }));

    expect(document.body.innerHTML).toBe(before);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the same fall-through check for the
    entries affordance.
  */
  it('TC_CTS_086 (negative): activating entries does not toggle the row selection', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(within(rowFor('blog_article')).getByRole('button', { name: /entries/i }));

    expect(sel(store)).toEqual(['blog_article']);
  });

  it('TC_CTS_087 (positive): an unticked row carries neither affordance', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    const row = within(rowFor('blog_article'));
    expect(row.queryByText(/map fields/i)).not.toBeInTheDocument();
    expect(row.queryByText(/entries/i)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): unticking must withdraw them again.
    Affordances left behind on an unselected row imply it is still in scope.
  */
  it('TC_CTS_087 (negative): withdraws the affordances when a ticked row is unticked', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Press Release'));

    await userEvent.click(boxFor('Press Release'));

    expect(within(rowFor('press_release')).queryByText(/map fields/i)).not.toBeInTheDocument();
  });

  it('TC_CTS_088 (positive): keyboard focus never lands on the disabled affordances', async () => {
    const store = mkStore();
    seed(store, [F1[0]]);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    const mapFields = within(rowFor('blog_article')).getByRole('button', { name: /map fields/i });
    boxFor('Blog Article').focus();
    await userEvent.tab();

    expect(mapFields).not.toHaveFocus();
  });

  /*
    Negative — taxonomy #3 (boundary): keeping them out of the tab order must not
    take the row's checkbox with them. The checkbox is the row's only real
    control and has to stay reachable.
  */
  it('TC_CTS_088 (negative): leaves the row checkbox itself keyboard reachable', async () => {
    const store = mkStore();
    seed(store, [F1[0]]);
    renderWithChrome(store);

    boxFor('Blog Article').focus();

    expect(boxFor('Blog Article')).toHaveFocus();
  });
});

// ───────────────────────── the status line (FR-8.1 … FR-8.3) ─────────────────────────

describe('v3 content mapping — the footer status line', () => {
  it('TC_CTS_090 (positive): reads the plural form for six selected content types', async () => {
    const store = mkStore();
    seed(store, many(10));
    renderWithChrome(store);

    for (let i = 0; i < 6; i++) await userEvent.click(boxFor(`CT ${i}`));

    expect(statusLine()).toHaveTextContent('6 content types ship');
  });

  /*
    Negative — taxonomy #3 (boundary): the plural form must not be used at one.
    "1 content types ship" is the exact defect the pluralisation rule exists to
    avoid.
  */
  it('TC_CTS_090 (negative): does not use the plural form at a count of one', async () => {
    const store = mkStore();
    seed(store, many(10));
    renderWithChrome(store);

    await userEvent.click(boxFor('CT 0'));

    expect(statusLine()).not.toHaveTextContent('1 content types ship');
  });

  it('TC_CTS_091 (positive): reads the singular form for exactly one', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(statusLine()).toHaveTextContent('1 content type ships');
  });

  /*
    Negative — taxonomy #3 (boundary): two must return to the plural. A rule
    applied in one direction only leaves "2 content type ships".
  */
  it('TC_CTS_091 (negative): returns to the plural form at two', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Press Release'));

    expect(statusLine()).toHaveTextContent('2 content types ship');
  });

  it('TC_CTS_092 (positive): reads the empty form when nothing is selected', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(statusLine()).toHaveTextContent('No content types selected');
  });

  /*
    Negative — taxonomy #1 (missing input): the empty state must not render as
    "0 content types ship". FR-8.2 specifies distinct copy, and the numeric form
    reads like a result rather than a prompt.
  */
  it('TC_CTS_092 (negative): does not render the empty state as a count of zero', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    // Anchored on the specified copy, so the absence cannot be met by an empty line.
    expect(statusLine()).toHaveTextContent('No content types selected');
    expect(statusLine()).not.toHaveTextContent('0 content types ship');
  });

  it('TC_CTS_093 (positive): carries no manual, auto or global breakdown', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Landing Page'));

    const text = statusLine().textContent ?? '';
    expect(text).not.toMatch(/manual|auto|global/i);
  });

  /*
    Negative — taxonomy #2 (invalid shape): no entry estimate and no unmapped
    field count either. Both belong to the prototype's footer and to features
    that do not exist; showing either would be an unbacked promise (FR-8.3).
  */
  it('TC_CTS_093 (negative): carries no entry estimate and no unmapped-field count', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    const text = statusLine().textContent ?? '';
    expect(text).not.toMatch(/entries|unmapped|≈/i);
  });

  it('TC_CTS_094 (positive): counts only the ticked content type, not its references', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(statusLine()).toHaveTextContent('1 content type ships');
  });

  /*
    Negative — taxonomy #4 (forbidden state): the count must not silently grow to
    include dependencies. feature.md A-6 makes the naive count deliberate, so a
    "helpful" resolved count would contradict the spec rather than improve it.
  */
  it('TC_CTS_094 (negative): does not report the resolved dependency count', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(statusLine()).not.toHaveTextContent('2 content types ship');
  });

  it('TC_CTS_170 (positive): updates after each tick without a save or reload', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));
    expect(statusLine()).toHaveTextContent('1 content type ships');

    await userEvent.click(boxFor('Blog Article'));
    expect(statusLine()).toHaveTextContent('No content types selected');
  });

  /*
    Negative — taxonomy #4 (forbidden state): updating the line must not persist
    anything. The status line is derived state; if it were driven by the saved
    record it would lag the operator's choices by one save.
  */
  it('TC_CTS_170 (negative): issues no persist while the status line updates', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Press Release'));

    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockProceed).not.toHaveBeenCalled();
  });
});

// ───────────────────────── the gate (FR-8.4 … FR-8.7) ─────────────────────────

describe('v3 content mapping — the wizard gate', () => {
  it('TC_CTS_095 (positive): the primary action is labelled Move to review', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(primary()).toHaveTextContent('Move to review');
  });

  /*
    Negative — taxonomy #2 (invalid shape): the previous label must be gone. The
    step definition shipped with "Continue to preview", and leaving it would mean
    the label was never actually changed (FR-8.4).
  */
  it('TC_CTS_095 (negative): no longer carries the previous step label', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(primary()).not.toHaveTextContent('Continue to preview');
  });

  it('TC_CTS_096 (positive): exactly one primary action exists on the page', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(screen.getAllByRole('button', { name: /move to review/i })).toHaveLength(1);
  });

  /*
    Negative — taxonomy #7 (conflict): the panel must render no Back control of
    its own either. This is the exact shape of the audit's duplicate-footer
    defect — two controls doing different things behind one label (trd.md TRR-2).
  */
  it('TC_CTS_096 (negative): the panel renders no second Back control', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    // Anchored: the panel body must actually be rendered, otherwise "no second
    // Back control" is true of an empty page.
    expect(screen.getByTestId('cts-row-blog_article')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^back$/i })).toHaveLength(1);
  });

  it('TC_CTS_097 (positive): persists before advancing when the primary action is pressed', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());

    expect(mockProceed).toHaveBeenCalledWith('P1');
    expect(advanced).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the wizard must not advance without
    the persist. This is the assertion the audit step lacked, and its absence is
    exactly why a footer that navigated without saving passed every test it had.
  */
  it('TC_CTS_097 (negative): does not advance without going through the persist path', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());

    expect(mockProceed).toHaveBeenCalled();
    expect(advanced).toHaveBeenCalledTimes(1);
  });

  it('TC_CTS_098 (positive): does not advance when the persist fails', async () => {
    mockProceed.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());

    expect(advanced).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #6 (dependency failure): the working selection must
    survive the failure untouched, so the operator can simply press again. Losing
    it would make a transient network error cost them their whole scoping pass.
  */
  it('TC_CTS_098 (negative): preserves the working selection when the persist fails', async () => {
    mockProceed.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Landing Page'));

    await userEvent.click(primary());

    expect(sel(store).sort()).toEqual(['blog_article', 'landing_page']);
  });

  it('TC_CTS_099 (positive): issues exactly one persist for two rapid presses', async () => {
    let resolve: (v: boolean) => void = () => {};
    mockProceed.mockImplementation(() => () => new Promise<boolean>((r) => (resolve = r)));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());
    await userEvent.click(primary());
    resolve(true);

    expect(mockProceed).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #7 (conflict): two presses must not advance twice either.
    A guard on the request alone would still fire the navigation callback a second
    time, skipping a step.
  */
  it('TC_CTS_099 (negative): does not advance twice for two rapid presses', async () => {
    /*
      Mirrors the positive's structure. Both clicks are awaited, but the persist
      promise is still PENDING throughout, so the second press arrives while the
      first advance is in flight — which is what the re-entrancy guard is for.
      Resolving before the second press would make these two sequential presses,
      which legitimately advance twice, and the test would assert a contract that
      was never promised.
    */
    let resolve: (v: boolean) => void = () => {};
    mockProceed.mockImplementation(() => () => new Promise<boolean>((r) => (resolve = r)));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());
    await userEvent.click(primary());
    resolve(true);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockProceed).toHaveBeenCalledTimes(1);
    expect(advanced).toHaveBeenCalledTimes(1);
  });

  it('TC_CTS_100 (positive): disables the primary action while a persist is in flight', async () => {
    let resolve: (v: boolean) => void = () => {};
    mockProceed.mockImplementation(() => () => new Promise<boolean>((r) => (resolve = r)));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());

    expect(primary()).toBeDisabled();
    resolve(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): it must be enabled again once the
    persist settles. A permanently disabled action after one failed save would
    strand the operator on the step.
  */
  it('TC_CTS_100 (negative): re-enables the primary action once a failed persist settles', async () => {
    mockProceed.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(primary());

    expect(primary()).toBeEnabled();
  });
});

// ───────────────────────── the save control (FR-9.1, FR-9.2, FR-9.8) ─────────────────────────

describe('v3 content mapping — the save control', () => {
  const saveBtn = () => screen.getByRole('button', { name: /save selection/i });

  it('TC_CTS_101 (positive): persists without advancing', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(saveBtn());

    expect(mockPersist).toHaveBeenCalledWith('P1');
    expect(advanced).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the save control must not go through
    the advance path. Reusing the gate's runner here would navigate on success,
    which is the opposite of "save without leaving the step" (UC-6).
  */
  it('TC_CTS_101 (negative): does not invoke the advance thunk', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(saveBtn());

    expect(mockProceed).not.toHaveBeenCalled();
  });

  it('TC_CTS_102 (positive): states how many content types it will save', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Landing Page'));
    await userEvent.click(boxFor('Press Release'));

    expect(saveBtn()).toHaveTextContent('3');
  });

  /*
    Negative — taxonomy #3 (boundary): the count must track the working selection,
    not the persisted one. A label frozen at the last save tells the operator they
    are about to save something other than what they see.
  */
  it('TC_CTS_102 (negative): updates the count as the working selection changes', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    expect(saveBtn()).toHaveTextContent('1');

    await userEvent.click(boxFor('Press Release'));

    expect(saveBtn()).toHaveTextContent('2');
  });

  it('TC_CTS_111 (positive): acknowledges a successful save', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(saveBtn());

    expect(await screen.findByTestId('cts-save-ack')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): a FAILED save must not be
    acknowledged as a success. An acknowledgement on failure is worse than none —
    the operator leaves believing their decisions are safe.
  */
  it('TC_CTS_111 (negative): shows no success acknowledgement when the save fails', async () => {
    mockPersist.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(saveBtn());

    expect(screen.queryByTestId('cts-save-ack')).not.toBeInTheDocument();
  });

  it('TC_CTS_110 (positive): surfaces an error when the save is rejected', async () => {
    mockPersist.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    await userEvent.click(saveBtn());

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): the working selection must be
    exactly as the operator left it after a failed save (FR-9.7).
  */
  it('TC_CTS_110 (negative): leaves the working selection unchanged after a failed save', async () => {
    mockPersist.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));
    await userEvent.click(boxFor('Press Release'));

    await userEvent.click(saveBtn());

    expect(sel(store).sort()).toEqual(['blog_article', 'press_release']);
  });

  it('TC_CTS_174 (positive): keeps a chosen conflict mode after a failed save', async () => {
    mockPersist.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Landing Page'));
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await userEvent.click(saveBtn());

    expect(store.getState().contentMapping.selection.contentTypes.landing_page.conflictMode).toBe(
      'merge'
    );
  });

  /*
    Negative — taxonomy #6 (dependency failure): the chosen mode must still be
    RENDERED as chosen. A store that kept `merge` while the control reverted to
    the default would show the operator an intent they did not pick.
  */
  it('TC_CTS_174 (negative): still renders the chosen mode as selected after a failed save', async () => {
    mockPersist.mockImplementation(() => () => Promise.resolve(false));
    const store = mkStore();
    seed(store);
    renderWithChrome(store);
    await userEvent.click(boxFor('Landing Page'));
    await userEvent.click(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ }));

    await userEvent.click(saveBtn());

    expect(within(rowFor('landing_page')).getByRole('radio', { name: /Merge/ })).toBeChecked();
  });
});

// ───────────────────────── hydration and reliability (FR-9.5, FR-9.6, NFR-8) ─────────────────────────

describe('v3 content mapping — hydration', () => {
  it('TC_CTS_107 (positive): restores a persisted selection with its conflict mode', () => {
    const store = mkStore();
    // Only the PERSISTED record is seeded. Deriving the working selection from
    // it is FR-9.5's behaviour, so pre-seeding it would assume the answer.
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {}, landing_page: { conflictMode: 'dest' } } },
    });
    renderWithChrome(store);

    expect(boxFor('Blog Article')).toBeChecked();
    expect(
      within(rowFor('landing_page')).getByRole('radio', { name: /Keep destination/ })
    ).toBeChecked();
    expect(statusLine()).toHaveTextContent('2 content types ship');
  });

  /*
    Negative — taxonomy #4 (forbidden state): rows absent from the persisted
    selection must render unticked. A hydration that ticked everything would
    silently widen the migration on every revisit.
  */
  it('TC_CTS_107 (negative): leaves rows outside the persisted selection unticked', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {} } },
    });
    renderWithChrome(store);

    expect(boxFor('Person')).not.toBeChecked();
  });

  it('TC_CTS_108 (positive): drops a persisted uid that is absent from the export', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {}, retired_type: {} } },
    });
    renderWithChrome(store);

    // Anchored on the surviving row: an unrendered panel also lacks retired_type.
    expect(screen.getByTestId('cts-row-blog_article')).toBeInTheDocument();
    expect(screen.queryByTestId('cts-row-retired_type')).not.toBeInTheDocument();
    expect(sel(store)).toEqual(['blog_article']);
  });

  /*
    Negative — taxonomy #4 (forbidden state): dropping the stale uid must not
    disturb the surviving ones. Anchored on the surviving row so an empty
    selection cannot satisfy the absence.
  */
  it('TC_CTS_108 (negative): keeps the surviving persisted content types selected', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {}, retired_type: {} } },
    });
    renderWithChrome(store);

    expect(boxFor('Blog Article')).toBeChecked();
  });

  it('TC_CTS_109 (positive): renders everything unticked with no persisted selection', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(boxFor('Blog Article')).not.toBeChecked();
    expect(statusLine()).toHaveTextContent('No content types selected');
  });

  /*
    Negative — taxonomy #1 (missing input): the rows must still render. Anchored
    so "nothing is ticked" cannot be satisfied by an empty list.
  */
  it('TC_CTS_109 (negative): still renders the content type rows', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(screen.getByTestId('cts-row-blog_article')).toBeInTheDocument();
  });

  it('TC_CTS_154 (positive): a persisted selection is restored on a fresh mount', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { press_release: {} } },
    });
    const { unmount } = renderWithChrome(store);
    unmount();

    renderWithChrome(store);

    expect(boxFor('Press Release')).toBeChecked();
  });

  /*
    Negative — taxonomy #4 (forbidden state): remounting must not re-request the
    inventory when it is already loaded, or every step change would refetch and
    briefly blank the list.
  */
  it('TC_CTS_154 (negative): does not reload the inventory on a remount when it is already loaded', () => {
    const store = mkStore();
    seed(store);
    const { unmount } = renderWithChrome(store);
    unmount();
    mockLoadInventory.mockClear();

    renderWithChrome(store);

    expect(screen.getByTestId('cts-row-blog_article')).toBeInTheDocument();
    expect(mockLoadInventory).not.toHaveBeenCalled();
  });

  it('TC_CTS_155 (positive): unsaved ticks are absent after a remount from the persisted state', async () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { press_release: {} } },
    });
    renderWithChrome(store);
    await userEvent.click(boxFor('Blog Article'));

    // A reload restores from the persisted record only.
    const fresh = mkStore();
    seed(fresh, F1, {
      persistedSelection: { contentTypes: { press_release: {} } },
    });
    renderWithChrome(fresh);

    expect(sel(fresh)).toEqual(['press_release']);
  });

  /*
    Negative — taxonomy #1 (missing input): the saved part must survive. Losing
    both the unsaved ticks AND the saved selection would be data loss rather than
    the documented cost of save-on-continue (trd.md TC-5).
  */
  it('TC_CTS_155 (negative): does not lose the previously saved selection as well', () => {
    const fresh = mkStore();
    seed(fresh, F1, {
      persistedSelection: { contentTypes: { press_release: {} } },
    });
    renderWithChrome(fresh);

    expect(boxFor('Press Release')).toBeChecked();
  });
});

// ───────────────────────── failure and empty states (EC-1 … EC-3, EC-14) ─────────────────────────

describe('v3 content mapping — failure and empty states', () => {
  const fail = (store: ReturnType<typeof mkStore>, error = 'export_unreadable') =>
    store.dispatch(contentMappingActions.inventoryLoaded({ phase: 'error', error } as never));

  it('TC_CTS_156 (positive): explains a missing export and offers a route back to Source', () => {
    const store = mkStore();
    fail(store);
    renderWithChrome(store);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to source/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the gate must be closed in the error
    state. Advancing from a step that could not read its input would carry an
    empty selection forward as if it were a decision.
  */
  it('TC_CTS_156 (negative): closes the gate while the export cannot be read', () => {
    const store = mkStore();
    fail(store);
    renderWithChrome(store);

    expect(primary()).toBeDisabled();
  });

  it('TC_CTS_157 (positive): renders no content type list in the error state', () => {
    const store = mkStore();
    fail(store);
    renderWithChrome(store);

    // Anchored on the error state being rendered at all.
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the error state must not reuse the
    empty-export copy. EC-1 and EC-3 are different situations with different
    remedies, and conflating them tells an operator whose export failed that
    their stack has no content types.
  */
  it('TC_CTS_157 (negative): does not present the error as an empty export', () => {
    const store = mkStore();
    fail(store);
    renderWithChrome(store);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/contains no content types/i)).not.toBeInTheDocument();
  });

  it('TC_CTS_158 (positive): shows the same state for an unreadable export as for a missing one', () => {
    const store = mkStore();
    fail(store, 'export_unreadable');
    renderWithChrome(store);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to source/i })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): the raw failure classification
    must not be shown to the operator. `export_unreadable` is a log vocabulary,
    not an explanation someone can act on.
  */
  it('TC_CTS_158 (negative): does not display the raw failure classification', () => {
    const store = mkStore();
    fail(store, 'export_unreadable');
    renderWithChrome(store);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('export_unreadable')).not.toBeInTheDocument();
  });

  it('TC_CTS_159 (positive): shows an empty-export state with the gate closed', () => {
    const store = mkStore();
    seed(store, []);
    renderWithChrome(store);

    expect(screen.getByText(/contains no content types/i)).toBeInTheDocument();
    expect(statusLine()).toHaveTextContent('No content types selected');
    expect(primary()).toBeDisabled();
  });

  /*
    Negative — taxonomy #2 (invalid shape): an empty export is not an error. No
    alert may be raised, or a perfectly valid empty stack reads as a failure.
  */
  it('TC_CTS_159 (negative): raises no error alert for a valid but empty export', () => {
    const store = mkStore();
    seed(store, []);
    renderWithChrome(store);

    // Anchored on the empty-export copy being present.
    expect(screen.getByText(/contains no content types/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('TC_CTS_160 (positive): stays paged and searchable at 500 content types', async () => {
    const store = mkStore();
    seed(store, many(500));
    renderWithChrome(store);

    expect(screen.getByText('Showing 25 of 500')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox'), 'CT 499');

    expect(screen.getByRole('checkbox', { name: /^CT 499$/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): it must not render all 500 rows at once.
    Abandoning paging at scale is the failure mode that makes the step unusable
    precisely on the stacks that need it most.
  */
  it('TC_CTS_160 (negative): does not render all 500 rows at once', () => {
    const store = mkStore();
    seed(store, many(500));
    renderWithChrome(store);

    const boxes = screen
      .getAllByRole('checkbox')
      .filter((cb) => !/select all/i.test(cb.getAttribute('aria-label') ?? ''));
    expect(boxes).toHaveLength(25);
  });

  it('TC_CTS_161 (positive): raises no error when a persisted uid vanishes from the export', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {}, retired_type: {} } },
    });
    renderWithChrome(store);

    expect(screen.getByTestId('cts-row-blog_article')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the vanished uid must not be sent
    back on the next save. Round-tripping a uid the export no longer contains
    would be rejected by API-2's validation and fail the save for a reason the
    operator cannot see.
  */
  it('TC_CTS_161 (negative): does not carry the vanished uid into the working selection', () => {
    const store = mkStore();
    seed(store, F1, {
      persistedSelection: { contentTypes: { blog_article: {}, retired_type: {} } },
    });
    renderWithChrome(store);

    expect(boxFor('Blog Article')).toBeChecked();
    expect(sel(store)).not.toContain('retired_type');
  });

  it('TC_CTS_162 (positive): keeps the restored selection when a content type’s references change', () => {
    const store = mkStore();
    seed(
      store,
      [{ uid: 'blog_article', title: 'Blog Article', references: ['category'], existsInDestination: false },
       { uid: 'category', title: 'Category', references: [], existsInDestination: true }],
      {
        persistedSelection: { contentTypes: { blog_article: {} } },
      }
    );
    renderWithChrome(store);

    expect(boxFor('Blog Article')).toBeChecked();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the confirmation must use the NEW
    edges. Unticking Category — now referenced by Blog Article in the re-export —
    must raise the dialog, proving the graph was recomputed rather than restored
    alongside the selection.
  */
  it('TC_CTS_162 (negative): uses the re-exported edges rather than the previous graph', async () => {
    const store = mkStore();
    seed(
      store,
      [{ uid: 'blog_article', title: 'Blog Article', references: ['category'], existsInDestination: false },
       { uid: 'category', title: 'Category', references: [], existsInDestination: true }],
      {
        persistedSelection: { contentTypes: { blog_article: {}, category: {} } },
      }
    );
    renderWithChrome(store);

    await userEvent.click(boxFor('Category'));

    expect(within(screen.getByRole('dialog')).getByText(/Blog Article/)).toBeInTheDocument();
  });
});

// ───────────────────────── client-side interaction cost and a11y (NFR-2, NFR-5, NFR-6) ─────────────────────────

describe('v3 content mapping — interaction cost and accessibility', () => {
  it('TC_CTS_138 (positive): issues no request while a search term is typed', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderWithChrome(store);
    mockLoadInventory.mockClear();

    await userEvent.type(screen.getByRole('searchbox'), 'CT 1234567');

    expect(mockLoadInventory).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the search must still work while
    making no request. Anchored so "no requests" cannot be satisfied by a search
    box that does nothing at all.
  */
  it('TC_CTS_138 (negative): still filters the list while making no request', async () => {
    const store = mkStore();
    seed(store, many(120));
    renderWithChrome(store);

    await userEvent.type(screen.getByRole('searchbox'), 'CT 99');

    expect(screen.getByRole('checkbox', { name: /^CT 99$/ })).toBeInTheDocument();
    expect(mockLoadInventory).not.toHaveBeenCalled();
  });

  it('TC_CTS_139 (positive): issues no request while rows are ticked and unticked', async () => {
    const store = mkStore();
    seed(store, many(20));
    renderWithChrome(store);
    mockLoadInventory.mockClear();

    for (let i = 0; i < 10; i++) await userEvent.click(boxFor(`CT ${i}`));
    for (let i = 0; i < 10; i++) await userEvent.click(boxFor(`CT ${i}`));

    expect(mockLoadInventory).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the ticks must have taken effect.
    Anchored on the resulting selection so "no requests" is not satisfied by
    checkboxes that never changed anything.
  */
  it('TC_CTS_139 (negative): still records every tick locally', async () => {
    const store = mkStore();
    seed(store, many(20));
    renderWithChrome(store);

    for (let i = 0; i < 10; i++) await userEvent.click(boxFor(`CT ${i}`));

    expect(sel(store)).toHaveLength(10);
  });

  it('TC_CTS_141 (positive): a content type checkbox is toggleable by keyboard alone', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    boxFor('Blog Article').focus();
    await userEvent.keyboard('{ }');

    expect(sel(store)).toEqual(['blog_article']);
  });

  /*
    Negative — taxonomy #5 (permission denial, adapted): no row checkbox may be
    removed from the tab order. A list of a hundred rows with tabIndex -1 is
    unusable without a pointer.
  */
  it('TC_CTS_141 (negative): removes no row checkbox from the tab order', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    const boxes = screen
      .getAllByRole('checkbox')
      .filter((cb) => !/select all/i.test(cb.getAttribute('aria-label') ?? ''));
    expect(boxes.some((b) => b.getAttribute('tabindex') === '-1')).toBe(false);
  });

  it('TC_CTS_144 (positive): a row checkbox is named for its content type', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(screen.getByRole('checkbox', { name: /^Blog Article$/ })).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the name must not be a bare state word
    or a generic label. "Selected" repeated down a hundred rows identifies
    nothing.
  */
  it('TC_CTS_144 (negative): does not name a row checkbox with a bare state word', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    // Anchored: the properly-named checkbox must exist.
    expect(screen.getByRole('checkbox', { name: /^Blog Article$/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^(selected|checkbox|select)$/i })).not.toBeInTheDocument();
  });

  it('TC_CTS_146 (positive): conveys the already-in-destination status as text', () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    expect(within(rowFor('landing_page')).getByText('already in destination')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): selection state must be exposed to
    assistive technology, not implied by styling. `aria-checked`/`checked` on the
    input is what a screen reader announces.
  */
  it('TC_CTS_146 (negative): exposes selection state through the checkbox rather than styling alone', async () => {
    const store = mkStore();
    seed(store);
    renderWithChrome(store);

    await userEvent.click(boxFor('Blog Article'));

    expect(boxFor('Blog Article')).toBeChecked();
  });
});
