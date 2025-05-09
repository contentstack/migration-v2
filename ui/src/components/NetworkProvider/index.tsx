import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useCallback } from 'react';
import { setOnline, setOffline, selectNetworkStatus } from '../../store/slice/networkSlice';
import { RootState } from '../../store';

export const useNetworkCheck = () => {
  const dispatch = useDispatch();
  const isOnline = useSelector((state: RootState) => selectNetworkStatus(state));

  const setOnlineToTrue = useCallback(() => {
    dispatch(setOnline());
  }, [dispatch]);

  const setOnlineToFalse = useCallback(() => {
    dispatch(setOffline());
  }, [dispatch]);

  useEffect(() => {
    window.addEventListener('online', setOnlineToTrue);
    window.addEventListener('offline', setOnlineToFalse);

    return () => {
      window.removeEventListener('online', setOnlineToTrue);
      window.removeEventListener('offline', setOnlineToFalse);
    };
  }, [setOnlineToTrue, setOnlineToFalse]);

  return isOnline;
};
