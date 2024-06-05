// Libraries
import { FC, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router';
// Component
import MainHeader from '../../MainHeader';
import SideBar from '../../SideBar';
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
      {location.pathname.includes('projects') && 
        <>
        <MainHeader />
        <SideBar /> 
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
