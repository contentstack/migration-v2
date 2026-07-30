import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 CreateStackModal component.
 * Backs TC_DEST_008 (modal shape + disabled Create action), TC_DEST_009 (a
 * non-empty Stack name enables Create), TC_DEST_011 (Cancel creates nothing and
 * leaves the Stack selection untouched).
 * feature.md AC-7.1, AC-7.3, FR-1.4, FR-1.6.
 */
const { mockCreateDestStack } = vi.hoisted(() => ({
  mockCreateDestStack: vi.fn(() => () => {}),
}));
vi.mock('../../../../../v3/store/thunks/destination.thunks', () => ({
  createDestStack: mockCreateDestStack,
}));

import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import CreateStackModal from '../../../../../v3/components/destination/CreateStackModal';

const renderModal = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  store.dispatch(destinationActions.setOrgs([{ value: 'o1', label: 'TSO Migrations' }]));
  store.dispatch(destinationActions.setField({ field: 'org', value: 'o1' }));
  store.dispatch(destinationActions.openCreateStack());
  setup?.(store);
  render(
    <Provider store={store}>
      <CreateStackModal />
    </Provider>
  );
  return store;
};

const createBtn = () => screen.getByRole('button', { name: 'Create stack' });

beforeEach(() => {
  mockCreateDestStack.mockClear();
});

describe('v3 CreateStackModal', () => {
  it('TC_DEST_008 (positive): the modal opens with a required Stack name, optional description and Create disabled', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Create a new stack' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stack name')).toBeRequired();
    expect(screen.getByLabelText('Stack description')).not.toBeRequired();
    expect(createBtn()).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): while closed the modal renders nothing
  // at all, so the create controls can't be reached out-of-flow.
  it('TC_DEST_008 (negative): while closed the modal renders no dialog or create controls', () => {
    const store = configureStore({ reducer: { destination: destinationReducer } });
    render(
      <Provider store={store}>
        <CreateStackModal />
      </Provider>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create stack' })).toBeNull();
  });

  it('TC_DEST_009 (positive): typing a non-empty Stack name enables the Create stack button', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Stack name'), 'production-eu-marketing-site');
    expect(createBtn()).not.toBeDisabled();
  });

  // Negative — taxonomy #1 (missing/empty input): a whitespace-only name is not a
  // name — Create stays disabled and clicking it starts no request.
  it('TC_DEST_009 (negative): a whitespace-only Stack name leaves Create disabled and starts no request', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Stack name'), '    ');

    expect(createBtn()).toBeDisabled();
    await userEvent.click(createBtn());
    expect(mockCreateDestStack).not.toHaveBeenCalled();
  });

  it('TC_DEST_011 (positive): Cancel closes the modal, creates nothing and leaves the Stack selection unchanged', async () => {
    const store = renderModal((s) => {
      s.dispatch(destinationActions.setField({ field: 'stackApiKey', value: 'blt-existing' }));
      s.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'draft-name' }));
    });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockCreateDestStack).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getState().destination.stackApiKey).toBe('blt-existing');
  });

  // Negative — taxonomy #4 (forbidden state): the close (X) control must behave the
  // same as Cancel — no creation, and the typed draft is discarded rather than kept
  // for the next time the modal opens.
  it('TC_DEST_011 (negative): the close control also creates nothing and discards the typed draft', async () => {
    const store = renderModal((s) => {
      s.dispatch(destinationActions.setCreateStackField({ field: 'name', value: 'draft-name' }));
    });

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mockCreateDestStack).not.toHaveBeenCalled();
    expect(store.getState().destination.createStack.name).toBe('');
  });
});
