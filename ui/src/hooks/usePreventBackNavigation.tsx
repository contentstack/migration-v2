import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const usePreventBackNavigation = (): void => {
    const navigate = useNavigate();
    const location = useLocation();
  
    useEffect(() => {
      // push a dummy state to the history stack
      window.history.pushState(null, "", window.location.href);
  
      const handlePopState = () => {
        navigate(location.pathname, { replace: true });
      };
  
      window.addEventListener("popstate", handlePopState);
  
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }, [navigate, location]);
  };

export default usePreventBackNavigation;
