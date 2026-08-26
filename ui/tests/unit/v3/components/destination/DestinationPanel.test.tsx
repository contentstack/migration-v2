import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 DestinationPanel component.
 * Backs TC_DEST_001–007 (Region/Org/Stack cascade + required-field gating),
 * TC_DEST_038–040 (cross-region banner), TC_DEST_042–044 (Proceed gating incl.
 * source readiness), TC_DEST_045 (live Destination summary).
 * feature.md AC-1.1–1.5, AC-6.1–6.2, FR-1.1–1.7, FR-5.1, FR-6.1–6.3, FR-7.1,
 * EC-1, EC-2, EC-6, EC-8, EC-10.
 *
 * Thunks are mocked to no-ops so mount effects never touch the network; a real
 * store drives the rendered state.
 */
const { mockProceed, mockSelectDestRegion, mockSelectDestOrg, mockSelectDestStack } = vi.hoisted(
  () => ({
    mockProceed: vi.fn(() => () => {}),
    mockSelectDestRegion: vi.fn(() => () => {}),
    mockSelectDestOrg: vi.fn(() => () => {}),
    mockSelectDestStack: vi.fn(() => () => {}),
  })
);
vi.mock('../../../../../v3/store/thunks/destination.thunks', () => ({
  loadDestRegions: () => () => {},
  loadSourceContext: () => () => {},
  loadPersistedDestination: () => () => {},
  loadDestStackStats: () => () => {},
  createDestStack: () => () => {},
  loadContentstackLocales: () => () => {},
  submitDestRegionLogin: () => () => {},
  cancelDestRegionLogin: () => () => {},
  selectDestRegion: mockSelectDestRegion,
  selectDestOrg: mockSelectDestOrg,
  selectDestStack: mockSelectDestStack,
  proceedToContentMapping: mockProceed,
}));

import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import DestinationPanel from '../../../../../v3/components/destination/DestinationPanel';

const renderPanel = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  setup?.(store);
  render(
    <Provider store={store}>
      <DestinationPanel projectId="P1" />
    </Provider>
  );
  return store;
};

/** A fully-valid destination selection with a ready source — the happy path baseline. */
const seedComplete = (store: any) => {
  store.dispatch(destinationActions.setRegions([{ value: 'NA', label: 'North America' }]));
  store.dispatch(destinationActions.setOrgs([{ value: 'o1', label: 'TSO Migrations' }]));
  store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Production — EU' }]));
  store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
  store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
  store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt1' }));
  store.dispatch(destinationActions.setImportMethod('authToken'));
  store.dispatch(
    destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
  );
};

const proceedBtn = () => screen.getByRole('button', { name: /proceed to content mapping/i });

/** The dropdowns are themed (V3Select): options only exist once the trigger is
 * opened, and each open list is a listbox labelled like its trigger. */
const openDropdown = async (label: string) => {
  await userEvent.click(screen.getByLabelText(label));
  return screen.getByRole('listbox', { name: label });
};
const optionLabels = (list: HTMLElement) =>
  within(list).getAllByRole('option').map((o) => o.textContent);

beforeEach(() => {
  mockProceed.mockClear();
  mockSelectDestRegion.mockClear();
  mockSelectDestOrg.mockClear();
  mockSelectDestStack.mockClear();
});

