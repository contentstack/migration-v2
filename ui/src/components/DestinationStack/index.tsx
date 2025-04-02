import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AutoVerticalStepper from '../Stepper/VerticalStepper/AutoVerticalStepper';
import { getDestinationStackSteps } from './StepperSteps';
import { CircularLoader } from '@contentstack/venus-components';
import { CS_ENTRIES } from '../../utilities/constants';
import {
  DEFAULT_DESTINATION_STACK_DATA,
  IDestinationStackComponent
} from '../../context/app/app.interface';
import './DestinationStack.scss';
import { MigrationResponse } from '../../services/api/service.interface';
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { RootState } from '../../store';
import { updateMigrationData } from '../../store/slice/migrationDataSlice';
import { AutoVerticalStepperRef } from '../LegacyCms';

type DestinationStackComponentProps = {
  isCompleted: boolean;
  projectData: MigrationResponse;
  handleOnAllStepsComplete: (flag: boolean) => void;
};

const DestinationStackComponent = ({
  projectData,
  isCompleted,
  // handleStepChange,
  handleOnAllStepsComplete
}: DestinationStackComponentProps) => {
  /** ALL HOOKS HERE */

  const [isMigrationLocked, setIsMigrationLocked] = useState<boolean>(false);
  const [stepperKey] = useState<string>('destination-Vertical-stepper');
  const [internalActiveStepIndex] = useState<number>(-1);

  const autoVerticalStepperComponent = useRef<AutoVerticalStepperRef>(null);

  /** ALL CONTEXT HERE */
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProjectMapped, setisProjectMapped] = useState<boolean>(newMigrationData?.isprojectMapped);
  const handleAllStepsComplete = (flag = false) => {
    handleOnAllStepsComplete(flag);
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

      dispatch(updateMigrationData({ destinationStackData: destinationStackDataMapped }));

      setIsLoading(false);

      //Check for migration Status and lock.
      // Status where Migration is to be Locked:
      setIsMigrationLocked(projectData?.status === 2 || projectData?.status === 5);
    };
    fetchCMSData();
  }, []);

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

  useEffect(()=>{
    setisProjectMapped(newMigrationData?.isprojectMapped);
  },[newMigrationData?.isprojectMapped]);

  return (
    <>
      {isLoading || isProjectMapped ? (
        <div className="loader-container">
          <CircularLoader />
        </div>
      ) : (
        <div className="destination-stack-container">
          <div className="stackTitle">{migrationData?.destinationStackData?.title}</div>
          <div className="row">
            <div className="col-12">
              <AutoVerticalStepper
                key={stepperKey}
                steps={getDestinationStackSteps(
                  isCompleted,
                  !isMigrationLocked,
                  migrationData?.destinationStackData?.all_steps
                )}
                description={migrationData?.destinationStackData?.description}
                ref={autoVerticalStepperComponent}
                isEdit={!isMigrationLocked}
                isRequired={false}
                handleOnAllStepsComplete={handleAllStepsComplete}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DestinationStackComponent;
