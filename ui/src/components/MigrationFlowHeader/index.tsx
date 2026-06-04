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

    // Delta migration: a completed run shows "Restart Migration" regardless of step.
    if (
      newMigrationData?.legacy_cms?.projectStatus === 5 &&
      newMigrationData?.migration_execution?.migrationCompleted
    ) {
      newStepValue = 'Restart Migration';
    } else if (
      (isContentstackSource && params?.stepId === '6') ||
      (!isContentstackSource && params?.stepId === '5')
    ) {
      newStepValue = 'Start Migration';
    } else if (
      isContentstackSource
        ? params?.stepId === '3' || params?.stepId === '4' || params?.stepId === '5'
        : params?.stepId === '3' || params?.stepId === '4'
    ) {
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
    params?.stepId === testMigrationStepId &&
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

  const isStepInvalid =
    params?.stepId &&
    params?.stepId <= '2' &&
    newMigrationData?.project_current_step?.toString() !== params?.stepId &&
    parseInt(params?.stepId) < newMigrationData?.project_current_step;

  const isExecutionStarted =
    finalExecutionStarted ||
    newMigrationData?.migration_execution?.migrationStarted ||
    newMigrationData?.migration_execution?.migrationCompleted;

  // Only applies on the real "Start/Restart migration" step for this CMS (was hardcoded as 6, so non-CS never hit it).
  const destinationStackMigrated =
    params?.stepId === finalMigrationStepId &&
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
        {newMigrationData?.stepValue || 'Save and Continue'}
        </Button>
    </div>
  );
};

export default MigrationFlowHeader;
