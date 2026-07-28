/**
 * v3 route guard.
 *
 * Reads auth state from ONE place — `hasToken()` in ./token — so there is a
 * single definition of "logged in" across v3. `hasToken` is evaluated on each
 * render (not cached), so a token cleared in another tab is reflected here too.
 *
 * Mirrors v2's PrivateRoute behavior: unauthenticated users are redirected to
 * `redirectTo` (default "/", the shared login entry), preserving the attempted
 * location in navigation state.
 */
import { FC, ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { hasToken } from './token';

type Props = {
  /** Where to send unauthenticated users. Defaults to the shared login entry. */
  redirectTo?: string;
  children?: ReactNode;
};

const PrivateRouteV3: FC<Props> = ({ redirectTo = '/', children }) => {
  const location = useLocation();

  if (!hasToken()) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default PrivateRouteV3;
