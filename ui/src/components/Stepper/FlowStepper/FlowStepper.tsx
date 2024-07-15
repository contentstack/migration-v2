// Libraries
import { useContext } from 'react';
import { useParams, useNavigate } from 'react-router';
import { UseDispatch,useSelector } from 'react-redux';


// Interface
import { IFlowStep } from './flowStep.interface';

// Utilities
import { validateArray } from '../../../utilities/functions';

// Context
import { AppContext } from '../../../context/app/app.context';

// Components
import FlowBlock from './FlowBlock';
import FlowBlockItem from './FlowBlockItem';

// Styles
import './FlowStepper.scss';
import { useDispatch } from 'react-redux';
import { setMigrationData, updateMigrationData } from '../../../store/slice/migrationDataSlice';

type IProp = {
  currentStep: number;
};

/**
 * FlowStepper component displays a stepper for the migration flow steps.
 *
 * @param {IProp} props - The component props.
 * @param {number} props.currentStep - The current step of the migration flow.
 * @returns {JSX.Element} The rendered FlowStepper component.
 */
const FlowStepper = ({ currentStep }: IProp) => {
  /** ALL HOOKS Here */
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const migrationData = useSelector((state:any)=>state?.migration?.migrationData)

  /**
   * Handles the click event when a step is clicked in the stepper.
   *
   * @param {IFlowStep} step - The step object.
   * @param {boolean} isCompleted - Indicates if the step is completed.
   * @returns {Promise<void>} A Promise that resolves when the click event is handled.
   */
  const onStepClick = (step: IFlowStep, isCompleted: boolean) => async () => {
    if (params?.stepId === `${step?.name}`) return;
    dispatch(updateMigrationData({ currentFlowStep: step }))


    const url = `/projects/${params?.projectId}/migration/steps/${step?.name}`;

    navigate(url, { replace: true });
  };

  return (
    <FlowBlock className={'ft-block'}>
      {validateArray(migrationData?.allFlowSteps) ? (
        migrationData?.allFlowSteps?.map((step: IFlowStep) => {
          return (
            <FlowBlockItem
              onStepClick={onStepClick}
              step={step}
              isActive={params?.stepId === `${step?.name}`}
              key={step?.flow_id}
              isCompleted={currentStep > +step?.name}
            />
          );
        })
      ) : (
        <></>
      )}
    </FlowBlock>
  );
};

export default FlowStepper;
