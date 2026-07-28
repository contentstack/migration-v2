import { createSlice } from '@reduxjs/toolkit';

/**
 * Placeholder slice so the v3 store is valid before any real feature slice
 * exists. Real v3 feature slices (e.g. the Source-panel slice) replace/augment
 * this. Auth state is NOT kept here — it is derived from ui/v3/auth/token.ts.
 */
const placeholderSlice = createSlice({
  name: 'v3Placeholder',
  initialState: {},
  reducers: {},
});

export default placeholderSlice.reducer;
