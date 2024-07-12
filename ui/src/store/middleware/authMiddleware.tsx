//redux dependencies
import { createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import { Middleware } from '@reduxjs/toolkit';
import { getUserDetails } from '../slice/authSlice'; // Adjust import path

// Your other imports...

/**
 * Middleware function that handles authentication-related actions.
 * @param {Object} store - The Redux store object.
 * @returns {Function} - The next middleware function in the chain.
 */
const authMiddleware: Middleware = ({dispatch}) => (next) => (action: any) => { 
  if (action.type === '@@INIT') {    
    dispatch(getUserDetails());
  }

  return next(action);
};

export default authMiddleware;
