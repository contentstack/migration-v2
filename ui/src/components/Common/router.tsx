// Libraries
import { lazy } from 'react';
import { Routes, Route } from 'react-router';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Pages
import ErrorPage from '../../pages/Errors';

// Component
import PrivateRoute from './private-route';

/******** ALL LAZY LOADING ********/
const HomeLazyLoad = lazy(() => import('../../pages/Home'));
const LoginLazyLoad = lazy(() => import('../../pages/Login'));
const RegionalLoginLazyLoad = lazy(() => import('../../pages/RegionalLogin'));
const MigrationLazyLoad = lazy(() => import('../../pages/Migration'));
const ProjectsLazyLoad = lazy(() => import('../../pages/Projects'));
const SettingsLazyLoad = lazy(() => import ('../Common/Settings'))

const AppRouter = () => {
  return (
    <Routes>
      {/* ALL PUBLIC ROUTES HERE */}
      <Route path="/" element={<HomeLazyLoad />} />
      <Route path="/region-login" element={<RegionalLoginLazyLoad />} />
      <Route path="/login" element={<LoginLazyLoad />} />

      {/* ALL PROTECTED ROUTES HERE */}
      <Route element={<PrivateRoute redirectTo="/" />}>
        <Route path="/migrations" element={<MigrationLazyLoad />} />
        <Route path="/projects" element={<ProjectsLazyLoad />} />

        <Route
          path="/projects/:projectId/migration/steps/:stepId"
          element={<MigrationLazyLoad />}
        />
          
        <Route path="/projects/:projectId/settings" element={<SettingsLazyLoad />} />
      </Route>

      <Route path="*" element={<ErrorPage contentType={CS_ENTRIES.NOT_FOUND_ERROR} />} />
    </Routes>
  );
};

export default AppRouter;
