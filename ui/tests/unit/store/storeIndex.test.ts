import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => null),
  clearLocalStorage: vi.fn(() => true),
  isEmptyString: vi.fn((str: string | undefined) => !str || str.trim().length < 1),
  validateArray: vi.fn((arr: any[]) => Array.isArray(arr) && arr.length > 0)
}));

vi.mock('../../../src/services/api/user.service', () => ({
  getUser: vi.fn()
}));

import { store, persistor } from '../../../src/store/index';
import type { RootState, AppDispatch } from '../../../src/store/index';

describe('store/index', () => {
  it('should export a configured store', () => {
    expect(store).toBeDefined();
    expect(store.getState).toBeDefined();
    expect(store.dispatch).toBeDefined();
  });

  it('should export a persistor', () => {
    expect(persistor).toBeDefined();
  });

  it('should have all required reducer slices in state', () => {
    const state = store.getState();
    expect(state).toHaveProperty('migration');
    expect(state).toHaveProperty('authentication');
    expect(state).toHaveProperty('network');
  });

  it('should have the correct initial authentication state shape', () => {
    const state = store.getState();
    expect(state.authentication).toHaveProperty('authToken');
    expect(state.authentication).toHaveProperty('user');
    expect(state.authentication).toHaveProperty('isAuthenticated');
    expect(state.authentication).toHaveProperty('organisationsList');
    expect(state.authentication).toHaveProperty('selectedOrganisation');
  });

  it('should have the correct initial migration state shape', () => {
    const state = store.getState();
    expect(state.migration).toHaveProperty('migrationData');
    expect(state.migration).toHaveProperty('newMigrationData');
  });

  it('should have the correct initial network state shape', () => {
    const state = store.getState();
    expect(state.network).toHaveProperty('isOnline');
  });

  it('should allow dispatching actions', () => {
    const dispatch: AppDispatch = store.dispatch;
    expect(typeof dispatch).toBe('function');
  });
});
