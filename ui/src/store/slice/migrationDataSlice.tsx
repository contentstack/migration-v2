import { createSlice } from '@reduxjs/toolkit'


//defalut values from app interface
import {  DEFAULT_CONTENT_MAPPING_DATA, DEFAULT_DESTINATION_STACK_DATA, DEFAULT_LEGACY_CMS_DATA, DEFAULT_MIGRATION_DATA, DEFAULT_MIGRATION_EXECUTION, DEFAULT_NEW_MIGRATION, DEFAULT_TEST_MIGRATION, IMigrationData, INewMigration} from '../../context/app/app.interface';
import { DEFAULT_IFLOWSTEP } from '../../components/Stepper/FlowStepper/flowStep.interface';

const initialState = {
    migrationData: DEFAULT_MIGRATION_DATA ,
    newMigrationData: DEFAULT_NEW_MIGRATION 
} 

const migrationSlice = createSlice({
    name:'migration',
    initialState,
    reducers:{
        setNewMigrationData: (state, action) => {
            state.newMigrationData = action?.payload;
        },
        updateNewMigrationData: (state, action)=>{
            state.newMigrationData = {...state?.newMigrationData,...action?.payload};
        },
        setMigrationData: (state, action) => {
            state.migrationData = action?.payload;
        },
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