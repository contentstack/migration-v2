//redux dependencies
import { createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import { Middleware } from '@reduxjs/toolkit';
import { getUserDetails } from '../slice/authSlice'; // Adjust import path

// Your other imports...

const authMiddleware: Middleware = ({dispatch}) => (next) => (action: any) => { 
  if (action.type === '@@INIT') {    
    dispatch(getUserDetails());
  }

  return next(action);
};

export default authMiddleware;
