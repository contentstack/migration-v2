import { configureStore } from '@reduxjs/toolkit';
import migrationDataSlice from './migrationData.slice';
import authSlice from './auth.slice';

export const store = configureStore({
    reducer: {
        migration: migrationDataSlice,
        authentication: authSlice
    },
  })
  