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

  const  authentication = useSelector((state:RootState)=>state?.authentication?.isAuthenticated);

  const projectId = location?.pathname?.split('/')?.[2];

  useEffect(()=>{
    dispatch(getUserDetails());

  },[dispatch]);

  useAuthCheck();

  return (
    <>
      {location.pathname.includes('projects') && 
        <>
        <MainHeader />
        <SideBar projectId={projectId} /> 
        </>
      }
      <div className={`${(location.pathname.includes('projects')) ? 'sidebarWrapper' : ''} page-wrapper`}>
        <div
          className='w-100'
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default AppLayout;
