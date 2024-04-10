import { lazy } from 'react';
import { Routes, Route } from 'react-router';
import ErrorPage from '../../pages/Errors';
import { CS_ENTRIES } from '../../utilities/constants';
import PrivateRoute from './private-route';
import NewMigrationWrapper from '../Migrations/NewMigration/NewMigrationWrapper';
import Settings from './Settings';

/******** ALL LAZY LOADING ********/
const HomeLazyLoad = lazy(() => import('../../pages/Home'));
const LoginLazyLoad = lazy(() => import('../../pages/Login'));
const RegionalLoginLazyLoad = lazy(() => import('../../pages/RegionalLogin'));
const MigrationEditorLazyLoad = lazy(() => import('../../pages/MigrationEditor'));
const ProjectsLazyLoad = lazy(() => import('../../pages/Projects'));

const AppRouter = () => {
  return (
    <Routes>
      {/* ALL PUBLIC ROUTES HERE */}
      <Route path="/" element={<HomeLazyLoad />} />
      <Route path="/region-login" element={<RegionalLoginLazyLoad />} />
      <Route path="/login" element={<LoginLazyLoad />} />

      {/* ALL PROTECTED ROUTES HERE */}
      <Route element={<PrivateRoute redirectTo="/" />}>
        <Route path="/migrations" element={<MigrationEditorLazyLoad />} />
        <Route path="/projects" element={<ProjectsLazyLoad />} />

        {/* <Route
          path="/projects/:projectId/migrations/:ruleId/"
          element={<MigrationEditorLazyLoad />}
        /> */}
        <Route
          path="/projects/:projectId/migration/steps/:stepId"
          element={<MigrationEditorLazyLoad />}
        >
          <Route index element={<NewMigrationWrapper />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* <Route path={["/","/region-login"]} render={()=> Header} /> */}
      <Route path="*" element={<ErrorPage contentType={CS_ENTRIES.NOT_FOUND_ERROR} />} />
    </Routes>
  );
};

export default AppRouter;
