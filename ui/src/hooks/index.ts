// Use this hook for any frequent changes , that impect on performance
/**
 * Creates a debounced version of a callback function.
 * @param callback The callback function to be debounced.
 * @param wait The debounce wait time in milliseconds (default: 250ms).
 * @returns A debounced version of the callback function.
 */
export function useDebouncer<Params extends any[]>(callback: (...args: Params) => any, wait = 250) {
  let timeoutId: any = null;
  return (...args: Params) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../store'

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()