import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 DestRegionLoginModal (destination region re-authentication).
 * Backs TC_DEST_016 (Log in disabled while either field is empty) and
 * TC_DEST_017 (both fields non-empty enables Log in).
 * feature.md AC-2.1, FR-2.2.
 */
const { mockSubmit } = vi.hoisted(() => ({ mockSubmit: vi.fn(() => () => {}) }));
vi.mock('../../../../../v3/store/thunks/destination.thunks', () => ({
  submitDestRegionLogin: mockSubmit,
  cancelDestRegionLogin: () => () => {},
}));

import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import DestRegionLoginModal from '../../../../../v3/components/destination/DestRegionLoginModal';

const renderModal = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  store.dispatch(destinationActions.setRegions([
    { value: 'NA', label: 'North America' },
    { value: 'EU', label: 'Europe' },
  ]));
  store.dispatch(destinationActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
  setup?.(store);
  render(
    <Provider store={store}>
      <DestRegionLoginModal />
    </Provider>
  );
  return store;
};

const loginBtn = () => screen.getByRole('button', { name: 'Log in' });

beforeEach(() => {
  mockSubmit.mockClear();
});

describe('v3 DestRegionLoginModal', () => {
  it('TC_DEST_016 (positive): with both fields empty the Log in button is disabled', () => {
    renderModal();
    expect(screen.getByText(/Switching to/)).toHaveTextContent('Europe');
    expect(loginBtn()).toBeDisabled();
  });

  // Negative — taxonomy #1 (missing input): a filled email but empty password is still
  // incomplete — Log in stays disabled and submitting starts no request.
  it('TC_DEST_016 (negative): an email with no password leaves Log in disabled and starts no request', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Email'), 'me@company.com');

    expect(loginBtn()).toBeDisabled();
    await userEvent.click(loginBtn());
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('TC_DEST_017 (positive): entering both Email and Password enables the Log in button', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Email'), 'me@company.com');
    await userEvent.type(screen.getByLabelText('Password'), 's3cret');

    expect(loginBtn()).not.toBeDisabled();
  });

  // Negative — taxonomy #1 (missing/empty input): whitespace-only values are not
  // credentials — the button must stay disabled.
  it('TC_DEST_017 (negative): whitespace-only credentials leave Log in disabled', async () => {
    renderModal();
    await userEvent.type(screen.getByLabelText('Email'), '   ');
    await userEvent.type(screen.getByLabelText('Password'), '   ');

    expect(loginBtn()).toBeDisabled();
  });
});
