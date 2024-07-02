// Libraries
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dropdown, Tooltip , Accordion} from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Service
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Redux
import { RootState } from '../../store';
import { setSelectedOrganisation } from '../../store/slice/authSlice';

//Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import {
  clearLocalStorage,
  getDataFromLocalStorage,
  setDataInLocalStorage
} from '../../utilities/functions';

// Interface
import { MainHeaderType } from './mainheader.interface';
import { IDropDown } from '../../context/app/app.interface';

import ProfileCard from '../ProfileHeader';
// Styles
import './index.scss';

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
          <div className="d-flex align-items-center">
            {logo?.image?.url ? (
              <div className="logo">
                <Tooltip position="right" content="Projects" wrapperElementType="div">
                  <Link to={`${logo?.url}`}>
                    <img src={logo?.image?.url} width={32} alt="Contentstack" />
                  </Link>
                </Tooltip>
              </div>
            ) : (
              ''
            )}

            {location.pathname === '/projects' && <div className="organisationWrapper">
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
            </div>}
          </div>

          {(location.pathname == '/projects' || location.pathname.includes('/projects/')) && <div className="flex-end">
            <div className="Dropdown-wrapper">
              <Dropdown
                list={[
                  {
                    // action: handleLogout,
                    default: true,
                    label: <ProfileCard/>,
                  }
                ]}
                type="click"
                className="Profile_card"
              >
                <div className="user-short-name flex-v-center flex-h-center">{name}</div>
              </Dropdown>
              {/* <Accordion>
              <div className="user-short-name flex-v-center flex-h-center">{name}</div>
                <p>HIIIIIIIIII</p>
              </Accordion> */}
            </div>
          </div>}
    </div>
  );
};

export default MainHeader;
