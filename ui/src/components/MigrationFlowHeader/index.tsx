// Libraries
import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';

import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

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
  const dispatch = useDispatch();
  const isContentstackSource = newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';

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

  // CTA label: Contentstack uses step 6 for final migration; other CMS use step 5.
  // Delta migration: after completion, label becomes "Restart Migration".
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

    if (newStepValue !== newMigrationData?.stepValue) {
      dispatch(updateNewMigrationData({ stepValue: newStepValue }));
    }
  }, [
    params?.stepId,
    newMigrationData?.stepValue,
    newMigrationData?.legacy_cms?.projectStatus,
    newMigrationData?.migration_execution?.migrationCompleted,
    isContentstackSource,
    dispatch,
  ]);

  const stepValue = newMigrationData?.stepValue ?? 'Save and Continue';

  /** Final migration step: Contentstack has an extra Audit step, so execution is on 6; other CMS use 5. */
  const finalMigrationStepId = isContentstackSource ? '6' : '5';

  const testMigrationStepId = isContentstackSource ? '5' : '4';
  const isStep4AndNotMigrated =
    params?.stepId === TEST_MIGRATION_STEP &&
    !newMigrationData?.testStacks?.some(
      (stack) =>
        stack?.stackUid === newMigrationData?.test_migration?.stack_api_key && stack?.isMigrated
    );

  const isStepOneandNotMapped =
    params?.stepId === '1' &&
    newMigrationData?.isContentMapperGenerated &&
    newMigrationData?.legacy_cms?.projectStatus === 3 &&
    newMigrationData?.legacy_cms?.uploadedFile?.reValidate;

  const isProjectStatusOne = newMigrationData?.legacy_cms?.projectStatus === 1;
  const isPreviousStepDisabled =
    params?.stepId &&
    parseInt(params?.stepId) < newMigrationData?.project_current_step &&
    !isProjectStatusOne;

  const isProjectStatusThreeAndMapperNotGenerated =
    params?.stepId === '1' &&
    newMigrationData?.legacy_cms?.projectStatus === 3 &&
    newMigrationData?.legacy_cms?.uploadedFile?.buttonClicked;

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

  // Only applies on the real "Start/Restart migration" step for this CMS (was hardcoded as 6, so non-CS never hit it).
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
