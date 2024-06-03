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

const FlowStepper = ({ currentStep }: IProp) => {
  /** ALL HOOKS Here */
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  //const { migrationData, updateMigrationData, selectedOrganisation } = useContext(AppContext);
  const migrationData = useSelector((state:any)=>state?.migration?.migrationData)

  const onStepClick = (step: IFlowStep, isCompleted: boolean) => async () => {
    if (params?.stepId === `${step?.name}`) return;
    dispatch(updateMigrationData({ currentFlowStep: step }))
    //updateMigrationData({ currentFlowStep: step });

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
