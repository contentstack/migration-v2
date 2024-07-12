// Libraries
import { FC, ReactNode, useEffect } from 'react';
import { Params, useLocation, useParams } from 'react-router';
import { useDispatch } from 'react-redux';

import { getUserDetails } from '../../../store/slice/authSlice';

// Component
import MainHeader from '../../MainHeader';
import SideBar from '../../SideBar';

type IProps = {
  children?: ReactNode;
};

/**
 * Represents the layout component for the application.
 * @param {Object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render.
 * @returns {JSX.Element} The rendered layout component.
 */
const AppLayout: FC<IProps> = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch();

  const projectId = location?.pathname?.split('/')?.[2];

  useEffect(()=>{
    dispatch(getUserDetails());

  },[dispatch])

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
