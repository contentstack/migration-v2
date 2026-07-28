import { combineReducers, configureStore } from '@reduxjs/toolkit';

import placeholderReducer from './slice/placeholder.slice';

/**
 * v3 store — fully independent from v2's store. It is mounted via its own
 * <Provider> inside V3App, wrapping only the v3 route subtree, so v3 and v2
 * state never collide.
 *
 * Add real v3 feature reducers to `combineReducers` below as features land.
 */
const rootReducer = combineReducers({
  _placeholder: placeholderReducer,
});

export const v3Store = configureStore({
  reducer: rootReducer,
});

export type V3RootState = ReturnType<typeof rootReducer>;
export type V3Dispatch = typeof v3Store.dispatch;
