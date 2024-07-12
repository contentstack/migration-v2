import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AutoVerticalStepper from '../Stepper/VerticalStepper/AutoVerticalStepper';
import { getDestinationStackSteps } from './StepperSteps';
import { CircularLoader } from '@contentstack/venus-components';
import { CS_ENTRIES } from '../../utilities/constants';
import {
  DEFAULT_DESTINATION_STACK_DATA,
  IDestinationStack,
  IDestinationStackComponent,
  IDropDown
} from '../../context/app/app.interface';
import './DestinationStack.scss';
import { isEmptyString, validateArray } from '../../utilities/functions';
import { getAllStacksInOrg } from '../../services/api/stacks.service';
import { MigrationResponse, StackResponse } from '../../services/api/service.interface';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { RootState } from '../../store';
import { updateMigrationData, updateNewMigrationData } from '../../store/slice/migrationDataSlice';

/**
 * Props for the DestinationStackComponent.
 */
type DestinationStackComponentProps = {
  destination_stack: string;
  org_id: string;
  isCompleted: boolean;
  projectData: MigrationResponse;
  handleStepChange: (currentStep: number) => void;
  handleOnAllStepsComplete: (flag: boolean) => void;
};

/**
 * Renders the DestinationStackComponent.
 * @param destination_stack - The destination stack value.
 * @param org_id - The organization ID.
 * @param projectData - The project data.
 * @param isCompleted - Flag indicating if the component is completed.
 * @param handleOnAllStepsComplete - Callback function for handling all steps completion.
 */
const DestinationStackComponent = ({
  destination_stack,
  org_id,
  projectData,
  isCompleted,
  handleOnAllStepsComplete,
}: DestinationStackComponentProps) => {
  /** ALL HOOKS HERE */

  /**
   * Flag indicating if the component is loading.
   */
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Flag indicating if the component is migration locked.
   */
  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);

  /**
   * The key for the stepper component.
   */
  const [stepperKey, setStepperKey] = useState<string>('v-mig-destination-step');

  /**
   * The internal active step index.
   */
  const [internalActiveStepIndex, setInternalActiveStepIndex] = useState<number>(-1);

  /**
   * Reference to the autoVerticalStepperComponent.
   */
  const autoVerticalStepperComponent = useRef<any>(null);

  /** ALL CONTEXT HERE */

  /**
   * The migration data from the Redux store.
   */
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);

  /**
   * The new migration data from the Redux store.
   */
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  /**
   * The selected organization from the Redux store.
   */
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);

  /**
   * The list of organizations from the Redux store.
   */
  const organisationsList = useSelector((state: RootState) => state?.authentication?.organisationsList);

  /**
   * The Redux dispatch function.
   */
  const dispatch = useDispatch();

  /**
   * Handles all steps completion.
   * @param flag - Flag indicating if all steps are completed.
   */
  const handleAllStepsComplete = (flag = false) => {
    handleOnAllStepsComplete(flag);
  };

  /**
   * Updates the destination stack data.
   */
  const updateDestinationStackData = async () => {
    // Update New Migration data

    const selectedOrganisationData = validateArray(organisationsList)
      ? organisationsList?.find((org: IDropDown) => org?.value === org_id)
      : selectedOrganisation;

    let selectedStackData: IDropDown = {
      value: destination_stack,
      label: '',
      master_locale: '',
      locales: [],
      created_at: '',
    };

    // If stack is already selected and exist in backend, then fetch all stack list and filter selected stack.
    if (!isEmptyString(destination_stack)) {
      const stackData: any = await getAllStacksInOrg(
        selectedOrganisationData?.value || selectedOrganisation?.value,
        ''
      );

      const stack =
        validateArray(stackData?.data?.stacks) &&
        stackData?.data?.stacks?.find((stack: StackResponse) => stack?.api_key === destination_stack);

      if (stack) {
        selectedStackData = {
          label: stack?.name,
          value: stack?.api_key,
          master_locale: stack?.master_locale,
          locales: stack?.locales,
          created_at: stack?.created_at,
        };
      }
    }

    // Make First Step Complete
    if (!isEmptyString(selectedOrganisationData?.value)) {
      setInternalActiveStepIndex(0);
    }

    // Complete step if all step are selected.
    if (
      !isEmptyString(selectedOrganisationData?.value) &&
      !isEmptyString(selectedStackData?.value)
    ) {
      setInternalActiveStepIndex(1);
    }

    // Update newMigration Data for destination stack
    const newMigData: IDestinationStack = {
      ...newMigrationData?.destination_stack,
      selectedOrg: selectedOrganisationData || selectedOrganisation,
      selectedStack: selectedStackData,
    };

    dispatch(updateNewMigrationData({ destination_stack: newMigData }));
  };

  /********** ALL USEEFFECT HERE *************/

  useEffect(() => {
    /**
     * Fetches the CMS data and updates the component state.
     */
    const fetchCMSData = async () => {
      // Check if offline CMS data field is set to true, if then read data from cms data file.
      const data = await getCMSDataFromFile(CS_ENTRIES?.DESTINATION_STACK);

      // Check for null
      if (!data) {
        dispatch(updateMigrationData({ destinationStackData: DEFAULT_DESTINATION_STACK_DATA }));
        setIsLoading(false);
        return;
      }

      const destinationStackDataMapped: IDestinationStackComponent = {
        ...data,
        all_steps: getDestinationStackSteps(isCompleted, isMigrationLocked, data?.all_steps),
      };

      dispatch(updateMigrationData({ destinationStackData: destinationStackDataMapped }));

      setIsLoading(false);

      // Check for migration Status and lock.
      // Status where Migration is to be Locked:
      setIsMigrationLocked(projectData?.status === 2 || projectData?.status === 5);
    };

    fetchCMSData();
  }, []);

  useEffect(() => {
    setStepperKey('destination-Vertical-stepper');
  }, [isLoading]);

  useEffect(() => {
    updateDestinationStackData();
  }, [selectedOrganisation]);

  useEffect(() => {
    if (autoVerticalStepperComponent?.current) {
      if (internalActiveStepIndex > -1) {
        autoVerticalStepperComponent?.current?.handleDynamicStepChange(internalActiveStepIndex);
      }

      if (
        internalActiveStepIndex > -1 &&
        internalActiveStepIndex === migrationData?.destinationStackData?.all_steps?.length - 1
      ) {
        autoVerticalStepperComponent?.current?.handleDynamicStepChange(
          internalActiveStepIndex,
          true
        );
      }
    }
  }, [internalActiveStepIndex]);

  /**
   * Renders the DestinationStackComponent.
   */
  return (
    <>
      {isLoading ? (
        <div className="row">
          <div className="col-12 text-center center-align">
            <CircularLoader />
          </div>
        </div>
      ) : (
        <div className="destination-stack-container">
          <div className="stackTitle">{migrationData?.destinationStackData?.title}</div>
          <AutoVerticalStepper
            key={stepperKey}
            steps={getDestinationStackSteps(
              isCompleted,
              isMigrationLocked == false,
              migrationData?.destinationStackData?.all_steps
            )}
            description={migrationData?.destinationStackData?.description}
            ref={autoVerticalStepperComponent}
            isEdit={!isMigrationLocked}
            isRequired={false}
            handleOnAllStepsComplete={handleAllStepsComplete}
          />
        </div>
      )}
    </>
  );
};

export default DestinationStackComponent;
