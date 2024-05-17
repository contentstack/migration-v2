// Libraries
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

// Service
import { updateLegacyCMSData } from '../../../services/api/migration.service';
import { fileValidation, getConfig } from '../../../services/api/upload.service';

// Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';

// Context
import { AppContext } from '../../../context/app/app.context';

// Interface
import { defaultCardType } from '../../../components/Common/Card/card.interface';
import { DEFAULT_CMS_TYPE, ICMSType, INewMigration } from '../../../context/app/app.interface';

// Components
import Card from '../../../components/Common/Card/card';
import { EmptyState, Line, Search } from '@contentstack/venus-components';

// Style
import '../legacyCms.scss';

import { SEARCH_ICON } from '../../../common/assets';
import { IFilterStatusType } from '../../../components/Common/Modal/FilterModal/filterModal.interface';

interface LoadSelectCmsProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadSelectCms = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const { migrationData, newMigrationData, updateNewMigrationData, selectedOrganisation } =
    useContext(AppContext);

  const [selectedCard, setSelectedCard] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms || defaultCardType
  );
  const [cmsData, setCmsData] = useState<ICMSType[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [cmsFilterStatus, setCmsFilterStatus] = useState<IFilterStatusType>({});
  const [cmsFilter, setCmsFilter] = useState<string[]>([]);
  const [cmsType, setCmsType] = useState<string>(
    newMigrationData?.legacy_cms?.selectedCms?.title?.toLowerCase()
  );

  const { projectId = '' } = useParams();

  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleDirectSelection = async (cms: any) => {
    setSelectedCard(cms);
    updateNewMigrationData({
      ...newMigrationData?.legacy_cms,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedCms: cms
      }
    });

    
    if (!isEmptyString(cms?.title)) {
      props?.handleStepChange(props?.currentStep);
    }
  };

  //Handle CMS Filter Updation in local storage.
  const updateCMSFilters = (cmsFilter: IFilterStatusType) => {
    //Get Applied CMS Parent Filters
    const cmsParentFilter: string[] = cmsFilter
      ? Object.keys(cmsFilter)?.filter((key) => cmsFilter?.[key])
      : [];

    //Update state
    setCmsFilter(cmsParentFilter);
  };

  //Handle CMS Filter selection
  const applyCMSFilter = (cmsFilter: IFilterStatusType) => {
    setCmsFilterStatus(cmsFilter);
    updateCMSFilters(cmsFilter);
  };

  // Filter CMS Data
  const filterCMSData = async (searchText: string) => {
    const { all_cms = [] } = migrationData?.legacyCMSData || {};

    const apiRes: any = await getConfig(); // api call to get cms type from upload service

    const cms = apiRes?.data?.cmsType?.toLowerCase();

    const cmstype = !isEmptyString(cmsType) ? cmsType : cms; // Fetch the specific CMS type

    let filteredCmsData: ICMSType[] = [];
    if (isEmptyString(searchText) && !validateArray(cmsFilter) && !cmstype) {
      filteredCmsData = all_cms;
    } else {
      if (cmstype) {
        filteredCmsData = all_cms?.filter((cms: ICMSType) => cms?.cms_id === cmstype);
      }
    }

    setCmsData(filteredCmsData);

    //Normal Search
    const _filterCmsData = validateArray(all_cms)
      ? filteredCmsData?.filter(
          ({ title, cms_id }: ICMSType) =>
            //Filtering Criteria base on SearchText
            title?.toLowerCase()?.includes(searchText) ||
            cms_id?.toLowerCase()?.includes(searchText)
        )
      : [];

    setCmsData(_filterCmsData);

    const newSelectedCard = filteredCmsData?.some((cms) => cms?.cms_id === cmstype)
      ? filteredCmsData?.[0]
      : DEFAULT_CMS_TYPE;

    setSelectedCard(newSelectedCard);

    if (newSelectedCard) {
      setSelectedCard(newSelectedCard);

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedCms: newSelectedCard
        }
      };

      updateNewMigrationData(newMigrationDataObj);

      // API call for saving selected CMS, if a new card is selected
      // updateLegacyCMSData(selectedOrganisation?.value, projectId, {
      //   legacy_cms: newSelectedCard?.cms_id
      // });
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    filterCMSData(searchText);
  }, []);

  useEffect(() => {
    filterCMSData(searchText);
  }, [cmsFilter]);

  useEffect(() => {
    if (selectedCard?.title !== 'Drupal' && selectedCard?.title !== 'Sitecore') {
      handleDirectSelection(selectedCard);
    }
  }, [cmsType, selectedCard]);


  return (
    <div>
      {(cmsType === 'sitecore' || cmsType === 'drupal') && (
        <div className="row bg-white action-content-wrapper p-3">
          <div className="col-12">
            <div className="service_list_search">
              <Search
                className="service_list_search_bar"
                width="full"
                placeholder="Search for CMS"
                debounceSearch
                onClear
                version="v2"
                type="secondary"
                onChange={(text: string) => {
                  setSearchText(text?.toLowerCase());
                  filterCMSData(text?.toLowerCase());
                }}
              />
            </div>
            <Line type="solid" />
          </div>

          <div className="col-12">
            {cmsData && validateArray(cmsData) ? (
              <div className="service_list">
                {cmsData?.map((data: ICMSType) => (
                  <Card
                    key={data?.title}
                    data={data}
                    onCardClick={handleDirectSelection}
                    selectedCard={selectedCard}
                    idField="cms_id"
                  />
                ))}
              </div>
            ) : (
              <div className="action-search-not-found-container" style={{ maxHeight: '32rem' }}>
                <EmptyState
                  heading={<div className="empty_search_heading">No matching CMS found!</div>}
                  img={SEARCH_ICON}
                  description={
                    <div className="empty_search_description">
                      Try changing your search term to find what you are looking for.
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.title) && (
        <div className="col-12 bg-white p-3">
          <span className="summary-title">Please enter the correct CMS</span>
        </div>
      )}
    </div>
  );
};

export default LoadSelectCms;
