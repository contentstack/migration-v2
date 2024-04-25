// Libraries
import { FC, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

// Context
import { AppContext } from './app.context';

// Utilities
import {
  clearLocalStorage,
  getDataFromLocalStorage,
  isEmptyString,
  setDataInLocalStorage,
  validateArray
} from '../../utilities/functions';

// Interface
import {
  DEFAULT_DROPDOWN,
  DEFAULT_MIGRATION_DATA,
  DEFAULT_NEW_MIGRATION,
  DEFAULT_USER,
  IAppContext,
  IDropDown,
  IMigrationData,
  INewMigration,
  User
} from './app.interface';
import { OrganisationResponse } from '../../services/api/service.interface';

// Services
import { getUser } from '../../services/api/user.service';

type IProps = {
  children?: ReactNode;
};

const AppContextProvider: FC<IProps> = ({ children }) => {
  //********* ALL STATES HERE  *********/
  const [authToken, setAuthToken] = useState<string>('');
  const [user, setUser] = useState<User>(DEFAULT_USER);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [newMigration, setNewMigration] = useState<INewMigration>(DEFAULT_NEW_MIGRATION);
  const [migrationData, setMigrationData] = useState<IMigrationData>(DEFAULT_MIGRATION_DATA);
  const [organisationsList, setOrganisationsList] = useState<IDropDown[]>([]);
  const [selectedOrganisation, setSelectedOrganisation] = useState<IDropDown>(DEFAULT_DROPDOWN);

  const navigate = useNavigate();

  //********* ALL Methods HERE  *********/

  const reInitiliseAppContext = () => {
    setAuthToken('');
    setUser(DEFAULT_USER);
    setIsAuthenticated(false);
    setNewMigration(DEFAULT_NEW_MIGRATION);
    setMigrationData(DEFAULT_MIGRATION_DATA);
    setSelectedOrganisation(DEFAULT_DROPDOWN);
    setOrganisationsList([]);
  };

  const getUserDetails = async () => {
    try {
      const response = await getUser();

      if (response.status === 401) {
        clearLocalStorage();
        reInitiliseAppContext();
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
            }
          }

          //Update Selected org
          setSelectedOrganisation(org);
        }

        setUser(response?.data?.user);

        setOrganisationsList(mappedOrg);
        setIsAuthenticated(!isEmptyString(authToken));
      }
    } catch (error) {
      console.error(error);

      clearLocalStorage();
      reInitiliseAppContext();
    }
  };

  //********* ALL USEEFFECT HERE  *********/

  useEffect(() => {
    const token = getDataFromLocalStorage('app_token');
    setAuthToken(token || '');

    const storedNewMigration = sessionStorage.getItem('newMigration');
    if (storedNewMigration) {
      setNewMigration(JSON.parse(storedNewMigration));
    }
  }, []);

  //get User details on auth token change;
  useEffect(() => {
    if (!isEmptyString(authToken)) {
      getUserDetails();
    }
  }, [authToken]);

  useEffect(() => {
    sessionStorage.setItem('newMigration', JSON.stringify(newMigration));
  }, [newMigration]);

  const ctxObject: IAppContext = {
    authToken: authToken,
    setAuthToken: (token: string) => setAuthToken(() => token),
    user: user,
    updateUser: (user: User) => setUser(user),
    isAuthenticated: isAuthenticated,
    setIsAuthenticated: (flag: boolean) => setIsAuthenticated(flag),
    newMigrationData: newMigration,
    updateNewMigrationData: (data: Partial<INewMigration>) =>
      setNewMigration((prev) => ({ ...prev, ...data })),
    migrationData: migrationData,
    updateMigrationData: (data: Partial<IMigrationData>) =>
      setMigrationData((prev) => ({ ...prev, ...data })),
    organisationsList: organisationsList,
    updateOrganisationsList: (list: IDropDown[]): void => setOrganisationsList(list),
    selectedOrganisation: selectedOrganisation,
    updateSelectedOrganisation: (dropdown: IDropDown): void => setSelectedOrganisation(dropdown)
  };

  return (
    <AppContext.Provider value={ctxObject}>
      <>{children}</>
    </AppContext.Provider>
  );
};

export default AppContextProvider;
