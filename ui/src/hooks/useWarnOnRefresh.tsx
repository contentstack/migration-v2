export function useWarnOnRefresh(isUnsaved : boolean){
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
}