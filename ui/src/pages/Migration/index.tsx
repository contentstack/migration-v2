// Libraries
import { useEffect, useState, useRef, useMemo } from 'react';
import { Params, useNavigate, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { cbModal, Notification } from '@contentstack/venus-components';

// Redux files
import { RootState, store } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Services
import {
  getMigrationData,
  updateCurrentStepData,
  updateLegacyCMSData,
  updateDestinationStack,
  updateAffixData,
  fileformatConfirmation,
  updateFileFormatData,
  updateSourceConfigData,
  affixConfirmation,
  updateStackDetails,
  getExistingContentTypes,
  getExistingGlobalFields,
  startMigration,
  updateMigrationKey,
  updateLocaleMapper,
  restartMigration,
  persistAuditSummary
} from '../../services/api/migration.service';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES, CS_URL } from '../../utilities/constants';
import { isEmptyString, validateArray } from '../../utilities/functions';
import useBlockNavigation from '../../hooks/userNavigation';

// Interface
import { defaultMigrationResponse, MigrationResponse } from '../../services/api/service.interface';
import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../components/Stepper/FlowStepper/flowStep.interface';
import {
  IDropDown,
  INewMigration,
  ICMSType,
  ILegacyCMSComponent,
  DEFAULT_CMS_TYPE,
  TestStacks,
  FileDetails
} from '../../context/app/app.interface';
import { ContentTypeSaveHandles } from '../../components/ContentMapper/contentMapper.interface';
import { ICardType } from '../../components/Common/Card/card.interface';
import { ModalObj } from '../../components/Modal/modal.interface';

// Components
import MigrationFlowHeader from '../../components/MigrationFlowHeader';
import HorizontalStepper from '../../components/Stepper/HorizontalStepper/HorizontalStepper';
import LegacyCms from '../../components/LegacyCms';
import DestinationStackComponent from '../../components/DestinationStack';
import ContentMapper from '../../components/ContentMapper';
import AuditReport from '../../components/AuditReport';
import TestMigration from '../../components/TestMigration';
import MigrationExecution from '../../components/MigrationExecution';
import SaveChangesModal from '../../components/Common/SaveChangesModal';
import { getMigratedStacks } from '../../services/api/project.service';
import { getConfig } from '../../services/api/upload.service';
import { useWarnOnRefresh } from '../../hooks/useWarnOnrefresh';

type StepperComponentRef = {
  handleStepChange: (step: number) => void;
};
type LegacyCmsRef = {
  getInternalActiveStepIndex: () => number;
};
type LocalesType = {
  [key: string]: string;
}

/**
 * Migration component to handle the migration process
 * It includes steps like selecting legacy CMS, configuring destination stack,
 * mapping content fields, running test migration, and executing final migration.
 */
