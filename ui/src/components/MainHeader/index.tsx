// Libraries
import { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dropdown, Tooltip } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Service
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

//Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Context
import { AppContext } from '../../context/app/app.context';

// Interface
import { MainHeaderType } from './mainheader.interface';
import { DEFAULT_USER, IDropDown } from '../../context/app/app.interface';

// Styles
import './index.scss';
import {
  clearLocalStorage,
  getDataFromLocalStorage,
  setDataInLocalStorage
} from '../../utilities/functions';
import { RootState } from '../../store';
import { setSelectedOrganisation } from '../../store/slice/authSlice';

const MainHeader = () => {

  const user = useSelector((state:RootState)=>state?.authentication?.user);
  const organisationsList = useSelector((state:RootState)=>state?.authentication?.organisationsList);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);

  const [data, setData] = useState<MainHeaderType>({});
  const [orgsList, setOrgsList] = useState<IDropDown[]>([]);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { logo, organization_label: organizationLabel } = data;

  const name = `${user?.first_name?.charAt(0)}${user?.last_name?.charAt(0)}`.toUpperCase() ?? '';
   
  const updateOrganisationListState = () => {
    if (organisationsList) {
      //set selected org as default
      const list = organisationsList.map((org: any) => ({
        ...org,
        default: org?.value === selectedOrganisation?.value
      }));
  
      setOrgsList(list);
  
      //Set organization in local storage, first check if selectedOrg.value exists, if not get org id from local storage and set.
      setDataInLocalStorage(
        'organization',
        selectedOrganisation?.value || getDataFromLocalStorage('organization')
      );
    }
  };

  const fetchData = async () => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.MAIN_HEADER)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData({});
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    updateOrganisationListState();
  }, [selectedOrganisation]);

  const urlParams = new URLSearchParams(location.search);
  const newParam = urlParams.get('region');

  // Function for Logout
  const handleLogout = () => {
    if (clearLocalStorage()) {
      navigate('/', { replace: true });
    }
  };

  const handleOnDropDownChange = (data: IDropDown) => {
    if (data.value === selectedOrganisation.value) return;

    dispatch(setSelectedOrganisation(data));
    setDataInLocalStorage('organization', data?.value);
  };

  return (
    <div className="mainheader">
      <div className="container-fluid">
        <div className="row align-items-center">
          <div className="col-6 d-flex align-items-center">
            {logo?.image?.url ? (
              <div className="logo">
                <Tooltip position="right" content="Stacks" wrapperElementType="div">
                  <Link to={`${logo?.url}`}>
                    <img src={logo?.image?.url} className="w-100" alt="Contentstack Logo" />
                  </Link>
                </Tooltip>
              </div>
            ) : (
              ''
            )}

            <div className="organisationWrapper">
              <Dropdown
                withSearch
                headerLabel={organizationLabel}
                closeAfterSelect
                highlightActive
                list={orgsList}
                type="select"
                withArrow
                onChange={handleOnDropDownChange}
              ></Dropdown>
            </div>
          </div>

          <div className="col-6 flex-end">
            <div className="Dropdown-wrapper">
              <Dropdown
                list={[
                  {
                    action: handleLogout,
                    default: true,
                    label: 'Logout'
                  }
                ]}
                type="click"
              >
                <div className="user-short-name flex-v-center flex-h-center">{name}</div>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainHeader;
