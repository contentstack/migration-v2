import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — restoring a project's saved source selection — rows TC_SRC_070–071.
 *
 * Added 2026-08-12 as a direct change. `SourcePanel` already fetched the persisted GRAPH
 * on mount but nothing ever fetched the persisted SELECTION, which caused two symptoms
 * from one gap: the graph is only rendered when a stack is selected, so it appeared to
 * vanish on returning to the page; and the (disabled) selects fell through to their
 * placeholders, reading "Select an organization…" for a project that plainly had one.
 *
 * ⚠️ This must NOT reuse `selectRegion` / `selectOrg`. Those are user-intent thunks: they
 * clear downstream fields and call `clearExportState()`, which would wipe the very graph
 * being restored, and `selectRegion` opens the region-login modal for any non-home
 * region. Restoration needs read-only loaders, which is what these tests pin.
 */
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getRegions: vi.fn(),
    getOrgs: vi.fn(),
    getStacks: vi.fn(),
    getBranches: vi.fn(),
    getFileModules: vi.fn(),
    getStackModules: vi.fn(),
    uploadBundle: vi.fn(),
    startExport: vi.fn(),
    getExportStatus: vi.fn(),
    getGraph: vi.fn(),
    persistSource: vi.fn(),
    getSource: vi.fn(),
  },
}));
vi.mock('../../../../../v3/services/api/source.service', () => ({ sourceApi: mockApi }));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';
import { loadPersistedSource } from '../../../../../v3/store/thunks/source.thunks';

const mkStore = () => configureStore({ reducer: { source: sourceReducer } });

const STACK_SOURCE = {
  mode: 'stack',
  stack: {
    region: 'NA',
    orgId: 'blt-org-1',
    stackApiKey: 'blt-stack-1',
    branch: 'main',
    scope: 'specific',
    selectedModules: ['contentTypes', 'globalFields'],
  },
};

const GRAPH = { counts: { contentTypes: 6 }, nodes: [], edges: [] };

beforeEach(() => {
  Object.values(mockApi).forEach((m) => (m as any).mockReset());
  mockApi.getOrgs.mockResolvedValue({ data: { orgs: [{ uid: 'blt-org-1', name: 'TSO Migrations' }] } });
  mockApi.getStacks.mockResolvedValue({ data: { stacks: [{ apiKey: 'blt-stack-1', name: 'Blog stack' }] } });
  mockApi.getBranches.mockResolvedValue({ data: { branches: [{ uid: 'main', name: 'main' }] } });
});

describe('v3 loadPersistedSource — restoring a saved selection', () => {
  it('TC_SRC_070 (positive): restores the region, org, stack, branch, scope and modules', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: STACK_SOURCE } });
    const store = mkStore();

    await store.dispatch(loadPersistedSource('P1') as any);

    const { stack, mode } = store.getState().source;
    expect(mode).toBe('stack');
    expect(stack.region).toBe('NA');
    expect(stack.org).toBe('blt-org-1');
    expect(stack.stackApiKey).toBe('blt-stack-1');
    expect(stack.branch).toBe('main');
    expect(stack.scope).toBe('specific');
    expect(stack.selectedModules).toEqual(['contentTypes', 'globalFields']);
  });

  /*
    Negative — taxonomy #6 (dependency failure): a project with no saved source (404)
    must leave the form untouched rather than half-filled. A fresh project hits this on
    every visit, so throwing or partially applying would break the normal case.
  */
  it('TC_SRC_070 (negative): leaves state untouched when the project has no saved source', async () => {
    mockApi.getSource.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    const store = mkStore();
    const before = JSON.stringify(store.getState().source);

    await store.dispatch(loadPersistedSource('P1') as any);

    expect(JSON.stringify(store.getState().source)).toBe(before);
  });

  /*
    ⚠️ The assertion that protects the reported bug. Restoring the selection must not
    clear the graph — `selectRegion` and `selectOrg` both call `clearExportState()`, so
    reusing them here would delete the graph this restore exists to reveal.
  */
  it('TC_SRC_071 (positive): preserves an already-loaded graph while restoring', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: STACK_SOURCE } });
    const store = mkStore();
    store.dispatch(sourceActions.setGraph(GRAPH as any));

    await store.dispatch(loadPersistedSource('P1') as any);

    expect(store.getState().source.graph).toMatchObject({ counts: { contentTypes: 6 } });
  });

  /*
    Negative — taxonomy #4 (forbidden state): restoring must not open the region-login
    modal. `selectRegion` does that for any non-home region, and a modal appearing
    unprompted every time an old project is opened would block the page.
  */
  it('TC_SRC_071 (negative): does not open the region-login modal while restoring', async () => {
    mockApi.getSource.mockResolvedValue({
      data: { source: { ...STACK_SOURCE, stack: { ...STACK_SOURCE.stack, region: 'EU' } } },
    });
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'homeRegion', value: 'NA' }));

    await store.dispatch(loadPersistedSource('P1') as any);

    // `regionLogin` is top-level source state, not part of `stack`.
    expect(store.getState().source.regionLogin.open).toBe(false);
    expect(store.getState().source.stack.region).toBe('EU');
  });

  it('TC_SRC_072 (positive): loads the org and stack lists so the labels resolve', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: STACK_SOURCE } });
    const store = mkStore();

    await store.dispatch(loadPersistedSource('P1') as any);

    const { stack } = store.getState().source;
    expect(stack.orgs).toEqual(expect.arrayContaining([{ value: 'blt-org-1', label: 'TSO Migrations' }]));
    expect(stack.stacks).toEqual(expect.arrayContaining([{ value: 'blt-stack-1', label: 'Blog stack' }]));
  });

  /*
    Negative — taxonomy #6 (dependency failure): if the list fetches fail, the IDS must
    still be restored. The selects fall back to showing the id, which is the whole reason
    option B was chosen — a placeholder would claim nothing was selected.
  */
  it('TC_SRC_072 (negative): still restores the ids when the list fetches fail', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: STACK_SOURCE } });
    mockApi.getOrgs.mockRejectedValue(new Error('network'));
    mockApi.getStacks.mockRejectedValue(new Error('network'));
    const store = mkStore();

    await store.dispatch(loadPersistedSource('P1') as any);

    const { stack } = store.getState().source;
    expect(stack.org).toBe('blt-org-1');
    expect(stack.stackApiKey).toBe('blt-stack-1');
    expect(store.getState().source.error).toBeUndefined();
  });

  it('TC_SRC_073 (positive): restores a file-mode selection', async () => {
    mockApi.getSource.mockResolvedValue({
      data: {
        source: {
          mode: 'file',
          file: { sourceId: 's1', fileName: 'export.zip', scope: 'all', selectedModules: [] },
        },
      },
    });
    const store = mkStore();

    await store.dispatch(loadPersistedSource('P1') as any);

    expect(store.getState().source.mode).toBe('file');
    expect(store.getState().source.file.fileName).toBe('export.zip');
  });

  /*
    Negative — taxonomy #2 (invalid shape): a stack-mode source must not populate the
    file fields, or the panel would render a file bundle the project never used.
  */
  it('TC_SRC_073 (negative): does not populate the file fields from a stack-mode source', async () => {
    mockApi.getSource.mockResolvedValue({ data: { source: STACK_SOURCE } });
    const store = mkStore();

    await store.dispatch(loadPersistedSource('P1') as any);

    expect(store.getState().source.file.fileName).toBeFalsy();
  });
});
