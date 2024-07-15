import { validateArray } from '../../utilities/functions';
import { StepStatus } from '../Stepper/VerticalStepper/AutoVerticalStepper';
import LoadOrganisation from './Actions/LoadOrganisation';
import LoadStacks from './Actions/LoadStacks';
import OrganisationSummary from './Summary/OrganisationSummary';
import StacksSummary from './Summary/StacksSummary';
import { IStep } from '../../context/app/app.interface';

/**
 * Returns an updated step object based on the provided parameters.
 *
 * @param step - The original step object.
 * @param isCompleted - A boolean indicating whether the step is completed.
 * @param isMigrationLocked - A boolean indicating whether the migration is locked.
 * @param isPrevStepLocked - A boolean indicating whether the previous step is locked. Default is false.
 * @returns The updated step object.
 */
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
      summery: OrganisationSummary,
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
      summery: StacksSummary,
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

/**
 * Returns an array of component objects representing the steps in the destination stack.
 *
 * @param isCompleted - A boolean indicating whether the migration is completed.
 * @param isMigrationLocked - A boolean indicating whether the migration is locked.
 * @param allSteps - An array of IStep objects representing all the steps in the destination stack.
 * @returns An array of component objects representing the steps in the destination stack.
 */
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
          index > 0 ?? allSteps[index - 1].lock
        )
      )
    : [];
};
