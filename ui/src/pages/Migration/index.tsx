// Libraries
import { useEffect, useState, useRef } from 'react';
import { Params, useNavigate, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import {  updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Services
import { getMigrationData, updateCurrentStepData, updateLegacyCMSData, updateDestinationStack, createTestStack, updateAffixData, fileformatConfirmation, updateFileFormatData, affixConfirmation, updateStackDetails } from '../../services/api/migration.service';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { isEmptyString, validateArray } from '../../utilities/functions';

// Interface
import { MigrationResponse } from '../../services/api/service.interface';
import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../components/Stepper/FlowStepper/flowStep.interface';
import { IDropDown, INewMigration, ICMSType, ILegacyCMSComponent, DEFAULT_CMS_TYPE } from '../../context/app/app.interface';
import { ContentTypeSaveHandles } from '../../components/ContentMapper/contentMapper.interface';
import { ICardType, defaultCardType } from "../../components/Common/Card/card.interface";

// Components
import MigrationFlowHeader from '../../components/MigrationFlowHeader';
import HorizontalStepper from '../../components/Stepper/HorizontalStepper/HorizontalStepper';
import LegacyCms from '../../components/LegacyCms';
import DestinationStackComponent from '../../components/DestinationStack';
import ContentMapper from '../../components/ContentMapper';
import TestMigration from '../../components/TestMigration';
import MigrationExecution from '../../components/MigrationExecution';
import { cbModal, Notification } from '@contentstack/venus-components';
import SaveChangesModal from '../../components/Common/SaveChangesModal';
import { ModalObj } from '../../components/Modal/modal.interface';

type StepperComponentRef = {
  handleStepChange: (step: number) => void;
};
type LegacyCmsRef = {
  getInternalActiveStepIndex: () => number;
};

const Migration = () => {
  const [projectData, setProjectData] = useState<MigrationResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [curreentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isProjectMapper, setIsProjectMapper] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const params: Params<string> = useParams();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stepperRef = useRef<StepperComponentRef>(null);
  const legacyCMSRef = useRef<LegacyCmsRef>(null);

  const selectedOrganisation = useSelector((state: RootState)=>state?.authentication?.selectedOrganisation);
  const newMigrationData = useSelector((state:RootState)=> state?.migration?.newMigrationData);
  const organisationsList = useSelector((state:RootState)=>state?.authentication?.organisationsList);

  const saveRef = useRef<ContentTypeSaveHandles>(null);

  useEffect(() => {
    fetchData();
  }, [params?.stepId, params?.projectId, selectedOrganisation?.value]);

  useEffect(()=>{
    dispatch(updateNewMigrationData({
      ...newMigrationData,
      isprojectMapped : isProjectMapper
      
    }));
    
  },[isProjectMapper]);

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


    dispatch(updateMigrationData({
      allFlowSteps: data?.all_steps,
      currentFlowStep: currentFlowStep,
      migration_steps_heading: data?.migration_steps_heading,
      settings: data?.settings
    }));

    await fetchProjectData();
    const stepIndex = data?.all_steps?.findIndex((step: IFlowStep) => `${step?.name}` === params?.stepId);
    setCurrentStepIndex(stepIndex !== -1 ? stepIndex : 0);
  };

  //Fetch project data
  const fetchProjectData = async () => {
  if (isEmptyString(selectedOrganisation?.value) || isEmptyString(params?.projectId)) return;

  const data = await getMigrationData(selectedOrganisation?.value, params?.projectId || '');
  if (data) {
    setIsLoading(false);
    setProjectData(data?.data);
  }
  setIsProjectMapper(true);
  const projectData = data?.data;

  const legacyCmsData:ILegacyCMSComponent = await  getCMSDataFromFile(CS_ENTRIES.LEGACY_CMS);

  const selectedCmsData: ICMSType = validateArray(legacyCmsData?.all_cms)
  ? legacyCmsData?.all_cms?.find((cms: ICMSType) => cms?.cms_id === projectData?.legacy_cms?.cms) ?? DEFAULT_CMS_TYPE
  : DEFAULT_CMS_TYPE;

  const selectedFileFormatData: ICardType | undefined = validateArray(
    selectedCmsData?.allowed_file_formats
  )
    ? selectedCmsData.allowed_file_formats?.find(
        (cms: ICardType) => cms?.fileformat_id === projectData?.legacy_cms?.file_format
      )
    : defaultCardType;
  

  const selectedOrganisationData = validateArray(organisationsList)
  ? organisationsList?.find((org: IDropDown) => org?.value === projectData?.org_id)
  : selectedOrganisation;

  let selectedStackData: IDropDown = {
    value: projectData?.destination_stack_id,
    label: '',
    master_locale: '',
    locales: [],
    created_at: '',
    isNewStack: false
  };
  
  selectedStackData = {
    label: projectData?.stackDetails?.label,
    value: projectData?.stackDetails?.value,
    master_locale: projectData?.stackDetails?. master_locale,
    created_at: projectData?.stackDetails?.created_at,
    locales:[],
    isNewStack: projectData?.stackDetails?.isNewStack
  };
  
  const projectMapper = {
    ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedCms: selectedCmsData,
        selectedFileFormat: selectedFileFormatData,
        affix: projectData?.legacy_cms?.affix,
        uploadedFile: {
          file_details: {
            localPath: projectData?.legacy_cms?.file_path,
            awsData: {
              awsRegion: projectData?.legacy_cms?.awsDetails?.awsRegion,
              bucketName: projectData?.legacy_cms?.awsDetails?.bucketName,
              buketKey: projectData?.legacy_cms?.awsDetails?.buketKey
            },
            isLocalPath: projectData?.legacy_cms?.is_localPath
          },
          isValidated: projectData?.legacy_cms?.is_fileValid || newMigrationData?.legacy_cms?.uploadedFile?.isValidated
        },
        isFileFormatCheckboxChecked: true, 
        isRestictedKeywordCheckboxChecked: true,
        projectStatus: projectData?.status,
        currentStep: -1,
      },
      destination_stack: {
        selectedOrg: selectedOrganisationData,
        selectedStack: selectedStackData,
        stackArray:[]
      },
      content_mapping: {
        isDropDownChanged: false,
        content_type_mapping: projectData?.mapperKeys
      },
      stackDetails: projectData?.stackDetails,
      // mapper_keys: projectData?.mapper_keys,
    };

  dispatch(updateNewMigrationData(projectMapper));
  setIsProjectMapper(false);
  };


  const createStepper = (projectData: MigrationResponse,handleStepChange: (currentStep: number) => void) => {
    const steps = [
      {
        data: <LegacyCms
              ref={legacyCMSRef}
              legacyCMSData={projectData?.legacy_cms}
              handleStepChange={handleStepChange}
              isCompleted={isCompleted}
              handleOnAllStepsComplete={handleOnAllStepsComplete}/>,
        id:'1',
        title:'Legacy CMS'
      },
      {
        data: <DestinationStackComponent
              destination_stack={projectData?.destination_stack_id}
              org_id={projectData?.org_id}
              projectData={projectData}
              handleStepChange={handleStepChange}
              isCompleted={isCompleted}
              handleOnAllStepsComplete={handleOnAllStepsComplete} />,
        id:'2',
        title:'Destination Stack'
      },
      {
        data: <ContentMapper ref={saveRef} />,
        id:'3',
        title:'Content Mapping'
      },
      {
        data: <TestMigration />,
        id:'4',
        title:'Test Migration'
      },
      {
        data: <MigrationExecution />,
        id:'5',
        title:'Migration Execution'
      }
     ]
     return steps;
  }

  const handleClick = () => {
    // Call handleStepChange function
    const x : string | undefined= params.stepId 
    const currentStep : number = parseInt(x || '');  
    stepperRef?.current?.handleStepChange(currentStep-1);
  };

  const handleStepChange = (currentStep: number) => { 
    if (stepperRef?.current) {
      stepperRef.current.handleStepChange(currentStep-1);
    }
  };

  //Handle on all steps are completed
  const handleOnAllStepsComplete = (flag = false) => {
    setIsCompleted(flag);
  };

  // handle on proceed to destination stack
  const handleOnClickLegacyCms = async (event: MouseEvent ) => {
    setIsLoading(true);
    if(isCompleted){
      event.preventDefault();

    //Update Data in backend
    await updateLegacyCMSData(selectedOrganisation?.value, projectId, {
      legacy_cms: newMigrationData?.legacy_cms?.selectedCms?.cms_id
    });
    await updateAffixData(selectedOrganisation?.value, projectId, { affix: newMigrationData?.legacy_cms?.affix });
    await fileformatConfirmation(selectedOrganisation?.value, projectId, {
      fileformat_confirmation: true
    });     

    await affixConfirmation(selectedOrganisation?.value, projectId, {
      affix_confirmation: true
    })
    await updateFileFormatData(selectedOrganisation?.value, projectId, {
      file_format: newMigrationData?.legacy_cms?.selectedCms?.allowed_file_formats[0]?.fileformat_id?.toString() ,
      file_path: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath,
      is_fileValid: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
      is_localPath: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isLocalPath,
      awsDetails:{
        awsRegion: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.awsRegion,
        bucketName: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.bucketName,
        buketKey: newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.buketKey
      }
    });
    const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
    handleStepChange(1);
    if (res) {
      setIsLoading(false);

      const url = `/projects/${projectId}/migration/steps/2`;
      navigate(url, { replace: true });
    }

    }
    else{
      setIsLoading(false);

      if (legacyCMSRef?.current) {
        const currentIndex = legacyCMSRef?.current?.getInternalActiveStepIndex() + 1;                
        let result;
        switch (currentIndex ) {
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
            notificationContent: { text: `Please complete ${result} step` },
            type: 'warning'
          });
        }
      }

    }
    
  };

  // handle on proceed to content mapping
  const handleOnClickDestinationStack = async (event: MouseEvent) => {
    setIsLoading(true);

    if(isCompleted && !isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value)){
      event?.preventDefault();
      //Update Data in backend
      await updateDestinationStack(selectedOrganisation?.value, projectId, {
        stack_api_key: newMigrationData?.destination_stack?.selectedStack?.value
      });

      await updateStackDetails(selectedOrganisation?.value, projectId,{
        label:newMigrationData?.destination_stack?.selectedStack?.label,
        value:newMigrationData?.destination_stack?.selectedStack?.value,
        master_locale:newMigrationData?.destination_stack?.selectedStack?.master_locale,
        created_at:newMigrationData?.destination_stack?.selectedStack?.created_at,
        isNewStack: newMigrationData?.destination_stack?.selectedStack?.isNewStack
      })
      handleStepChange(2);
      const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
      if (res) {
        setIsLoading(false);
        const url = `/projects/${projectId}/migration/steps/3`;
        navigate(url, { replace: true });
      }
    } else{
      setIsLoading(false);
      Notification({
        notificationContent: { text: 'Please select a stack to proceed further' },
        type: 'warning'
      });
    }
  };

  const handleOnClickContentMapper = async (event: MouseEvent) => {
    setIsModalOpen(true);

    if(newMigrationData?.content_mapping?.isDropDownChanged){
      return cbModal({
        component: (props: ModalObj) => (
        <SaveChangesModal
            {...props}
            isopen={setIsModalOpen}
            otherCmsTitle={newMigrationData?.content_mapping?.otherCmsTitle}
            saveContentType={saveRef?.current?.handleSaveContentType}
            changeStep={async () => {
              setIsLoading(true);
              const data = {
                name: newMigrationData?.destination_stack?.selectedStack?.label,
                description: 'test migration stack',
                master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale
              };
          
              const res = await createTestStack(
                newMigrationData?.destination_stack?.selectedOrg?.value,
                projectId,
                data
              );
          
              if (res?.status) {
                setIsLoading(false);
                const newMigrationDataObj: INewMigration = {
                  ...newMigrationData,
                    content_mapping: { ...newMigrationData?.content_mapping, isDropDownChanged: false },

                  test_migration: { stack_link: res?.data?.data?.url, stack_api_key: res?.data?.data?.data?.stack?.api_key }
                };
            
                dispatch(updateNewMigrationData((newMigrationDataObj)));
          
                const url = `/projects/${projectId}/migration/steps/4`;
                navigate(url, { replace: true });
          
                await updateCurrentStepData(selectedOrganisation.value, projectId);
                handleStepChange(3);
              }}}
            dropdownStateChange={changeDropdownState}
        />
        ),
        modalProps: {
        size: 'xsmall',
        shouldCloseOnOverlayClick: false
        }
    });

    }
    else{
      event.preventDefault();
      setIsLoading(true);
      const data = {
        name: newMigrationData?.destination_stack?.selectedStack?.label,
        description: 'test migration stack',
        master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale
      };
  
      const res = await createTestStack(
        newMigrationData?.destination_stack?.selectedOrg?.value,
        projectId,
        data
      );
  
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        test_migration: { stack_link: res?.data?.data?.url, stack_api_key: res?.data?.data?.data?.stack?.api_key }
      };
  
      dispatch(updateNewMigrationData((newMigrationDataObj)));
      if (res?.status) {
        setIsLoading(false);
  
        const url = `/projects/${projectId}/migration/steps/4`;
        navigate(url, { replace: true });
  
        await updateCurrentStepData(selectedOrganisation.value, projectId);
        handleStepChange(3);
      }

    }
  
    

  }

  const handleOnClickTestMigration = async () => {
    setIsLoading(false);

    const url = `/projects/${projectId}/migration/steps/5`;
    navigate(url, { replace: true });

    await updateCurrentStepData(selectedOrganisation.value, projectId);
    handleStepChange(4);
  }

  const changeDropdownState = () =>{
    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      content_mapping: { ...newMigrationData?.content_mapping, isDropDownChanged: false }
    };

    dispatch(updateNewMigrationData((newMigrationDataObj)));
  }

  const handleOnClickFunctions = [
    handleOnClickLegacyCms, 
    handleOnClickDestinationStack,
    handleOnClickContentMapper,
    handleOnClickTestMigration 
  ];


  
  return (
     
 
    <div className='migration-steps-wrapper'>
      {projectData && 
      <>
      <MigrationFlowHeader projectData={projectData} handleOnClick={handleOnClickFunctions[curreentStepIndex]} isLoading={isLoading} isCompleted={isCompleted} legacyCMSRef={legacyCMSRef}   />
      <div className='steps-wrapper'>
          <HorizontalStepper ref={stepperRef} steps={createStepper(projectData, handleClick)} handleSaveCT={saveRef?.current?.handleSaveContentType} changeDropdownState={changeDropdownState } />
      </div>
      </>
      }
    </div>

    
  )
}

export default Migration;