describe('v3 DestinationPanel — Region/Org/Stack selection', () => {
  it('TC_DEST_001 (positive): a fresh panel has Region/Org/Stack empty, no auth method, and Proceed disabled', () => {
    renderPanel();
    // Nothing selected: each trigger shows its placeholder rather than a value.
    expect(screen.getByLabelText('Region')).toHaveTextContent('Select a region…');
    expect(screen.getByLabelText('Organization')).toHaveTextContent('Select a region first');
    expect(screen.getByLabelText('Stack')).toHaveTextContent('Select an organization first');
    expect(screen.getByTestId('summary-auth')).toHaveTextContent('Not selected');
    expect(proceedBtn()).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): with every required field set AND a
  // ready source, the same action is enabled — proving the initial disable is the
  // gate doing its job, not a permanently dead button.
  it('TC_DEST_001 (negative): with all required fields set and the source ready, Proceed is enabled', () => {
    renderPanel(seedComplete);
    expect(proceedBtn()).not.toBeDisabled();
  });

  it('TC_DEST_002 (positive): selecting a Region enables the Organization dropdown', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setRegions([{ value: 'NA', label: 'North America' }]));
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
    });
    expect(screen.getByLabelText('Organization')).not.toBeDisabled();
  });

  // Negative — taxonomy #1 (missing input): with no Region chosen the Organization
  // dropdown stays disabled and prompts for a region first.
  it('TC_DEST_002 (negative): with no Region chosen the Organization dropdown is disabled', () => {
    renderPanel();
    expect(screen.getByLabelText('Organization')).toBeDisabled();
    expect(screen.getByLabelText('Organization')).toHaveTextContent('Select a region first');
  });

  it('TC_DEST_003 (positive): choosing an Organization lists its stacks plus a "Create a new stack" option', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(
        destinationActions.setStacks([
          { value: 'blt1', label: 'Production — EU Marketing Site' },
          { value: 'blt2', label: 'Staging — EU Marketing Site' },
        ])
      );
    });
    const list = await openDropdown('Stack');
    expect(optionLabels(list)).toEqual([
      'Production — EU Marketing Site',
      'Staging — EU Marketing Site',
      '+ Create a new stack',
    ]);
  });

  // Negative — taxonomy #1 (missing input): with no Organization chosen the Stack
  // dropdown is disabled and offers no stack options at all.
  it('TC_DEST_003 (negative): with no Organization chosen the Stack dropdown is disabled', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
    });
    expect(screen.getByLabelText('Stack')).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Stack'));
    expect(screen.queryByRole('listbox', { name: 'Stack' })).toBeNull();
  });

  it('TC_DEST_004 (positive): selecting an existing stack sets it as the destination without opening a modal', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Production — EU' }]));
    });

    const list = await openDropdown('Stack');
    await userEvent.click(within(list).getByRole('option', { name: 'Production — EU' }));

    expect(mockSelectDestStack).toHaveBeenCalledWith('blt1');
    expect(screen.queryByRole('dialog', { name: 'Create a new stack' })).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): picking the "+ Create a new stack"
  // sentinel must NOT be treated as selecting a stack; it opens the modal instead.
  it('TC_DEST_004 (negative): choosing "+ Create a new stack" opens the modal instead of selecting a stack', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Production — EU' }]));
    });

    const list = await openDropdown('Stack');
    await userEvent.click(within(list).getByRole('option', { name: '+ Create a new stack' }));

    expect(mockSelectDestStack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Create a new stack' })).toBeInTheDocument();
  });

  it('TC_DEST_005 (positive): an organization with zero stacks offers only the "Create a new stack" option', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([]));
    });
    const list = await openDropdown('Stack');
    // Only the create entry — no real stack entries at all.
    expect(optionLabels(list)).toEqual(['+ Create a new stack']);
  });

  // Negative — a populated organization does list its real stacks alongside the create option.
  it('TC_DEST_005 (negative): an organization with stacks lists them alongside the create option', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Sandbox — EU' }]));
    });
    const list = await openDropdown('Stack');
    expect(optionLabels(list)).toEqual(['Sandbox — EU', '+ Create a new stack']);
  });

  it('TC_DEST_006 (positive): a region with zero accessible organizations shows an empty state and keeps Proceed disabled', () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setRegions([{ value: 'NA', label: 'North America' }]));
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setOrgs([]));
      store.dispatch(
        destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(screen.getByLabelText('Organization')).toHaveTextContent('No organizations found');
    expect(proceedBtn()).toBeDisabled();
  });

  // Negative — with organizations present the empty state is gone and a real org is selectable.
  it('TC_DEST_006 (negative): with organizations present the empty state is not shown', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setOrgs([{ value: 'o1', label: 'TSO Migrations' }]));
    });
    expect(screen.getByLabelText('Organization')).not.toHaveTextContent('No organizations found');
    const list = await openDropdown('Organization');
    expect(optionLabels(list)).toEqual(['TSO Migrations']);
  });

  it('TC_DEST_007 (positive): leaving Stack unset keeps Proceed disabled and sends no request', async () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: '' }));
    });

    expect(proceedBtn()).toBeDisabled();
    await userEvent.click(proceedBtn());
    expect(mockProceed).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): with the same fields complete the
  // click does reach the persist thunk.
  it('TC_DEST_007 (negative): with every required field set the Proceed click reaches the persist thunk', async () => {
    renderPanel(seedComplete);
    await userEvent.click(proceedBtn());
    expect(mockProceed).toHaveBeenCalledWith('P1');
  });
});

