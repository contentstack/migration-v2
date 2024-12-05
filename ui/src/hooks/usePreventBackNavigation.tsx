import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const usePreventBackNavigation = (): void => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleBackNavigation = (event: PopStateEvent) => {
      event.preventDefault();
      navigate(window.location.pathname, { replace: true });
    };

    window.history.pushState(null, "", window.location.href);

    window.addEventListener("popstate", handleBackNavigation);

    return () => {
      window.removeEventListener("popstate", handleBackNavigation);
    };
  }, [navigate]);
};
export default usePreventBackNavigation;
