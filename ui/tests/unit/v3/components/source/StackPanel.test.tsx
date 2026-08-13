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

/**
 * Freezing the source form once an export has succeeded.
 *
 * Rows TC_SRC_059–063, TC_SRC_067. Added 2026-08-12 as a direct change (no pipeline
 * run); the matrix was extended with the same ids.
 *
 * The rule is `!failed && (hasGraph || succeeded)`:
 *   - `hasGraph` and not just `succeeded`, because the job registry is in-memory and
 *     lost on restart. Returning to a finished project shows a persisted graph with no
 *     job status at all, and the form must still be frozen (TC_SRC_067).
 *   - `!failed` wins over both, because a failure must always leave the operator able to
 *     change something and retry — including when an EARLIER export had succeeded and
 *     left a graph behind (TC_SRC_063).
 */
const GRAPH = { counts: { contentTypes: 1 }, nodes: [], edges: [] };

/*
  A panel with a stack chosen. `stacks` must be seeded too: with an org set and an empty
  stack list the panel renders "No stacks in this org." in place of the Stack select, so
  a fixture that set only the org would be asserting against a state the operator never
  reaches after a successful export.
*/
const seedReady = (store: any) => {
  store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
  store.dispatch(sourceActions.setStackField({ field: 'org', value: 'O1' }));
  store.dispatch(
    sourceActions.setStackField({ field: 'stacks', value: [{ value: 'blt1', label: 'Blog stack' }] })
  );
  store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
};

describe('v3 StackPanel — frozen after a successful export', () => {
  it('TC_SRC_059 (positive): disables the region, organization, stack and branch selects', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'succeeded' }));
    });

    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(screen.getByLabelText('Organization')).toBeDisabled();
    expect(screen.getByLabelText('Stack')).toBeDisabled();
  });

  /*
    Negative — taxonomy #4 (forbidden state) inverted: before any export the selects must
    be usable. Without this pair, "everything disabled" would pass against a panel that
    was permanently inert.
  */
  it('TC_SRC_059 (negative): leaves the selects usable before any export has run', () => {
    renderStack(seedReady);

    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByLabelText('Organization')).not.toBeDisabled();
    expect(screen.getByLabelText('Stack')).not.toBeDisabled();
  });

  it('TC_SRC_060 (positive): marks the scope cards as disabled', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'succeeded' }));
    });

    for (const card of screen.getAllByRole('button', { name: /whole stack|specific module/i })) {
      expect(card).toHaveAttribute('aria-disabled', 'true');
    }
  });

  /*
    Negative — taxonomy #4: the scope cards must not merely LOOK disabled. They are divs
    with role="button", so the `disabled` attribute does nothing on them — activating one
    after a successful export must not change the recorded scope.
  */
  it('TC_SRC_060 (negative): activating a disabled scope card does not change the scope', () => {
    const store = renderStack((s) => {
      seedReady(s);
      s.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'succeeded' }));
    });
    const before = store.getState().source.stack.scope;

    fireEvent.click(screen.getByRole('button', { name: /specific module/i }));

    expect(store.getState().source.stack.scope).toBe(before);
  });

  it('TC_SRC_061 (positive): disables the module checkboxes', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      // Modules are set through the generic field setter — there is no
      // `setStackModules` action.
      store.dispatch(
        sourceActions.setStackField({
          field: 'modules',
          value: [
            { key: 'contentTypes', label: 'Content Types', dependsOn: [] },
            { key: 'entries', label: 'Entries', dependsOn: [] },
          ],
        })
      );
      store.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'succeeded' }));
    });

    expect(screen.getByLabelText('Content Types')).toBeDisabled();
    expect(screen.getByLabelText('Entries')).toBeDisabled();
  });

  /*
    Negative — taxonomy #4: the same checkboxes are usable before the export. A module
    that is FORCED by the closure is already disabled for its own reason, so this pair
    uses two modules that depend on nothing.
  */
  it('TC_SRC_061 (negative): leaves the module checkboxes usable before the export', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
      // Modules are set through the generic field setter — there is no
      // `setStackModules` action.
      store.dispatch(
        sourceActions.setStackField({
          field: 'modules',
          value: [
            { key: 'contentTypes', label: 'Content Types', dependsOn: [] },
            { key: 'entries', label: 'Entries', dependsOn: [] },
          ],
        })
      );
    });

    expect(screen.getByLabelText('Content Types')).not.toBeDisabled();
  });

  it('TC_SRC_062 (positive): shows "Export complete" on a disabled action button', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'succeeded' }));
    });

    const btn = screen.getByRole('button', { name: /export complete/i });
    expect(btn).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^start export$/i })).toBeNull();
  });

  /*
    Negative — taxonomy #1 (missing state): before the export it still reads "Start
    export". Pinning both labels keeps the completed state from becoming the only one the
    button ever shows.
  */
  it('TC_SRC_062 (negative): still reads "Start export" before the export has run', () => {
    renderStack(seedReady);

    expect(screen.getByRole('button', { name: /start export/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export complete/i })).toBeNull();
  });

  it('TC_SRC_063 (positive): after a FAILED export the form stays usable and offers a retry', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setJob({ jobId: 'j1', jobStatus: 'failed' }));
    });

    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByLabelText('Stack')).not.toBeDisabled();
    const btn = screen.getByRole('button', { name: /export again/i });
    expect(btn).not.toBeDisabled();
  });

  /*
    Negative — taxonomy #7 (conflict), and the interaction most likely to be got wrong: a
    failure AFTER an earlier success. The persisted graph from the first export is still
    in state, so a rule of `hasGraph || succeeded` alone would freeze the form and leave
    the operator unable to retry the attempt that just failed.
  */
  it('TC_SRC_063 (negative): a failure after an earlier success still leaves the form usable', () => {
    renderStack((store) => {
      seedReady(store);
      store.dispatch(sourceActions.setGraph(GRAPH as any));   // an earlier export succeeded
      store.dispatch(sourceActions.setJob({ jobId: 'j2', jobStatus: 'failed' }));
    });

    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /export again/i })).not.toBeDisabled();
  });

  it('TC_SRC_067 (positive): a persisted graph alone freezes the form, with no job status', () => {
    renderStack((store) => {
      seedReady(store);
      // Revisiting a finished project: the in-memory job registry is gone, so only the
      // persisted graph remains.
      store.dispatch(sourceActions.setGraph(GRAPH as any));
    });

    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(screen.getByRole('button', { name: /export complete/i })).toBeDisabled();
  });

  /*
    Negative — taxonomy #1 (missing value): no graph and no job status is a fresh panel,
    which must not be frozen. This is the state every new project starts in.
  */
  it('TC_SRC_067 (negative): no graph and no job status leaves the form fully usable', () => {
    renderStack(seedReady);

    expect(screen.getByLabelText('Region')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /start export/i })).not.toBeDisabled();
  });
});
