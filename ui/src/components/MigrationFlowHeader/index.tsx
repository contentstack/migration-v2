// Libraries
import { useEffect, useState } from 'react';
import { Button } from '@contentstack/venus-components';
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
  projectData:MigrationResponse
};

const MigrationFlowHeader = ({projectData, handleOnClick, isLoading }: MigrationFlowHeaderProps) => {
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
    stepValue = 'Start';
  } else {
    stepValue = 'Save and Continue';
  }

  return (
    <div className='d-flex align-items-center justify-content-between migration-flow-header'>
      <div className='d-flex align-items-center'>
        { projectName && <h1>{projectName}</h1> }
      </div>

      <Button
        buttonType='primary'
        className="ml-10"
        onClick={handleOnClick}
        version="v2"
        aria-label='Save and Continue'
        isLoading={isLoading}
        disabled={newMigrationData?.testStacks?.some((stack) => stack?.isMigrated === false)}
      >
        {stepValue}
      </Button>
    </div>
  )
}

export default MigrationFlowHeader;