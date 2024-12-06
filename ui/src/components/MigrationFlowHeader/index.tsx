// Libraries
import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@contentstack/venus-components';
import { useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';

import { RootState } from '../../store';

// Interfaces
import { MigrationResponse } from '../../services/api/service.interface';

// CSS
import './index.scss';

type MigrationFlowHeaderProps = {
  handleOnClick: (event: MouseEvent, handleStepChange: (currentStep: number) => void) => void;
  isLoading: boolean;
  isCompleted: boolean;
  legacyCMSRef: React.MutableRefObject<any>; 
  projectData:MigrationResponse;
  finalExecutionStarted?: boolean;
};

/**
 * Renders a MigrationFlowHeader component to show the project name and CTA to proceed to next step
 * @param projectData - The projectData object containing project details.
 * @param handleOnClick - Callback function to proceed to next step.
 * @param isLoading - isLoading flag to load redux data
 * @param finalExecutionStarted - The finalExecutionStarted boolean to check if migration execution is started to disable Start Migration button.
 */
const MigrationFlowHeader = ({projectData, handleOnClick, isLoading, finalExecutionStarted }: MigrationFlowHeaderProps) => {
  const [projectName, setProjectName] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(0);

  const navigate = useNavigate();
  const params: Params<string> = useParams();

  const selectedOrganisation = useSelector((state: RootState)=>state?.authentication?.selectedOrganisation);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);


  useEffect(() => {
    fetchProject();
  }, [selectedOrganisation?.value, params?.projectId]);

  /******** Function to get project  ********/
  /**
   * Fetch the project details project name and current step.
   */
  const fetchProject = async () => {
    setProjectName(projectData?.name);
    setCurrentStep(projectData?.current_step);

    //Navigate to lastest or active Step
    const url = `/projects/${params?.projectId}/migration/steps/${projectData?.current_step}`;
    navigate(url, { replace: true });
  };

  let stepValue;
  if (params?.stepId === '3' || params?.stepId === '4') {
    stepValue = 'Continue';
  } else if (params?.stepId === '5') {
    stepValue = 'Start Migration';
  } else {
    stepValue = 'Save and Continue';
  }

  const isStep4AndNotMigrated = 
  params?.stepId === '4' && 
  !newMigrationData?.testStacks?.some(
    (stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key && stack?.isMigrated
  );

  const isStepInvalid = 
    params?.stepId && 
    params?.stepId <= '2' && 
    newMigrationData?.project_current_step?.toString() !== params?.stepId;

  const isExecutionStarted = 
    finalExecutionStarted || 
    newMigrationData?.migration_execution?.migrationStarted;
    
  return (
    <div className='d-flex align-items-center justify-content-between migration-flow-header'>
      <div className='d-flex align-items-center'>
        { projectName && 
        <Tooltip content={projectName} position='right' version={'v2'}>
          <h1 className='project-name-ellipsis'>{projectName}</h1> 
        </Tooltip>}
      </div>

      <Button
        buttonType='primary'
        className="ml-10"
        onClick={handleOnClick}
        version="v2"
        aria-label='Save and Continue'
        isLoading={isLoading || newMigrationData?.isprojectMapped}
        disabled={isStep4AndNotMigrated || isStepInvalid || isExecutionStarted}
      >
        {stepValue}
      </Button>
    </div>
  )
}

export default MigrationFlowHeader;