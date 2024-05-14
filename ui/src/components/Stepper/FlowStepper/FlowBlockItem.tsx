// Libraries
import { FC, useState } from 'react';
import { Icon, Tooltip } from '@contentstack/venus-components';

// Interface
import { IFlowStep } from './flowStep.interface';

// Components
import StepIcon from './StepIcon';
import StepTitle from './StepTitle';

// Assets
import { CARET_RIGHT } from '../../../common/assets';

interface FlowBlockItemProps {
  isActive?: boolean;
  isCompleted?: boolean;
  step: IFlowStep;
  onStepClick: (step: IFlowStep, isCompleted: boolean) => () => void;
}

const FlowBlockItem: FC<FlowBlockItemProps> = (props: FlowBlockItemProps) => {
  //console.log("isComeplted : ", props?.isCompleted, props?.step);

  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleHoveredToggle = (flag: boolean) => () => {
    setIsHovered(flag);
  };

  return (
    <div className="ft-block-item" style={{ display: 'flex', flexDirection: 'row' }}>
      <div className="centered-flex-container step-name-icon">
        <Tooltip
          content={props?.isCompleted || false ? 'Completed' : 'Pending'}
          position="left"
          showArrow={false}
        >
          <div className="step_name_sticker">
            <span className="step_name_tested">{props?.step.name}</span>
            <Icon
              className="step_tested_check"
              icon={props?.isCompleted ? 'CheckCircle' : 'WarningBold'}
              version="v2"
              stroke={props?.isCompleted ? 'none' : '#475161'}
            ></Icon>
          </div>
        </Tooltip>
      </div>

      <div
        onMouseEnter={handleHoveredToggle(true)}
        onMouseLeave={handleHoveredToggle(false)}
        className={`ft-step-block-head ${props?.isActive ? 'ft-step-block-head-active' : ''} ${
          !(props?.isCompleted || props?.isActive) ? 'ft-step-block-head-disabled' : ''
        } `}
        onClick={props?.onStepClick(props?.step, props?.isCompleted || false)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            placeContent: 'space-around'
          }}
        >
          <Icon icon={props?.step?.group_name || 'Video'} version="v2" className="step-flow-icon" />
          {/* <StepIcon icon={props?.step?.group_name || 'play'} /> */}
          <StepTitle
            title={props?.step?.title}
            desc={props?.step?.description}
            stepActive={props?.isActive || false}
            isHovered={isHovered}
          />

          <div className="icon-container">
            {' '}
            {props?.isActive && !isHovered ? CARET_RIGHT : <></>}{' '}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowBlockItem;
