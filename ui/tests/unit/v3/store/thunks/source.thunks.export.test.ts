import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 export/upload thunks. Backs TC_SRC_011 (whole-stack export → graph),
 * TC_SRC_014 (export scoped to the selected modules), TC_SRC_021 (upload →
 * validated + manifest + modules) and TC_SRC_029 (upload error surfaced).
 * The poll interval is shrunk via VITE_V3_POLL_MS so tests stay fast.
 */
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    getRegions: vi.fn(),
    regionLogin: vi.fn(),
    getOrgs: vi.fn(),
    getStacks: vi.fn(),
    getBranches: vi.fn(),
    getFileModules: vi.fn(),
    getStackModules: vi.fn(),
    uploadBundle: vi.fn(),
    startExport: vi.fn(),
    getExportStatus: vi.fn(),
    getGraph: vi.fn(),
  },
}));
vi.mock('../../../../../v3/services/api/source.service', () => ({ sourceApi: mockApi }));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';

let thunks: any;
const mkStore = () => configureStore({ reducer: { source: sourceReducer } });

beforeEach(async () => {
  Object.values(mockApi).forEach((m) => (m as any).mockReset());
  vi.stubEnv('VITE_V3_POLL_MS', '1');
  vi.resetModules();
  thunks = await import('../../../../../v3/store/thunks/source.thunks');
});

