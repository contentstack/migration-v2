import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import * as reactRedux from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

/**
 * The Migration page's one job beyond choosing a panel: enforce the project-scope
 * invariant before any panel mounts.
 *
 * `useProjectScope` is unit-tested on its own. This file covers the WIRING — that the page
 * actually withholds the panel until the scope is current. Without it, deleting
 * `scopeReady ?` from the JSX would leave every hook test passing while the reported bug
 * came straight back: React runs child effects before parent ones, so a panel that mounts
 * alongside the reset reads the previous project's state and skips its own fetch.
 *
 * The panels are mocked — the real ones reach for the network on mount. The audit mock also
 * records the state it sees at mount, because that is the invariant worth asserting: not
 * whether an element is present, but whether a panel can ever observe another project's
 * state.
 */
const { mockParams } = vi.hoisted(() => ({ mockParams: { current: {} as Record<string, string> } }));

vi.mock('react-router', async (orig) => ({
  ...(await orig<typeof import('react-router')>()),
  useParams: () => mockParams.current,
}));

/*
  Records the audit phase the panel sees the moment it mounts. This, not the presence of the
  element, is the invariant: a panel must never observe another project's state. Asserting
  on presence cannot work — effects flush before `render()` returns, so the gated first
  render is already gone by the time the test looks.
*/
const seenAtMount: string[] = [];
vi.mock('../../../../v3/components/audit/AuditPanel', () => ({
  default: () => {
    const phase = reactRedux.useSelector((st: any) => st.audit.phase);
    reactRedux.useDispatch(); // same hook order as the real panel
    if (!seenAtMount.length || seenAtMount[seenAtMount.length - 1] !== phase) seenAtMount.push(phase);
    return <div data-testid="panel">audit</div>;
  },
}));
vi.mock('../../../../v3/components/source/SourcePanel', () => ({
  default: () => <div data-testid="panel">source</div>,
}));
vi.mock('../../../../v3/components/destination/DestinationPanel', () => ({
  default: () => <div data-testid="panel">destination</div>,
}));
vi.mock('../../../../v3/components/contentMapping/ContentMappingPanel', () => ({
  default: () => <div data-testid="panel">content mapping</div>,
}));
vi.mock('../../../../v3/components/wizard/WizardChrome', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="chrome">{children}</div>,
}));

import auditReducer, { auditActions } from '../../../../v3/store/slice/audit.slice';
import sourceReducer, { sourceActions } from '../../../../v3/store/slice/source.slice';
import destinationReducer from '../../../../v3/store/slice/destination.slice';
import contentMappingReducer from '../../../../v3/store/slice/contentMapping.slice';
import scopeReducer, { scopeActions } from '../../../../v3/store/slice/scope.slice';
import MigrationV3 from '../../../../v3/pages/Migration';

const mkStore = () =>
  configureStore({
    reducer: combineReducers({
      audit: auditReducer,
      source: sourceReducer,
      destination: destinationReducer,
      contentMapping: contentMappingReducer,
      scope: scopeReducer,
    }),
  });

/** Recognisable state from a project that is NOT the one being opened. */
const seedOtherProject = (store: ReturnType<typeof mkStore>, id: string) => {
  store.dispatch(scopeActions.enterProject(id));
  store.dispatch(sourceActions.setGraph({ counts: { contentTypes: 6 }, nodes: [], edges: [] } as never));
  store.dispatch(
    auditActions.findingsLoaded({
      checks: [],
      totals: { contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36 },
      decisions: { categories: {}, itemOverrides: {} },
      impactNote: undefined,
      variantsInspected: true,
    } as never)
  );
};

const renderPage = (store: ReturnType<typeof mkStore>) =>
  render(
    <Provider store={store}>
      <MigrationV3 />
    </Provider>
  );

beforeEach(() => {
  mockParams.current = { projectId: 'P2', stepId: 'audit' };
});

describe('v3 Migration page — the scope gate', () => {
  it('renders the step panel once the scope is current', () => {
    const store = mkStore();
    store.dispatch(scopeActions.enterProject('P2'));

    renderPage(store);

    expect(screen.getByTestId('panel')).toHaveTextContent('audit');
  });

  /*
    ⚠️ The regression this file exists for. The panel must never mount while another
    project's findings are still loaded — if it does, its own `phase === 'idle'` guard sees
    `ready`, skips the fetch, and renders the other project's stats. That is the reported
    bug. Removing the gate from the page makes this the only failing test.
  */
  it('never lets the panel observe another project’s state', () => {
    seenAtMount.length = 0;
    const store = mkStore();
    seedOtherProject(store, 'P1');
    // Anchored: the stale state really is loaded, so 'idle' below is not merely 'never set'.
    expect(store.getState().audit.phase).not.toBe('idle');

    renderPage(store);

    expect(seenAtMount.length).toBeGreaterThan(0);
    expect(seenAtMount[0]).toBe('idle');
    // The chrome renders throughout, so only the body waits — no layout jump.
    expect(screen.getByTestId('chrome')).toBeInTheDocument();
  });

  it('clears the other project’s state and then renders the panel', async () => {
    const store = mkStore();
    seedOtherProject(store, 'P1');

    renderPage(store);

    // The reset runs in the page's own effect, which has flushed by the time render returns.
    expect(store.getState().audit.phase).toBe('idle');
    expect(store.getState().source.graph).toBeFalsy();
    expect(store.getState().scope.projectId).toBe('P2');
    expect(await screen.findByTestId('panel')).toHaveTextContent('audit');
  });

  /*
    Negative — taxonomy #4 (forbidden state): re-entering the SAME project must not gate or
    clear anything. Every step change would otherwise blank the body and discard the work of
    the step before it.
  */
  it('neither gates nor clears when the same project is already in scope', () => {
    const store = mkStore();
    seedOtherProject(store, 'P2');

    renderPage(store);

    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(store.getState().source.graph).toBeTruthy();
  });

  it('renders the placeholder for a step that has no panel yet', () => {
    mockParams.current = { projectId: 'P2', stepId: 'review' };
    const store = mkStore();
    store.dispatch(scopeActions.enterProject('P2'));

    renderPage(store);

    expect(screen.queryByTestId('panel')).toBeNull();
    expect(screen.getByTestId('chrome').textContent).toMatch(/not built yet/i);
  });

  /*
    Negative — taxonomy #1 (missing input): an absent project id is a route in transition,
    not a project change. It must not clear the state of the project still on screen.
  */
  it('does not clear state when the route carries no project id', () => {
    mockParams.current = { stepId: 'audit' };
    const store = mkStore();
    seedOtherProject(store, 'P1');

    renderPage(store);

    expect(store.getState().source.graph).toBeTruthy();
    expect(store.getState().scope.projectId).toBe('P1');
  });
});
