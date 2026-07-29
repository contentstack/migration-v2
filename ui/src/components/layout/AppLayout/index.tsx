// Libraries
import { FC, ReactNode, useEffect } from 'react';
import { Params, useLocation, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

import { getUserDetails } from '../../../store/slice/authSlice';

// Component
import MainHeader from '../../MainHeader';
import SideBar from '../../SideBar';
import { RootState } from '../../../store';
import useAuthCheck from '../../../hooks/authentication';

type IProps = {
  children?: ReactNode;
};

const AppLayout: FC<IProps> = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch();

  const authentication = useSelector((state: RootState) => state?.authentication?.isAuthenticated);

  const projectId = location?.pathname?.split('/')?.[2];
  const isV3 = location.pathname.startsWith('/v3');

  useEffect(() => {
    dispatch(getUserDetails());
  }, []);

  useAuthCheck();

  // v3 is a fully independent flow with its own chrome and scrolling — it must
  // not be wrapped in the v2 page-wrapper (fixed 100vh + overflow:hidden), nor
  // get the v2 MainHeader/SideBar (which would otherwise render here since v3
  // paths like /v3/projects/... also contain the substring "projects").
  if (isV3) {
    return <>{children}</>;
  }

  return (
    <>
      {location.pathname.includes('projects') && (
        <>
          <MainHeader />
          <SideBar projectId={projectId} />
        </>
      )}
      <div
        className={`${location.pathname.includes('projects') ? 'sidebarWrapper' : ''} page-wrapper`}
      >
        <div className="w-100">{children}</div>
      </div>
    </>
  );
};

export default AppLayout;
