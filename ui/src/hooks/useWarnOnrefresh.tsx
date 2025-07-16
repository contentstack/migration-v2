import { useEffect } from "react";

export function useWarnOnRefresh(isUnsaved : boolean){
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isUnsaved) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
    };
}, [isUnsaved]);
}