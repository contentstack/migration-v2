import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 BranchMapping component.
 * Backs TC_DEST_030 (exactly one locked-source row + destination-branch select),
 * TC_DEST_031 (no add/remove controls), TC_DEST_032 (the locked marker and its
 * "Set in the source step" tooltip), TC_DEST_033 (a just-created stack offers
 * only the default `main` branch).
 * feature.md AC-8.1, AC-8.2, FR-9.1–9.3, EC-12.
 */
import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import BranchMapping from '../../../../../v3/components/destination/BranchMapping';

const renderBranches = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  store.dispatch(
    destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'release-eu', masterLocale: 'en-us' })
  );
  setup?.(store);
  render(
    <Provider store={store}>
      <BranchMapping />
    </Provider>
  );
  return store;
};

describe('v3 BranchMapping', () => {
  it('TC_DEST_030 (positive): exactly one row shows the locked source branch and a destination-branch select', () => {
    renderBranches((store) => {
      store.dispatch(
        destinationActions.setBranches([
          { value: 'main', label: 'main' },
          { value: 'develop', label: 'develop' },
        ])
      );
    });

    expect(screen.getAllByTestId('branch-map-row')).toHaveLength(1);
    expect(screen.getByTestId('branch-src-locked')).toHaveTextContent('release-eu');
    expect(screen.getByLabelText('Destination branch')).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (wrong shape): the source side is a locked read-only
  // display, NOT an editable select — there must be no source-branch input.
  it('TC_DEST_030 (negative): the source branch is read-only, not an editable select', () => {
    renderBranches();
    expect(screen.queryByLabelText('Source branch')).toBeNull();
    expect(screen.getByTestId('branch-src-locked')).toHaveAttribute('aria-readonly', 'true');
  });

  it('TC_DEST_031 (positive): no add or remove control is rendered for branch mapping', () => {
    renderBranches();
    expect(screen.queryByRole('button', { name: /add branch/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): the row count is fixed at one and cannot
  // be grown, even when the destination stack exposes several branches to choose from.
  it('TC_DEST_031 (negative): multiple available destination branches still yield exactly one mapping row', () => {
    renderBranches((store) => {
      store.dispatch(
        destinationActions.setBranches([
          { value: 'main', label: 'main' },
          { value: 'develop', label: 'develop' },
          { value: 'release-eu', label: 'release-eu' },
        ])
      );
    });
    expect(screen.getAllByTestId('branch-map-row')).toHaveLength(1);
  });

  it('TC_DEST_032 (positive): the source branch is marked Locked with a "Set in the source step" tooltip', () => {
    renderBranches();
    const locked = screen.getByTestId('branch-src-locked');
    expect(locked).toHaveTextContent('Locked');
    expect(screen.getByTitle('Set in the source step')).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (wrong shape): the DESTINATION side must NOT carry the
  // locked marker — it is the one field the user is expected to change.
  it('TC_DEST_032 (negative): the destination-branch select is not marked read-only', () => {
    renderBranches((store) => {
      store.dispatch(destinationActions.setBranches([{ value: 'main', label: 'main' }]));
    });
    const dest = screen.getByLabelText('Destination branch');
    expect(dest).not.toBeDisabled();
    expect(dest).not.toHaveAttribute('aria-readonly', 'true');
  });

  it('TC_DEST_033 (positive): a just-created destination stack offers only the default main branch', async () => {
    renderBranches((store) => {
      store.dispatch(destinationActions.stackCreated({ apiKey: 'blt-new', name: 'brand-new-stack' }));
      // Even if a stale branch list is in state, a new stack has only `main`.
      store.dispatch(
        destinationActions.setBranches([
          { value: 'main', label: 'main' },
          { value: 'develop', label: 'develop' },
        ])
      );
    });

    await userEvent.click(screen.getByLabelText('Destination branch'));
    const list = screen.getByRole('listbox', { name: 'Destination branch' });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual(['main']);
  });

  // Negative — taxonomy #4 (forbidden state): an EXISTING (not newly created) stack is
  // not restricted — its real branch list is offered.
  it('TC_DEST_033 (negative): an existing destination stack offers its full branch list', async () => {
    renderBranches((store) => {
      store.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt-existing' }));
      store.dispatch(
        destinationActions.setBranches([
          { value: 'main', label: 'main' },
          { value: 'develop', label: 'develop' },
        ])
      );
    });

    await userEvent.click(screen.getByLabelText('Destination branch'));
    expect(screen.getByRole('option', { name: 'develop' })).toBeInTheDocument();
  });
});
