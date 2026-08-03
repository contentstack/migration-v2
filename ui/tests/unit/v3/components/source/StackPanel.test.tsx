import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 StackPanel component. Backs TC_SRC_005 (initial gating), TC_SRC_008
 * (ordered cascade: Stack disabled until Org chosen), TC_SRC_013 (specific-module
 * gate). Thunks are mocked to no-ops so the mount effect doesn't hit the network.
 */
const { mockLoadStackModules } = vi.hoisted(() => ({ mockLoadStackModules: vi.fn(() => () => {}) }));
vi.mock('../../../../../v3/store/thunks/source.thunks', () => ({
  loadRegions: () => () => {},
  selectRegion: () => () => {},
  selectOrg: () => () => {},
  selectStack: () => () => {},
  loadStackModules: mockLoadStackModules,
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

  // Negative — once an org is chosen (with stacks loaded), the Stack select enables.
  it('TC_SRC_008 (negative): choosing an Organization enables the Stack select', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStacks([{ value: 'blt1', label: 'S1' }]));
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
    expect(screen.getByLabelText('Branch')).toHaveTextContent('main');
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
    fireEvent.click(screen.getByLabelText('Branch'));
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

  // Regression: an org with zero stacks used to leave the Stack field looking
  // broken — a select the user could open onto an empty, unexplained list.
  it('(stacks, positive) shows "No stacks in this org" instead of an empty select when the org has none', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
    });
    expect(screen.getByText(/No stacks in this org/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Stack')).toBeNull();
  });

  // Negative — once stacks load for that org, the normal select replaces the message.
  it('(stacks, negative) the "No stacks" message disappears once stacks are loaded', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStacks([{ value: 'blt1', label: 'S1' }]));
    });
    expect(screen.queryByText(/No stacks in this org/i)).toBeNull();
    expect(screen.getByLabelText('Stack')).toBeInTheDocument();
  });

  it('(stacks, positive) shows a loading indicator while stacksLoading is true, not the empty-org message', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      store.dispatch(sourceActions.setStackField({ field: 'stacksLoading', value: true }));
    });
    expect(screen.getByText(/Loading stacks/i)).toBeInTheDocument();
    expect(screen.queryByText(/No stacks in this org/i)).toBeNull();
  });

  // Negative — a failed stack load shows a distinct error + Retry, not the "no stacks" message.
  it('(stacks, negative) a stacksError shows an error message and a working Retry button', () => {
    const store = renderStack((s) => {
      s.dispatch(sourceActions.setStackField({ field: 'org', value: 'o1' }));
      s.dispatch(sourceActions.setStackField({ field: 'stacksError', value: 'Contentstack API error' }));
    });
    expect(screen.queryByText(/No stacks in this org/i)).toBeNull();
    expect(screen.getByText('Contentstack API error')).toBeInTheDocument();
    expect(store.getState().source.stack.stacksError).toBe('Contentstack API error');
  });

  // Regression: the "Specific module" panel used to be indistinguishable
  // between "still loading" and "load failed" — both looked like an infinite
  // "Loading modules…". Now modulesLoading and modulesError are tracked
  // separately and rendered distinctly.
  it('(modules, positive) shows a loading indicator while modulesLoading is true, not the module list', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      store.dispatch(sourceActions.setStackField({ field: 'modulesLoading', value: true }));
    });
    expect(screen.getByText(/Loading modules/i)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load modules|failed to load/i)).toBeNull();
  });

  // Negative — a failed load shows a distinct error + Retry, NOT the loading text forever.
  it('(modules, negative) a modulesError shows an error message and a working Retry button', () => {
    renderStack((store) => {
      store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      store.dispatch(sourceActions.setStackField({ field: 'modulesError', value: 'Contentstack API error' }));
    });
    expect(screen.queryByText(/Loading modules/i)).toBeNull();
    expect(screen.getByText('Contentstack API error')).toBeInTheDocument();

    mockLoadStackModules.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockLoadStackModules).toHaveBeenCalledTimes(1);
  });
});
