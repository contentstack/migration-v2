//redux dependencies
import { createAsyncThunk, createSlice} from '@reduxjs/toolkit';
import { useNavigate } from 'react-router';

//initial values from app interface
import { DEFAULT_ORGANISATION,DEFAULT_USER, IDropDown, DEFAULT_DROPDOWN  } from './../../context/app/app.interface';

//utilities
import { clearLocalStorage, getDataFromLocalStorage, isEmptyString, validateArray } from '../../utilities/functions';
import { getUser } from '../../services/api/user.service';

//api
import { OrganisationResponse } from '../../services/api/service.interface';


/**
 * Represents the initial state of the authentication slice.
 */
const initialState = {
  authToken: getDataFromLocalStorage('app_token'),
  user : DEFAULT_USER,
  isAuthenticated:false,
  organisationsList: [],
  selectedOrganisation: DEFAULT_DROPDOWN
}

/**
 * Async thunk function to get user details.
 * @param _ - The payload (not used in this case)
 * @param dispatch - The Redux dispatch function
 * @returns A Promise that resolves to an object containing user details, organisations list, and selected organisation
 */
const getUserDetails: any = createAsyncThunk(
  'get/getUserDetails',
  async (_, { dispatch }) => {
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

/**
 * Represents the authentication slice of the Redux store.
 */
const authSlice = createSlice({
  name:'authentication',
  initialState,
  reducers:{
    /**
     * Sets the authentication token and updates the authentication status.
     * @param state - The current state of the authentication slice.
     * @param action - The Redux action containing the payload.
     */
    setAuthToken : (state, action)=>{
      state.authToken = action?.payload;
      state.isAuthenticated = !!action?.payload;
    },
    /**
     * Sets the user object in the authentication slice.
     * @param state - The current state of the authentication slice.
     * @param action - The Redux action containing the payload.
     */
    setUser : (state, action) => {
      state.user = action?.payload;
    },
    /**
     * Reinitializes the state of the authentication slice to its default values.
     * @param state - The current state of the authentication slice.
     */
    reInitiliseState: (state) => {
      state.authToken = '';
      state.user = DEFAULT_USER;
      state.isAuthenticated = false;
      state.organisationsList = [];
      state.selectedOrganisation = DEFAULT_DROPDOWN;
    },
    /**
     * Sets the list of organizations in the authentication slice.
     * @param state - The current state of the authentication slice.
     * @param action - The Redux action containing the payload.
     */
    setOrganisationsList: (state, action)=>{
      state.organisationsList = action?.payload;
    },
    /**
     * Sets the selected organization in the authentication slice.
     * @param state - The current state of the authentication slice.
     * @param action - The Redux action containing the payload.
     */
    setSelectedOrganisation: (state, action) => {
      state.selectedOrganisation = action?.payload;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(getUserDetails?.fulfilled,(state, action:any)=>{
      state.user = action?.payload?.user;
      state.organisationsList = action?.payload?.organisationsList;
      state.selectedOrganisation = action?.payload?.selectedOrganisation ;
      state.isAuthenticated = !isEmptyString(state?.authToken || '');
    })
  },
})
export const { setAuthToken, reInitiliseState, setOrganisationsList, setSelectedOrganisation, setUser } = authSlice.actions;

export {getUserDetails};
export default authSlice.reducer;