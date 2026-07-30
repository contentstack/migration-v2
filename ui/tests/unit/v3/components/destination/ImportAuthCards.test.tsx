import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 ImportAuthCards component.
 * Backs TC_DEST_021 (both method cards always visible, none pre-selected),
 * TC_DEST_022 (Management token reveals its required name field + apps warning),
 * TC_DEST_023 (the token NAME field is plain text, not password-masked),
 * TC_DEST_024 (authToken reveals no extra field).
 * feature.md AC-3.1–3.3, FR-3.1, FR-3.2, FR-3.4, FR-3.5.
 */
import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import ImportAuthCards from '../../../../../v3/components/destination/ImportAuthCards';

const renderCards = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  setup?.(store);
  render(
    <Provider store={store}>
      <ImportAuthCards />
    </Provider>
  );
  return store;
};

const mgmtCard = () => screen.getByRole('radio', { name: /Management token/ });
const authCard = () => screen.getByRole('radio', { name: /authToken/ });

describe('v3 ImportAuthCards', () => {
  it('TC_DEST_021 (positive): both method cards render with their descriptions and neither is pre-selected', () => {
    renderCards();

    expect(
      screen.getByText('Stack-scoped token with an API key. Recommended for automated imports.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('User session token from a Contentstack login. Good for quick, one-off imports.')
    ).toBeInTheDocument();
    expect(mgmtCard()).toHaveAttribute('aria-checked', 'false');
    expect(authCard()).toHaveAttribute('aria-checked', 'false');
  });

  // Negative — taxonomy #4 (forbidden state): once a method is chosen exactly one card
  // is checked — the pair is mutually exclusive, not independently toggleable.
  it('TC_DEST_021 (negative): choosing one method checks exactly that card and leaves the other unchecked', async () => {
    renderCards();
    await userEvent.click(mgmtCard());

    expect(mgmtCard()).toHaveAttribute('aria-checked', 'true');
    expect(authCard()).toHaveAttribute('aria-checked', 'false');
  });

  it('TC_DEST_022 (positive): selecting Management token reveals the required token-name field and the apps warning', () => {
    renderCards((store) => {
      store.dispatch(destinationActions.setImportMethod('management'));
    });

    expect(screen.getByLabelText('Management token name')).toBeRequired();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'a management token cannot install apps'
    );
  });

  // Negative — taxonomy #1 (missing input): with no method chosen the token-name field
  // and the apps warning are both absent.
  it('TC_DEST_022 (negative): with no method chosen neither the token-name field nor the apps warning render', () => {
    renderCards();
    expect(screen.queryByLabelText('Management token name')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('TC_DEST_023 (positive): the Management token name field is plain text, not password-masked', () => {
    renderCards((store) => {
      store.dispatch(destinationActions.setImportMethod('management'));
    });
    expect(screen.getByLabelText('Management token name')).toHaveAttribute('type', 'text');
  });

  // Negative — taxonomy #2 (wrong shape): it must not be rendered as a password input,
  // because a token NAME is not a secret (feature.md NFR-1).
  it('TC_DEST_023 (negative): the Management token name field is not rendered as a password input', () => {
    renderCards((store) => {
      store.dispatch(destinationActions.setImportMethod('management'));
    });
    const field = screen.getByLabelText('Management token name');
    expect(field).not.toHaveAttribute('type', 'password');
  });

  it('TC_DEST_024 (positive): selecting authToken reveals no additional field', () => {
    renderCards((store) => {
      store.dispatch(destinationActions.setImportMethod('authToken'));
    });

    expect(authCard()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByLabelText('Management token name')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  // Negative — taxonomy #4 (forbidden state): the Management-token branch is the only
  // one that reveals a field, so switching to it does add exactly that input.
  it('TC_DEST_024 (negative): switching from authToken to Management token does reveal the token-name field', async () => {
    renderCards((store) => {
      store.dispatch(destinationActions.setImportMethod('authToken'));
    });
    expect(screen.queryByLabelText('Management token name')).toBeNull();

    await userEvent.click(mgmtCard());
    expect(screen.getByLabelText('Management token name')).toBeInTheDocument();
  });
});
