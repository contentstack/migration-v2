import { useContext, useEffect, useRef, useState } from 'react';
import AutoVerticalStepper from '../Stepper/VerticalStepper/AutoVerticalStepper';
import { getDestinationStackSteps } from './StepperSteps';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, CircularLoader } from '@contentstack/venus-components';
//import { getEntries } from '../../services/contentstackSDK';
import { CS_ENTRIES, PROJECT_STATUS } from '../../utilities/constants';
import { AppContext } from '../../context/app/app.context';
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
import {
  updateCurrentStepData,
  updateDestinationStack
} from '../../services/api/migration.service';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

type DestinationStackComponentProps = {
  destination_stack: string;
  org_id: string;
  projectData: MigrationResponse;
};

const DestinationStackComponent = ({
  destination_stack,
  org_id,
  projectData
}: DestinationStackComponentProps) => {
  /** ALL HOOKS HERE */
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);
  const [stepperKey, setStepperKey] = useState<string>('v-mig-destination-step');
  const [internalActiveStepIndex, setInternalActiveStepIndex] = useState<number>(-1);

  const autoVerticalStepperComponent = useRef<any>(null);

  /** ALL CONTEXT HERE */
  const {
    migrationData,
    updateMigrationData,
    newMigrationData,
    updateNewMigrationData,
    selectedOrganisation,
    organisationsList
  } = useContext(AppContext);
  const { projectId = '' } = useParams();

  const navigate = useNavigate();

  const handleOnAllStepsComplete = (flag = false) => {
    setIsCompleted(flag);
  };

  const handleOnClick = async (event: MouseEvent) => {
    event?.preventDefault();
    //Update Data in backend
    await updateDestinationStack(selectedOrganisation?.value, projectId, {
      stack_api_key: newMigrationData?.destination_stack?.selectedStack?.value
    });

    const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
    if (res) {
      const url = `/projects/${projectId}/migration/steps/3`;
      navigate(url, { replace: true });
    }
  };

  const updateDestinationStackData = async () => {
    //Update New Migration data

    const selectedOrganisationData = validateArray(organisationsList)
      ? organisationsList?.find((org: IDropDown) => org?.value === org_id)
      : selectedOrganisation;

    let selectedStackData: IDropDown = {
      value: destination_stack,
      label: '',
      master_locale: '',
      locales:[],
      created_at: ''
    };

    //If stack is already selected and exist in backend, then fetch all stack list and filter selected stack.
    if (!isEmptyString(destination_stack)) {
      const stackData: any = await getAllStacksInOrg(
        selectedOrganisationData?.value || selectedOrganisation?.value
      );

      const stack =
        validateArray(stackData?.data?.stacks) &&
        stackData?.data?.stacks?.find(
          (stack: StackResponse) => stack?.api_key === destination_stack
        );

      if (stack) {
        selectedStackData = {
          label: stack?.name,
          value: stack?.api_key,
          master_locale: stack?.master_locale,
          locales: stack?.locales,
          created_at: stack?.created_at
        };
      }
    }

    //Make First Step Complete
    if (!isEmptyString(selectedOrganisationData?.value)) {
      setInternalActiveStepIndex(0);
    }

    //Complete step if all step are selected.
    if (
      !isEmptyString(selectedOrganisationData?.value) &&
      !isEmptyString(selectedStackData?.value)
    ) {
      setInternalActiveStepIndex(1);
      setIsCompleted(true);
    }

    //Update newMigration Data for destination stack
    const newMigData: IDestinationStack = {
      ...newMigrationData?.destination_stack,
      selectedOrg: selectedOrganisationData || selectedOrganisation,
      selectedStack: selectedStackData
    };

    updateNewMigrationData({ destination_stack: newMigData });
  };

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    const fetchCMSData = async () => {
      //check if offline CMS data field is set to true, if then read data from cms data file.
      const data = await getCMSDataFromFile(CS_ENTRIES?.DESTINATION_STACK);

      //fetch Legacy CMS Component Data from Contentstack CMS
      //const data = await getEntries({ contentType: CS_ENTRIES.DESTINATION_STACK })

      //Check for null
      if (!data) {
        updateMigrationData({ destinationStackData: DEFAULT_DESTINATION_STACK_DATA });
        setIsLoading(false);
        return;
      }

      const destinationStackDataMapped: IDestinationStackComponent = {
        ...data,
        all_steps: getDestinationStackSteps(isCompleted, isMigrationLocked, data?.all_steps)
      };

      //updateDestinationStackData();

      updateMigrationData({ destinationStackData: destinationStackDataMapped });

      setIsLoading(false);

      //Check for migration Status and lock.
      // Status where Migration is to be Locked:
      setIsMigrationLocked(
        projectData?.status === 2 ||
          projectData?.status === 5
      );
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
        autoVerticalStepperComponent?.current?.handleDynamicStepChange(internalActiveStepIndex, true);
      }
    }
  }, [internalActiveStepIndex]);

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
          <div className="row">
            <div className="col-12">
              <AutoVerticalStepper
                key={stepperKey}
                steps={getDestinationStackSteps(
                  isCompleted,
                  isMigrationLocked,
                  migrationData?.destinationStackData?.all_steps
                )}
                ref={autoVerticalStepperComponent}
                isEdit={!isMigrationLocked}
                handleOnAllStepsComplete={handleOnAllStepsComplete}
              />
            </div>
            {isCompleted && !isMigrationLocked ? (
              <div className="col-12">
                <div className="pl-40">
                  <Button version="v2" onClick={handleOnClick}>
                    {migrationData?.destinationStackData?.cta}
                  </Button>
                </div>
              </div>
            ) : (
              <></>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DestinationStackComponent;
