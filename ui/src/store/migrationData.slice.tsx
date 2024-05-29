import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

//interface
import { DEFAULT_MIGRATION_DATA, DEFAULT_NEW_MIGRATION} from '../context/app/app.interface';


const initialState = {
    migrationData: DEFAULT_MIGRATION_DATA,
    newMigrationdata: DEFAULT_NEW_MIGRATION

} 

const migrationSlice = createSlice({
    name:'migration',
    initialState,
    reducers:{
        setNewMigration: (state, action) => {
            state.newMigrationdata = action.payload;
        },
        updateNewMigration: (state, action)=>{
            state.newMigrationdata = {...state.newMigrationdata,...action.payload};
        },
        setMigrationData: (state, action) => {
            state.migrationData = action.payload;
        },
        updateMigrationData: (state, action) => {
            state.migrationData = {...state.migrationData, ...action.payload};
        }

    }
})

export const {setNewMigration, 
    updateNewMigration, 
    setMigrationData, 
    updateMigrationData} = 
    migrationSlice.actions;

export const selectNewMigration = (state:any) => state.migration.newMigration;
export const selectMigrationData = (state:any) => state.migration.migrationData;

export default migrationSlice.reducer;