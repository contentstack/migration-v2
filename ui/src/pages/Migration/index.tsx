// Libraries
import { useEffect, useState, useRef } from 'react';
import { Params, useNavigate, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import {  updateMigrationData } from '../../store/slice/migrationDataSlice';

// Services
import { getMigrationData, updateCurrentStepData, updateLegacyCMSData } from '../../services/api/migration.service';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { isEmptyString, validateArray } from '../../utilities/functions';

// Interface
import {
  MigrationResponse,
  defaultMigrationResponse
} from '../../services/api/service.interface';
import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../components/Stepper/FlowStepper/flowStep.interface';

// Components
import MigrationFlowHeader from '../../components/MigrationFlowHeader';
import HorizontalStepper from '../../components/Stepper/HorizontalStepper/HorizontalStepper';
import LegacyCms from '../../components/LegacyCms';
import DestinationStackComponent from '../../components/DestinationStack';
import ContentMapper from '../../components/ContentMapper';
import TestMigration from '../../components/TestMigration';
import MigrationExecution from '../../components/MigrationExecution';

const Migration = () => {
  const [projectData, setProjectData] = useState<MigrationResponse>(defaultMigrationResponse);
  const [isLoading, setIsLoading] = useState(false);
  const [curreentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const params: Params<string> = useParams();
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stepperRef = useRef<any>(null);

  const selectedOrganisation = useSelector((state: RootState)=>state?.authentication?.selectedOrganisation);
  const newMigrationData = useSelector((state:RootState)=> state?.migration?.newMigrationData);

  useEffect(() => {
    fetchData();
  }, [params?.stepId, params?.projectId, selectedOrganisation.value]);

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
    const stepIndex = data?.all_steps?.findIndex((step: IFlowStep) => `${step.name}` === params?.stepId);
    setCurrentStepIndex(stepIndex !== -1 ? stepIndex : 0);
  };

  //Fetch project data
  const fetchProjectData = async () => {
    if (isEmptyString(selectedOrganisation.value) || isEmptyString(params?.projectId)) return;

    const data = await getMigrationData(selectedOrganisation.value, params?.projectId || '');
    if (data) {
      setProjectData(data.data);
      setIsLoading(false);
    }
  };

  const createStepper = (projectData:any,handleStepChange: (currentStep: number) => void) => {

    const steps = [
      {
        data: <LegacyCms
              legacyCMSData={projectData?.legacy_cms}
              projectData={projectData}
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
              />,
        id:'2',
        title:'Destination Stack'
      },
      {
        data: <ContentMapper />,
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
      },
  
      
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
      if(isCompleted){
        event.preventDefault();
  
      //Update Data in backend
      await updateLegacyCMSData(selectedOrganisation?.value, projectId, {
        legacy_cms: newMigrationData?.legacy_cms?.selectedCms?.cms_id
      });
      const res = await updateCurrentStepData(selectedOrganisation.value, projectId);
      handleStepChange(1);
      if (res) {
        const url = `/projects/${projectId}/migration/steps/2`;
        navigate(url, { replace: true });
      }

      }
      
    };

    const handleOnClickFunctions = [
      handleOnClickLegacyCms,      
    ];

  return (
    <div className='migration-steps-wrapper'>
      <MigrationFlowHeader handleOnClick={handleOnClickFunctions[curreentStepIndex]} />

      <div className='steps-wrapper'>
        {!isEmptyString(projectData?.legacy_cms?.cms) &&
          <HorizontalStepper ref={stepperRef} steps={createStepper(projectData, handleClick)} />
        }       
      </div>
    </div>
  )
}

export default Migration;