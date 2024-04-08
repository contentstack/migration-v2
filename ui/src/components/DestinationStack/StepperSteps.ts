import { validateArray } from '../../utilities/functions';
import { StepStatus } from '../Stepper/VerticalStepper/AutoVerticalStepper';
import LoadOrganisation from './Actions/LoadOrganisation';
import LoadStacks from './Actions/LoadStacks';
import OrganisationSummary from './Summary/OrganisationSummary';
import StacksSummary from './Summary/StacksSummary';
import { IStep } from '../../context/app/app.interface';

const getComponentObject = (
  step: IStep,
  isCompleted: boolean,
  isMigrationLocked: boolean,
  isPrevStepLocked = false
): IStep => {
  switch (step.step_id) {
    case 'Step1': {
      //Insert Data , Summary component and status
      step.data = LoadOrganisation;
      step.summery = OrganisationSummary;
      step.status =
        isCompleted || step?.lock || isMigrationLocked ? StepStatus.COMPLETED : StepStatus.ACTIVE;

      break;
    }

    case 'Step2': {
      //Insert Data , Summary component and status
      step.data = LoadStacks;
      step.summery = StacksSummary;
      step.status =
        isCompleted || step?.lock || isMigrationLocked
          ? StepStatus.COMPLETED
          : isPrevStepLocked
          ? StepStatus.ACTIVE
          : StepStatus.DISABLED;

      break;
    }

    default:
      break;
  }

  step.lock = step.lock || isMigrationLocked;

  return step;
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
          index > 0 ?? allSteps[index - 1].lock
        )
      )
    : [];
};
