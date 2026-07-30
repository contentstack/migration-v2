import { combineReducers, configureStore } from '@reduxjs/toolkit';

import sourceReducer from './slice/source.slice';
import destinationReducer from './slice/destination.slice';

/**
 * v3 store — fully independent from v2's store. Mounted via its own <Provider>
 * inside V3App, wrapping only the v3 route subtree.
 */
const rootReducer = combineReducers({
  source: sourceReducer,
  destination: destinationReducer,
});

export const v3Store = configureStore({
  reducer: rootReducer,
});

export type V3RootState = ReturnType<typeof rootReducer>;
export type V3Dispatch = typeof v3Store.dispatch;
