import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 StackPanel component. Backs TC_SRC_005 (initial gating), TC_SRC_008
 * (ordered cascade: Stack disabled until Org chosen), TC_SRC_013 (specific-module
 * gate). Thunks are mocked to no-ops so the mount effect doesn't hit the network.
 */
vi.mock('../../../../../v3/store/thunks/source.thunks', () => ({
  loadRegions: () => () => {},
  selectRegion: () => () => {},
  selectOrg: () => () => {},
  selectStack: () => () => {},
  loadStackModules: () => () => {},
  startExportAndPoll: () => () => {},
}));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';
import StackPanel from '../../../../../v3/components/source/StackPanel';

const renderStack = (setup?: (store: any) => void) => {
  const store = configureStore({ reducer: { source: sourceReducer } });
  setup?.(store);
  render(
    <Provider store={store}>
      <StackPanel projectId="P1" />
    </Provider>
  );
  return store;
};

const startBtn = () => screen.getByRole('button', { name: /start export/i });

describe('v3 StackPanel', () => {
  it('TC_SRC_005 (positive): fresh panel gates downstream selects and the action', () => {
    renderStack();
    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByLabelText('Organization')).toBeDisabled();
    expect(screen.getByLabelText('Stack')).toBeDisabled();
    expect(startBtn()).toBeDisabled();
  });

  // Negative — contrast: with region+org+stack set (whole scope), the action enables.
  it('TC_SRC_005 (negative): with region, org and stack selected the action enables', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    });
    expect(startBtn()).not.toBeDisabled();
  });

  it('TC_SRC_008 (positive): the Stack select is disabled until an Organization is chosen', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
    });
    expect(screen.getByLabelText('Stack')).toBeDisabled();
  });

  // Negative — once an org is chosen, the Stack select enables.
  it('TC_SRC_008 (negative): choosing an Organization enables the Stack select', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
    });
    expect(screen.getByLabelText('Stack')).not.toBeDisabled();
  });

  it('TC_SRC_013 (positive): specific scope with no module checked keeps the action disabled', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      store.dispatch(
        sourceActions.setStackField({
          field: 'modules',
          value: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }],
        })
      );
    });
    expect(startBtn()).toBeDisabled();
  });

  // Negative — with at least one module checked, the action enables.
  it('TC_SRC_013 (negative): checking at least one module enables the action', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      store.dispatch(
        sourceActions.setStackField({
          field: 'modules',
          value: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }],
        })
      );
      store.dispatch(sourceActions.setStackField({ field: 'selectedModules', value: ['contentTypes'] }));
    });
    expect(startBtn()).not.toBeDisabled();
  });

  it('TC_SRC_009 (positive): the branch control defaults to "main" once a stack is selected', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    });
    expect((screen.getByLabelText('Branch') as HTMLSelectElement).value).toBe('main');
  });

  // Negative — loaded branches appear as selectable options (not stuck at main-only).
  it('TC_SRC_009 (negative): loaded branches are offered as options', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(sourceActions.setBranches([
        { value: 'main', label: 'main' },
        { value: 'develop', label: 'develop' },
      ]));
    });
    expect(screen.getByRole('option', { name: 'develop' })).toBeInTheDocument();
  });

  it('TC_SRC_015 (positive): a missing required field keeps the action disabled', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      // stack intentionally not selected
    });
    expect(startBtn()).toBeDisabled();
  });

  // Negative — with every required field set, the action is enabled.
  it('TC_SRC_015 (negative): with all required fields set the action is enabled', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    });
    expect(startBtn()).not.toBeDisabled();
  });
});
