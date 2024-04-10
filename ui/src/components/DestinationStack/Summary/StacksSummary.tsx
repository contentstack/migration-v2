import { useContext } from 'react';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';
import LoadStacks from '../Actions/LoadStacks';

import './summary.scss';
interface StacksSummaryProps {
  stepData: IStep;
}

let LoadFileFormatProps: {
  stepComponentProps: any;
  currentStep: 1;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => {};
};

const StacksSummary = (props: StacksSummaryProps): JSX.Element => {
  const { newMigrationData } = useContext(AppContext);

  return (
    <div className="row">
      {/* {!isEmptyString(newMigrationData?.destination_stack?.selectedStack?.label) &&
      !isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value) && ( */}
      <div className="col-12">
        <LoadStacks
          stepComponentProps={LoadFileFormatProps?.stepComponentProps}
          currentStep={LoadFileFormatProps?.currentStep}
          handleStepChange={LoadFileFormatProps?.handleStepChange}
        />
      </div>
    </div>
  );
};

export default StacksSummary;
