// Libraries
import { Icon } from '@contentstack/venus-components';

// Interface
import { MigrationFlowProps } from './migrationFlow.interface';

// Components
import FlowStepper from '../Stepper/FlowStepper/FlowStepper';

// Assets
import { CARET_RIGHT } from '../../common/assets';

// Style
import './index.scss';

const MigrationFlow = ({
  settingsText,
  settingsClick,
  showInfo,
  migrationStepsText,
  currentStep
}: MigrationFlowProps) => {
  return (
    <div className="d-flex flex-column justify-content-between">
      <div className="step-wrapper">
        <div className="outline-text">{migrationStepsText}</div>
        <FlowStepper currentStep={currentStep} />
      </div>

      <div className="basicinfo-tab">
        <div
          className={`d-flex justify-content-between basic-info-block-active`}
          onClick={settingsClick}
        >
          <div className="detail d-flex align-items-center">
            <Icon
              className="info-icon"
              icon={'Setting'}
              size="small"
              version="v2"
              active={showInfo ? true : false}
            />
            <p>{settingsText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationFlow;
