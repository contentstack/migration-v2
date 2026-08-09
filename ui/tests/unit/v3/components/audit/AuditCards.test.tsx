import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — cs-audit-report, Phase 1 tranche 3b: the two card families.
 *
 * Backs TC_AR_063–077 (feature.md FR-4.1 … FR-4.6, FR-5.1 … FR-5.4, FR-2.11,
 * FR-2.12, NFR-8, NFR-9; trd.md TR-16, TR-17).
 *
 * The split is the whole point of these two sections and is asserted repeatedly
 * below: "Worth a look" holds the two categories a user may act on, and "Just so
 * you know" holds the two that always migrate and expose no control at all (A-4).
 *
 * Cards are exercised through the panel rather than in isolation, because which
 * card appears — and in which section — is a property of the composition, not of a
 * card in a vacuum.
 */
vi.mock('../../../../../v3/store/thunks/audit.thunks', () => ({
  loadAuditFindings: () => () => {},
  startAuditScan: () => () => {},
  pollAuditJob: () => () => {},
  loadAuditItems: () => () => {},
  rerunAudit: () => () => {},
  proceedFromAudit: () => () => {},
}));

import auditReducer, {
  auditActions,
  AuditCheckView,
  AuditDecisionsView,
  AuditTotalsView,
} from '../../../../../v3/store/slice/audit.slice';
import AuditPanel from '../../../../../v3/components/audit/AuditPanel';

const LABELS = {
  unusedAssets: 'Unused assets — referenced by any entry?',
  unpublishedEntries: 'Unpublished entries — has publish details?',
  emptyContentTypes: 'Empty content types — any entries at all?',
  unusedGlobalFields: 'Unused global fields — referenced by a schema?',
} as const;

type Counts = {
  unusedAssets?: number | 'notPresent' | 'unavailable';
  unpublishedEntries?: number | 'notPresent' | 'unavailable';
  emptyContentTypes?: number | 'notPresent' | 'unavailable';
  unusedGlobalFields?: number | 'notPresent' | 'unavailable';
};

const check = (
  id: keyof typeof LABELS,
  value: number | 'notPresent' | 'unavailable'
): AuditCheckView =>
  typeof value === 'number'
    ? { id, label: LABELS[id], state: 'done', count: value }
    : { id, label: LABELS[id], state: value };

/** Fixture F1 by default: 4 unused assets, 6 unpublished, 1 empty CT, 1 unused GF. */
const checksFor = (over: Counts = {}): AuditCheckView[] => [
  check('unusedAssets', over.unusedAssets ?? 4),
  check('unpublishedEntries', over.unpublishedEntries ?? 6),
  check('emptyContentTypes', over.emptyContentTypes ?? 1),
  check('unusedGlobalFields', over.unusedGlobalFields ?? 1),
];

const F1_TOTALS: AuditTotalsView = {
  contentTypes: 4,
  globalFields: 2,
  assets: 10,
  entryRecords: 20,
  denominator: 36,
};

const NO_DECISIONS: AuditDecisionsView = { categories: {}, itemOverrides: {} };

const mkStore = () => configureStore({ reducer: { audit: auditReducer } });

const seedReady = (
  store: ReturnType<typeof mkStore>,
  opts: { counts?: Counts; decisions?: AuditDecisionsView; variantsInspected?: boolean } = {}
) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks: checksFor(opts.counts),
      totals: F1_TOTALS,
      variantsInspected: opts.variantsInspected ?? false,
      decisions: opts.decisions ?? NO_DECISIONS,
    })
  );
};

const renderPanel = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <AuditPanel projectId="P1" />
    </Provider>
  );

/** The "Worth a look" region, so assertions cannot stray into the other section. */
const worthALook = () => screen.getByRole('region', { name: /worth a look/i });
const justSoYouKnow = () => screen.getByRole('region', { name: /just so you know/i });

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────── Worth a look: presence ─────────────────────────

