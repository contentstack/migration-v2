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

import sourceReducer from '../../../../../v3/store/slice/source.slice';
import { selectRegion, selectOrg } from '../../../../../v3/store/thunks/source.thunks';

const mkStore = () => configureStore({ reducer: { source: sourceReducer } });

beforeEach(() => {
  Object.values(mockApi).forEach((m) => (m as any).mockReset());
});

describe('v3 source thunks — cascade', () => {
  it('TC_SRC_006 (positive): selectRegion sets the region and loads its organizations', async () => {
    mockApi.getOrgs.mockResolvedValue({ data: { orgs: [{ uid: 'o1', name: 'Org 1' }] } });
    const store = mkStore();
    await store.dispatch(selectRegion('NA') as any);

    const st = store.getState().source.stack;
    expect(st.region).toBe('NA');
    expect(st.org).toBe(''); // downstream cleared
    expect(st.orgs).toEqual([{ value: 'o1', label: 'Org 1' }]);
  });

  // Negative — taxonomy #6 (dependency failure): getOrgs rejects → error surfaced, orgs empty.
  it('TC_SRC_006 (negative): a failing org load surfaces an error and leaves orgs empty', async () => {
    mockApi.getOrgs.mockRejectedValue({ response: { data: { message: 'denied' } } });
    const store = mkStore();
    await store.dispatch(selectRegion('NA') as any);

    const s = store.getState().source;
    expect(s.error).toBe('denied');
    expect(s.stack.orgs).toEqual([]);
  });

  it('TC_SRC_007 (positive): selectOrg sets the org and loads its stacks', async () => {
    mockApi.getStacks.mockResolvedValue({ data: { stacks: [{ apiKey: 'blt1', name: 'S1' }] } });
    const store = mkStore();
    await store.dispatch(selectOrg('o1') as any);

    const st = store.getState().source.stack;
    expect(st.org).toBe('o1');
    expect(st.stackApiKey).toBe(''); // downstream cleared
    expect(st.stacks).toEqual([{ value: 'blt1', label: 'S1' }]);
  });

  // Negative — taxonomy #6 (dependency failure): getStacks rejects → error, stacks empty.
  it('TC_SRC_007 (negative): a failing stack load surfaces an error and leaves stacks empty', async () => {
    mockApi.getStacks.mockRejectedValue(new Error('network down'));
    const store = mkStore();
    await store.dispatch(selectOrg('o1') as any);

    const s = store.getState().source;
    expect(s.error).toBe('network down');
    expect(s.stack.stacks).toEqual([]);
  });
});
