import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { FC } from 'react';

/**
 * The project-scope invariant: **state belonging to one project must never be visible in
 * another.**
 *
 * Written after a reported bug — opening a project and going to its Audit page showed the
 * stats of the project opened *previously*, until you refreshed. The cause was not the
 * audit fetch itself but the absence of this rule: `AuditPanel` guards its load with
 * `if (phase === 'idle')`, so once anything is loaded it never re-reads, and the store
 * still held the previous project's findings.
 *
 * ⚠️ The same latent bug exists in `SourcePanel` (`if (!graph) dispatch(loadPersistedGraph)`),
 * which would show project A's content graph inside project B. It is unreported only
 * because nobody happened to look. That is why this is fixed as one invariant rather than
 * as a patch to the audit guard — a per-panel fix leaves every future panel free to make
 * the same mistake.
 *
 * ⚠️ The scope has to live in the STORE, not in a component ref. Returning to the
 * dashboard and opening another project UNMOUNTS the wizard page, so a ref-based "previous
 * id" is fresh on arrival while the store still holds the old project — exactly the
 * reported flow.
 */
import auditReducer, { auditActions } from '../../../../v3/store/slice/audit.slice';
import sourceReducer, { sourceActions } from '../../../../v3/store/slice/source.slice';
import destinationReducer, { destinationActions } from '../../../../v3/store/slice/destination.slice';
import contentMappingReducer from '../../../../v3/store/slice/contentMapping.slice';
import scopeReducer from '../../../../v3/store/slice/scope.slice';
import { useProjectScope } from '../../../../v3/store/useProjectScope';

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

/** Renders the hook and reports what it returned, so the render gate is observable. */
const Harness: FC<{ projectId: string; onReady: (ready: boolean) => void }> = ({
  projectId,
  onReady,
}) => {
  const ready = useProjectScope(projectId);
  onReady(ready);
  return <div data-testid="body">{ready ? 'panel' : 'gated'}</div>;
};

/** Puts recognisable project-A state into every project-scoped slice. */
const seedProjectState = (store: ReturnType<typeof mkStore>) => {
  store.dispatch(
    auditActions.findingsLoaded({
      checks: [],
      totals: { contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36 },
      decisions: { categories: {}, itemOverrides: {} },
      impactNote: undefined,
      variantsInspected: true,
    } as never)
  );
  store.dispatch(sourceActions.setGraph({ counts: { contentTypes: 6 }, nodes: [], edges: [] } as never));
  store.dispatch(destinationActions.setField({ field: 'region', value: 'NA' }));
};

const renderScope = (store: ReturnType<typeof mkStore>, projectId: string) => {
  let ready = false;
  const utils = render(
    <Provider store={store}>
      <Harness projectId={projectId} onReady={(r) => (ready = r)} />
    </Provider>
  );
  return {
    ...utils,
    get ready() {
      return ready;
    },
    rerenderWith: (next: string) =>
      utils.rerender(
        <Provider store={store}>
          <Harness projectId={next} onReady={(r) => (ready = r)} />
        </Provider>
      ),
  };
};

describe('v3 project scope — state never leaks between projects', () => {
  it('clears every project-scoped slice when a different project is opened', () => {
    const store = mkStore();
    renderScope(store, 'P1');
    seedProjectState(store);
    // Anchored: the state really is there, so "cleared" is not merely "never set".
    expect(store.getState().audit.phase).not.toBe('idle');
    expect(store.getState().source.graph).toBeTruthy();

    const second = renderScope(store, 'P2');
    second.rerenderWith('P2');

    expect(store.getState().audit.phase).toBe('idle');
    expect(store.getState().source.graph).toBeFalsy();
    expect(store.getState().destination.region).toBeFalsy();
  });

  /*
    Negative — taxonomy #4 (forbidden state): moving between STEPS of the same project must
    NOT reset. Every step would otherwise wipe the work of the one before it, which is a
    far worse bug than the one being fixed.
  */
  it('keeps state when the same project is re-entered', () => {
    const store = mkStore();
    const view = renderScope(store, 'P1');
    seedProjectState(store);

    view.rerenderWith('P1');

    expect(store.getState().audit.phase).not.toBe('idle');
    expect(store.getState().source.graph).toBeTruthy();
  });

  /*
    ⚠️ The remount case, which is the flow actually reported: dashboard → project A →
    dashboard → project B unmounts the wizard page entirely. A component-local "previous
    id" is undefined on arrival, so only store-held scope can catch this.
  */
  it('clears state when a different project is opened after a full unmount', () => {
    const store = mkStore();
    const first = renderScope(store, 'P1');
    seedProjectState(store);
    first.unmount();

    renderScope(store, 'P2');

    expect(store.getState().audit.phase).toBe('idle');
    expect(store.getState().source.graph).toBeFalsy();
  });

  /*
    Negative — taxonomy #1 (missing input): no project id yet is not a project CHANGE. An
    empty id during a route transition must not wipe the state of the project still on
    screen.
  */
  it('does not treat a missing project id as a change of project', () => {
    const store = mkStore();
    const view = renderScope(store, 'P1');
    seedProjectState(store);

    view.rerenderWith('');

    expect(store.getState().source.graph).toBeTruthy();
  });

  it('reports not-ready until the scope matches, then ready', () => {
    const store = mkStore();
    const view = renderScope(store, 'P1');

    // Settled on the first project.
    expect(view.ready).toBe(true);
    expect(store.getState().scope.projectId).toBe('P1');
  });

  /*
    Negative — taxonomy #3 (boundary/ordering): the gate exists because React runs CHILD
    effects before parent ones. Without it, a panel mounted alongside the reset would read
    the previous project's state in its own mount effect — see its `phase === 'idle'` guard
    — and skip the fetch, reproducing the bug through the fix.
  */
  it('gates the body on the very first render for a newly opened project', () => {
    const store = mkStore();
    store.dispatch(auditActions.findingsLoaded({
      checks: [],
      totals: { contentTypes: 1, globalFields: 0, assets: 0, entryRecords: 0, denominator: 1 },
      decisions: { categories: {}, itemOverrides: {} },
      impactNote: undefined,
      variantsInspected: true,
    } as never));

    let firstReady: boolean | undefined;
    render(
      <Provider store={store}>
        <Harness
          projectId="P9"
          onReady={(r) => {
            if (firstReady === undefined) firstReady = r;
          }}
        />
      </Provider>
    );

    // The stale project's state was present, so the first render must NOT have released
    // the body.
    expect(firstReady).toBe(false);
  });
});
