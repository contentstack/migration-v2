import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

/**
 * TDD — v3 source thunks (cascade). Backs TC_SRC_006 (region→org load) and
 * TC_SRC_007 (org→stack load), incl. dependency-failure handling (EC-5/EC-6).
 * The API service is mocked; a real store verifies the resulting state.
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
  },
}));
vi.mock('../../../../../v3/services/api/source.service', () => ({ sourceApi: mockApi }));

import sourceReducer, { sourceActions } from '../../../../../v3/store/slice/source.slice';
import {
  selectRegion,
  selectOrg,
  loadRegions,
  loadStackModules,
} from '../../../../../v3/store/thunks/source.thunks';

const mkStore = () => configureStore({ reducer: { source: sourceReducer } });

/** A store already authenticated for 'NA' as its home region (no region-login needed). */
const mkStoreHomeNA = () => {
  const store = mkStore();
  store.dispatch(sourceActions.setStackField({ field: 'homeRegion', value: 'NA' }));
  return store;
};

beforeEach(() => {
  Object.values(mockApi).forEach((m) => (m as any).mockReset());
});

describe('v3 source thunks — loadRegions defaults', () => {
  it('(positive) the backend homeRegion and region list are used when present', async () => {
    mockApi.getRegions.mockResolvedValue({
      data: { regions: [{ value: 'EU', label: 'Europe' }], homeRegion: 'EU' },
    });
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
    const store = mkStore();

    await store.dispatch(loadRegions() as any);

    const st = store.getState().source.stack;
    expect(st.region).toBe('EU');
    expect(st.homeRegion).toBe('EU');
    expect(st.regions).toEqual([{ value: 'EU', label: 'Europe' }]);
  });

  // Negative — taxonomy #1 (missing/empty): no homeRegion / no regions in the response falls
  // back to NA + the full 5-region list, so the dropdown is never blank or single-entry.
  it('(negative) a response with no homeRegion/regions falls back to NA and the full region list', async () => {
    mockApi.getRegions.mockResolvedValue({ data: {} });
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
    const store = mkStore();

    await store.dispatch(loadRegions() as any);

    const st = store.getState().source.stack;
    expect(st.region).toBe('NA');
    expect(st.homeRegion).toBe('NA');
    expect(st.regions.length).toBe(5);
    expect(st.regions.map((r) => r.value)).toEqual(['NA', 'EU', 'AZURE_NA', 'AZURE_EU', 'GCP_NA']);
  });

  it('(positive) a failed /regions call still defaults to NA and the full region list', async () => {
    mockApi.getRegions.mockRejectedValue(new Error('network down'));
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
    const store = mkStore();

    await store.dispatch(loadRegions() as any);

    const st = store.getState().source.stack;
    expect(st.region).toBe('NA');
    expect(st.regions.length).toBe(5);
  });

  // Negative — contrast: the error from the failed call is still surfaced, not swallowed silently.
  it('(negative) a failed /regions call still surfaces the error even though defaults apply', async () => {
    mockApi.getRegions.mockRejectedValue(new Error('network down'));
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
    const store = mkStore();

    await store.dispatch(loadRegions() as any);

    expect(store.getState().source.error).toBe('network down');
  });
});

