// Libraries
import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';

import { RootState } from '../../store';

// Interfaces
import { MigrationResponse } from '../../services/api/service.interface';

// CSS
import './index.scss';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

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
  const dispatch = useDispatch();

  // Delta migration: the "Map Entry" step only exists from iteration 2 onwards, which shifts the
  // step numbers for Test Migration and Execute Migration. Resolve the semantic step ids by
  // iteration so all stepId checks stay correct for both the 5-step (iter 1) and 6-step flows.
  const iteration = newMigrationData?.iteration ?? 1;
  const isDeltaIteration = iteration > 1;
  const TEST_MIGRATION_STEP = isDeltaIteration ? '5' : '4';
  const EXECUTE_MIGRATION_STEP = isDeltaIteration ? '6' : '5';
  // Mapping steps that show a plain "Continue" CTA: Map Content Fields (3) always, plus
  // Map Entry (4) and Test Migration on delta iterations.
  const isMappingContinueStep =
    params?.stepId === '3' ||
    (isDeltaIteration && (params?.stepId === '4' || params?.stepId === '5')) ||
    (!isDeltaIteration && params?.stepId === '4');

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

  useEffect(() => {
    let newStepValue;
    
    // Check conditions in priority order.
    // "Restart Migration" only applies on the final Execute step once a migration has completed —
    // not while navigating back through earlier (completed) steps in a delta iteration.
    if (
      params?.stepId === EXECUTE_MIGRATION_STEP &&
      newMigrationData?.legacy_cms?.projectStatus === 5 &&
      newMigrationData?.migration_execution?.migrationCompleted
    ) {
      newStepValue = 'Restart Migration';
    } else if (params?.stepId === EXECUTE_MIGRATION_STEP) {
      newStepValue = 'Start Migration';
    } else if (isMappingContinueStep) {
      newStepValue = 'Continue';
    } else {
      newStepValue = 'Save and Continue';
    }
    
    // Only update if the value has changed
    if (newStepValue !== newMigrationData?.stepValue) {
      dispatch(updateNewMigrationData({ stepValue: newStepValue }));
    }
  }, [params?.stepId, newMigrationData?.legacy_cms?.projectStatus, newMigrationData?.migration_execution?.migrationCompleted, newMigrationData?.stepValue, dispatch]);

  const isStep4AndNotMigrated =
    params?.stepId === TEST_MIGRATION_STEP &&
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

  // Migration is actively running: it has been started (locally or in redux) but not yet completed.
  // While in progress the CTA must be disabled; once completed it re-enables as "Restart Migration".
  const isMigrationInProgress =
    (finalExecutionStarted || newMigrationData?.migration_execution?.migrationStarted) &&
    !newMigrationData?.migration_execution?.migrationCompleted;

  // Disable the Start Migration button while the start request is in flight / after a successful
  // start (driven by the local finalExecutionStarted flag from the click handler, NOT by the
  // migration-completed flag — so the live logs still show while migration runs).
  const isStartMigrationDisabled =
    params?.stepId === EXECUTE_MIGRATION_STEP &&
    !!finalExecutionStarted &&
    newMigrationData?.stepValue !== 'Restart Migration';

  const destinationStackMigrated =
    params?.stepId === EXECUTE_MIGRATION_STEP &&
    newMigrationData?.destination_stack?.migratedStacks?.includes(
      newMigrationData?.destination_stack?.selectedStack?.value
    );
  const isFileValidated = newMigrationData?.isContentMapperGenerated ? true : newMigrationData?.legacy_cms?.uploadedFile?.reValidate;

  // Map Content Fields (step 3) empty-state handling:
  // - Iteration 1 with no content types = genuine error → keep Continue disabled.
  // - Iteration 2+ with no NEW content types = valid (nothing new to map) → Continue stays enabled.
  // ContentMapper reports emptiness via hasNoContentTypes (its local fetch result), which is more
  // accurate than isContentMapperGenerated (the project's mapper-id array can be non-empty while the
  // resolved content-type list is empty).
  const isContentMapperEmptyOnFirstIteration =
    params?.stepId === '3' &&
    !isDeltaIteration &&
    newMigrationData?.hasNoContentTypes === true;

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
          isMigrationInProgress ||
          isStartMigrationDisabled ||
          isContentMapperEmptyOnFirstIteration ||
          (isProjectStatusThreeAndMapperNotGenerated ?
            isFileValidated :
            isStep4AndNotMigrated ||
            isStepInvalid)
        }
      >
        {newMigrationData?.stepValue || 'Save and Continue'}
        </Button>
    </div>
  );
};

export default MigrationFlowHeader;
