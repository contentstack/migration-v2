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

const getComponentObject = (
  step: IStep,
  isCompleted: boolean,
  isMigrationLocked: boolean
): IStep => {
  switch (step.step_id) {
    case 'Step1': {
      //Insert Data , Summary component and status
      step.data = LoadSelectCms;
      step.summery = SelectCmsSummary;
      step.status = isCompleted ? StepStatus.COMPLETED : StepStatus.ACTIVE;

      break;
    }

    case 'Step2': {
      //Insert Data , Summary component and status
      step.data = LoadPreFix;
      step.summery = PreFixSummary;
      step.status = isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED;

      break;
    }

    case 'Step3': {
      //Insert Data , Summary component and status
      step.data = LoadFileFormat;
      step.summery = FileFormatSummary;
      step.status = isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED;

      break;
    }

    case 'Step4': {
      //Insert Data , Summary component and status
      step.data = LoadUploadFile;
      step.summery = UploadFileSummary;
      step.status = isCompleted ? StepStatus.COMPLETED : StepStatus.DISABLED;

      break;
    }

    default:
      break;
  }

  step.lock = step.lock || isMigrationLocked;

  return step;
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
