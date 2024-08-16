// Define RootState type
export type RootState = ReturnType<typeof rootReducer>;

// Import reducers
import migrationDataSlice from './slice/migrationDataSlice';
import authSlice, { getUserDetails } from './slice/authSlice';
import { combineReducers, configureStore, Tuple} from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage'; 
import { persistReducer, persistStore } from 'redux-persist';
import authMiddleware from './middleware/authMiddleware';
import networkReducer from './slice/networkSlice';

const persistConfig = {
  key: 'root',
  storage,
};

// Combine reducers
const rootReducer = combineReducers({
  migration: migrationDataSlice,
  authentication: authSlice,
  network: networkReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the store
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware:any) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(authMiddleware),
});

const persistor = persistStore(store);




export type AppDispatch = typeof store.dispatch;
export { store, persistor };
