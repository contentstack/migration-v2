import { FC, ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { getDataFromLocalStorage } from '../../utilities/functions';

/**
 * Props for the PrivateRoute component.
 */
type IProps = {
  children?: ReactNode;
  redirectTo: string;
};

/**
 * Renders a private route component that checks if the user is authenticated.
 * If the user is authenticated, it renders the child components.
 * If the user is not authenticated, it redirects to the specified route.
 *
 * @param redirectTo - The route to redirect to if the user is not authenticated.
 * @returns The private route component.
 */
const PrivateRoute: FC<IProps> = ({ redirectTo }: IProps) => {
  const isAuthenticated = !!getDataFromLocalStorage('app_token');

  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace={true} state={{ from: location }} />;
  }

  return <Outlet />;
};

export default PrivateRoute;
