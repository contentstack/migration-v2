import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const useBlockNavigation = (isModalOpen: boolean) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // If the modal is open, prevent navigation
      if (isModalOpen) {
        window.history.pushState(null, '', window.location.pathname);
        navigate(location.pathname);
      }
    };

    if (isModalOpen) {
      initialPathnameRef.current = location.pathname;
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isModalOpen, navigate, location.pathname]);

  useEffect(() => {
    if (!isModalOpen) {
      initialPathnameRef.current = location.pathname;
    }
  }, [isModalOpen, location.pathname]);
};

export default useBlockNavigation;
