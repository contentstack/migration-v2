import { FC, lazy, Suspense } from 'react';
import { Provider } from 'react-redux';
import { Route, Routes } from 'react-router';

import PrivateRouteV3 from './auth/PrivateRouteV3';
import { v3Store } from './store';

/**
 * v3 application root.
 *
 * Self-contained: brings its own Redux <Provider> (v3Store) and its own route
 * guard, so v3 shares nothing mutable with v2. Mounted by the shared router at
 * `/v3/*`; the child routes below are relative to that prefix (e.g. "projects"
 * → /v3/projects).
 */
const ProjectsV3 = lazy(() => import('./pages/Projects'));
const MigrationV3 = lazy(() => import('./pages/Migration'));
const SettingsV3 = lazy(() => import('./pages/Settings'));

const V3App: FC = () => {
  return (
    <Provider store={v3Store}>
      <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
        <Routes>
          {/* v3 guards with its own PrivateRouteV3 (reads ui/v3/auth/token). */}
          <Route element={<PrivateRouteV3 redirectTo="/" />}>
            <Route path="projects" element={<ProjectsV3 />} />
            <Route
              path="projects/:projectId/migration/steps/:stepId"
              element={<MigrationV3 />}
            />
            <Route
              path="projects/:projectId/settings"
              element={<SettingsV3 />}
            />
          </Route>
        </Routes>
      </Suspense>
    </Provider>
  );
};

export default V3App;