describe('v3 source thunks — cascade', () => {
  it('TC_SRC_006 (positive): selecting the home region loads its organizations directly (no login gate)', async () => {
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [{ uid: 'o1', name: 'Org 1' }] } });
    const store = mkStoreHomeNA();
    await store.dispatch(selectRegion('NA') as any);

    const st = store.getState().source.stack;
    expect(st.region).toBe('NA');
    expect(st.org).toBe(''); // downstream cleared
    expect(st.orgs).toEqual([{ value: 'o1', label: 'Org 1' }]);
    expect(store.getState().source.regionLogin.open).toBe(false);
  });

  // Negative — taxonomy #6 (dependency failure): getOrgs rejects → error surfaced, orgs empty.
  it('TC_SRC_006 (negative): a failing org load for the home region surfaces an error and leaves orgs empty', async () => {
    mockApi.getOrgs.mockRejectedValue({ response: { data: { message: 'denied' } } });
    const store = mkStoreHomeNA();
    await store.dispatch(selectRegion('NA') as any);

    const s = store.getState().source;
    expect(s.error).toBe('denied');
    expect(s.stack.orgs).toEqual([]);
  });

  it('(gate, positive) selecting a region other than home opens the region-login modal instead of loading orgs', async () => {
    const store = mkStoreHomeNA();
    await store.dispatch(selectRegion('EU') as any);

    const s = store.getState().source;
    expect(s.regionLogin.open).toBe(true);
    expect(s.regionLogin.region).toBe('EU');
    expect(s.stack.region).toBe('EU'); // selection commits immediately, revertible on cancel
    expect(mockApi.getOrgs).not.toHaveBeenCalled();
  });

  // Negative — a region already unlocked this session (regionAuth) skips the modal, like the home region.
  it('(gate, negative) a previously region-logged-in region skips the modal and loads orgs directly', async () => {
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [] } });
    const store = mkStoreHomeNA();
    store.dispatch(sourceActions.regionAuthed({ region: 'EU', userId: 'u2' }));

    await store.dispatch(selectRegion('EU') as any);

    expect(store.getState().source.regionLogin.open).toBe(false);
    expect(mockApi.getOrgs).toHaveBeenCalledWith({ region: 'EU', regionUserId: 'u2' });
  });

  it('TC_SRC_007 (positive): selectOrg sets the org and loads its stacks', async () => {
    mockApi.getStacks.mockResolvedValue({ data: { stacks: [{ apiKey: 'blt1', name: 'S1' }] } });
    const store = mkStore();
    await store.dispatch(selectOrg('o1') as any);

    const st = store.getState().source.stack;
    expect(st.org).toBe('o1');
    expect(st.stackApiKey).toBe(''); // downstream cleared
    expect(st.stacks).toEqual([{ value: 'blt1', label: 'S1' }]);
    expect(st.stacksLoading).toBe(false);
    expect(st.stacksError).toBeUndefined();
  });

  // Negative — taxonomy #6 (dependency failure): getStacks rejects → a
  // distinct, retryable stacksError (not the generic page-level error), so
  // the Stack field can show its own inline message instead of leaving the
  // panel stuck on an empty, unexplained dropdown.
  it('TC_SRC_007 (negative): a failing stack load clears stacksLoading and sets a distinct stacksError', async () => {
    mockApi.getStacks.mockRejectedValue(new Error('network down'));
    const store = mkStore();
    await store.dispatch(selectOrg('o1') as any);

    const st = store.getState().source.stack;
    expect(st.stacksLoading).toBe(false);
    expect(st.stacksError).toBe('network down');
    expect(st.stacks).toEqual([]);
  });

  it('(stacks, positive) selectOrg sets stacksLoading during the fetch', async () => {
    let resolveFetch: (v: any) => void;
    mockApi.getStacks.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const store = mkStore();

    const promise = store.dispatch(selectOrg('o1') as any);
    expect(store.getState().source.stack.stacksLoading).toBe(true);

    resolveFetch!({ data: { stacks: [] } });
    await promise;

    expect(store.getState().source.stack.stacksLoading).toBe(false);
  });

  it('(modules, positive) loadStackModules sets modulesLoading during the fetch and populates modules on success', async () => {
    let resolveFetch: (v: any) => void;
    mockApi.getStackModules.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));

    const promise = store.dispatch(loadStackModules() as any);
    expect(store.getState().source.stack.modulesLoading).toBe(true);

    resolveFetch!({ data: { modules: [{ key: 'contentTypes', label: 'Content Types', count: 2, dependsOn: [] }] } });
    await promise;

    const st = store.getState().source.stack;
    expect(st.modulesLoading).toBe(false);
    expect(st.modules).toHaveLength(1);
    expect(st.modulesError).toBeUndefined();
  });

  // Negative — taxonomy #6 (dependency failure): a real bug this locks in — a
  // failed module fetch must NOT leave the panel stuck showing "Loading
  // modules…" forever; it must surface a distinct, retryable error.
  it('(modules, negative) a failing module fetch clears modulesLoading and sets a distinct modulesError', async () => {
    mockApi.getStackModules.mockRejectedValue({ response: { data: { message: 'Contentstack API error' } } });
    const store = mkStore();
    store.dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: 'blt1' }));

    await store.dispatch(loadStackModules() as any);

    const st = store.getState().source.stack;
    expect(st.modulesLoading).toBe(false);
    expect(st.modulesError).toBe('Contentstack API error');
    expect(st.modules).toEqual([]);
  });
});
