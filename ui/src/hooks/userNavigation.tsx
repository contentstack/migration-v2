import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getSafeRouterPath } from '../utilities/functions';

/**
 * Custom hook to block browser navigation when a modal is open.
 * Uses stored pathname from React Router to avoid Open Redirect vulnerabilities (CWE-601).
 */
const useBlockNavigation = (isModalOpen: boolean) => {
  const location = useLocation();
  
  // Store the validated pathname when modal state changes
  // This breaks the data flow from user-controlled input to redirect
  const storedPathnameRef = useRef<string>('/');

  // Memoized function to get the safe stored path
  const getSafeStoredPath = useCallback(() => {
    return storedPathnameRef.current;
  }, []);

  // Update stored pathname only when modal is not open
  // This captures the safe path before any manipulation
  useEffect(() => {
    if (!isModalOpen) {
      // Store the current path from React Router's validated state
      storedPathnameRef.current = getSafeRouterPath(location);
    }
  }, [isModalOpen, location]);

  useEffect(() => {
    const handlePopState = () => {
      // If the modal is open, prevent navigation by pushing state with stored safe path
      if (isModalOpen) {
        const safePath = getSafeStoredPath();
        window.history.pushState({ blockNav: true }, '', safePath);
      }
    };

    if (isModalOpen) {
      // Store the current safe path when modal opens
      storedPathnameRef.current = getSafeRouterPath(location);
      const safePath = getSafeStoredPath();
      window.history.pushState({ blockNav: true }, '', safePath);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isModalOpen, getSafeStoredPath, location]);
};

export default useBlockNavigation;
