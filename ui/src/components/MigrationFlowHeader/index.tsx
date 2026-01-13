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
  projectData: MigrationResponse;
  finalExecutionStarted?: boolean;
};

/**
 * Renders a MigrationFlowHeader component to show the project name and CTA to proceed to next step
 * @param projectData - The projectData object containing project details.
 * @param handleOnClick - Callback function to proceed to next step.
 * @param isLoading - isLoading flag to load redux data
 * @param finalExecutionStarted - The finalExecutionStarted boolean to check if migration execution is started to disable Start Migration button.
 */
const MigrationFlowHeader = ({
  projectData,
  handleOnClick,
  isLoading,
  finalExecutionStarted
}: MigrationFlowHeaderProps) => {
  const [projectName, setProjectName] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(0);

  const navigate = useNavigate();
  const params: Params<string> = useParams();

  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  useEffect(() => {
    fetchProject();
  }, [selectedOrganisation?.value, params?.projectId, projectData?.current_step]);

  /******** Function to get project  ********/
  /**
   * Fetch the project details project name and current step.
   */
  const fetchProject = async () => {
    if (!projectData?.name || !projectData?.current_step) return;
    
    setProjectName(projectData?.name);
    setCurrentStep(projectData?.current_step);

    // Check if URL step matches database step
    const urlStep = parseInt(params?.stepId || '1');
    const dbStep = projectData?.current_step;
    
    // Only navigate if there's a mismatch and we have valid data
    if (urlStep !== dbStep && dbStep && params?.projectId) {
      const url = `/projects/${params?.projectId}/migration/steps/${dbStep}`;
      navigate(url, { replace: true });
    }
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
      (stack) =>
        stack?.stackUid === newMigrationData?.test_migration?.stack_api_key && stack?.isMigrated
    );

  const isStepOneandNotMapped = params?.stepId === '1' && newMigrationData?.isContentMapperGenerated && newMigrationData?.legacy_cms?.projectStatus === 3 && newMigrationData?.legacy_cms?.uploadedFile?.reValidate;

  const isProjectStatusOne = newMigrationData?.legacy_cms?.projectStatus === 1;
  const isPreviousStepDisabled = params?.stepId &&
    parseInt(params?.stepId) < newMigrationData?.project_current_step &&
    !isProjectStatusOne;

  const isProjectStatusThreeAndMapperNotGenerated =
    params?.stepId === '1' &&
    newMigrationData?.legacy_cms?.projectStatus === 3 &&
    newMigrationData?.legacy_cms?.uploadedFile?.buttonClicked 

  const isStepInvalid =
    params?.stepId &&
    params?.stepId <= '2' &&
    newMigrationData?.project_current_step?.toString() !== params?.stepId && 
    parseInt(params?.stepId) < newMigrationData?.project_current_step;

  const isExecutionStarted =
    finalExecutionStarted ||
    newMigrationData?.migration_execution?.migrationStarted ||
    newMigrationData?.migration_execution?.migrationCompleted;

  const destinationStackMigrated =
    params?.stepId === '5' &&
    newMigrationData?.destination_stack?.migratedStacks?.includes(
      newMigrationData?.destination_stack?.selectedStack?.value
    );
  const isFileValidated = newMigrationData?.isContentMapperGenerated ? true : newMigrationData?.legacy_cms?.uploadedFile?.reValidate;

  return (
    <div className="d-flex align-items-center justify-content-between migration-flow-header">
      <div className="d-flex align-items-center">
        {projectName && (
          <Tooltip content={projectName} position="right" version={'v2'}>
            <h1 className="project-name-ellipsis">{projectName}</h1>
          </Tooltip>
        )}
      </div>

      <Button
        buttonType="primary"
        className="ml-10"
        onClick={handleOnClick}
        version="v2"
        aria-label="Save and Continue"
        isLoading={isLoading || newMigrationData?.isprojectMapped}
        disabled={
          isProjectStatusThreeAndMapperNotGenerated ?
            isFileValidated :
            isStep4AndNotMigrated || 
            isStepInvalid || 
            isExecutionStarted || 
            destinationStackMigrated
        }
      >
        {stepValue}
      </Button>
    </div>
  );
};

export default MigrationFlowHeader;
