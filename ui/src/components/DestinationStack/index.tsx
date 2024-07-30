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

type DestinationStackComponentProps = {
  destination_stack: string;
  org_id: string;
  isCompleted: boolean;
  projectData: MigrationResponse;
  handleStepChange: (currentStep: number) => void;
  handleOnAllStepsComplete:(flag : boolean)=>void;
};

const DestinationStackComponent = ({
  destination_stack,
  org_id,
  projectData,
  isCompleted,
  // handleStepChange,
  handleOnAllStepsComplete,
}: DestinationStackComponentProps) => {
  /** ALL HOOKS HERE */
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);
  const [stepperKey, setStepperKey] = useState<string>('v-mig-destination-step');
  const [internalActiveStepIndex, setInternalActiveStepIndex] = useState<number>(-1);

  const autoVerticalStepperComponent = useRef<any>(null);

  /** ALL CONTEXT HERE */
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  const organisationsList = useSelector((state:RootState)=>state?.authentication?.organisationsList);
  const dispatch = useDispatch();

  // const { projectId = '' } = useParams();

  // const navigate = useNavigate();

  const handleAllStepsComplete = (flag = false) => {
    handleOnAllStepsComplete(flag);
  };

  // const handleOnClick = async (event: MouseEvent) => {
  //   event?.preventDefault();
  //   //Update Data in backend
  //   await updateDestinationStack(selectedOrganisation?.value, projectId, {
  //     stack_api_key: newMigrationData?.destination_stack?.selectedStack?.value
  //   });
  //   handleStepChange(2);
  //   const res = await updateCurrentStepData(selectedOrganisation?.value, projectId);
  //   if (res) {
  //     const url = `/projects/${projectId}/migration/steps/3`;
  //     navigate(url, { replace: true });
  //   }
  // };

  const updateDestinationStackData = async () => {
    const selectedOrganisationData = validateArray(organisationsList)
      ? organisationsList?.find((org: IDropDown) => org?.value === org_id)
      : selectedOrganisation;

    let selectedStackData: IDropDown = {
      value: destination_stack,
      label: '',
      master_locale: '',
      locales: [],
      created_at: ''
    };

    //If stack is already selected and exist in backend, then fetch all stack list and filter selected stack.
    if (!isEmptyString(destination_stack)) {
      const stackData: any = await getAllStacksInOrg(
        selectedOrganisationData?.value || selectedOrganisation?.value,''
      );
      const stackArray = validateArray(stackData?.data?.stacks)
        ? stackData?.data?.stacks?.map((stack: StackResponse) => ({
            label: stack?.name,
            value: stack?.api_key,
            uid: stack?.api_key,
            master_locale: stack?.master_locale,
            locales: stack?.locales,
            created_at: stack?.created_at
          }))
        : [];
  
      stackArray.sort(
        (a: IDropDown, b: IDropDown) =>
          new Date(b?.created_at)?.getTime() - new Date(a?.created_at)?.getTime()
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
      const newMigData: IDestinationStack = {
        ...newMigrationData?.destination_stack,
        selectedOrg: selectedOrganisationData || selectedOrganisation,
        selectedStack: selectedStackData,
        stackArray: stackArray
      };
      dispatch(updateNewMigrationData({ destination_stack: newMigData }));
    }
        //Update newMigration Data for destination stack
    
      
    
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
      // setIsCompleted(true);
    }
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
        dispatch(updateMigrationData({ destinationStackData: DEFAULT_DESTINATION_STACK_DATA }));
        setIsLoading(false);
        return;
      }

      const destinationStackDataMapped: IDestinationStackComponent = {
        ...data,
        all_steps: getDestinationStackSteps(isCompleted, isMigrationLocked, data?.all_steps)
      };

      //updateDestinationStackData();

      dispatch(updateMigrationData({ destinationStackData: destinationStackDataMapped }));

      setIsLoading(false);

      //Check for migration Status and lock.
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
          <div className='stackTitle'>{migrationData?.destinationStackData?.title}</div>
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
