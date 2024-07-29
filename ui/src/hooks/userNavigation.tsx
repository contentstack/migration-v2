import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const useBlockNavigation = (isModalOpen: boolean) => {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isModalOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.history.replaceState(null, '', window.location.pathname);
        navigate(location.pathname);
      }
    };

    if (isModalOpen) {
      initialPathnameRef.current = location.pathname;
      window.history.pushState(null, '', window.location.pathname);
      window.addEventListener('popstate', handlePopState);
    } else {
      window.removeEventListener('popstate', handlePopState);
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
