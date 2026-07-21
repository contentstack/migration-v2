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
import { CircularLoader } from '@contentstack/venus-components';

// Style
import '../legacyCms.scss';

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

  const [cmsType, setCmsType] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms || defaultCardType
  );
  const [selectedCard, setSelectedCard] = useState<ICMSType>(
    newMigrationData?.legacy_cms?.selectedCms
  );
  //const [setErrorMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /****  ALL METHODS HERE  ****/
  //Handle Legacy cms selection
  const handleCardClick = async (data: ICMSType) => {
    setSelectedCard({ ...data });

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData.legacy_cms,
        selectedCms: { ...data },
        // Update selectedFileFormat from the clicked CMS's allowed_file_formats (data-driven via legacyCms.json)
        selectedFileFormat: data?.allowed_file_formats?.[0] ?? newMigrationData?.legacy_cms?.selectedFileFormat,
        source_details: {
          ...(newMigrationData?.legacy_cms?.source_details || {
            source_mode: 'imported_export',
            source_region_id: '',
            source_org_id: '',
            source_stack_id: '',
            source_branch: '',
            imported_data_path: ''
          }),
          source_mode:
            data?.cms_id === 'contentstack' ? 'credentials' : 'imported_export'
        }
      }
    };
    dispatch(updateNewMigrationData(newMigrationDataObj));

    //API call for saving selected CMS
    //await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: data?.cms_id });

    // Call for Step Change
    props?.handleStepChange(props?.currentStep);
  };

  // Filter CMS Data
  const filterCMSData = async () => {
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
      // Check if cmstype is empty
      if (isEmptyString(cmstype)) {
        setIsError(true);
        setErrorMessage('No CMS found! Please add the correct CMS');
        setCmsData([]);
      } else {
        // cmstype is not empty, apply filter
        filteredCmsData = all_cms.filter(
          (cms: ICMSType) => cms?.parent?.toLowerCase() === cmstype?.toLowerCase()
        );
        setIsLoading(false);

        // Check if filter returned any results
        if (filteredCmsData?.length > 0) {
          // File-format compatibility is validated in LoadFileFormat, not here.
          setIsError(false);
          setErrorMessage('');
          setCmsData(filteredCmsData);
        } else {
          // cmstype is not empty but no matches found
          setIsError(true);
          setErrorMessage('Please add the correct CMS');
          setCmsData([]);
        }
      }


      // Determine which CMS to set as selected.
      // If a version is already selected (e.g. preserved across a restart / on revisit),
      // keep it instead of wiping it back to DEFAULT_CMS_TYPE. Only auto-pick when there's
      // a single matching version, and only fall back to default when nothing is selected.
      let finalSelectedCard: ICMSType | undefined;
      const existingSelectedCms = newMigrationData?.legacy_cms?.selectedCms;
      const existingStillValid =
        !isEmptyString(existingSelectedCms?.cms_id) &&
        filteredCmsData?.some(
          (cms: ICMSType) => cms?.cms_id === existingSelectedCms?.cms_id
        );

      if (existingStillValid) {
        finalSelectedCard = existingSelectedCms;
      } else if (filteredCmsData?.length === 1) {
        finalSelectedCard = filteredCmsData[0];
      } else {
        finalSelectedCard = DEFAULT_CMS_TYPE;
      }
      
      // Merge config data with existing Redux file_details, preserving
      // non-empty existing values when config returns empty/undefined.
      const existingFileDetails = newMigrationData?.legacy_cms?.uploadedFile?.file_details;
      const newMigrationDataObj = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedCms: finalSelectedCard, // Include selectedCms in this dispatch
          // Keep the file format in sync with the resolved CMS: only preserve the existing
          // format when the existing version is being preserved; otherwise derive it from
          // the resolved card so we never end up with DEFAULT_CMS_TYPE + a stale format.
          selectedFileFormat: existingStillValid
            ? newMigrationData?.legacy_cms?.selectedFileFormat
            : finalSelectedCard?.allowed_file_formats?.[0],
          source_details: {
            ...(newMigrationData?.legacy_cms?.source_details || {
              source_mode: 'imported_export',
              source_region_id: '',
              source_org_id: '',
              source_stack_id: '',
              source_branch: '',
              imported_data_path: ''
            }),
            source_mode:
              finalSelectedCard?.cms_id === 'contentstack'
                ? 'credentials'
                : 'imported_export'
          },
          affix: newMigrationData?.legacy_cms?.affix || 'cs', // Preserve or set default affix
          uploadedFile: {
            ...newMigrationData?.legacy_cms?.uploadedFile,
            file_details: {
              ...existingFileDetails,
              mysql: data?.mysql || existingFileDetails?.mysql,
              assetsConfig: data?.assetsConfig || existingFileDetails?.assetsConfig,
              cmsType: data?.cmsType || existingFileDetails?.cmsType,
              localPath: data?.localPath || existingFileDetails?.localPath,
              awsData: data?.awsData || existingFileDetails?.awsData
            }
          }
        }
      };
      
      dispatch(updateNewMigrationData(newMigrationDataObj)); // Dispatch to save config to Redux
      
      setIsLoading(false);

      if (!isEmptyString(finalSelectedCard?.title)) {
        setSelectedCard(finalSelectedCard);
        //setErrorMessage('');
        setIsError(false);

        // The dispatch already happened above with all the data including selectedCms
        // No need to dispatch again here
        
        //await updateLegacyCMSData(selectedOrganisation.value, projectId, { legacy_cms: finalSelectedCard?.cms_id });
        props?.handleStepChange(props?.currentStep);
      }
    } catch (error) {
      return error;
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    filterCMSData();
  }, []);

  return (
    <div>
      <div className="col-12">
      {isError && (
          <div className="px-3 py-1 fs-6 errorMessage">{errorMessage}</div>
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
                  disabled={newMigrationData?.project_current_step > 1 || isError}
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