describe('v3 audit cards — Worth a look, which cards appear', () => {
  it('TC_AR_063 (positive): both excludable categories render a card', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const region = worthALook();
    expect(within(region).getByText(/6 unpublished entries/i)).toBeInTheDocument();
    expect(within(region).getByText(/4 unused assets/i)).toBeInTheDocument();
    expect(within(region).getAllByRole('switch')).toHaveLength(2);
  });

  /*
    Negative — taxonomy #1 (empty input): a category with zero flagged items renders
    no card (FR-4.6). A card reading "0 unused assets" with a switch invites the user
    to exclude a set that is already empty.
  */
  it('TC_AR_070 (negative): a category with zero flagged items renders no card', () => {
    const store = mkStore();
    seedReady(store, { counts: { unusedAssets: 0 } });
    renderPanel(store);

    const region = worthALook();
    expect(within(region).getByText(/6 unpublished entries/i)).toBeInTheDocument();
    expect(within(region).queryByText(/unused assets/i)).not.toBeInTheDocument();
    expect(within(region).getAllByRole('switch')).toHaveLength(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the non-excludable categories must
    never appear in this section. Their presence here would imply a control that
    A-4 forbids ever existing.
  */
  it('TC_AR_071 (negative): the non-excludable categories never appear under Worth a look', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const region = worthALook();
    expect(within(region).queryByText(/empty content types/i)).not.toBeInTheDocument();
    expect(within(region).queryByText(/unused global fields/i)).not.toBeInTheDocument();
  });

  /*
    Negative — taxonomy #6 (dependency failure): a check that resolved `unavailable`
    renders no card either.

    It is not the FR-4.6 zero case — there may well be flagged items, we simply could
    not look. Offering a switch would let the user exclude a set whose size is
    unknown, and a card with a blank count is the FR-2.11 violation in card form.
  */
  it('TC_AR_063 (negative): a category whose check is unavailable renders no card and no switch', () => {
    const store = mkStore();
    seedReady(store, { counts: { unusedAssets: 'unavailable' } });
    renderPanel(store);

    const region = worthALook();
    expect(within(region).getByText(/6 unpublished entries/i)).toBeInTheDocument();
    expect(within(region).queryByText(/unused assets/i)).not.toBeInTheDocument();
    expect(within(region).getAllByRole('switch')).toHaveLength(1);
  });
});

// ───────────────────────── Worth a look: contents ─────────────────────────

describe('v3 audit cards — Worth a look, card contents', () => {
  it('TC_AR_064 (positive): a card carries its count, guidance and a Review items action', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    expect(within(card).getByText(/6 unpublished entries/i)).toBeInTheDocument();
    expect(within(card).getByText(/never published/i)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /review items/i })).toBeInTheDocument();
    expect(within(card).getByRole('switch')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the card's count comes from the CHECK,
    never from however many table rows happen to be loaded.

    The table is paginated at 50, so a card reading the loaded row count would say
    "50 unpublished entries" for a category of 100 — a wrong headline number that
    looks entirely plausible.
  */
  it('TC_AR_064 (negative): the card count comes from the check, not from the loaded table rows', () => {
    const store = mkStore();
    seedReady(store, { counts: { unpublishedEntries: 100 } });
    store.dispatch(
      auditActions.itemsLoaded({
        items: Array.from({ length: 50 }, (_, i) => ({
          key: `entry:blog:e${i}:en`,
          category: 'unpublishedEntries' as const,
          type: 'Entry',
          title: `Draft ${i}`,
          uid: `e${i}`,
          contentType: 'blog',
          locale: 'en',
          status: 'Never published',
        })),
        page: 1,
        pageCount: 2,
        total: 100,
        counts: { all: 100, entries: 100, assets: 0, contentTypes: 0, globalFields: 0 },
      })
    );
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    expect(within(card).getByText(/100 unpublished entries/i)).toBeInTheDocument();
    expect(within(card).queryByText(/50 unpublished entries/i)).not.toBeInTheDocument();
  });

  it('TC_AR_065 (positive): the switch reads Included when the category is kept and Excluded when not', () => {
    const store = mkStore();
    seedReady(store, { decisions: { categories: { unusedAssets: 'exclude' }, itemOverrides: {} } });
    renderPanel(store);

    const kept = screen.getByRole('group', { name: /unpublished entries/i });
    const dropped = screen.getByRole('group', { name: /unused assets/i });

    expect(within(kept).getByText('Included')).toBeInTheDocument();
    expect(within(dropped).getByText('Excluded')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the switch's state must be readable
    without colour. NFR-9 requires text as well as colour, and the reference design
    carries this meaning largely in the track's fill — so the word is the part that
    has to be verified, plus `aria-checked` for assistive technology.
  */
  it('TC_AR_065 (negative): switch state is conveyed by text and aria-checked, not colour alone', () => {
    const store = mkStore();
    seedReady(store, { decisions: { categories: { unusedAssets: 'exclude' }, itemOverrides: {} } });
    renderPanel(store);

    const kept = within(screen.getByRole('group', { name: /unpublished entries/i })).getByRole('switch');
    const dropped = within(screen.getByRole('group', { name: /unused assets/i })).getByRole('switch');

    expect(kept).toHaveAttribute('aria-checked', 'true');
    expect(dropped).toHaveAttribute('aria-checked', 'false');
  });
});

// ───────────────────────── Worth a look: the switch ─────────────────────────

describe('v3 audit cards — the include/exclude switch', () => {
  it('TC_AR_066 (positive): the switch is reachable and operable by keyboard alone', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const sw = within(screen.getByRole('group', { name: /unused assets/i })).getByRole('switch');
    sw.focus();
    expect(sw).toHaveFocus();

    await userEvent.keyboard('{Enter}');

    expect(store.getState().audit.decisions.categories.unusedAssets).toBe('exclude');
  });

  /*
    Negative — taxonomy #2 (invalid shape): each switch's accessible name must
    identify WHICH category it governs. Two switches sit on this page; names of
    "toggle" or "Included" leave a screen-reader user unable to tell which set of
    content they are about to drop (NFR-8).
  */
  it('TC_AR_066 (negative): each switch has an accessible name naming its own category', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const [first, second] = screen.getAllByRole('switch');
    const names = [first, second].map(
      (el) => el.getAttribute('aria-label') ?? el.textContent ?? ''
    );

    expect(names.some((n) => /unpublished entries/i.test(n))).toBe(true);
    expect(names.some((n) => /unused assets/i.test(n))).toBe(true);
  });

  it('TC_AR_067 (positive): an excluded card shows a strip stating the count that will not migrate', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    await userEvent.click(within(card).getByRole('switch'));

    expect(within(card).getByText(/6 entries/i)).toBeInTheDocument();
    expect(within(card).getByText(/will not be migrated/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the count strip must not be present
    while the category is included. It is the loudest element on the card, and
    showing it for a kept category tells the user content is being dropped when it
    is not.
  */
  it('TC_AR_067 (negative): an included card shows no will-not-be-migrated strip', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    expect(within(card).getByText('Included')).toBeInTheDocument();
    expect(within(card).queryByText(/will not be migrated/i)).not.toBeInTheDocument();
  });

  it('TC_AR_068 (positive): toggling an excluded card back to included clears its strip', async () => {
    const store = mkStore();
    seedReady(store, {
      decisions: { categories: { unpublishedEntries: 'exclude' }, itemOverrides: {} },
    });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    expect(within(card).getByText(/will not be migrated/i)).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('switch'));

    expect(within(card).queryByText(/will not be migrated/i)).not.toBeInTheDocument();
    expect(within(card).getByText('Included')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): toggling one card must leave the other
    alone. Both switches write into one shared decision object, so a handler that
    replaced `categories` wholesale rather than updating one key would silently
    re-include the category the user excluded a moment earlier.
  */
  it('TC_AR_068 (negative): toggling one card does not disturb the other category', async () => {
    const store = mkStore();
    seedReady(store, {
      decisions: { categories: { unusedAssets: 'exclude' }, itemOverrides: {} },
    });
    renderPanel(store);

    const entries = screen.getByRole('group', { name: /unpublished entries/i });
    await userEvent.click(within(entries).getByRole('switch'));

    expect(store.getState().audit.decisions.categories).toEqual({
      unusedAssets: 'exclude',
      unpublishedEntries: 'exclude',
    });
  });
});

// ───────────────────────── Worth a look: Review items ─────────────────────────

describe('v3 audit cards — Review items', () => {
  it('TC_AR_069 (positive): Review items opens the table and filters it to that category', async () => {
    const store = mkStore();
    seedReady(store);
    store.dispatch(auditActions.setTableOpen(false));
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unused assets/i });
    await userEvent.click(within(card).getByRole('button', { name: /review items/i }));

    expect(store.getState().audit.tableOpen).toBe(true);
    expect(store.getState().audit.filter).toBe('assets');
  });

  /*
    Negative — taxonomy #2 (invalid shape): each card's Review items action must
    filter to ITS OWN category, not to `all`. Filtering to everything is the easy
    implementation and it looks like it works — the table opens and rows appear —
    while doing nothing the user asked for.
  */
  it('TC_AR_069 (negative): Review items on the entries card filters to entries, not to all', async () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unpublished entries/i });
    await userEvent.click(within(card).getByRole('button', { name: /review items/i }));

    expect(store.getState().audit.filter).toBe('entries');
  });
});

