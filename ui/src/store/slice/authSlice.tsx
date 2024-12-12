//redux dependencies
import { createAsyncThunk, createSlice} from '@reduxjs/toolkit';

//initial values from app interface
import { DEFAULT_USER, IDropDown, DEFAULT_DROPDOWN  } from './../../context/app/app.interface';

//utilities
import { clearLocalStorage, getDataFromLocalStorage, isEmptyString, validateArray } from '../../utilities/functions';
import { getUser } from '../../services/api/user.service';

//api
import { OrganisationResponse } from '../../services/api/service.interface';


const initialState = {
    authToken: getDataFromLocalStorage('app_token'),
    user : DEFAULT_USER,
    isAuthenticated:false,
    organisationsList: [],
    selectedOrganisation: DEFAULT_DROPDOWN
    
}

const getUserDetails:any = createAsyncThunk(
  'get/getUserDetails',
  async (_,{dispatch}) => {
    try {
      const response = await getUser();

      if (response?.status === 401) {
        clearLocalStorage();
        dispatch(reInitiliseState());
        return;
      }

      if (response?.status === 200 && response?.data?.user) {
        const mappedOrg: IDropDown[] = validateArray(response?.data?.user?.orgs)
          ? response?.data?.user?.orgs?.map(({ org_id, org_name }: OrganisationResponse) => ({
              uid: org_id,
              value: org_id,
              label: org_name
            }))
          : [];

        const localOrgId = getDataFromLocalStorage('organization');

        if (validateArray(mappedOrg)) {
          let org = mappedOrg[0];

          if (localOrgId) {
            const localOrg = mappedOrg?.find((drpdwn: IDropDown) => drpdwn?.value === localOrgId);
            if (localOrg) {
              org = localOrg;
            }
          }

          dispatch(setSelectedOrganisation(org));
          return {
            user: response?.data?.user,
            organisationsList: mappedOrg,
            selectedOrganisation: org
          };
        }
      }
    } catch (error) {
      console.error(error);
      clearLocalStorage();
      dispatch(reInitiliseState());
    }
  }
);

const authSlice = createSlice({
    name:'authentication',
    initialState,
    reducers:{
        setAuthToken : (state, action)=>{
            state.authToken = action?.payload?.authToken;
            state.isAuthenticated = action?.payload?.isAuthenticated;
        },
        setUser : (state, action) => {
          state.user = {
            ...state?.user,             
            ...action?.payload,        
          };
        },
        reInitiliseState: (state) => {
            state.authToken = '';
            state.user = DEFAULT_USER;
            state.isAuthenticated = false;
            state.organisationsList = [];
            state.selectedOrganisation = DEFAULT_DROPDOWN;
        },
        setOrganisationsList: (state, action)=>{
            state.organisationsList = action?.payload

        },
        setSelectedOrganisation: (state, action) => {
            state.selectedOrganisation = action?.payload;
        }


    },
    extraReducers: (builder) => {
        builder.addCase(getUserDetails?.fulfilled,(state, action)=>{          
          state.user = {
            ...state?.user,          
            ...action?.payload?.user, 
          };
            state.organisationsList = action?.payload?.organisationsList;
            state.selectedOrganisation = action?.payload?.selectedOrganisation ;
            state.isAuthenticated = !isEmptyString(state?.authToken || '');
            

        })
        
    },
})
export const { setAuthToken, reInitiliseState, setOrganisationsList, setSelectedOrganisation, setUser } = authSlice.actions;

export {getUserDetails};
export default authSlice.reducer;