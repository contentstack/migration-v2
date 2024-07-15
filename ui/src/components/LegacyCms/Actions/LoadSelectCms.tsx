// Libraries
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

// Service
import { updateLegacyCMSData } from '../../../services/api/migration.service';
import { getConfig } from '../../../services/api/upload.service';

// Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';


// Interface
import { defaultCardType } from '../../../components/Common/Card/card.interface';
import { DEFAULT_CMS_TYPE, ICMSType, INewMigration } from '../../../context/app/app.interface';

// Components
import Card from '../../../components/Common/Card/card';
import { CircularLoader, EmptyState } from '@contentstack/venus-components';

// Style
import '../legacyCms.scss';

import { SEARCH_ICON } from '../../../common/assets';
import { IFilterStatusType } from '../../../components/Common/Modal/FilterModal/filterModal.interface';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadSelectCmsProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

/**
 * Component for loading and selecting CMS data.
 *
 * @component
 * @param {LoadSelectCmsProps} props - The component props.
 * @returns {JSX.Element} The rendered component.
 */
const LoadSelectCms = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);

  const dispatch = useDispatch();

  const [cmsData, setCmsData] = useState<ICMSType[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [cmsFilterStatus, setCmsFilterStatus] = useState<IFilterStatusType>({});
  const [cmsFilter, setCmsFilter] = useState<string[]>([]);
  const [cmsType, setCmsType] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms || defaultCardType
  );
  const [selectedCard, setSelectedCard] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false); 
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { projectId = '' } = useParams();
   
  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleCardClick = async(data: ICMSType) => {
 
    const isSingleMatch = cmsData.length === 1; 
    
    if (isSingleMatch || selectedCard?.cms_id !== data?.cms_id) {
      setSelectedCard({ ...data });

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData.legacy_cms,
          selectedCms: { ...data }
        }
      };

      dispatch(updateNewMigrationData(newMigrationDataObj));

      //API call for saving selected CMS
      //await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: data?.cms_id });
      
      // Call for Step Change 
      props?.handleStepChange(props?.currentStep);
    }
  };


  const handleDirectSelection = async (cms: any) => {
    setSelectedCard(cms); 

    dispatch(updateNewMigrationData({
      ...newMigrationData?.legacy_cms,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedCms: cms
      }
    }));

    const res = await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: cms});
    
    if (!isEmptyString(cms?.title)) {
      props?.handleStepChange(props?.currentStep, true);
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
    setSelectedCard(cmsType);
    setIsLoading(true);

    const apiRes: any = await getConfig(); // api call to get cms type from upload service

    const cms = apiRes?.data?.cmsType?.toLowerCase();

    
    if(isEmptyString(cmsType?.cms_id)){
      setCmsType(cms);
    }
    
    const cmstype = !isEmptyString(cmsType?.cms_id) ? cmsType?.parent : cms; // Fetch the specific CMS type

    let filteredCmsData = all_cms;
    if (cmstype) {
      filteredCmsData = all_cms.filter((cms: ICMSType) => cms?.parent?.toLowerCase() === cmstype?.toLowerCase());
    }
    const newMigrationDataObj = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedFileFormat: filteredCmsData[0].allowed_file_formats[0]
      }
    };

    dispatch(updateNewMigrationData(newMigrationDataObj));

    setCmsData(filteredCmsData)

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
    
    let newSelectedCard: ICMSType | undefined;
    
    if (filteredCmsData?.length === 1) {
      newSelectedCard = filteredCmsData[0];
    } else {
      newSelectedCard = DEFAULT_CMS_TYPE;
    }
    setIsLoading(false);
    
    if (!isEmptyString(newSelectedCard?.title)) {
      setSelectedCard(newSelectedCard);
      setErrorMessage('');
      setIsError(false);

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedCms: newSelectedCard
        }
      };
      await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: newSelectedCard?.cms_id });
      dispatch(updateNewMigrationData(newMigrationDataObj));
      props?.handleStepChange(props?.currentStep);
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
    <div>
      <div className="col-12">
          { isError &&
            <div className="empty_search_description">
                <EmptyState
                heading={<div className="empty_search_heading">No matching CMS found!</div>}
                img={SEARCH_ICON}
              />
              </div>
          }
           { isLoading ? (
              <div className='loader'>
                <CircularLoader/>
              </div>
             ) : 
            (cmsData && validateArray(cmsData) && (
            <div className="service_list_legacy">
              {cmsData?.map((data: ICMSType) => (
                <Card
                  key={data?.title}
                  data={data}
                  onCardClick={handleCardClick}
                  selectedCard={selectedCard}
                  idField="cms_id"
                />
              ))}
            </div>))
            } 
          
      </div>
    </div>
  );
};

export default LoadSelectCms;
