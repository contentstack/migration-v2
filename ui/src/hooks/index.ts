// Use this hook for any frequent changes , that impect on performance
export function useDebouncer<Params extends any[]>(callback: (...args: Params) => any, wait = 250) {
  let timeoutId: any = null;
  return (...args: Params) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
    }, wait);
  };
}