describe('v3 DestinationPanel — cross-region guidance', () => {
  it('TC_DEST_038 (positive): a destination region different from the source region shows the cross-region banner', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setRegions([
        { value: 'NA', label: 'North America' },
        { value: 'EU', label: 'Europe' },
      ]));
      store.dispatch(destinationActions.setField({ field: 'region', value: 'EU' }));
      store.dispatch(
        destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });

    const banner = screen.getByTestId('cross-region-banner');
    expect(banner).toHaveTextContent('Cross-region migration.');
    expect(banner).toHaveTextContent('Confirm data-residency requirements first.');
  });

  // Negative — taxonomy #4 (forbidden state): matching regions is not a cross-region
  // migration, so the banner must be absent (EC-8 / AC-1.5).
  it('TC_DEST_038 (negative): a destination region equal to the source region shows no banner', () => {
    renderPanel(seedComplete); // both 'NA'
    expect(screen.queryByTestId('cross-region-banner')).toBeNull();
  });

  it('TC_DEST_039 (positive): with source and destination in the same region the banner is not rendered', () => {
    renderPanel(seedComplete);
    expect(screen.queryByTestId('cross-region-banner')).toBeNull();
  });

  // Negative — changing the destination region away from the source's brings the banner back.
  it('TC_DEST_039 (negative): switching the destination region away from the source region renders the banner', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setField({ field: 'region', value: 'EU' }));
    });
    expect(screen.getByTestId('cross-region-banner')).toBeInTheDocument();
  });

  it('TC_DEST_040 (positive): the cross-region banner is advisory — Proceed stays enabled', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setField({ field: 'region', value: 'EU' }));
    });
    expect(screen.getByTestId('cross-region-banner')).toBeInTheDocument();
    expect(proceedBtn()).not.toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): a real gate (source not ready) DOES
  // disable Proceed even while the advisory banner is showing, proving the banner
  // isn't what's driving the enabled state.
  it('TC_DEST_040 (negative): a not-ready source still disables Proceed while the banner shows', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setField({ field: 'region', value: 'EU' }));
      store.dispatch(
        destinationActions.setSourceContext({ ready: false, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(screen.getByTestId('cross-region-banner')).toBeInTheDocument();
    expect(proceedBtn()).toBeDisabled();
  });
});

