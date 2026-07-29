import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import type { V3Dispatch, V3RootState } from './index';

/** Typed v3 store hooks. */
export const useV3Dispatch = () => useDispatch<V3Dispatch>();
export const useV3Selector: TypedUseSelectorHook<V3RootState> = useSelector;
