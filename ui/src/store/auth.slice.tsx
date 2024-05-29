import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_ORGANISATION,DEFAULT_USER, IDropDown  } from './../context/app/app.interface';
import { clearLocalStorage, getDataFromLocalStorage, isEmptyString, validateArray } from '../utilities/functions';
import { getUser } from '../services/api/user.service';

import { useNavigate } from 'react-router';
import { OrganisationResponse } from '../services/api/service.interface';

const initialState = {
    authToken: getDataFromLocalStorage('app_token'),
    user : DEFAULT_USER,
    isAuthenticated:false,
    organisationsList: [],
    selectedOrganisation: DEFAULT_ORGANISATION
    
}

const getUserDetails = createAsyncThunk(
    'auth/getUserDetails',
    async (_,{dispatch}:any) =>{
        try {
            console.log("in thunk");
            
            const navigate = useNavigate();

            const response = await getUser();
            console.log("resopnse : ", response);
            
      
            if (response.status === 401) {
              clearLocalStorage();
              dispatch(reInitiliseState());
              navigate('/', { replace: true });
              return;
            }
      
            if (response.status === 200 && response?.data?.user) {
              const mappedOrg: IDropDown[] = validateArray(response?.data?.user?.orgs)
                ? response?.data?.user?.orgs?.map(({ org_id, org_name }: OrganisationResponse) => ({
                    uid: org_id,
                    value: org_id,
                    label: org_name
                  }))
                : [];
      
              const localOrgId = getDataFromLocalStorage('organization');
      
              if (validateArray(mappedOrg)) {
                //Initialise org with 1st element
                let org = mappedOrg[0];
      
                //if Local Org is id exist in local Storage.
                if (localOrgId) {
                  //Find org in mappedOrg array
                  const localOrg = mappedOrg?.find((drpdwn: IDropDown) => drpdwn.value === localOrgId);
      
                  //IF org found in mappedOrg array then assign it to org.
                  if (localOrg) {
                    org = localOrg;
                    dispatch(setSelectedOrganisation(org));
                    return {
                        user: response?.data?.user,
                        organisationsList: mappedOrg,
                        selectedOrganisation: localOrg,
                        
                      };
                  }
                }
      
                //Update Selected org
                //setSelectedOrganisation(org);
              }
      
              //setUser(response?.data?.user);
      
              //setOrganisationsList(mappedOrg);
              //setIsAuthenticated(!isEmptyString(authToken));
              
            }
          } catch (error) {
            //console.error(error);
      
            clearLocalStorage();
            dispatch(reInitiliseState());
          }
    }
)

const authSlice = createSlice({
    name:'authentication',
    initialState,
    reducers:{
        setAuthToken : (state, action)=>{
            state.authToken = action.payload;
            state.isAuthenticated = !!action.payload;
        },
        setUser : (state, action) => {
            state.user = action.payload;
        },
        reInitiliseState: (state) => {
            state.authToken = '';
            state.user = DEFAULT_USER;
            state.isAuthenticated = false;
            state.organisationsList = [];
            state.selectedOrganisation = DEFAULT_ORGANISATION;
        },
        setOrganisationsList: (state, action)=>{
            state.organisationsList = action.payload

        },
        setSelectedOrganisation: (state, action) => {
            state.selectedOrganisation = action.payload;
        }


    },
    extraReducers: (builder) => {
        builder.addCase(getUserDetails.fulfilled,(state, action:any)=>{
            console.log("action",action.payload);
            
            
            state.user = action?.payload?.user;
            //state.organisationsList.push(action?.payload.organisationsList || []);
            state.organisationsList = action.payload?.organisationsList;
            state.selectedOrganisation = action?.payload?.selectedOrganisation || {};
            state.isAuthenticated = !isEmptyString(state.authToken || '');
            

        })
        
    },
})
export const { setAuthToken, reInitiliseState, setOrganisationsList, setSelectedOrganisation, setUser } = authSlice.actions;
export const selectOrganisation = (state:any) => state.authentication.selectedOrganisation
export {getUserDetails};
export default authSlice.reducer;