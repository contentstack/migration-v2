// Define RootState type
export type RootState = ReturnType<typeof rootReducer>;

// Import reducers
import migrationDataSlice from './slice/migrationDataSlice';
import authSlice, { getUserDetails } from './slice/authSlice';
import { combineReducers, configureStore, Tuple} from '@reduxjs/toolkit';
import storage from 'redux-persist/lib/storage'; 
import { persistReducer, persistStore } from 'redux-persist';
import authMiddleware from './middleware/authMiddleware';


/**
 * Configuration object for persisting the Redux store.
 * @property {string} key - The key to use for storing the state in the storage.
 * @property {Object} storage - The storage engine to use for persisting the state.
 */
const persistConfig = {
  key: 'root',
  storage,
};

// Combine reducers
/**
 * Root reducer function that combines all the reducers for the Redux store.
 * @returns The combined reducer object.
 */
const rootReducer = combineReducers({
  migration: migrationDataSlice,
  authentication: authSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the store
/**
 * Creates the Redux store with the specified reducer and middleware.
 *
 * @param {Object} options - The options for configuring the store.
 * @param {Function} options.reducer - The root reducer function for the store.
 * @param {Function} options.middleware - The middleware function for the store.
 * @returns {Object} The Redux store object.
 */
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
