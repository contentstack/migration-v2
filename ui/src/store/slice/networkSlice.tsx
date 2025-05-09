import { createSlice } from '@reduxjs/toolkit';
import { RootState } from '../../store';

interface NetworkState {
  isOnline: boolean;
}

const initialState: NetworkState = {
  isOnline: navigator.onLine,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOnline(state) {
      state.isOnline = true;
    },
    setOffline(state) {
      state.isOnline = false;
    },
  },
});

export const { setOnline, setOffline } = networkSlice.actions;

export const selectNetworkStatus = (state: RootState) => state.network.isOnline;

export default networkSlice.reducer;