const Migration = () => {
  const params: Params<string> = useParams();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stepperRef = useRef<StepperComponentRef>(null);
  const legacyCMSRef = useRef<LegacyCmsRef>(null);
  const isMountedRef = useRef(true);

  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const organisationsList = useSelector(
    (state: RootState) => state?.authentication?.organisationsList
  );
  const [projectData, setProjectData] = useState<MigrationResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isProjectMapper, setIsProjectMapper] = useState<boolean>(true);

  const [disableMigration, setDisableMigration] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const saveRef = useRef<ContentTypeSaveHandles>(null);
  const newMigrationDataRef = useRef(newMigrationData);

  useEffect(() => {
    fetchData();
  }, [params?.stepId, params?.projectId, selectedOrganisation?.value]);

  useWarnOnRefresh(isSaved);
  /**
 * Dispatches the isprojectMapped key to redux
 */
  // useEffect(()=> {
  //   dispatch(updateNewMigrationData({
  //     ...newMigrationDataRef?.current,
  //     isprojectMapped: isProjectMapper
      
  //   }));
    
  // },[isProjectMapper]);


  useBlockNavigation(isModalOpen);

  useEffect (()=>{
    const hasNonEmptyMapping =
    newMigrationData?.destination_stack?.localeMapping &&
    Object.entries(newMigrationData?.destination_stack?.localeMapping || {})?.every(
      ([label, value]: [string, string]) =>
        Boolean(label?.trim()) &&
        value !== '' &&
        value !== null &&
        value !== undefined && 
        label !== 'undefined'
    );
    if(legacyCMSRef?.current && newMigrationData?.project_current_step === 1 && legacyCMSRef?.current?.getInternalActiveStepIndex() > -1){
      setIsSaved(true);    
    }
    else if ((isCompleted && !isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value) && newMigrationData?.project_current_step === 2)){
     setIsSaved(true);
    }
    else if(newMigrationData?.content_mapping?.isDropDownChanged){
      setIsSaved(true);
    }
    else{
      setIsSaved(false);
    }
  }, [isCompleted, newMigrationData])

  /**
   * Function to get exisiting content types list
   */
  const fetchExistingContentTypes = async () => {
    try {
      const { data, status } = await getExistingContentTypes(projectId);
      if (status === 201) {
        return data?.contentTypes;
      }
    } catch (error) {
      // return error;
      console.error(error);
    }
  };

  /**
   * Function to get exisiting global fields list
   */
  const fetchExistingGlobalFields = async () => {
    try {
      const { data, status } = await getExistingGlobalFields(projectId);

      if (status === 201) {
        return data?.globalFields;
      }
    } catch (error) {
      // return error;
      console.error(error);
    }
  };

  /**
   * Fetch the CMS data
   */
  const fetchData = async () => {
    setIsLoading(true);

    //gets Data from CMS file.
    const data = await getCMSDataFromFile(CS_ENTRIES.MIGRATION_FLOW);

    //Uncomment this line to get data CMS stack.
    //const data = await getEntries({ contentType: CS_ENTRIES.MIGRATION_FLOW })

    if (!data) {
      setIsLoading(false);
      return;
    }

    //get Flow Steps and update it in APP Context
    const currentFlowStep = validateArray(data?.all_steps)
      ? data?.all_steps?.find((step: IFlowStep) => `${step.name}` === params?.stepId)
      : DEFAULT_IFLOWSTEP;

    dispatch(
      updateMigrationData({
        allFlowSteps: data?.all_steps,
        currentFlowStep: currentFlowStep,
        migration_steps_heading: data?.migration_steps_heading,
        settings: data?.settings
      })
    );

    await fetchProjectData();
    const stepIndex = data?.all_steps?.findIndex(
      (step: IFlowStep) => `${step?.name}` === params?.stepId
    );
    setCurrentStepIndex(stepIndex !== -1 ? stepIndex : 0);
  };

  const getFileExtension = (filePath: string): string => {
    const normalizedPath = filePath?.replace(/\\/g, "/")?.replace(/\/$/, "");

    // Use regex to extract the file extension
    const match = normalizedPath?.match(/\.([a-zA-Z0-9]+)$/);
    
    // Check if it has a file extension (dot followed by 1-5 alphanumeric characters at the end)
    const isDirectory = !/\.[a-zA-Z0-9]{1,5}$/.test(normalizedPath);
    
    const ext = match ? match?.[1]?.toLowerCase() : isDirectory ? "directory" : "";

    // const fileName = filePath?.split('/')?.pop();
    //const ext = fileName?.split('.')?.pop();
    const validExtensionRegex = /\.(pdf|zip|xml|json|directory|sql)$/i;
    return ext && validExtensionRegex?.test(`.${ext}`) ? `${ext}` : '';
  };
 
  // funcrion to form file format object from config response
  const fetchFileFormat = (data: FileDetails) => {
    const filePath = data?.localPath?.toLowerCase();
    const fileFormat =  getFileExtension(filePath ?? '');
    const selectedFileFormatObj = {
      description: "",
      fileformat_id: fileFormat,
      group_name: fileFormat,
      isactive: true,
      title: fileFormat === 'zip' ? fileFormat?.charAt(0)?.toUpperCase() + fileFormat?.slice(1) : fileFormat?.toUpperCase()
    }
    return selectedFileFormatObj;
  }

