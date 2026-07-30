import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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
      <DestinationPanel orgId="O1" projectId="P1" />
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

beforeEach(() => {
  mockProceed.mockClear();
  mockSelectDestRegion.mockClear();
  mockSelectDestOrg.mockClear();
  mockSelectDestStack.mockClear();
});

describe('v3 DestinationPanel — Region/Org/Stack selection', () => {
  it('TC_DEST_001 (positive): a fresh panel has Region/Org/Stack empty, no auth method, and Proceed disabled', () => {
    renderPanel();
    expect((screen.getByLabelText('Region') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Organization') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Stack') as HTMLSelectElement).value).toBe('');
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
    expect(screen.getByRole('option', { name: 'Select a region first' })).toBeInTheDocument();
  });

  it('TC_DEST_003 (positive): choosing an Organization lists its stacks plus a "Create a new stack" option', () => {
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
    expect(screen.getByRole('option', { name: 'Production — EU Marketing Site' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Staging — EU Marketing Site' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '+ Create a new stack' })).toBeInTheDocument();
  });

  // Negative — taxonomy #1 (missing input): with no Organization chosen the Stack
  // dropdown is disabled and offers no stack options at all.
  it('TC_DEST_003 (negative): with no Organization chosen the Stack dropdown is disabled', () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
    });
    expect(screen.getByLabelText('Stack')).toBeDisabled();
    expect(screen.queryByRole('option', { name: '+ Create a new stack' })).toBeNull();
  });

  it('TC_DEST_004 (positive): selecting an existing stack sets it as the destination without opening a modal', async () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Production — EU' }]));
    });

    await userEvent.selectOptions(screen.getByLabelText('Stack'), 'blt1');

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

    await userEvent.selectOptions(screen.getByLabelText('Stack'), '__create__');

    expect(mockSelectDestStack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Create a new stack' })).toBeInTheDocument();
  });

  it('TC_DEST_005 (positive): an organization with zero stacks offers only the "Create a new stack" option', () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([]));
    });
    expect(screen.getByRole('option', { name: '+ Create a new stack' })).toBeInTheDocument();
    // The only other option is the unselected placeholder — no real stack entries.
    const options = screen.getAllByRole('option', { hidden: true });
    const stackSelect = screen.getByLabelText('Stack');
    const stackOptions = options.filter((o) => o.closest('select') === stackSelect);
    expect(stackOptions.map((o) => o.textContent)).toEqual(['Select a stack…', '+ Create a new stack']);
  });

  // Negative — a populated organization does list its real stacks alongside the create option.
  it('TC_DEST_005 (negative): an organization with stacks lists them alongside the create option', () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
      store.dispatch(destinationActions.setStacks([{ value: 'blt1', label: 'Sandbox — EU' }]));
    });
    expect(screen.getByRole('option', { name: 'Sandbox — EU' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '+ Create a new stack' })).toBeInTheDocument();
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
    expect(screen.getByRole('option', { name: 'No organizations found' })).toBeInTheDocument();
    expect(proceedBtn()).toBeDisabled();
  });

  // Negative — with organizations present the empty state is gone and a real org is selectable.
  it('TC_DEST_006 (negative): with organizations present the empty state is not shown', () => {
    renderPanel((store) => {
      store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
      store.dispatch(destinationActions.setOrgs([{ value: 'o1', label: 'TSO Migrations' }]));
    });
    expect(screen.queryByRole('option', { name: 'No organizations found' })).toBeNull();
    expect(screen.getByRole('option', { name: 'TSO Migrations' })).toBeInTheDocument();
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
    expect(mockProceed).toHaveBeenCalledWith('O1', 'P1');
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