describe('v3 export/upload thunks', () => {
  it('TC_SRC_011 (positive): a whole-stack export polls to success and stores the graph', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } });
    mockApi.getGraph.mockResolvedValue({ data: { counts: {}, nodes: [], edges: [] } });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(store.getState().source.graph).toEqual({ counts: {}, nodes: [], edges: [] });
    expect(store.getState().source.running).toBe(false);
    expect(mockApi.startExport).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'stack', stack: expect.objectContaining({ scope: 'whole' }) })
    );
  });

  it('(live counts, positive) polling dispatches liveCounts from the job status into the store', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({
      data: { status: 'succeeded', liveCounts: { contentTypes: 3, assets: 1, entries: 9, globalFields: 0, references: 2 } },
    });
    mockApi.getGraph.mockResolvedValue({ data: { counts: {}, nodes: [], edges: [] } });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(store.getState().source.jobLiveCounts).toEqual({
      contentTypes: 3,
      assets: 1,
      entries: 9,
      globalFields: 0,
      references: 2,
    });
  });

  // Negative — taxonomy #1 (missing/empty): starting a new run resets any stale liveCounts
  // from a previous export, rather than showing leftover numbers from before.
  it('(live counts, negative) starting a new export resets jobLiveCounts from a previous run', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setJobLiveCounts({ contentTypes: 9, assets: 9, entries: 9, globalFields: 9, references: 9 }));
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j2' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } }); // no liveCounts this tick
    mockApi.getGraph.mockResolvedValue({ data: {} });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(store.getState().source.jobLiveCounts).toBeUndefined();
  });

  // Negative — taxonomy #6 (dependency failure): a failed job surfaces an error, no graph.
  it('TC_SRC_011 (negative): a failed export job surfaces an error and stores no graph', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'failed' } });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(store.getState().source.error).toBeTruthy();
    expect(store.getState().source.graph).toBeUndefined();
    expect(mockApi.getGraph).not.toHaveBeenCalled();
  });

  it('TC_SRC_014 (positive): a specific-module export scopes the request to the selected modules', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    store.dispatch(sourceActions.setStackField({ field: 'scope', value: 'specific' }));
    store.dispatch(sourceActions.setStackField({ field: 'selectedModules', value: ['contentTypes', 'entries'] }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } });
    mockApi.getGraph.mockResolvedValue({ data: {} });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(mockApi.startExport).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.objectContaining({ scope: 'specific', selectedModules: ['contentTypes', 'entries'] }),
      })
    );
  });

  // Negative — contrast: a whole-stack export does not carry a specific-module scope.
  it('TC_SRC_014 (negative): a whole-stack export sends scope "whole"', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } });
    mockApi.getGraph.mockResolvedValue({ data: {} });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(mockApi.startExport).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.objectContaining({ scope: 'whole' }) })
    );
  });

  it('TC_SRC_021 (positive): uploadFile validates the bundle and loads its manifest + modules', async () => {
    const store = mkStore();
    mockApi.uploadBundle.mockResolvedValue({
      data: { sourceId: 's1', manifest: [{ name: 'Content Types', count: 2 }] },
    });
    mockApi.getFileModules.mockResolvedValue({
      data: { modules: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }] },
    });

    await store.dispatch(thunks.uploadFile(new File([new Blob(['zip'])], 'e.zip')));

    const f = store.getState().source.file;
    expect(f.validated).toBe(true);
    expect(f.sourceId).toBe('s1');
    expect(f.manifest).toEqual([{ name: 'Content Types', count: 2 }]);
    expect(f.modules).toHaveLength(1);
    expect(store.getState().source.running).toBe(false);
  });

  // Negative — taxonomy #6 (dependency failure): an upload error is surfaced; file stays unvalidated.
  it('TC_SRC_021 (negative): an upload failure surfaces the error and leaves the file unvalidated', async () => {
    const store = mkStore();
    mockApi.uploadBundle.mockRejectedValue({ response: { data: { message: 'File exceeds the 100 MB limit.' } } });

    await store.dispatch(thunks.uploadFile(new File([new Blob(['zip'])], 'big.zip')));

    expect(store.getState().source.error).toBe('File exceeds the 100 MB limit.');
    expect(store.getState().source.file.validated).toBe(false);
    expect(store.getState().source.running).toBe(false);
  });

  it('TC_SRC_010 (positive): a changed branch is carried into the export request', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    store.dispatch(sourceActions.setStackField({ field: 'branch', value: 'develop' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } });
    mockApi.getGraph.mockResolvedValue({ data: {} });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(mockApi.startExport).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.objectContaining({ branch: 'develop' }) })
    );
  });

  // Negative — the default branch "main" is sent when unchanged.
  it('TC_SRC_010 (negative): the default branch "main" is sent when unchanged', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));
    mockApi.startExport.mockResolvedValue({ data: { jobId: 'j1' } });
    mockApi.getExportStatus.mockResolvedValue({ data: { status: 'succeeded' } });
    mockApi.getGraph.mockResolvedValue({ data: {} });

    await store.dispatch(thunks.startExportAndPoll('P1'));

    expect(mockApi.startExport).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.objectContaining({ branch: 'main' }) })
    );
  });

  it('(region-login, positive) submitRegionLogin authenticates the region and loads its orgs', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
    store.dispatch(sourceActions.setRegionLoginField({ field: 'email', value: 'a@b.com' }));
    store.dispatch(sourceActions.setRegionLoginField({ field: 'password', value: 'secret' }));
    mockApi.regionLogin.mockResolvedValue({ data: { userId: 'u2', email: 'a@b.com' } });
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [{ uid: 'o9', name: 'Org 9' }] } });

    await store.dispatch(thunks.submitRegionLogin());

    const s = store.getState().source;
    expect(s.regionLogin.open).toBe(false);
    expect(s.stack.regionAuth.EU).toBe('u2');
    expect(s.stack.orgs).toEqual([{ value: 'o9', label: 'Org 9' }]);
    expect(mockApi.regionLogin).toHaveBeenCalledWith('EU', 'a@b.com', 'secret');
  });

  // Negative — taxonomy #5 (permission denial): a failed CS login keeps the modal open with an error, doesn't unlock the region.
  it('(region-login, negative) a failed login keeps the modal open with an error and does not unlock the region', async () => {
    const store = mkStore();
    store.dispatch(sourceActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
    store.dispatch(sourceActions.setRegionLoginField({ field: 'email', value: 'a@b.com' }));
    store.dispatch(sourceActions.setRegionLoginField({ field: 'password', value: 'wrong' }));
    mockApi.regionLogin.mockRejectedValue({ response: { data: { message: 'Invalid email or password' } } });

    await store.dispatch(thunks.submitRegionLogin());

    const s = store.getState().source;
    expect(s.regionLogin.open).toBe(true);
    expect(s.regionLogin.error).toBe('Invalid email or password');
    expect(s.stack.regionAuth.EU).toBeUndefined();
    expect(mockApi.getOrgs).not.toHaveBeenCalled();
  });

  it('(region-login, positive) canceling reverts the region back to what it was', () => {
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'region', value: 'NA' }));
    store.dispatch(sourceActions.openRegionLogin({ region: 'EU', prevRegion: 'NA' }));
    expect(store.getState().source.stack.region).toBe('EU');

    store.dispatch(thunks.cancelRegionLogin());

    const s = store.getState().source;
    expect(s.stack.region).toBe('NA');
    expect(s.regionLogin.open).toBe(false);
  });

  // Negative — canceling when there was no prior region (fresh state) just closes the modal without throwing.
  it('(region-login, negative) canceling with no prior selection just closes the modal', () => {
    const store = mkStore();
    store.dispatch(sourceActions.openRegionLogin({ region: 'EU', prevRegion: '' }));

    store.dispatch(thunks.cancelRegionLogin());

    const s = store.getState().source;
    expect(s.stack.region).toBe('');
    expect(s.regionLogin.open).toBe(false);
  });

  it('TC_SRC_037 (positive): loadPersistedGraph restores a persisted graph into state', async () => {
    const store = mkStore();
    mockApi.getGraph.mockResolvedValue({ data: { counts: { contentTypes: 3 }, nodes: [], edges: [] } });

    await store.dispatch(thunks.loadPersistedGraph('P1'));

    expect(store.getState().source.graph?.counts.contentTypes).toBe(3);
  });

  // Negative — taxonomy #1 (missing): no persisted graph (404) leaves state clean, no error.
  it('TC_SRC_037 (negative): loadPersistedGraph leaves graph undefined when none is persisted', async () => {
    const store = mkStore();
    mockApi.getGraph.mockRejectedValue({ response: { status: 404 } });

    await store.dispatch(thunks.loadPersistedGraph('P1'));

    expect(store.getState().source.graph).toBeUndefined();
    expect(store.getState().source.error).toBeUndefined();
  });
});
