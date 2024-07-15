import { createSlice } from '@reduxjs/toolkit'


//defalut values from app interface
import {  DEFAULT_CONTENT_MAPPING_DATA, DEFAULT_DESTINATION_STACK_DATA, DEFAULT_LEGACY_CMS_DATA, DEFAULT_MIGRATION_DATA, DEFAULT_MIGRATION_EXECUTION, DEFAULT_NEW_MIGRATION, DEFAULT_TEST_MIGRATION, IMigrationData, INewMigration} from '../../context/app/app.interface';
import { DEFAULT_IFLOWSTEP } from '../../components/Stepper/FlowStepper/flowStep.interface';

/**
 * Represents the initial state of the migration data slice.
 */
const initialState = {
    migrationData: DEFAULT_MIGRATION_DATA,
    newMigrationData: DEFAULT_NEW_MIGRATION,
};


/**
 * Represents the migration data slice.
 */
const migrationSlice = createSlice({
    name:'migration',
    initialState,
    reducers:{
        /**
         * Sets the new migration data.
         * @param state - The current state.
         * @param action - The action containing the payload.
         */
        setNewMigrationData: (state, action) => {
            state.newMigrationData = action?.payload;
        },
        /**
         * Updates the new migration data.
         * @param state - The current state.
         * @param action - The action containing the payload.
         */
        updateNewMigrationData: (state, action)=>{
            state.newMigrationData = {...state?.newMigrationData,...action?.payload};
        },
        /**
         * Sets the migration data.
         * @param state - The current state.
         * @param action - The action containing the payload.
         */
        setMigrationData: (state, action) => {
            state.migrationData = action?.payload;
        },
        /**
         * Updates the migration data.
         * @param state - The current state.
         * @param action - The action containing the payload.
         */
        updateMigrationData: (state, action) => {
            state.migrationData = {...state?.migrationData, ...action?.payload};
        }
    }
})

export const {
    setNewMigrationData, 
    updateNewMigrationData, 
    setMigrationData, 
    updateMigrationData} =  migrationSlice.actions;

export const selectNewMigration = (state:any) => state.migration.newMigration;
export const selectMigrationData = (state:any) => state.migration.migrationData;

export default migrationSlice.reducer;