// ───────────────────────── Just so you know ─────────────────────────

describe('v3 audit cards — Just so you know', () => {
  it('TC_AR_072 (positive): both non-excludable categories render an informational card', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const region = justSoYouKnow();
    expect(within(region).getByText(/empty content types/i)).toBeInTheDocument();
    expect(within(region).getByText(/unused global fields/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): these cards must expose no means of
    exclusion whatsoever. A-4 makes these categories permanently non-excludable, and
    FR-5.2 states it as a prohibition rather than a default — so the absence of every
    control is the assertion, not merely the absence of a switch.
  */
  it('TC_AR_073 (negative): informational cards expose no switch, checkbox or button', () => {
    const store = mkStore();
    seedReady(store);
    renderPanel(store);

    const region = justSoYouKnow();
    expect(within(region).getByText(/empty content types/i)).toBeInTheDocument();
    expect(within(region).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
  });

  it('TC_AR_074 (positive): a non-zero informational card shows the Keeping pill', () => {
    const store = mkStore();
    seedReady(store, { counts: { emptyContentTypes: 2 } });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /empty content types/i });
    expect(within(card).getByText('Keeping')).toBeInTheDocument();
  });

  it('TC_AR_075 (positive): a zero-count informational card shows the All clean pill', () => {
    const store = mkStore();
    seedReady(store, { counts: { unusedGlobalFields: 0 } });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unused global fields/i });
    expect(within(card).getByText('All clean')).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the two pills are mutually exclusive. A
    zero-count card carrying "Keeping" implies content is being retained when there
    is none, and a non-zero card carrying "All clean" is the false clean bill of
    health in miniature.
  */
  it('TC_AR_074 (negative): the Keeping and All clean pills never appear together on one card', () => {
    const store = mkStore();
    seedReady(store, { counts: { emptyContentTypes: 2, unusedGlobalFields: 0 } });
    renderPanel(store);

    const keeping = screen.getByRole('group', { name: /empty content types/i });
    const clean = screen.getByRole('group', { name: /unused global fields/i });

    expect(within(keeping).queryByText('All clean')).not.toBeInTheDocument();
    expect(within(clean).queryByText('Keeping')).not.toBeInTheDocument();
  });

  it('TC_AR_076 (positive): a notPresent check shows that state in place of either pill', () => {
    const store = mkStore();
    seedReady(store, { counts: { unusedGlobalFields: 'notPresent' } });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unused global fields/i });
    expect(within(card).getByText(/not present/i)).toBeInTheDocument();
  });

  it('TC_AR_077 (positive): an unavailable check shows that state in place of either pill', () => {
    const store = mkStore();
    seedReady(store, { counts: { emptyContentTypes: 'unavailable' } });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /empty content types/i });
    expect(within(card).getByText(/unavailable/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #3 (boundary): a check that did not run shows NEITHER pill and
    NO count.

    This is G-3 at card level and the most consequential assertion in this file. An
    `unavailable` card that fell through to "All clean" — the natural outcome of
    branching on `count === 0` when `count` is absent — tells the user a check passed
    when it never ran (FR-2.11, FR-5.4).
  */
  it('TC_AR_076 (negative): a check that did not run shows neither pill and no count of zero', () => {
    const store = mkStore();
    seedReady(store, {
      counts: { unusedGlobalFields: 'unavailable', emptyContentTypes: 'notPresent' },
    });
    renderPanel(store);

    for (const name of [/unused global fields/i, /empty content types/i]) {
      const card = screen.getByRole('group', { name });
      expect(within(card).queryByText('All clean')).not.toBeInTheDocument();
      expect(within(card).queryByText('Keeping')).not.toBeInTheDocument();
      expect(within(card).queryByText('0')).not.toBeInTheDocument();
    }
  });
});

// ───────────────────────── the variant caveat ─────────────────────────

describe('v3 audit cards — the variant caveat', () => {
  it('TC_AR_063b (positive): with no variant data the unused-assets card discloses it was not inspected', () => {
    const store = mkStore();
    seedReady(store, { variantsInspected: false });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unused assets/i });
    // FR-2.12: without this, a user acting on the "unused" label deletes assets that
    // live variant content depends on — 7 of 10 on the reference stack.
    expect(within(card).getByText(/variant/i)).toBeInTheDocument();
  });

  /*
    Negative — taxonomy #4 (forbidden state): when variants WERE inspected the caveat
    must be absent. A permanent caveat is noise that trains the user to ignore it,
    which costs exactly the protection FR-2.12 buys.
  */
  it('TC_AR_063b (negative): with variant data inspected the caveat is absent', () => {
    const store = mkStore();
    seedReady(store, { variantsInspected: true });
    renderPanel(store);

    const card = screen.getByRole('group', { name: /unused assets/i });
    expect(within(card).getByText(/4 unused assets/i)).toBeInTheDocument();
    expect(within(card).queryByText(/variant/i)).not.toBeInTheDocument();
  });
});
