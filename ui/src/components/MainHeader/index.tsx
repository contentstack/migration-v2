// Libraries
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cbModal, Dropdown, Tooltip } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Service
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { getProject } from '../../services/api/project.service';

// Redux
import { RootState } from '../../store';
import { setSelectedOrganisation } from '../../store/slice/authSlice';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

//Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import {
  getDataFromLocalStorage,
  isEmptyString,
  setDataInLocalStorage
} from '../../utilities/functions';

// Interface
import { MainHeaderType } from './mainheader.interface';
import { DEFAULT_NEW_MIGRATION, IDropDown } from '../../context/app/app.interface';
import { ModalObj } from '../Modal/modal.interface';

// Components
import ProfileCard from '../ProfileHeader';
import NotificationModal from '../Common/NotificationModal';

// Styles
import './index.scss';
import useBlockNavigation from '../../hooks/userNavigation';

const MainHeader = () => {
  const user = useSelector((state: RootState) => state?.authentication?.user);
  const organisationsList = useSelector(
    (state: RootState) => state?.authentication?.organisationsList
  );
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  const [data, setData] = useState<MainHeaderType>({});
  const [orgsList, setOrgsList] = useState<IDropDown[]>(organisationsList ?? []);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { logo, organization_label: organizationLabel } = data;

  const name = user
    ? `${user?.first_name?.charAt(0)}${user?.last_name?.charAt(0)}`.toUpperCase() ?? ''
    : '';

  const updateOrganisationListState = () => {
    if (organisationsList) {
      //set selected org as default
      const list = organisationsList.map((org: IDropDown) => ({
        ...org,
        default: org?.value === selectedOrganisation?.value
      }));

      setOrgsList(list);

      //Set organization in local storage, first check if selectedOrg.value exists, if not get org id from local storage and set.
      setDataInLocalStorage(
        'organization',
        selectedOrganisation?.value || getDataFromLocalStorage('organization') || ''
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
  }, [selectedOrganisation, organisationsList]);

  const handleOnDropDownChange = (data: IDropDown) => {
    if (data.value === selectedOrganisation.value) return;

    dispatch(setSelectedOrganisation(data));
    setDataInLocalStorage('organization', data?.value);
  };

  // useEffect(()=>{
  //   const handlePopState = (event: PopStateEvent) => {
  //     event.preventDefault();
  //     window.history.pushState(null, '', window.location.href);
  //     handleonClick();

  //   };
  //   if(isModalOpen){
  //     window.history.pushState(null, '', window.location.href);

  //   }
  //   window.history.pushState(null, '', window.location.href);
  //   window.addEventListener('popstate',handlePopState);
  //   console.log("href ::::::", window.location.href);

  //   return () => {
  //     window.removeEventListener('popstate', handlePopState);
  //   };

  // },[isModalOpen,newMigrationData]);
  useBlockNavigation(isModalOpen);

  const handleonClick = async () => {
    const currentIndex = newMigrationData?.legacy_cms?.currentStep + 1;
    const pathSegments = location?.pathname.split('/');
    const lastPathSegment = pathSegments?.[pathSegments?.length - 4];

    const response =
      lastPathSegment && (await getProject(selectedOrganisation?.uid || '', lastPathSegment));
    const current_step = response?.data?.current_step;
    if (isModalOpen) return;

    const goback = () => {
      dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION));
      navigate(`/projects`, { replace: true });
      setIsModalOpen(false);
    };

    if (
      -1 < currentIndex &&
      currentIndex < 4 &&
      (!isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) ||
        !isEmptyString(newMigrationData?.legacy_cms?.affix) ||
        newMigrationData?.legacy_cms?.uploadedFile?.isValidated) &&
      current_step === 1
    ) {
      setIsModalOpen(true);
      return cbModal({
        component: (props: ModalObj) => (
          <NotificationModal goBack={goback} {...props} isopen={setIsModalOpen} />
        ),
        modalProps: {
          size: 'xsmall',
          shouldCloseOnOverlayClick: false
        }
      });
    } else {
      dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION));
      navigate(`/projects`, { replace: true });
    }
  };
  return (
    <div className="mainheader">
      <div className="d-flex align-items-center">
        {logo?.image?.url ? (
          <div className="logo" onClick={handleonClick}>
            <Tooltip position="right" content="Projects" wrapperElementType="div">
              <Link to={`${logo?.url}`} onClick={(e) => e.preventDefault()}>
                <img src={logo?.image?.url} width={32} alt="Contentstack" />
              </Link>
            </Tooltip>
          </div>
        ) : (
          ''
        )}

        {location.pathname === '/projects' && (
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
        )}
      </div>

      {(location.pathname == '/projects' || location.pathname.includes('/projects/')) && (
        <div className="flex-end">
          <div className="Dropdown-wrapper">
            <Tooltip content={'Profile'} position="top">
              <Dropdown
                list={[
                  {
                    default: true,
                    label: <ProfileCard />
                  }
                ]}
                type="click"
                className="Profile_card"
              >
                <div className="user-short-name flex-v-center flex-h-center">{name}</div>
              </Dropdown>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainHeader;
