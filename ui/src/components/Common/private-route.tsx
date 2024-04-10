import { FC, ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { getDataFromLocalStorage } from '../../utilities/functions';

type IProps = {
  children?: ReactNode;
  redirectTo: string;
};

const PrivateRoute: FC<IProps> = ({ redirectTo }: IProps) => {
  const isAuthenticated = !!getDataFromLocalStorage('app_token');

  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace={true} state={{ from: location }} />;
  }

  return <Outlet />;
};

export default PrivateRoute;
