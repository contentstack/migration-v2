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

/**
 * Renders the MigrationFlow component.
 *
 * @param {Object} props - The component props.
 * @param {string} props.settingsText - The text for the settings.
 * @param {Function} props.settingsClick - The click event handler for the settings.
 * @param {boolean} props.showInfo - Indicates whether to show the info.
 * @param {string} props.migrationStepsText - The text for the migration steps.
 * @param {number} props.currentStep - The current step of the migration.
 * @returns {JSX.Element} The rendered MigrationFlow component.
 */
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
