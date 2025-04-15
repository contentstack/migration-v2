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

type StepperComponentRef = {
  handleStepChange: (step: number) => void;
};
type LegacyCmsRef = {
  getInternalActiveStepIndex: () => number;
};
type LocalesType = {
  [key: string]: any
}

const Migration = () => {
  const params: Params<string> = useParams();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stepperRef = useRef<StepperComponentRef>(null);
  const legacyCMSRef = useRef<LegacyCmsRef>(null);

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

  const saveRef = useRef<ContentTypeSaveHandles>(null);
  const newMigrationDataRef = useRef(newMigrationData);

  useEffect(() => {
    fetchData();
  }, [params?.stepId, params?.projectId, selectedOrganisation?.value]);

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
    const ext = match ? match?.[1]?.toLowerCase() : "";

    // const fileName = filePath?.split('/')?.pop();
    //const ext = fileName?.split('.')?.pop();
    const validExtensionRegex = /\.(pdf|zip|xml|json)$/i;
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
          name: data?.localPath,
          url: data?.localPath,
          isValidated: data?.localPath !== newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath ? false : newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
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
        affix:  projectData?.legacy_cms?.affix ,
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
          reValidate: newMigrationData?.legacy_cms?.uploadedFile?.reValidate
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
    };

    dispatch(updateNewMigrationData(projectMapper));
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
      await updateLegacyCMSData(selectedOrganisation?.value, projectId, {
        legacy_cms: newMigrationData?.legacy_cms?.selectedCms?.cms_id
      });
      await updateAffixData(selectedOrganisation?.value, projectId, {
        affix: newMigrationData?.legacy_cms?.affix
      });
      await fileformatConfirmation(selectedOrganisation?.value, projectId, {
        fileformat_confirmation: true
      });

      await affixConfirmation(selectedOrganisation?.value, projectId, {
        affix_confirmation: true
      });
      await updateFileFormatData(selectedOrganisation?.value, projectId, {
        file_format:
          newMigrationData?.legacy_cms?.selectedCms?.allowed_file_formats[0]?.fileformat_id?.toString(),
        file_path: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath,
        is_fileValid: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
        is_localPath: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isLocalPath,
        awsDetails: {
          awsRegion: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.awsRegion,
          bucketName: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketName,
          buketKey: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.buketKey
        }
      });
      const res = await updateCurrentStepData(selectedOrganisation.value, projectId);

      if (res?.status === 200) {
        setIsLoading(false);
        handleStepChange(1);
        const url = `/projects/${projectId}/migration/steps/2`;
        navigate(url, { replace: true });
      } else {
        setIsLoading(false);
        Notification({
          notificationContent: { text: res?.data?.error?.message },
          type: 'error'
        });
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
      Object.values(newMigrationData?.destination_stack?.localeMapping)?.every(
        (value) => value !== '' && value !== null && value !== undefined
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
      if (res?.status === 200) {
        setIsLoading(false);
        event.preventDefault();
        handleStepChange(3);
        const url = `/projects/${projectId}/migration/steps/4`;
        navigate(url, { replace: true });
      } else {
        setIsLoading(false);
        Notification({
          notificationContent: { text: res?.data?.error?.message },
          type: 'error'
        });
      }

    }
  };

  /**
   * Calls when click Continue button on Test Migration step and handles to proceed to Migration Execution
   */
  const handleOnClickTestMigration = async () => {
    setIsLoading(false);

    await updateMigrationKey(selectedOrganisation.value, projectId);

    const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
    if (res?.status === 200) {
      handleStepChange(4);
      const url = `/projects/${projectId}/migration/steps/5`;
      navigate(url, { replace: true });
    }
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
            hideProgressBar: false
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
