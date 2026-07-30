import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 LanguageMapping component.
 * Backs TC_DEST_034 (mandatory locked master-locale row + explanatory copy),
 * TC_DEST_035 (zero additional rows by default), TC_DEST_036 ("Add language"
 * adds a source→destination row), TC_DEST_037 (any additional row is removable,
 * including the last, without touching the master row).
 * feature.md AC-4.1–4.4, FR-4.1–4.3, EC-7.
 */
import destinationReducer, {
  destinationActions,
} from '../../../../../v3/store/slice/destination.slice';
import LanguageMapping from '../../../../../v3/components/destination/LanguageMapping';

const LOCALES = [
  { value: 'en-us', label: 'en-us' },
  { value: 'en-gb', label: 'en-gb' },
  { value: 'fr-fr', label: 'fr-fr' },
];

const renderLangs = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { destination: destinationReducer } });
  store.dispatch(
    destinationActions.setSourceContext({ ready: true, region: 'NA', branch: 'main', masterLocale: 'en-us' })
  );
  store.dispatch(destinationActions.setLocales(LOCALES));
  setup?.(store);
  render(
    <Provider store={store}>
      <LanguageMapping />
    </Provider>
  );
  return store;
};

describe('v3 LanguageMapping', () => {
  it('TC_DEST_034 (positive): the master-locale row shows the locked source locale, a destination select and the explanatory copy', () => {
    renderLangs();

    const master = screen.getByTestId('master-locale-src');
    expect(master).toHaveTextContent('en-us');
    expect(master).toHaveTextContent('Master');
    expect(screen.getByLabelText('Destination master locale')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The source master locale is fixed. Choose which locale it becomes in the destination stack, then map any additional locales below.'
      )
    ).toBeInTheDocument();
  });

  // Negative — taxonomy #2 (wrong shape): the master row's SOURCE side is read-only and
  // has no remove control — it is mandatory and always present.
  it('TC_DEST_034 (negative): the master-locale row is read-only on the source side and cannot be removed', () => {
    renderLangs();
    expect(screen.getByTestId('master-locale-src')).toHaveAttribute('aria-readonly', 'true');
    expect(screen.queryByLabelText('Source master locale')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove master locale mapping' })).toBeNull();
  });

  it('TC_DEST_035 (positive): with nothing configured only the master row renders — zero additional rows', () => {
    renderLangs();
    expect(screen.queryAllByTestId('lang-map-row')).toHaveLength(0);
    expect(screen.getByTestId('master-locale-src')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): persisted additional mappings DO render,
  // so the empty default is genuinely "none configured", not a broken renderer.
  it('TC_DEST_035 (negative): persisted additional mappings render as additional rows', () => {
    renderLangs((store) => {
      store.dispatch(
        destinationActions.hydrate({
          additionalLanguageMappings: [{ srcLocale: 'en-gb', destLocale: 'fr-fr' }],
        } as any)
      );
    });
    expect(screen.getAllByTestId('lang-map-row')).toHaveLength(1);
  });

  it('TC_DEST_036 (positive): "Add language" adds a row with a source select on the left and a destination select on the right', async () => {
    renderLangs();
    await userEvent.click(screen.getByRole('button', { name: 'Add language' }));

    expect(screen.getAllByTestId('lang-map-row')).toHaveLength(1);
    expect(screen.getByLabelText('Source locale 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Destination locale 1')).toBeInTheDocument();
  });

  // Negative — taxonomy #4 (forbidden state): adding is additive, never a replace — a
  // second click yields two independent rows, not one reused row.
  it('TC_DEST_036 (negative): clicking "Add language" twice yields two independent rows', async () => {
    renderLangs();
    const add = screen.getByRole('button', { name: 'Add language' });
    await userEvent.click(add);
    await userEvent.click(add);

    expect(screen.getAllByTestId('lang-map-row')).toHaveLength(2);
    expect(screen.getByLabelText('Source locale 2')).toBeInTheDocument();
  });

  it('TC_DEST_037 (positive): the last remaining additional row can be removed, leaving the master row intact', async () => {
    renderLangs((store) => {
      store.dispatch(
        destinationActions.hydrate({
          additionalLanguageMappings: [{ srcLocale: 'en-gb', destLocale: 'fr-fr' }],
        } as any)
      );
    });
    expect(screen.getAllByTestId('lang-map-row')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Remove language mapping 1' }));

    expect(screen.queryAllByTestId('lang-map-row')).toHaveLength(0);
    expect(screen.getByTestId('master-locale-src')).toHaveTextContent('en-us');
  });

  // Negative — taxonomy #4 (forbidden state): removing ONE row of several removes only
  // that row; the others survive with their own values.
  it('TC_DEST_037 (negative): removing one of several rows leaves the remaining rows and their values', async () => {
    const store = renderLangs((s) => {
      s.dispatch(
        destinationActions.hydrate({
          additionalLanguageMappings: [
            { srcLocale: 'en-gb', destLocale: 'fr-fr' },
            { srcLocale: 'fr-fr', destLocale: 'en-gb' },
          ],
        } as any)
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove language mapping 1' }));

    expect(screen.getAllByTestId('lang-map-row')).toHaveLength(1);
    expect(store.getState().destination.additionalLanguageMappings).toEqual([
      { srcLocale: 'fr-fr', destLocale: 'en-gb' },
    ]);
  });
});
