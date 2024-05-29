// Libraries
import { FC, ReactNode } from 'react';
import { useLocation } from 'react-router';
// Component
import MainHeader from '../../MainHeader';
import SideBar from '../../SideBar';

type IProps = {
  children?: ReactNode;
};

const AppLayout: FC<IProps> = ({ children }) => {
  const location = useLocation();

  return (
    <>
      {/* {location.pathname === '/projects' && <MainHeader />} */}
      <MainHeader />
      <SideBar />
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
