import { createContext } from 'react';
import { IAppContext, DEFAULT_APP_CONTEXT } from './app.interface';

export const AppContext = createContext<IAppContext>(DEFAULT_APP_CONTEXT);
