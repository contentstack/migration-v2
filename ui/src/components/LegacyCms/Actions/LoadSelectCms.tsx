// Libraries
import { useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

// Service
import { updateLegacyCMSData } from '../../../services/api/migration.service';
import { fileValidation } from '../../../services/api/upload.service';

// Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';

// Context
import { AppContext } from '../../../context/app/app.context';

// Interface
import { defaultCardType } from '../../../components/Common/Card/card.interface';
import { ICMSType, INewMigration } from '../../../context/app/app.interface';

// Components
import Card from '../../../components/Common/Card/card';
import { EmptyState, Line, Search } from '@contentstack/venus-components';
import { FilterModal } from '../../../components/Common/Modal/FilterModal/FilterModal';

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

  const { projectId = '' } = useParams();

  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleCardClick = (data: ICMSType) => {
    if (selectedCard?.cms_id !== data?.cms_id) {
      setSelectedCard((prevState) => ({ ...data }));

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData.legacy_cms,
          selectedCms: { ...data }
        }
      };

      updateNewMigrationData(newMigrationDataObj);
    }
    //API call for saving selected CMS
    updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: data?.cms_id });

    //call for Step Change
    props.handleStepChange(props.currentStep);
  };

  //Handle CMS Filter Updation in local storage.
  const updateCMSFilters = (cmsFilter: IFilterStatusType) => {
    //Get Applied CMS Parent Filters
    const cmsParentFilter: string[] = cmsFilter
      ? Object.keys(cmsFilter).filter((key) => cmsFilter[key])
      : [];

    //Update state
    setCmsFilter(cmsParentFilter);
  };

  //Handle CMS Filter selection
  const applyCMSFilter = (cmsFilter: IFilterStatusType) => {
    setCmsFilterStatus(cmsFilter);
    updateCMSFilters(cmsFilter);
  };

  const getCmsType = async () => {
    const res: any = await fileValidation();
    const cmsType = res?.data?.file_details?.cmsType;
    return cmsType;
  };
  // Filter CMS Data
  const filterCMSData = async (searchText: string) => {
    const { all_cms = [] } = migrationData?.legacyCMSData || {};
    const cmsType = await getCmsType(); // Fetch the specific CMS type

    let filteredCmsData: ICMSType[] = [];
    if (isEmptyString(searchText) && !validateArray(cmsFilter) && !cmsType) {
      filteredCmsData = all_cms;
    } else {
      if (cmsType) {
        filteredCmsData = all_cms?.filter((cms: ICMSType) => cms?.cms_id === cmsType);
      }

      if (validateArray(cmsFilter) || !isEmptyString(searchText)) {
        const searchTextLower = searchText?.toLowerCase();
        filteredCmsData = all_cms
          .filter(({ parent }: ICMSType) => !cmsFilter?.length || cmsFilter?.includes(parent))
          .filter(
            ({ title, cms_id }: ICMSType) =>
              title?.toLowerCase()?.includes(searchTextLower) ||
              cms_id?.toLowerCase()?.includes(searchTextLower)
          );
      }
    }

    setCmsData(filteredCmsData); // Set filtered CMS data

    // Determine if a new card should be selected
    const newSelectedCard =
      filteredCmsData?.find((cms) => cms?.cms_id === selectedCard?.cms_id) ||
      filteredCmsData[0] ||
      null;

    if (newSelectedCard?.cms_id !== selectedCard?.cms_id) {
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
      if (newSelectedCard) {
        updateLegacyCMSData(selectedOrganisation?.value, projectId, {
          legacy_cms: newSelectedCard?.cms_id
        });
      }
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    filterCMSData(searchText);
  }, []);

  useEffect(() => {
    filterCMSData(searchText);
  }, [cmsFilter]);

  return (
    <div className="row bg-white action-content-wrapper p-3">
      {/* <div className="col-12">
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
              setSearchText(text.toLowerCase());
              filterCMSData(text.toLowerCase());
            }}
          />

          <div className="service_list_search_button">
            <FilterModal
              title="CMS"
              list={migrationData?.legacyCMSData?.cmsFilterList}
              status={cmsFilterStatus}
              applyFilter={applyCMSFilter}
              isMulti={true}
              canSearch={true}
              searchPlaceholder="Search CMS"
              iconSize="small"
            />
          </div>
        </div>
        <Line type="solid" />
      </div> */}
      <div className="col-12">
        {cmsData && validateArray(cmsData) ? (
          <div className="service_list">
            {cmsData?.map((data: ICMSType) => (
              <Card
                key={data?.title}
                data={data}
                onCardClick={handleCardClick}
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
  );
};

export default LoadSelectCms;
