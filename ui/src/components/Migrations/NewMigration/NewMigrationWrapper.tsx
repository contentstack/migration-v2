// Libraries
import { lazy, useEffect, useState, useRef } from 'react';
import {  Outlet, Params, useNavigate, useParams } from 'react-router';
import {  useSelector } from 'react-redux';

//venus components
import { Button, PageLayout, Stepper } from '@contentstack/venus-components';

// Services
import { getMigrationData } from '../../../services/api/migration.service';
//import { getEntries } from '../../../services/contentstackSDK';
import { getCMSDataFromFile } from '../../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../../utilities/constants';
import { isEmptyString, validateArray } from '../../../utilities/functions';


// Interface
import {
  DEFAULT_IFLOWSTEP,
  IFlowStep
} from '../../../components/Stepper/FlowStepper/flowStep.interface';

// Components
import { ActionTitle } from './ActionTitle';
import MigrationFlow from '../../../components/MigrationFlow';

// Styles
import './NewMigrationWrapper.scss';

import {
  MigrationResponse,
  defaultMigrationResponse
} from '../../../services/api/service.interface';
import { useDispatch } from 'react-redux';
import {  updateMigrationData } from '../../../store/slice/migrationDataSlice';
import HorizontalStepper from '../../Stepper/HorizontalStepper/HorizontalStepper';
import { RootState } from '../../../store';

const defaultStep = '1';

/******* ALL LAZY LOADED COMPONENT********/
const LegacyCMSComponentLazyLoaded = lazy(() => import('../../../components/LegacyCms'));
const DestinationStackComponentLazyLoaded = lazy(
  () => import('../../../components/DestinationStack')
);
const ContentMapperComponentLazyLoaded = lazy(() => import('../../../components/ContentMapper'));
const TestMigrationComponentLazyLoaded = lazy(() => import('../../../components/TestMigration'));
const MigrationExecutionComponentLazyLoaded = lazy(
  () => import('../../../components/MigrationExecution')
);


const createStepper = (projectData:any,handleStepChange: (currentStep: number) => void) => {
  const steps = [
    {
      data: <LegacyCMSComponentLazyLoaded
            legacyCMSData={projectData?.legacy_cms}
            projectData={projectData}
            handleStepChange={handleStepChange}/>,
      id:'1',
      title:'Legacy CMS'
    },
    {
      data: <DestinationStackComponentLazyLoaded
              destination_stack={projectData?.destination_stack_id}
              org_id={projectData?.org_id}
              projectData={projectData}
              handleStepChange={handleStepChange}
            />,
      id:'2',
      title:'Destination Stack'
    },
    {
      data: <ContentMapperComponentLazyLoaded />,
      id:'3',
      title:'Content Mapping'
    },
    {
      data: <TestMigrationComponentLazyLoaded />,
      id:'4',
      title:'Test Migration'
    },
    {
      data: <MigrationExecutionComponentLazyLoaded />,
      id:'5',
      title:'Migration Execution'
    },

    
   ]
   return steps;
}

const NewMigrationWrapper = () => {
  const params: Params<string> = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const stepperRef = useRef<any>(null);

  const [showInfo, setShowInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [projectData, setProjectData] = useState<MigrationResponse>(defaultMigrationResponse);

  /********  ALL CONTEXT DATA  **********/
  //const { migrationData, updateMigrationData, selectedOrganisation } = useContext(AppContext);
  const migrationData = useSelector((state: RootState)=>state?.migration?.migrationData);
  const selectedOrganisation = useSelector((state: RootState)=>state?.authentication?.selectedOrganisation);

  //Fetch project data
  const fetchProjectData = async () => {
    if (isEmptyString(selectedOrganisation.value) || isEmptyString(params?.projectId)) return;

    const data = await getMigrationData(selectedOrganisation.value, params?.projectId || '');
    if (data) {
      setProjectData(data.data);
      setIsLoading(false);
    }
  };

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
  };

  const openBasicInfo = () => {
    setShowInfo(true);
    navigate(`settings`);
  };

  const handleClick = () => {

    // Call handleStepChange function
    const x : string | undefined= params.stepId 
    const currentStep : number = parseInt(x || '');  
    stepperRef?.current?.handleStepChange(currentStep-1);
};

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [params?.stepId, params?.projectId, selectedOrganisation.value]);

  const { settings, migration_steps_heading } = migrationData;


  const leftSidebar = {
    component: (
      <div className="step-flow-wrapper-tree-area">
        <MigrationFlow
          settingsText={settings}
          migrationStepsText={migration_steps_heading}
          settingsClick={openBasicInfo}
          showInfo={showInfo}
          currentStep={projectData.current_step}
        />
      </div>
    )
  };
  
  const header = {
    component: (
      <div className="action-component-title">
        <ActionTitle
          stepName={`${migrationData?.currentFlowStep?.name}` || ''}
          title={migrationData?.currentFlowStep?.title || ''}
        />
      </div>
    )
  };
 
  return (
    <>
      {/* {showInfo && <Outlet />}
      {!showInfo && (
        <div className="migrations-container p-0 d-flex w-100">
          <div className="step-flow-wrapper-tree-area">
            <MigrationFlow
              settingsText={settings}
              migrationStepsText={migration_steps_heading}
              settingsClick={openBasicInfo}
              showInfo={showInfo}
              currentStep={projectData.current_step}
            />
          </div>
          <div className="step-flow-wrapper-content-area">
            <div className="step-component step-open trigger">
              <div className="action-component-title">
                <ActionTitle
                  stepName={`${migrationData?.currentFlowStep?.name}` || ''}
                  title={migrationData?.currentFlowStep?.title || ''}
                />
              </div>
              {isLoading ? (
                <></> // Consider using a loading indicator here
              ) : (
                <div className="action-component-body">
                  {getComponent(params, projectData, params?.stepId)}
                </div>
              )}
            </div>
          </div>
        </div>
      )} */}
      {showInfo && <Outlet />}
      {!showInfo && (
        <div id="newMigration" className="layout-container migrations-container  p-0 d-flex w-100">
          <div className="step-flow-wrapper-content-area">
            <div className="step-component step-open trigger">
              <HorizontalStepper ref={stepperRef} steps={createStepper(projectData,handleClick)}/>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NewMigrationWrapper;