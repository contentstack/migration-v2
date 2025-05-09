import { validateArray } from '../../utilities/functions';
import { StepStatus } from '../Stepper/VerticalStepper/AutoVerticalStepper';
import LoadOrganisation from './Actions/LoadOrganisation';
import LoadStacks from './Actions/LoadStacks';
import { IStep } from '../../context/app/app.interface';

const getComponentObject = (
  step: IStep,
  isCompleted: boolean,
  isMigrationLocked: boolean,
  isPrevStepLocked = false
): IStep => {
  let updatedStep = { ...step };
  switch (step.step_id) {
    case 'Step1': {
      //Insert Data , Summary component and status
      updatedStep = {
        ...updatedStep,
      data: LoadOrganisation,
      status:
        isCompleted || isPrevStepLocked || isMigrationLocked ? StepStatus.COMPLETED : StepStatus.ACTIVE,
      }
      break;
    }

    case 'Step2': {
      //Insert Data , Summary component and status
      updatedStep = {
        ...updatedStep,
      data:  LoadStacks,
      status:
        isCompleted || isPrevStepLocked || isMigrationLocked ? StepStatus.COMPLETED : StepStatus.ACTIVE,
      }
      break;
    }

    default:
      break;
  }

  updatedStep.lock = updatedStep.lock || isMigrationLocked;

  return updatedStep;
};

export const getDestinationStackSteps = (
  isCompleted: boolean,
  isMigrationLocked: boolean,
  allSteps: IStep[]
) => {
 
  return validateArray(allSteps)
    ? allSteps.map((step: IStep, index: number) =>
        getComponentObject(
          step,
          isCompleted,
          isMigrationLocked,
          index > 0 && allSteps[index - 1].lock
        )
      )
    : [];
};
