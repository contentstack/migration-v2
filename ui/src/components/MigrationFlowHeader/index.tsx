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
  /**
   * Starts a new (delta) iteration once a migration has completed. Offered as a separate
   * secondary control rather than by turning the primary CTA into "Restart Migration", so a
   * finished migration cannot be re-run by clicking the button you just clicked.
   */
  onStartNewIteration?: () => void;
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
  finalExecutionStarted,
  onStartNewIteration
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
    
    // Check conditions in priority order. The execute step always reads "Start Migration" —
    // it is never relabelled to "Restart Migration" on completion, because a completed
    // migration must not be re-runnable from the primary CTA (it goes disabled instead).
    if (params?.stepId === EXECUTE_MIGRATION_STEP) {
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

  // A freshly restarted project is a draft (projectStatus === 0) sitting on step 1. Right after
  // restart, project_current_step can still hold the old (execute-step) value for a beat — the
  // restart navigate triggers a project re-fetch that may read backend state before it settles,
  // overwriting our optimistic project_current_step: 1. That would make isStepInvalid true and wedge
  // the step-1 CTA disabled until a manual reload. A draft project on an early step is never
  // "already past", so exclude projectStatus === 0 here (mirrors the isProjectStatusOne guard above).
  const isProjectStatusDraft = newMigrationData?.legacy_cms?.projectStatus === 0;
  const isStepInvalid =
    params?.stepId &&
    params?.stepId <= '2' &&
    newMigrationData?.project_current_step?.toString() !== params?.stepId &&
    parseInt(params?.stepId) < newMigrationData?.project_current_step &&
    !isProjectStatusDraft;

  const isOnExecuteStep = params?.stepId === EXECUTE_MIGRATION_STEP;
  const isMigrationComplete = Boolean(newMigrationData?.migration_execution?.migrationCompleted);

  // Migration is actively running: started (locally or in redux) but not yet completed.
  const isMigrationInProgress =
    (finalExecutionStarted || newMigrationData?.migration_execution?.migrationStarted) &&
    !isMigrationComplete;

  // Disable the Start Migration button while the start request is in flight / after a
  // successful start, and keep it disabled once the migration has COMPLETED — a finished
  // migration must not be re-runnable from this button. Starting another (delta) iteration
  // is a separate, deliberate action via the secondary control below.
  const isStartMigrationDisabled = isOnExecuteStep && (!!finalExecutionStarted || isMigrationComplete);

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

      <div className="d-flex align-items-center">
        {/*
          Delta migrations (iteration >= 2) begin by starting a new iteration, and this is the
          only entry point to that flow. Kept deliberately secondary so it reads as a distinct
          action rather than as "click the same button again".
        */}
        {isOnExecuteStep && isMigrationComplete && onStartNewIteration && (
          <Tooltip
            content="Begin another migration round for this project, migrating only what has changed since the last run."
            position="bottom"
            version={'v2'}
          >
            <Button
              buttonType="tertiary"
              onClick={onStartNewIteration}
              version="v2"
              aria-label="Start New Iteration"
            >
              Start New Iteration
            </Button>
          </Tooltip>
        )}
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
    </div>
  );
};

export default MigrationFlowHeader;
