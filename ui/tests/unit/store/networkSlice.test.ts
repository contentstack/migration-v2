import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import networkReducer, {
  setOnline,
  setOffline,
  selectNetworkStatus
} from '../../../src/store/slice/networkSlice';

const createTestStore = () =>
  configureStore({
    reducer: { network: networkReducer }
  });

describe('store/slice/networkSlice', () => {
  describe('reducers', () => {
    it('should return initial state with navigator.onLine', () => {
      const store = createTestStore();
      const state = store.getState().network;
      expect(state).toHaveProperty('isOnline');
    });

    describe('setOnline', () => {
      it('should set isOnline to true', () => {
        const store = createTestStore();
        store.dispatch(setOffline());
        store.dispatch(setOnline());

        expect(store.getState().network.isOnline).toBe(true);
      });
    });

    describe('setOffline', () => {
      it('should set isOnline to false', () => {
        const store = createTestStore();
        store.dispatch(setOffline());

        expect(store.getState().network.isOnline).toBe(false);
      });
    });
  });

  describe('selectors', () => {
    describe('selectNetworkStatus', () => {
      it('should return the network online status', () => {
        const store = createTestStore();
        store.dispatch(setOnline());

        const state = store.getState();
        expect(selectNetworkStatus(state as any)).toBe(true);
      });

      it('should return false when offline', () => {
        const store = createTestStore();
        store.dispatch(setOffline());

        const state = store.getState();
        expect(selectNetworkStatus(state as any)).toBe(false);
      });
    });
  });
});
