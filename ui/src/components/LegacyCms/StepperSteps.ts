import { validateArray } from '../../utilities/functions';
import { IStep } from '../../context/app/app.interface';
import { StepStatus } from '../Stepper/VerticalStepper/AutoVerticalStepper';
import LoadFileFormat from './Actions/LoadFileFormat';
import LoadSelectCms from './Actions/LoadSelectCms';
import LoadUploadFile from './Actions/LoadUploadFile';
import FileFormatSummary from './Summary/FileFormatSummary';
import SelectCmsSummary from './Summary/SelectCmsSummary';
import UploadFileSummary from './Summary/UploadFileSummary';
import LoadPreFix from './Actions/LoadPrefix';
import PreFixSummary from './Summary/PreFixSummary';

/**
 * Returns an updated step object based on the provided parameters.
 *
 * @param step - The original step object.
 * @param isCompleted - A boolean indicating whether the step is completed.
 * @param isMigrationLocked - A boolean indicating whether the migration is locked.
 * @returns The updated step object.
 */
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
        summery: SelectCmsSummary,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.ACTIVE,
      };
      break;
    }

    case 'Step2': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadPreFix,
        summery: PreFixSummary,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED,
      };
      break;
    }

    case 'Step3': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadFileFormat,
        summery: FileFormatSummary,
        status: isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED,
      };
      break;
    }

    case 'Step4': {
      // Insert Data, Summary component, and status
      updatedStep = {
        ...updatedStep,
        data: LoadUploadFile,
        summery: UploadFileSummary,
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

/**
 * Retrieves the legacy CMS steps based on the provided parameters.
 *
 * @param isCompleted - A boolean indicating whether the steps are completed.
 * @param isMigrationLocked - A boolean indicating whether the migration is locked.
 * @param allSteps - An array of IStep objects representing all the steps.
 * @returns An array of component objects representing the legacy CMS steps.
 */
export const getLegacyCMSSteps = (
  isCompleted: boolean,
  isMigrationLocked: boolean,
  allSteps: IStep[]
) => {
  return validateArray(allSteps)
    ? allSteps.map((step: IStep) => getComponentObject(step, isCompleted, isMigrationLocked))
    : [];
};
