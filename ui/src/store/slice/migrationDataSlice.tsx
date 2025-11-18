import { createSlice } from '@reduxjs/toolkit';

//defalut values from app interface
import {
  DEFAULT_CONTENT_MAPPING_DATA,
  DEFAULT_DESTINATION_STACK_DATA,
  DEFAULT_LEGACY_CMS_DATA,
  DEFAULT_MIGRATION_DATA,
  DEFAULT_MIGRATION_EXECUTION,
  DEFAULT_NEW_MIGRATION,
  DEFAULT_TEST_MIGRATION,
  IMigrationData,
  INewMigration
} from '../../context/app/app.interface';
import { DEFAULT_IFLOWSTEP } from '../../components/Stepper/FlowStepper/flowStep.interface';

const initialState = {
  migrationData: DEFAULT_MIGRATION_DATA,
  newMigrationData: DEFAULT_NEW_MIGRATION
};

const migrationSlice = createSlice({
  name: 'migration',
  initialState,
  reducers: {
    setNewMigrationData: (state, action) => {
      state.newMigrationData = action?.payload;
    },
    updateNewMigrationData: (state, action) => {
      // Deep merge for nested objects
      const payloadDestinationStack = action?.payload?.destination_stack;
      const payloadSourceLocale = payloadDestinationStack?.sourceLocale;
      
      // Ensure sourceLocale is properly set (array should be replaced, not merged)
      // Priority: payload sourceLocale > existing state sourceLocale
      const finalSourceLocale = (payloadSourceLocale !== undefined && Array.isArray(payloadSourceLocale) && payloadSourceLocale.length > 0)
        ? payloadSourceLocale
        : (state?.newMigrationData?.destination_stack?.sourceLocale || []);
      
      state.newMigrationData = {
        ...state?.newMigrationData,
        ...action?.payload,
        legacy_cms: {
          ...state?.newMigrationData?.legacy_cms,
          ...action?.payload?.legacy_cms,
          uploadedFile: {
            ...state?.newMigrationData?.legacy_cms?.uploadedFile,
            ...action?.payload?.legacy_cms?.uploadedFile
          }
        },
        destination_stack: {
          ...state?.newMigrationData?.destination_stack,
          ...payloadDestinationStack,
          // Explicitly set sourceLocale to ensure it's not lost
          sourceLocale: finalSourceLocale
        }
      };
    },
    setMigrationData: (state, action) => {
      state.migrationData = action?.payload;
    },
    updateMigrationData: (state, action) => {
      state.migrationData = { ...state?.migrationData, ...action?.payload };
    }
  }
});

export const {
  setNewMigrationData,
  updateNewMigrationData,
  setMigrationData,
  updateMigrationData
} = migrationSlice.actions;

export const selectNewMigration = (state: any) => state.migration.newMigration;
export const selectMigrationData = (state: any) => state.migration.migrationData;

export default migrationSlice.reducer;
