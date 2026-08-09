import { combineReducers, configureStore } from '@reduxjs/toolkit';

import sourceReducer from './slice/source.slice';
import destinationReducer from './slice/destination.slice';
import sessionReducer from './slice/session.slice';
import projectReducer from './slice/project.slice';
import auditReducer from './slice/audit.slice';
import toastReducer from './slice/toast.slice';

/**
 * v3 store — fully independent from v2's store. Mounted via its own <Provider>
 * inside V3App, wrapping only the v3 route subtree.
 *
 * `session` holds the selected organization and is read by BOTH the projects page
 * and the wizard — that shared read is what lets the wizard stop depending on a
 * hand-typed `?orgId=` (cs-project-dashboard TR-7, TR-17).
 */
const rootReducer = combineReducers({
  source: sourceReducer,
  destination: destinationReducer,
  session: sessionReducer,
  project: projectReducer,
  audit: auditReducer,
  // Shared by the whole wizard, not just the Audit step (cs-audit-report FR-9.1).
  toast: toastReducer,
});

export const v3Store = configureStore({
  reducer: rootReducer,
});

export type V3RootState = ReturnType<typeof rootReducer>;
export type V3Dispatch = typeof v3Store.dispatch;
