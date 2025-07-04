// Libraries
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Service
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
//import { IFilterStatusType } from '../../../components/Common/Modal/FilterModal/filterModal.interface';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadSelectCmsProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadSelectCms = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  //sconst selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);

  const dispatch = useDispatch();

  const [cmsData, setCmsData] = useState<ICMSType[]>([]);
  const [searchText] = useState<string>('');
  //const [cmsFilterStatus, setCmsFilterStatus] = useState<IFilterStatusType>({});
  const [cmsType, setCmsType] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms || defaultCardType
  );
  const [selectedCard, setSelectedCard] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms
  );
  //const [setErrorMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleCardClick = async (data: ICMSType) => {
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
  };

  // Filter CMS Data
  const filterCMSData = async (searchText: string) => {
    try {
      const { all_cms = [] } = migrationData?.legacyCMSData || {};
      setSelectedCard(cmsType);
      setIsLoading(true);

      const { data } = await getConfig(); // api call to get cms type from upload service

      const cms = data?.cmsType?.toLowerCase();

      if (isEmptyString(cmsType?.cms_id)) {
        setCmsType(cms);
      }

      const cmstype = !isEmptyString(cmsType?.cms_id) ? cmsType?.parent : cms; // Fetch the specific CMS type

      let filteredCmsData = all_cms;
      if (cmstype) {
        filteredCmsData = all_cms.filter(
          (cms: ICMSType) => cms?.parent?.toLowerCase() === cmstype?.toLowerCase()
        );
      }
      const newMigrationDataObj = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedFileFormat: filteredCmsData[0].allowed_file_formats[0]
        }
      };

      //dispatch(updateNewMigrationData(newMigrationDataObj));

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

      let newSelectedCard: ICMSType | undefined;

      if (filteredCmsData?.length === 1) {
        newSelectedCard = filteredCmsData[0];
      } else {
        newSelectedCard = DEFAULT_CMS_TYPE;
      }
      setIsLoading(false);

      if (!isEmptyString(newSelectedCard?.title)) {
        setSelectedCard(newSelectedCard);
        //setErrorMessage('');
        setIsError(false);

        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            selectedCms: newSelectedCard
          }
        };
        //await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: newSelectedCard?.cms_id });
        dispatch(updateNewMigrationData(newMigrationDataObj));
        props?.handleStepChange(props?.currentStep);
      }
    } catch (error) {
      return error;
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    filterCMSData(searchText);
  }, []);


  // Handle Legacy cms selection for single match
  // useEffect(() => {
  //   const isSingleMatch = cmsData?.length === 1;
  //   if (isSingleMatch) {
  //     setSelectedCard({ ...selectedCard });

  //     const newMigrationDataObj: INewMigration = {
  //       ...newMigrationData,
  //       legacy_cms: {
  //         ...newMigrationDataRef?.current?.legacy_cms,
  //         selectedCms: { ...selectedCard }
  //       }
  //     };
  //     console.info("neMigObj ---> ", newMigrationDataObj, cmsData)
  //     dispatch(updateNewMigrationData(newMigrationDataObj));

  //     // Call for Step Change
  //     props?.handleStepChange(props?.currentStep);
  //   }
  // }, [cmsData]);

  return (
    <div>
      <div className="col-12">
        {isError && (
          <div className="empty_search_description">
            <EmptyState
              heading={<div className="empty_search_heading">No matching CMS found!</div>}
              img={SEARCH_ICON}
            />
          </div>
        )}
        {isLoading ? (
          <div className="loader">
            <CircularLoader />
          </div>
        ) : (
          cmsData &&
          validateArray(cmsData) && (
            <div className="service_list_legacy">
              {cmsData?.map((data: ICMSType) => (
                <Card
                  key={data?.title}
                  data={data}
                  onCardClick={data?.cms_id !== selectedCard?.cms_id ? handleCardClick : undefined}
                  selectedCard={selectedCard}
                  idField="cms_id"
                  disabled={newMigrationData?.project_current_step > 1}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default LoadSelectCms;