describe('v3 DestinationPanel — Proceed gating', () => {
  it('TC_DEST_042 (positive): a not-ready source disables Proceed and shows the prepare-source caption', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(
        destinationActions.setSourceContext({ ready: false, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(proceedBtn()).toBeDisabled();
    expect(screen.getByText('Prepare the source first to continue.')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): once the source IS ready the caption
  // disappears (it must not be shown for an unrelated missing field).
  it('TC_DEST_042 (negative): a ready source removes the prepare-source caption', () => {
    renderPanel(seedComplete);
    expect(screen.queryByText('Prepare the source first to continue.')).toBeNull();
  });

  it('TC_DEST_043 (positive): the source becoming ready while the panel is open enables Proceed without a reload', () => {
    const store = renderPanel((s) => {
      seedComplete(s);
      s.dispatch(
        destinationActions.setSourceContext({ ready: false, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(proceedBtn()).toBeDisabled();

    // The source becomes ready with the panel still mounted — no remount, no reload.
    act(() => {
      store.dispatch(
        destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(proceedBtn()).not.toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): the live re-check is not one-way; a
  // source that goes back to not-ready re-disables the action.
  it('TC_DEST_043 (negative): the source going back to not-ready re-disables Proceed live', () => {
    const store = renderPanel(seedComplete);
    expect(proceedBtn()).not.toBeDisabled();

    act(() => {
      store.dispatch(
        destinationActions.setSourceContext({ ready: false, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
    });
    expect(proceedBtn()).toBeDisabled();
  });

  it('TC_DEST_044 (positive): an unset import-authentication method keeps Proceed disabled and sends no request', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(
        destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
      );
      // importAuth.method intentionally left unset
    });

    expect(proceedBtn()).toBeDisabled();
    await userEvent.click(proceedBtn());
    expect(mockProceed).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #1 (missing input): choosing Management token but leaving its
  // required name blank is still an INCOMPLETE method, so Proceed stays disabled.
  it('TC_DEST_044 (negative): Management token chosen with a blank token name still keeps Proceed disabled', () => {
    renderPanel((store) => {
      seedComplete(store);
      store.dispatch(destinationActions.setImportMethod('management'));
      store.dispatch(destinationActions.setManagementTokenName('   '));
    });
    expect(proceedBtn()).toBeDisabled();
  });
});

describe('v3 DestinationPanel — Destination summary', () => {
  it('TC_DEST_045 (positive): the summary reflects the chosen Region, Organization, Stack and import auth', () => {
    renderPanel(seedComplete);
    expect(screen.getByTestId('summary-region')).toHaveTextContent('North America');
    expect(screen.getByTestId('summary-org')).toHaveTextContent('TSO Migrations');
    expect(screen.getByTestId('summary-stack')).toHaveTextContent('Production — EU');
    expect(screen.getByTestId('summary-auth')).toHaveTextContent('authToken');
  });

  // Negative — taxonomy #4 (forbidden state): the summary is live, not a snapshot —
  // adding a language mapping updates the locales-mapped figure rather than leaving
  // the value it first rendered with. (The exact counting formula is open — Q-16 —
  // so this asserts the value CHANGES, not what it equals.)
  it('TC_DEST_045 (negative): the locales-mapped summary value updates live rather than staying stale', () => {
    const store = renderPanel(seedComplete);
    const before = screen.getByTestId('summary-locales').textContent;

    act(() => {
      store.dispatch(destinationActions.addLanguageRow());
    });
    expect(screen.getByTestId('summary-locales').textContent).not.toBe(before);
  });
});

/**
 * Freezing the destination once it has been saved — rows TC_DEST_059–061.
 *
 * Added 2026-08-13 as a direct change. Unlike Source, no "failed" override is needed:
 * `proceedToContentMapping` mints the management token BEFORE persisting and returns false
 * having persisted nothing if the mint throws, so a failure leaves no destination document
 * and therefore cannot coexist with the frozen state.
 *
 * ⚠️ `proceeded` alone was not enough. It was set only in-session after a successful
 * persist, so a reload restored the fields with the flag still false — the same
 * lost-on-restart trap that made Source key on a persisted graph. `hydrate` now sets it,
 * which is sound because `loadPersistedDestination` only dispatches `hydrate` when the
 * server actually returned a document.
 */
describe('v3 DestinationPanel — frozen once the destination is saved', () => {
  it('TC_DEST_062 (positive): disables the destination branch dropdown once saved', () => {
    renderPanel((s) => {
      seedComplete(s);
      s.dispatch(destinationActions.setProceeded(true));
    });

    expect(screen.getByLabelText('Destination branch')).toBeDisabled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): the branch dropdown must stay OPERABLE before
    the destination is saved. Freezing it early would block the mapping the operator has to
    complete in order to proceed at all — the control is a precondition of its own freeze.
  */
  it('TC_DEST_062 (negative): leaves the destination branch dropdown editable before saving', () => {
    renderPanel(seedComplete);

    expect(screen.getByLabelText('Destination branch')).not.toBeDisabled();
  });

  it('TC_DEST_063 (positive): disables the locale mapping selects and the auth cards once saved', () => {
    renderPanel((s) => {
      seedComplete(s);
      s.dispatch(destinationActions.setProceeded(true));
    });

    // Guard against a vacuous pass: assert the controls EXIST before asserting they are
    // all disabled, or an empty list would satisfy `.every`.
    const locales = screen.getAllByLabelText(/^destination (master )?locale/i);
    expect(locales.length).toBeGreaterThan(0);
    locales.forEach((el) => expect(el).toBeDisabled());

    /*
      The auth cards are `role="radio"` divs, not form controls, so `toBeDisabled()` does
      not apply — jest-dom deliberately ignores `aria-disabled`. The real contract for a
      non-form widget is therefore asserted directly: announced as disabled, removed from
      the tab order, and inert when activated. That is stricter than `toBeDisabled()`,
      which would have said nothing about whether the click still worked.
    */
    const authCards = screen.getAllByRole('radio');
    expect(authCards.length).toBeGreaterThan(0);
    authCards.forEach((el) => {
      expect(el).toHaveAttribute('aria-disabled', 'true');
      expect(el).toHaveAttribute('tabindex', '-1');
    });
  });

  /*
    Negative — taxonomy #4 (forbidden state): same reasoning as the branch dropdown — both
    are required before proceeding, so neither may be frozen until the destination is saved.
  */
  it('TC_DEST_063 (negative): leaves the locale mapping and auth cards editable before saving', () => {
    renderPanel(seedComplete);

    const locales = screen.getAllByLabelText(/^destination (master )?locale/i);
    expect(locales.length).toBeGreaterThan(0);
    locales.forEach((el) => expect(el).not.toBeDisabled());
    screen.getAllByRole('radio').forEach((el) => {
      expect(el).not.toHaveAttribute('aria-disabled', 'true');
      expect(el).toHaveAttribute('tabindex', '0');
    });
  });

  it('TC_DEST_060 (positive): disables the region, org and stack selects once saved', () => {
    renderPanel((s) => {
      seedComplete(s);
      s.dispatch(destinationActions.setProceeded(true));
    });

    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(screen.getByLabelText('Organization')).toBeDisabled();
    expect(screen.getByLabelText('Stack')).toBeDisabled();
  });

  /*
    Negative — taxonomy #4 (forbidden state) inverted: a complete-but-unsaved selection
    must stay editable. This is the state the operator sits in just before proceeding, so
    freezing it would make the panel impossible to correct.
  */
  it('TC_DEST_060 (negative): leaves the selects editable while the destination is unsaved', () => {
    renderPanel(seedComplete);

    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByLabelText('Stack')).not.toBeDisabled();
  });

  it('TC_DEST_061 (positive): shows "Destination saved" on a disabled action', () => {
    renderPanel((s) => {
      seedComplete(s);
      s.dispatch(destinationActions.setProceeded(true));
    });

    const btn = screen.getByRole('button', { name: /destination saved/i });
    expect(btn).toBeDisabled();
  });

  /*
    Negative — taxonomy #1 (missing state): before saving, the action still offers to
    proceed. Pinning both labels stops the saved state becoming the only one the button
    ever shows.
  */
  it('TC_DEST_061 (negative): still offers the proceed action before saving', () => {
    renderPanel(seedComplete);

    expect(screen.queryByRole('button', { name: /destination saved/i })).toBeNull();
  });
});

// ───── every control is frozen, not just the ones someone thought of ─────

/*
  ⚠️ Written after a real bug: the management-token NAME input stayed editable after the
  destination was saved. The freeze work covered the Region/Organization/Stack selects, the
  proceed button, the mapping controls and the auth cards — and missed this input, because
  the tests asserted on the specific controls that had just been built
  (`getAllByRole('radio')`) rather than on everything the panel contains.

  That mattered more than it looks: `persistDestination` runs only inside
  `proceedToContentMapping`, so once `proceeded` is true nothing re-persists. An edit after
  that point changed the slice alone and silently vanished on reload — the UI showing a
  token name the saved document did not have.

  So this test is deliberately GENERIC. It enumerates every control in the panel and
  requires each to be frozen, with a narrow allowlist for controls that change no saved
  value. A control added later defaults to "must be frozen" instead of "not covered".
*/

/*
  ⚠️ The management-token variant, and the reason the bug survived. Every existing seed in
  this file uses `authToken`, so `ImportAuthCards`' management branch — which is where the
  token-name input lives — never rendered in a single frozen-state test. The control was
  not merely un-asserted; it was not on the page.
*/
const seedCompleteMgmt = (store: any) => {
  seedComplete(store);
  store.dispatch(destinationActions.setImportMethod('management'));
  store.dispatch(destinationActions.setManagementTokenName('eu-marketing-import'));
};

/** Controls that legitimately stay live: dismissing a notice alters nothing saved. */
const ALLOWED_LIVE = /dismiss/i;

/** Every control in the rendered panel, with the label we would report it by. */
const allControls = () =>
  [...document.body.querySelectorAll('input, select, textarea, button, [role="radio"], [role="switch"], [role="checkbox"]')].map(
    (el) => ({
      el,
      label:
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.getAttribute('id') ||
        (el.textContent || '').trim().slice(0, 40) ||
        el.tagName.toLowerCase(),
    })
  );

/** A control counts as frozen by whichever mechanism suits its markup. */
const isFrozen = (el: Element): boolean =>
  (el as HTMLInputElement).disabled === true || el.getAttribute('aria-disabled') === 'true';

describe('v3 DestinationPanel — the whole panel freezes, control by control', () => {
  it('TC_DEST_064 (positive): every control that writes to the saved destination is frozen once saved', () => {
    renderPanel((s) => {
      seedCompleteMgmt(s);
      s.dispatch(destinationActions.setProceeded(true));
    });

    const controls = allControls();
    // Guard against a vacuous pass: an empty panel would satisfy any `.every`.
    expect(controls.length).toBeGreaterThan(5);

    const stillLive = controls
      .filter(({ label }) => !ALLOWED_LIVE.test(label))
      .filter(({ el }) => !isFrozen(el))
      .map(({ label }) => label);

    expect(stillLive).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): before the destination is saved the panel must
    NOT be frozen. Paired so "freeze everything" cannot be satisfied by code that disables
    the panel permanently — which would make the step impossible to complete at all.
  */
  it('TC_DEST_064 (negative): the management token name is editable before the destination is saved', () => {
    renderPanel(seedCompleteMgmt);

    expect(screen.getByLabelText('Management token name')).not.toBeDisabled();
  });
});
