import { validateArray } from '../../utilities/functions';
import { IStep } from '../../context/app/app.interface';
import { StepStatus } from '../Stepper/VerticalStepper/AutoVerticalStepper';
import LoadFileFormat from './Actions/LoadFileFormat';
import LoadSelectCms from './Actions/LoadSelectCms';
import LoadUploadFile from './Actions/LoadUploadFile';
import LoadPreFix from './Actions/LoadPrefix';

const getComponentObject = (
  step: IStep,
  isCompleted: boolean,
  isMigrationLocked: boolean
): IStep => {
  let updatedStep = { ...step }; 
  switch (step.step_id) {
    case 'Step1': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadSelectCms,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.ACTIVE,
      };
      break;
    }

    case 'Step2': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadPreFix,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED,
      };
      break;
    }

    case 'Step3': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadFileFormat,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED,
      };
      break;
    }

    case 'Step4': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadUploadFile,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED,
      };
      break;
    }

    default:
      break;
  }

  updatedStep.lock = updatedStep.lock || isMigrationLocked;

  return updatedStep;
};

export const getLegacyCMSSteps = (
  isCompleted: boolean,
  isMigrationLocked: boolean,
  allSteps: IStep[]
) => {
  return validateArray(allSteps)
    ? allSteps.map((step: IStep) => getComponentObject(step, isCompleted, isMigrationLocked))
    : [];
};
