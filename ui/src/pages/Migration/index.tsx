// Libraries
import { useEffect, useState, useRef } from 'react';
import { Params, useNavigate, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { cbModal, Notification } from '@contentstack/venus-components';

// Redux files
import { RootState } from '../../store';
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
  affixConfirmation,
  updateStackDetails,
  getExistingContentTypes,
  getExistingGlobalFields,
  startMigration,
  updateMigrationKey,
  updateLocaleMapper
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
              buketKey: data?.awsData?.buketKey
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
  const migrationData = await getMigrationData(selectedOrganisation?.value, params?.projectId ?? '');
  const migratedstacks = await getMigratedStacks(selectedOrganisation?.value, projectId );
  const {data} = await getConfig();
  const fileFormat =  fetchFileFormat(data);
  const uploadObj = getFileInfo(data);
 
  if (migrationData) {
    setIsLoading(false);
    setProjectData(migrationData?.data);
  }
  const projectData = migrationData?.data;

    const legacyCmsData: ILegacyCMSComponent = await getCMSDataFromFile(CS_ENTRIES.LEGACY_CMS);

    const selectedCmsData: ICMSType = validateArray(legacyCmsData?.all_cms)
      ? legacyCmsData?.all_cms?.find(
          (cms: ICMSType) => cms?.cms_id === projectData?.legacy_cms?.cms
        ) ?? DEFAULT_CMS_TYPE
      : DEFAULT_CMS_TYPE;

    const selectedFileFormatData: ICardType | undefined = validateArray(
      selectedCmsData?.allowed_file_formats
    )
      ? selectedCmsData.allowed_file_formats?.find(
          (cms: ICardType) => cms?.fileformat_id === projectData?.legacy_cms?.file_format
        )
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
        affix: projectData?.legacy_cms?.affix || newMigrationData?.legacy_cms?.affix || 'cs',
        uploadedFile: projectData?.legacy_cms?.is_fileValid ? {
          ...newMigrationDataRef?.current?.legacy_cms?.uploadedFile,
          file_details: {
            localPath: projectData?.legacy_cms?.file_path,
            awsData: {
              awsRegion: projectData?.legacy_cms?.awsDetails?.awsRegion,
              bucketName: projectData?.legacy_cms?.awsDetails?.bucketName,
              buketKey: projectData?.legacy_cms?.awsDetails?.buketKey
            },
            isLocalPath: projectData?.legacy_cms?.is_localPath
          },
          isValidated: projectData?.legacy_cms?.is_fileValid,
          reValidate: newMigrationData?.legacy_cms?.uploadedFile?.reValidate,
          buttonClicked: newMigrationData?.legacy_cms?.uploadedFile?.buttonClicked ? true : false,
        } : uploadObj,
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
        // 🔧 FIX: Ensure sourceLocale is set from backend data, with fallback to existing Redux state
        sourceLocale: (() => {
          const backendSourceLocales = projectData?.source_locales;
          const reduxSourceLocales = newMigrationData?.destination_stack?.sourceLocale;
          
          if (backendSourceLocales && Array.isArray(backendSourceLocales) && backendSourceLocales.length > 0) {
            return backendSourceLocales;
          }
          if (reduxSourceLocales && Array.isArray(reduxSourceLocales) && reduxSourceLocales.length > 0) {
            return reduxSourceLocales;
          }
          return [];
        })(),
        localeMapping: locales,
        csLocale: newMigrationDataRef?.current?.destination_stack?.csLocale || newMigrationData?.destination_stack?.csLocale || {}
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
    };

    dispatch(updateNewMigrationData(projectMapper));
    
    // Verify what was dispatched
    setIsProjectMapper(false);
  };

  /**
   * Create Stepper and call the steps components
   */
  const createStepper = (
    projectData: MigrationResponse,
    handleStepChange: (currentStep: number) => void
  ) => {
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
      },
      {
        data: <ContentMapper ref={saveRef} handleStepChange={handleStepChange} />,
        id: '3',
        title: 'Map Content Fields'
      },
      {
        data: <TestMigration />,
        id: '4',
        title: 'Run Test Migration'
      },
      {
        data: <MigrationExecution handleStepChange={handleStepChange} />,
        id: '5',
        title: 'Execute Migration'
      }
    ];
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
        awsDetails: {
          awsRegion: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.awsRegion,
          bucketName: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketName,
          buketKey: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.buketKey
        },
        mySQLDetails: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.mySQLDetails
      };
      
      try {
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

      // Check current project state before attempting step update
      const currentProjectData = await getMigrationData(selectedOrganisation?.value, projectId);
      const currentStep = currentProjectData?.data?.current_step;
      
      // Only call updateCurrentStepData if we're at step 1 (to avoid 400 error)
      let res;
      if (currentStep === 1) {
        res = await updateCurrentStepData(selectedOrganisation.value, projectId);
      } else {
        res = { status: 200 }; // Simulate success to continue flow
      }

      if (res?.status === 200) {
        setIsLoading(false);
        // Check if stack is already selected
        if (newMigrationData?.destination_stack?.selectedStack?.value) {
          const url = `/projects/${projectId}/migration/steps/3`;
          handleStepChange(2);
          navigate(url, { replace: true });
        } else {
          const url = `/projects/${projectId}/migration/steps/2`;
          handleStepChange(1);
          navigate(url, { replace: true });
        }
      } else {
        console.error('❌ Failed to update current step:', res);
        setIsLoading(false);
        // Only show notification if component is still mounted
        if (isMountedRef.current) {
          Notification({
            notificationContent: { text: res?.data?.error?.message || 'Failed to update project step' },
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

    // 🚀 PHASE 4: Auto-map remaining unmapped source locales before Continue
    let currentMapping = newMigrationData?.destination_stack?.localeMapping || {};
    
    // 🔧 FIX: If Redux localeMapping is empty, fetch from backend
    if ( Object.keys( currentMapping ).length === 0 )
    {
      try {
        const projectData: any = await getMigrationData(selectedOrganisation?.value, projectId);
        
        // ✅ FIX: Access data.data because API returns {data: {project}, status, ...}
        const project = projectData?.data || projectData;
        
        // Reconstruct localeMapping from master_locale and locales
        const backendMapping: Record<string, string> = {};
        
        if (project?.master_locale) {
          Object.entries(project.master_locale).forEach(([key, value]) => {
            backendMapping[`${key}-master_locale`] = value as string;
          });
        }
        
        if (project?.locales) {
          Object.entries(project.locales).forEach(([key, value]) => {
            backendMapping[key] = value as string;
          });
        }
        
        
        if (Object.keys(backendMapping).length > 0) {
          currentMapping = backendMapping;
          
          // Update Redux with the backend mapping
          dispatch(updateNewMigrationData({
            ...newMigrationData,
            destination_stack: {
              ...newMigrationData?.destination_stack,
              localeMapping: backendMapping
            }
          }));
          
          }
      } catch (error: unknown) {
        console.error('❌ Phase 4: Failed to fetch locale mapping from backend:', error);
      }
    }
    
    const sourceLocales = newMigrationData?.destination_stack?.sourceLocale || [];
    const destinationLocales = newMigrationData?.destination_stack?.selectedStack?.locales || [];
    
    // Find unmapped source locales
    const mappedSourceLocales = new Set<string>();
    Object.entries(currentMapping).forEach(([key, value]) => {
      if (!key.includes('master_locale')) {
        mappedSourceLocales.add(value as string);
      }
    });
    
    const unmappedSources = sourceLocales.filter((locale: any) => 
      !mappedSourceLocales.has(locale.value || locale.code || locale)
    );
    
    
    // Find available destination locales
    const usedDestinationLocales = new Set<string>(Object.keys(currentMapping));
    const availableDestinations = destinationLocales.filter((locale: any) => {
      const localeCode = locale.value || locale.code || locale;
      return !usedDestinationLocales.has(localeCode) && localeCode !== newMigrationData?.destination_stack?.selectedStack?.master_locale;
    });
    
    
    // Auto-map remaining unmapped sources to available destinations
    let finalMapping = currentMapping;
    if (unmappedSources.length > 0 && availableDestinations.length > 0) {
      const finalAutoMapping = { ...currentMapping };
      
      unmappedSources.forEach((sourceLocale: any, index: number) => {
        if (index < availableDestinations.length) {
          const sourceCode = sourceLocale.value || sourceLocale.code || sourceLocale;
          const destLocale: any = availableDestinations[index];
          const destCode = destLocale?.value || destLocale?.code || destLocale;
          finalAutoMapping[destCode] = sourceCode;
        }
      });
      
      // Update Redux with final mappings
      dispatch(updateNewMigrationData({
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          localeMapping: finalAutoMapping
        }
      }));
      
      finalMapping = finalAutoMapping;
      
      // 🚀 PHASE 4: Save final auto-mapping to backend immediately
      try {
        const phase4_master_locale: LocalesType = {};
        const phase4_locales: LocalesType = {};
        Object.entries(finalAutoMapping)?.forEach(([key, value]) => {
          if (key?.includes('master_locale')) {
            phase4_master_locale[key?.replace('-master_locale', '')] = value;
          } else {
            phase4_locales[key] = value;
          }
        });
        
        await updateLocaleMapper(projectId, {
          master_locale: phase4_master_locale,
          locales: phase4_locales
        });
      } catch (error: unknown) {
        console.error('❌ Phase 4: Failed to save final auto-mapping:', error);
      }
    }
    
    // Parse master_locale and locales from the final mapping
    const master_locale: LocalesType = {};
    const locales: LocalesType = {};
    Object.entries(finalMapping)?.forEach(([key, value]) => {
      if (key?.includes('master_locale')) {
        master_locale[key?.replace('-master_locale', '')] = value;
      } else {
        locales[key] = value;
      }
    });

    // ✅ Check if finalMapping has valid entries (after Phase 4)
    const hasNonEmptyMapping =
      finalMapping &&
      Object.keys(finalMapping).length > 0 &&
      Object.entries(finalMapping)?.every(
        ([label, value]: [string, string]) => {
          const conditions = {
            hasLabel: Boolean(label?.trim()),
            notEmptyValue: value !== '',
            notNullValue: value !== null,
            notUndefinedValue: value !== undefined,
            labelNotUndefined: label !== 'undefined',
            labelNotNumeric: isNaN(Number(label))
          };
          
          const passes = conditions.hasLabel &&
                         conditions.notEmptyValue &&
                         conditions.notNullValue &&
                         conditions.notUndefinedValue &&
                         conditions.labelNotUndefined &&
                         conditions.labelNotNumeric;
          
          return passes;
        }
      );

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

      // 🔍 DEBUG: Log master_locale before updating stack details
      const masterLocaleToSave = newMigrationData?.destination_stack?.selectedStack?.master_locale;
      
      await updateStackDetails(selectedOrganisation?.value, projectId, {
        label: newMigrationData?.destination_stack?.selectedStack?.label,
        value: newMigrationData?.destination_stack?.selectedStack?.value,
        master_locale: masterLocaleToSave,
        created_at: newMigrationData?.destination_stack?.selectedStack?.created_at,
        isNewStack: newMigrationData?.destination_stack?.selectedStack?.isNewStack
      });
      
      await updateLocaleMapper(projectId, { master_locale: master_locale, locales: locales });
      
      try {
        const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
        
        if (res?.status === 200) {
          handleStepChange(2);
          setIsLoading(false);
          const url = `/projects/${projectId}/migration/steps/3`;
          navigate(url, { replace: true });
        } else {
          // Handle error response (400, 500, etc.)
          const errorData = res?.data || {};
          const errorMessage = errorData?.message || 
                              errorData?.error?.message || 
                              (typeof errorData?.error === 'string' ? errorData.error : 'Failed to update project step') ||
                              'Failed to update project step';
          
          console.error('❌ updateCurrentStepData failed - FULL ERROR:', JSON.stringify({
            status: res?.status,
            statusText: res?.statusText,
            data: errorData,
            errorMessage,
            fullResponse: res
          }, null, 2));
          
          console.error('❌ Error message:', errorMessage);
          
          setIsLoading(false);
          if (isMountedRef.current) {
            Notification({
              notificationContent: { text: errorMessage },
              type: 'error'
            });
          }
        }
      } catch (error: any) {
        // This catch only runs for unexpected errors (network failures, etc.)
        console.error('❌ Unexpected error updating current step:', error);
        setIsLoading(false);
        if (isMountedRef.current) {
          Notification({
            notificationContent: { 
              text: error?.message || 'An unexpected error occurred. Please try again.'
            },
            type: 'error'
          });
        }
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

  /**
   * Calls when click Continue button on Content Mapper step and handles to proceed to Test Migration
   */
  const handleOnClickContentMapper = async (event: MouseEvent) => {
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
              const url = `/projects/${projectId}/migration/steps/4`;
              navigate(url, { replace: true });

              await updateCurrentStepData(selectedOrganisation.value, projectId);
              handleStepChange(3);
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

      const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
        setIsLoading(false);
        event.preventDefault();
        handleStepChange(3);
        const url = `/projects/${projectId}/migration/steps/4`;
        navigate(url, { replace: true });

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
      handleStepChange(4);
      const url = `/projects/${projectId}/migration/steps/5`;
      navigate(url, { replace: true });
    //}
  };

  /**
   * Calls when click Start Migration button on Migration Execution step and handles to start Final Migration process
   */
  const handleOnClickMigrationExecution = async () => {
    setIsLoading(true);

    try {
      const migrationRes = await startMigration(
        newMigrationData?.destination_stack?.selectedOrg?.value,
        projectId
      );

      if (migrationRes?.status === 200) {
        setIsLoading(false);
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
      }
    } catch (error) {
      // return error;
      console.error(error);
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

  const handleOnClickFunctions = [
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
          steps={createStepper(projectData ?? defaultMigrationResponse, handleStepChange)}
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