// funcrion to form upload object from config response
  const getFileInfo = (data: FileDetails) => {
    const newMigrationDataObj = {
        ...newMigrationData?.legacy_cms?.uploadedFile,
          name: data?.localPath,
          url: data?.localPath,
          isValidated: false,
          file_details: {
            isLocalPath: data?.isLocalPath,
            cmsType: data?.cmsType,
            localPath: data?.localPath,
            awsData: {
              awsRegion: data?.awsData?.awsRegion,
              bucketName: data?.awsData?.bucketName,
              bucketKey: data?.awsData?.bucketKey
            },
            mysql: {
              host: data?.mysql?.host,
              user: data?.mysql?.user,
              database: data?.mysql?.database,
              port: data?.mysql?.port
            },
            assetsConfig: {
              base_url: data?.assetsConfig?.base_url,
              public_path: data?.assetsConfig?.public_path
            }
          },
          cmsType: data?.cmsType  
    };
    return newMigrationDataObj;
  }

  /**
   * Fetch the project data
   */
  const fetchProjectData = async () => {
    if (isEmptyString(selectedOrganisation?.value) || isEmptyString(params?.projectId)) return;
    setIsProjectMapper(true);
    try {
      const migrationData = await getMigrationData(
        selectedOrganisation?.value,
        params?.projectId ?? ''
      );
      const migratedstacks = await getMigratedStacks(selectedOrganisation?.value, projectId);
      const configResponse = await getConfig();
      const data = configResponse?.data || ({} as FileDetails);
      const fileFormat = fetchFileFormat(data);
      const uploadObj = getFileInfo(data);

      if (migrationData) {
        setIsLoading(false);
        setProjectData(migrationData?.data);
      }
      const projectData = migrationData?.data;
      if (!projectData) {
        setIsProjectMapper(false);
        return;
      }

      const legacyCmsData: ILegacyCMSComponent = await getCMSDataFromFile(CS_ENTRIES.LEGACY_CMS);

      // Config's cmsType is the source of truth (may differ from stored project CMS if config changed)
      const configCmsType = data?.cmsType?.toLowerCase();

      // Look up stored CMS from project data
      const storedCmsData: ICMSType | undefined = validateArray(legacyCmsData?.all_cms)
        ? legacyCmsData?.all_cms?.find(
            (cms: ICMSType) => cms?.cms_id === projectData?.legacy_cms?.cms
          )
        : undefined;

      // Look up CMS by config's cmsType (same parent-matching logic as LoadSelectCms.filterCMSData)
      const configCmsData: ICMSType | undefined = (configCmsType && validateArray(legacyCmsData?.all_cms))
        ? legacyCmsData?.all_cms?.find(
            (cms: ICMSType) => cms?.parent?.toLowerCase() === configCmsType
          )
        : undefined;

      // Use stored CMS if its parent matches config's cmsType (preserves specific version like "Sitecore v9").
      // Otherwise, config takes precedence (CMS type was changed in config).
      const selectedCmsData: ICMSType =
        (storedCmsData && storedCmsData?.parent?.toLowerCase() === configCmsType)
          ? storedCmsData
          : (configCmsData ?? storedCmsData ?? DEFAULT_CMS_TYPE);

      const selectedFileFormatData: ICardType | undefined = validateArray(
        selectedCmsData?.allowed_file_formats
      )
        ? (selectedCmsData.allowed_file_formats?.find(
            (cms: ICardType) => cms?.fileformat_id === projectData?.legacy_cms?.file_format
          ) ?? selectedCmsData.allowed_file_formats?.[0])  // Fall back to CMS's first allowed format
        : fileFormat;

      const selectedOrganisationData = validateArray(organisationsList)
        ? organisationsList?.find((org: IDropDown) => org?.value === projectData?.org_id)
        : selectedOrganisation;

      const selectedStackData: IDropDown = {
        label: projectData?.stackDetails?.label,
        value: projectData?.stackDetails?.value,
        master_locale: projectData?.stackDetails?.master_locale,
        created_at: projectData?.stackDetails?.created_at,
        locales: [],
        isNewStack: projectData?.stackDetails?.isNewStack
      };

      const existingContentTypes = await fetchExistingContentTypes();
      const existingGlobalFields = await fetchExistingGlobalFields();

      const stackLink = `${CS_URL[projectData?.region]}/stack/${
        projectData?.current_test_stack_id
      }/dashboard`;
      const stackName = projectData?.test_stacks?.find(
        (stack: TestStacks) => stack?.stackUid === projectData?.current_test_stack_id
      )?.stackName;

      const masterLocaleEntries = projectData?.master_locale
        ? Object?.entries(projectData?.master_locale).map(([key, value]) => [
            `${key}-master_locale`,
            value
          ])
        : [];

      const locales = {
        ...Object?.fromEntries(masterLocaleEntries),
        ...projectData?.locales
      };

      const projectMapper = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedCms: selectedCmsData,
        selectedFileFormat: selectedFileFormatData,
        affix:  projectData?.legacy_cms?.affix ,
        source_details: {
          source_mode:
            projectData?.legacy_cms?.source_details?.source_mode ||
            newMigrationDataRef?.current?.legacy_cms?.source_details?.source_mode ||
            'imported_export',
          source_region_id:
            projectData?.legacy_cms?.source_details?.source_region_id || '',
          source_org_id:
            projectData?.legacy_cms?.source_details?.source_org_id || '',
          source_stack_id:
            projectData?.legacy_cms?.source_details?.source_stack_id || '',
          source_branch:
            projectData?.legacy_cms?.source_details?.source_branch || '',
          imported_data_path:
            projectData?.legacy_cms?.source_details?.imported_data_path || ''
        },
        audit: projectData?.legacy_cms?.audit || newMigrationDataRef?.current?.legacy_cms?.audit,
        uploadedFile: projectData?.legacy_cms?.is_fileValid ? {
          ...newMigrationDataRef?.current?.legacy_cms?.uploadedFile,
          file_details: {
            localPath: projectData?.legacy_cms?.file_path,
            awsData: {
              awsRegion: projectData?.legacy_cms?.awsDetails?.awsRegion,
              bucketName: projectData?.legacy_cms?.awsDetails?.bucketName,
              bucketKey: projectData?.legacy_cms?.awsDetails?.bucketKey
            },
            isLocalPath: projectData?.legacy_cms?.is_localPath,
            mysql: {
              host: projectData?.legacy_cms?.mySQLDetails?.host,
              user: projectData?.legacy_cms?.mySQLDetails?.user,
              database: projectData?.legacy_cms?.mySQLDetails?.database,
              port: projectData?.legacy_cms?.mySQLDetails?.port
            },
            assetsConfig: {
              base_url: projectData?.legacy_cms?.assetsConfig?.base_url,
              public_path: projectData?.legacy_cms?.assetsConfig?.public_path
            }
          },
          isValidated: projectData?.legacy_cms?.is_fileValid,
          reValidate: newMigrationData?.legacy_cms?.uploadedFile?.reValidate,
          buttonClicked: newMigrationData?.legacy_cms?.uploadedFile?.buttonClicked ? true : false,
        } : {
          // uploadObj (from getFileInfo) already merges existing Redux uploadedFile with config.
          // For file_details, prefer non-empty config values, fall back to existing Redux values.
          ...uploadObj,
          file_details: {
            ...newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details,
            isLocalPath: uploadObj?.file_details?.isLocalPath ?? newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.isLocalPath,
            cmsType: uploadObj?.file_details?.cmsType || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.cmsType,
            localPath: uploadObj?.file_details?.localPath || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.localPath,
            awsData: {
              awsRegion: uploadObj?.file_details?.awsData?.awsRegion || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.awsData?.awsRegion,
              bucketName: uploadObj?.file_details?.awsData?.bucketName || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketName,
              bucketKey: uploadObj?.file_details?.awsData?.bucketKey || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketKey,
            },
            mysql: {
              host: uploadObj?.file_details?.mysql?.host || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.mysql?.host,
              user: uploadObj?.file_details?.mysql?.user || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.mysql?.user,
              database: uploadObj?.file_details?.mysql?.database || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.mysql?.database,
              port: uploadObj?.file_details?.mysql?.port || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.mysql?.port,
            },
            assetsConfig: {
              base_url: uploadObj?.file_details?.assetsConfig?.base_url || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.assetsConfig?.base_url,
              public_path: uploadObj?.file_details?.assetsConfig?.public_path || newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details?.assetsConfig?.public_path,
            } 
          }
        },
        isFileFormatCheckboxChecked: true,
        isRestictedKeywordCheckboxChecked: true,
        projectStatus: projectData?.status,
        currentStep: -1
      },
      destination_stack: {
        ...newMigrationData?.destination_stack,
        selectedOrg: selectedOrganisationData,
        selectedStack: selectedStackData,
        stackArray: [],
        migratedStacks: migratedstacks?.data?.destinationStacks,
        sourceLocale: projectData?.source_locales,
        localeMapping: locales,
        csLocale: newMigrationDataRef?.current?.destination_stack?.csLocale
      },
      content_mapping: {
        isDropDownChanged: false,
        content_type_mapping: projectData?.mapperKeys,
        existingCT: existingContentTypes,
        existingGlobal: existingGlobalFields
      },
      test_migration: {
        stack_link: stackLink,
        stack_api_key: projectData?.current_test_stack_id,
        isMigrationStarted: newMigrationData?.test_migration?.isMigrationStarted || false,
        isMigrationComplete: newMigrationData?.test_migration?.isMigrationStarted || false,
        stack_name: stackName
      },
      migration_execution: {
        migrationStarted: projectData?.isMigrationStarted,
        migrationCompleted: projectData?.isMigrationCompleted
      },
      stackDetails: projectData?.stackDetails,
      testStacks: projectData?.test_stacks,
      isprojectMapped: false,
      project_current_step: projectData?.current_step,
      isContentMapperGenerated: projectData?.content_mapper?.length > 0,
      iteration: projectData?.iteration ?? 1,
    };

      dispatch(updateNewMigrationData(projectMapper));
    } catch (error) {
      console.error('Error while fetching project/config data:', error);
      Notification({
        notificationContent: {
          text: 'Upload service is unavailable (config fetch failed). Please start upload-api on port 4002.'
        },
        type: 'error'
      });
    } finally {
      setIsLoading(false);
      setIsProjectMapper(false);
    }
  };

  /**
   * Create Stepper and call the steps components
   */
  const createStepper = (
    projectData: MigrationResponse,
    handleStepChange: (currentStep: number) => void
  ) => {
    const isContentstackSource = newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';
    
    const steps = [
      {
        data: (
          <LegacyCms
            ref={legacyCMSRef}
            legacyCMSData={projectData?.legacy_cms}
            isCompleted={isCompleted}
            handleOnAllStepsComplete={handleOnAllStepsComplete}
          />
        ),
        id: '1',
        title: 'Select Legacy CMS'
      },
      {
        data: (
          <DestinationStackComponent
            projectData={projectData}
            isCompleted={isCompleted}
            handleOnAllStepsComplete={handleOnAllStepsComplete}
          />
        ),
        id: '2',
        title: 'Configure Destination Stack'
      }
    ];

    // Only add Audit Report step for Contentstack CMS
    if (isContentstackSource) {
      steps.push({
        data: <AuditReport />,
        id: '3',
        title: 'Audit Report'
      });
    }

    // Add remaining steps with appropriate IDs
    const nextId = isContentstackSource ? '4' : '3';
    const testId = isContentstackSource ? '5' : '4';
    const migrationId = isContentstackSource ? '6' : '5';

    steps.push(
      {
        data: <ContentMapper ref={saveRef} handleStepChange={handleStepChange} />,
        id: nextId,
        title: 'Map Content Fields'
      },
      {
        data: <TestMigration />,
        id: testId,
        title: 'Run Test Migration'
      },
      {
        data: <MigrationExecution handleStepChange={handleStepChange} />,
        id: migrationId,
        title: 'Execute Migration'
      }
    );

    return steps;
  };

  /**
   * Fetch the project data
   */
  const handleClick = () => {
    // Call handleStepChange function
    const x: string | undefined = params.stepId;
    const currentStep: number = parseInt(x ?? '');
    stepperRef?.current?.handleStepChange(currentStep - 1);
  };

  /**
   * Changes the step
   */
  const handleStepChange = (currentStep: number) => {
    if (stepperRef?.current) {
      stepperRef.current.handleStepChange(currentStep - 1);
    }
  };

  /**
   * Set the flag is step is completed
   */
  const handleOnAllStepsComplete = (flag = false) => {
    setIsCompleted(flag);
  };

  /**
   * Calls when click Continue button on Legacy CMS step and handles to proceed to destination stack
   */
  const handleOnClickLegacyCms = async (event: MouseEvent) => {
    setIsLoading(true);

    if (isCompleted) {
      event.preventDefault();

      //Update Data in backend
      const cmsUpdateData = {
        legacy_cms: newMigrationData?.legacy_cms?.selectedCms?.cms_id
      };
      await updateLegacyCMSData(selectedOrganisation?.value, projectId, cmsUpdateData);

      const affixData = {
        affix: newMigrationData?.legacy_cms?.affix
      };
      await updateAffixData(selectedOrganisation?.value, projectId, affixData);

      await fileformatConfirmation(selectedOrganisation?.value, projectId, {
        fileformat_confirmation: true
      });

      await affixConfirmation(selectedOrganisation?.value, projectId, {
        affix_confirmation: true
      });

      const fileFormatData = {
        file_format:
          newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toString() || 
          newMigrationData?.legacy_cms?.selectedCms?.allowed_file_formats[0]?.fileformat_id?.toString(),
        file_path: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath,
        is_fileValid: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
        is_localPath: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isLocalPath,
        source_details: {
          ...newMigrationData?.legacy_cms?.source_details,
          source_branch:
            newMigrationData?.legacy_cms?.source_details?.source_branch || 'main'
        },
        awsDetails: {
          awsRegion: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.awsRegion,
          bucketName: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketName,
          bucketKey: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketKey
        }
      };
      try {
        await updateSourceConfigData(selectedOrganisation?.value, projectId, {
          source_details: fileFormatData.source_details
        });
        await updateFileFormatData(selectedOrganisation?.value, projectId, fileFormatData);
      } catch (error: any) {
        console.error('Error details:', error?.response?.data);
        setIsLoading(false);
        if (isMountedRef.current) {
          Notification({
            notificationContent: { text: error?.response?.data?.message || 'Failed to update file format' },
            type: 'error'
          });
        }
        return; // Stop execution if file format update fails
      }

      const res = await updateCurrentStepData(selectedOrganisation.value, projectId);

      if (res?.status === 200) {
        setIsLoading(false);
        // Check if stack is already selected
        if (newMigrationData?.destination_stack?.selectedStack?.value) {
          const url = `/projects/${projectId}/migration/steps/3`;

          await updateCurrentStepData(selectedOrganisation?.value, projectId);

          handleStepChange(2);
          navigate(url, { replace: true });
        } else {
          const url = `/projects/${projectId}/migration/steps/2`;
          await updateCurrentStepData(selectedOrganisation?.value, projectId);

          handleStepChange(1);
          navigate(url, { replace: true });
        }
      } else {
        setIsLoading(false);
        // Only show notification if component is still mounted
        if (isMountedRef.current) {
          Notification({
            notificationContent: { text: res?.data?.error?.message },
            type: 'error'
          });
        }
      }
    } else {
      setIsLoading(false);

      if (legacyCMSRef?.current) {
        const currentIndex = legacyCMSRef?.current?.getInternalActiveStepIndex() + 1;
        let result;
        switch (currentIndex) {
          case 0:
            result = 'CMS';
            break;
          case 1:
            result = 'Enter Affix';
            break;
          case 2:
            result = 'Imported File';
            break;
        }
        if (currentIndex !== 3) {
          Notification({
            notificationContent: {
              text:
                result === undefined
                  ? `Something went wrong. Please refresh the page.`
                  : `Please complete ${result} step`
            },
            type: 'warning'
          });
        }
      }
    }
  };

  /**
   * Calls when click Save and Continue button on Destination Stack step and handles to proceed to content mapping
   */
  const handleOnClickDestinationStack = async (event: MouseEvent) => {
    setIsLoading(true);

    const hasNonEmptyMapping =
      newMigrationData?.destination_stack?.localeMapping &&
      Object.entries(newMigrationData?.destination_stack?.localeMapping || {})?.every(
        ([label, value]: [string, string]) => {
          const isValid = Boolean(label?.trim()) &&
            value !== '' &&
            value !== null &&
            value !== undefined && 
            label !== 'undefined';
          
          return isValid;
        }
      );

    const master_locale: LocalesType = {};
    const locales: LocalesType = {};
    Object.entries(newMigrationData?.destination_stack?.localeMapping)?.forEach(([key, value]) => {
      if (key?.includes('master_locale')) {
        master_locale[key?.replace('-master_locale', '')] = value;
      } else {
        locales[key] = value;
      }
    });
    if (
      isCompleted &&
      !isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value) &&
      hasNonEmptyMapping
    ) {
      event?.preventDefault();
      //Update Data in backend
      await updateDestinationStack(selectedOrganisation?.value, projectId, {
        stack_api_key: newMigrationData?.destination_stack?.selectedStack?.value
      });

      await updateStackDetails(selectedOrganisation?.value, projectId, {
        label: newMigrationData?.destination_stack?.selectedStack?.label,
        value: newMigrationData?.destination_stack?.selectedStack?.value,
        master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale,
        created_at: newMigrationData?.destination_stack?.selectedStack?.created_at,
        isNewStack: newMigrationData?.destination_stack?.selectedStack?.isNewStack
      });
      await updateLocaleMapper(projectId, { master_locale: master_locale, locales: locales });
      const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
      if (res?.status === 200) {
        handleStepChange(2);
        setIsLoading(false);
        const url = `/projects/${projectId}/migration/steps/3`;
        navigate(url, { replace: true });
      } else {
        setIsLoading(false);
        Notification({
          notificationContent: { text: res?.data?.error?.message },
          type: 'error'
        });
      }
    } else if (!isCompleted) {
      setIsLoading(false);
      Notification({
        notificationContent: { text: 'Please select a stack to proceed further' },
        type: 'warning'
      });
    } else if (!hasNonEmptyMapping) {
      setIsLoading(false);
      Notification({
        notificationContent: { text: 'Please complete the language mapping to proceed futher' },
        type: 'warning'
      });
    }
  };

  const handleOnClickAuditReport = async () => {
    const auditSummary = (newMigrationData as any)?.legacy_cms?.audit?.summary;
    if (!auditSummary) {
      Notification({
        notificationContent: {
          text: 'Please generate the audit report before proceeding.'
        },
        type: 'warning'
      });
      return;
    }
    setIsLoading(true);
    try {
      if (selectedOrganisation?.value) {
        const persistRes = await persistAuditSummary(
          selectedOrganisation.value,
          projectId,
          auditSummary
        );
        if (persistRes?.status !== 200) {
          if (isMountedRef.current) {
            Notification({
              notificationContent: {
                text:
                  persistRes?.data?.message ||
                  'Could not save audit summary to the project. Check your connection and try again.'
              },
              type: 'error'
            });
          }
          return;
        }
      }

      const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
      if (res?.status !== 200) {
        if (isMountedRef.current) {
          Notification({
            notificationContent: {
              text:
                res?.data?.message ||
                res?.data?.error?.message ||
                'Could not advance to content mapping. Ensure the audit is saved on the project.'
            },
            type: 'error'
          });
        }
        return;
      }
      const project = res?.data as MigrationResponse | undefined;
      const nm = store.getState()?.migration?.newMigrationData;
      if (project && nm) {
        dispatch(
          updateNewMigrationData({
            ...nm,
            project_current_step: project.current_step,
            legacy_cms: {
              ...nm.legacy_cms,
              projectStatus: project.status
            }
          })
        );
      }
      handleStepChange(3);
      const url = `/projects/${projectId}/migration/steps/4`;
      navigate(url, { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calls when click Continue button on Content Mapper step and handles to proceed to Test Migration
   */
  const handleOnClickContentMapper = async (event: MouseEvent) => {
    // The auto-mapped content mapper persist hook was part of the
    // AutoMappedMergeConfirmModal feature that was reverted on dev. Keep this
    // as a no-op so the navigation path still resolves; if/when the modal
    // returns, wire it back to saveRef?.current?.handleUpdateAutoMappedContentMapping.
    const persistAutoMappedContentMapper = async (): Promise<boolean> => true;

    if (newMigrationData?.content_mapping?.isDropDownChanged) {
      setIsModalOpen(true);

      return cbModal({
        component: (props: ModalObj) => (
          <SaveChangesModal
            {...props}
            isopen={setIsModalOpen}
            otherCmsTitle={newMigrationData?.content_mapping?.otherCmsTitle}
            saveContentType={saveRef?.current?.handleSaveContentType}
            changeStep={async () => {
              if (!(await persistAutoMappedContentMapper())) return;
              // Contentstack source has the extra Audit step, so test
              // migration sits at step 5; other CMS use step 4.
              const isCS =
                newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';
              const nextStep = isCS ? 5 : 4;
              const url = `/projects/${projectId}/migration/steps/${nextStep}`;
              navigate(url, { replace: true });

              await updateCurrentStepData(selectedOrganisation.value, projectId);
              handleStepChange(nextStep);
            }}
            dropdownStateChange={changeDropdownState}
          />
        ),
        modalProps: {
          size: 'xsmall',
          shouldCloseOnOverlayClick: false
        }
      });
    } else {
      const finishContentMapperNavigation = async () => {
        if (!(await persistAutoMappedContentMapper())) return;
        await updateCurrentStepData(selectedOrganisation.value, projectId);
        setIsLoading(false);
        event?.preventDefault?.();
        // Contentstack source has the extra Audit step, so test migration
        // sits at step 5; other CMS use step 4.
        const isCS =
          newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';
        const nextStep = isCS ? 5 : 4;
        handleStepChange(nextStep);
        const url = `/projects/${projectId}/migration/steps/${nextStep}`;
        navigate(url, { replace: true });
      };

      // AutoMappedMerge confirm modal was reverted on dev; fall through to
      // the standard navigation.
      await finishContentMapperNavigation();
    }
  };

  /**
   * Calls when click Continue button on Test Migration step and handles to proceed to Migration Execution
   */
  const handleOnClickTestMigration = async () => {
    setIsLoading(false);

    await updateMigrationKey(selectedOrganisation.value, projectId);

    const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
    //if (res?.status === 200) {
      // For non-Contentstack sources the audit step is absent, so the
      // migration-execution step is at position 5 (not 6).
      const isCS =
        newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';
      const nextStep = isCS ? 6 : 5;
      handleStepChange(nextStep);
      const url = `/projects/${projectId}/migration/steps/${nextStep}`;
      navigate(url, { replace: true });
    //}
  };

  /**
   * Calls when click Start Migration on the last step — starts final migration.
   */
  const handleOnClickMigrationExecution = async () => {
    setIsLoading(true);
    dispatch(
      updateNewMigrationData({
        ...newMigrationData,
        migration_execution: {
          ...newMigrationData?.migration_execution,
          migrationStarted: true,
          migrationCompleted: false
        }
      })
    );

    if (newMigrationData?.stepValue !== 'Restart Migration') {
      try {
        const migrationRes = await startMigration(
          newMigrationData?.destination_stack?.selectedOrg?.value,
          projectId
        );

        if (migrationRes?.status === 200) {
          setDisableMigration(true);
          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            migration_execution: {
              ...newMigrationData?.migration_execution,
              migrationStarted: true
            }
          };
          dispatch(updateNewMigrationData(newMigrationDataObj));

          Notification({
            notificationContent: { text: 'Migration Execution process started' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'message'
          });
        } else {
          // Surface server-provided message when available.
          Notification({
            notificationContent: {
              text:
                (migrationRes as { data?: { message?: string; error?: { message?: string } } })
                  ?.data?.message ||
                (migrationRes as { data?: { message?: string; error?: { message?: string } } })
                  ?.data?.error?.message ||
                'Failed to start migration'
            },
            type: 'error'
          });
        }
      } catch (error) {
        console.error(error);
        Notification({
          notificationContent: { text: 'Failed to start migration' },
          type: 'error'
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      await handleRestartMigration();
    }
  };

  const handleRestartMigration = async () => {
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        projectStatus: 0,
        currentStep: 1,
        uploadedFile: {
          ...newMigrationData?.legacy_cms?.uploadedFile,
          isValidated: false
        }
      },
      migration_execution: {
        ...newMigrationData?.migration_execution,
        migrationStarted: false,
        migrationCompleted: false
      },
      project_current_step: 1,
      iteration: newMigrationData?.iteration ? newMigrationData?.iteration + 1 : 1
    };
    dispatch(updateNewMigrationData(newMigrationDataObj));
    try {
      const res = await restartMigration(selectedOrganisation?.value, projectId);
      if (res?.status === 200) {
        Notification({
          notificationContent: { text: 'Migration restarted successfully' },
          type: 'success'
        });
        navigate(`/projects/${projectId}/migration/steps/1`);
      } else {
        Notification({
          notificationContent: { text: 'Failed to restart migration' },
          type: 'error'
        });
      }
    } catch (error) {
      console.error(error);
      Notification({
        notificationContent: { text: 'Failed to restart migration' },
        type: 'error'
      });
    }
  };
  
  /**
   * Once Save Changes Modal is shown, Change the dropdown state to false and store in rdux
   */
  const changeDropdownState = () => {
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      content_mapping: { ...newMigrationData?.content_mapping, isDropDownChanged: false }
    };

    dispatch(updateNewMigrationData(newMigrationDataObj));
  };

  const isContentstackSource = newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';

  // Re-dispatch flow steps with the audit step filtered out (and remaining
  // step `name` values renumbered) for non-Contentstack sources, so that URL
  // stepIds and the rendered stepper stay in sync.
  useEffect(() => {
    let cancelled = false;
    getCMSDataFromFile(CS_ENTRIES.MIGRATION_FLOW).then((data: any) => {
      if (cancelled || !validateArray(data?.all_steps)) return;
      const rawSteps: IFlowStep[] = data.all_steps;
      const filtered = (isContentstackSource
        ? rawSteps
        : rawSteps.filter((s: any) => s?.flow_id !== 'auditReport')
      ).map((s: any, i: number) => ({ ...s, name: i + 1 }));
      const currentFlowStep =
        filtered.find((s: any) => `${s?.name}` === params?.stepId) ??
        DEFAULT_IFLOWSTEP;
      dispatch(
        updateMigrationData({
          allFlowSteps: filtered,
          currentFlowStep,
          migration_steps_heading: data?.migration_steps_heading,
          settings: data?.settings
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isContentstackSource, params?.stepId, dispatch]);

  // Memoize stepper steps to update when CMS selection changes
  const stepperSteps = useMemo(() => {
    return createStepper(projectData ?? defaultMigrationResponse, handleStepChange);
  }, [projectData, newMigrationData?.legacy_cms?.selectedCms?.cms_id, handleStepChange]);
  
  const handleOnClickFunctions = isContentstackSource
    ? [
        handleOnClickLegacyCms,
        handleOnClickDestinationStack,
        handleOnClickAuditReport,
        handleOnClickContentMapper,
        handleOnClickTestMigration,
        handleOnClickMigrationExecution
      ]
    : [
        handleOnClickLegacyCms,
        handleOnClickDestinationStack,
        handleOnClickContentMapper,
        handleOnClickTestMigration,
        handleOnClickMigrationExecution
      ];

  return (
    <div className="migration-steps-wrapper">
      {projectData && (
        <MigrationFlowHeader
          projectData={projectData}
          handleOnClick={handleOnClickFunctions[currentStepIndex]}
          isLoading={isLoading}
          isCompleted={isCompleted}
          legacyCMSRef={legacyCMSRef}
          finalExecutionStarted={disableMigration}
        />
      )}
      <div className="steps-wrapper">
        <HorizontalStepper
          ref={stepperRef}
          steps={stepperSteps}
          handleSaveCT={saveRef?.current?.handleSaveContentType}
          changeDropdownState={changeDropdownState}
          projectData={projectData || defaultMigrationResponse}
          isProjectMapped={isProjectMapper}
        />
      </div>
    </div>
  );
};

export default Migration;
