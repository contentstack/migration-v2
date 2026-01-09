import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSafeRouterPath } from '../utilities/functions';

/**
 * Custom hook to prevent browser back navigation.
 * Uses React Router's internal location state instead of window.location
 * to avoid Open Redirect vulnerabilities (CWE-601).
 */
const usePreventBackNavigation = (): void => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Store the current safe path from React Router's internal state
  // This avoids using window.location which is user-controlled
  const safePathRef = useRef<string>('/');

  useEffect(() => {
    // Build the full path from React Router's location object
    // This is safe because React Router validates routes internally
    const fullPath = getSafeRouterPath(location, true);
    
    // Store the validated path
    safePathRef.current = fullPath;
    
    // Push a new history state to enable back navigation detection
    window.history.pushState({ preventBack: true }, '', fullPath);

    const handleBackNavigation = (event: PopStateEvent) => {
      event.preventDefault();
      // Use the stored safe path from React Router, not window.location
      // Navigate to the path we stored from React Router's validated state
      window.history.pushState({ preventBack: true }, '', safePathRef.current);
    };

    window.addEventListener('popstate', handleBackNavigation);

    return () => {
      window.removeEventListener('popstate', handleBackNavigation);
    };
  }, [navigate, location]);
};
export default usePreventBackNavigation;
