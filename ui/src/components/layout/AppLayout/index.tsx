// Libraries
import { FC, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router';

// Component
import MainHeader from '../../MainHeader';
import { getUserDetails } from '../../../store/slice/authSlice';
import { useDispatch } from 'react-redux';

type IProps = {
  children?: ReactNode;
};

const AppLayout: FC<IProps> = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch();

  useEffect(()=>{
    dispatch(getUserDetails());

  },[dispatch])

  return (
    <>
      {location.pathname === '/projects' && <MainHeader />}
      <div className="page-wrapper">
        <div
          className={
            location.pathname !== '/login' && location.pathname !== '/forgot-password'
              ? 'container-fluid'
              : 'w-100'
          }
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default AppLayout;
