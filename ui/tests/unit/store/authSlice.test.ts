import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => null),
  clearLocalStorage: vi.fn(() => true),
  isEmptyString: vi.fn((str: string | undefined) => !str || str.trim().length < 1),
  validateArray: vi.fn((arr: any[]) => Array.isArray(arr) && arr.length > 0)
}));

vi.mock('../../../src/services/api/user.service', () => ({
  getUser: vi.fn()
}));

import authReducer, {
  setAuthToken,
  reInitiliseState,
  setOrganisationsList,
  setSelectedOrganisation,
  setUser,
  clearOrganisationData,
  clearAuthToken,
  getUserDetails
} from '../../../src/store/slice/authSlice';
import { getUser } from '../../../src/services/api/user.service';

const createTestStore = (preloadedState?: any) =>
  configureStore({
    reducer: { authentication: authReducer },
    preloadedState: preloadedState
      ? { authentication: preloadedState }
      : undefined
  });

describe('store/slice/authSlice', () => {
  describe('reducers', () => {
    it('should return the initial state', () => {
      const store = createTestStore();
      const state = store.getState().authentication;

      expect(state).toHaveProperty('authToken');
      expect(state).toHaveProperty('user');
      expect(state).toHaveProperty('isAuthenticated');
      expect(state).toHaveProperty('organisationsList');
      expect(state).toHaveProperty('selectedOrganisation');
    });

    describe('setAuthToken', () => {
      it('should set auth token and authentication flag', () => {
        const store = createTestStore();
        store.dispatch(setAuthToken({ authToken: 'new-token', isAuthenticated: true }));

        const state = store.getState().authentication;
        expect(state.authToken).toBe('new-token');
        expect(state.isAuthenticated).toBe(true);
      });
    });

    describe('setUser', () => {
      it('should merge user data with existing state', () => {
        const store = createTestStore();
        store.dispatch(setUser({ first_name: 'John', last_name: 'Doe' }));

        const state = store.getState().authentication;
        expect(state.user.first_name).toBe('John');
        expect(state.user.last_name).toBe('Doe');
      });
    });

    describe('reInitiliseState', () => {
      it('should reset state to initial values', () => {
        const store = createTestStore();
        store.dispatch(setAuthToken({ authToken: 'token', isAuthenticated: true }));
        store.dispatch(reInitiliseState());

        const state = store.getState().authentication;
        expect(state.authToken).toBe('');
        expect(state.isAuthenticated).toBe(false);
        expect(state.organisationsList).toEqual([]);
      });
    });

    describe('setOrganisationsList', () => {
      it('should set the organisations list', () => {
        const store = createTestStore();
        const orgs = [
          { uid: 'org-1', value: 'org-1', label: 'Org 1' },
          { uid: 'org-2', value: 'org-2', label: 'Org 2' }
        ];
        store.dispatch(setOrganisationsList(orgs));

        const state = store.getState().authentication;
        expect(state.organisationsList).toEqual(orgs);
      });
    });

    describe('setSelectedOrganisation', () => {
      it('should set the selected organisation', () => {
        const store = createTestStore();
        const org = { uid: 'org-1', value: 'org-1', label: 'Org 1' };
        store.dispatch(setSelectedOrganisation(org));

        const state = store.getState().authentication;
        expect(state.selectedOrganisation).toEqual(org);
      });
    });

    describe('clearOrganisationData', () => {
      it('should clear organisations list and selected organisation', () => {
        const store = createTestStore();
        store.dispatch(
          setOrganisationsList([{ uid: 'org-1', value: 'org-1', label: 'Org 1' }])
        );
        store.dispatch(clearOrganisationData());

        const state = store.getState().authentication;
        expect(state.organisationsList).toEqual([]);
        expect(state.selectedOrganisation.value).toBe('');
      });
    });

    describe('clearAuthToken', () => {
      it('should clear auth token and set isAuthenticated to false', () => {
        const store = createTestStore();
        store.dispatch(setAuthToken({ authToken: 'token', isAuthenticated: true }));
        store.dispatch(clearAuthToken());

        const state = store.getState().authentication;
        expect(state.authToken).toBe('');
        expect(state.isAuthenticated).toBe(false);
      });
    });
  });

  describe('getUserDetails thunk', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should set user data on successful response', async () => {
      const mockUser = {
        email: 'test@example.com',
        first_name: 'Test',
        orgs: [
          { org_id: 'org-1', org_name: 'Test Org' }
        ]
      };
      vi.mocked(getUser).mockResolvedValue({
        status: 200,
        data: { user: mockUser }
      });

      const store = createTestStore();
      await store.dispatch(getUserDetails());

      const state = store.getState().authentication;
      expect(state.user.email).toBe('test@example.com');
      expect(state.organisationsList).toHaveLength(1);
      expect(state.organisationsList[0]).toEqual(
        expect.objectContaining({ uid: 'org-1', label: 'Test Org' })
      );
    });

    it('should reset state on 401 response', async () => {
      vi.mocked(getUser).mockResolvedValue({ status: 401 });

      const store = createTestStore();
      store.dispatch(setAuthToken({ authToken: 'old-token', isAuthenticated: true }));
      await store.dispatch(getUserDetails());

      const state = store.getState().authentication;
      expect(state.authToken).toBe('');
      expect(state.isAuthenticated).toBe(false);
    });

    it('should reset state on error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getUser).mockRejectedValue(new Error('Network error'));

      try {
        const store = createTestStore();
        store.dispatch(setAuthToken({ authToken: 'old-token', isAuthenticated: true }));
        await store.dispatch(getUserDetails());

        const state = store.getState().authentication;
        expect(state.authToken).toBe('');
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});
