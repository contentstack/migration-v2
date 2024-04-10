import { useContext } from 'react';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';
import './summary.scss';

interface OrganisationSummaryProps {
  stepData: IStep;
}

const OrganisationSummary = (props: OrganisationSummaryProps): JSX.Element => {
  const { newMigrationData } = useContext(AppContext);

  return (
    <div className="row">
      {!isEmptyString(newMigrationData?.destination_stack?.selectedOrg?.uid) &&
      !isEmptyString(newMigrationData?.destination_stack?.selectedOrg?.value) ? (
        <div className="col-12 bg-white">
          <StepIcon icon={'contentstack'} />{' '}
          <span className="summary-title">
            {newMigrationData?.destination_stack?.selectedOrg?.label || ''}
          </span>
        </div>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title">{props?.stepData?.empty_step_placeholder}</span>
        </div>
      )}
    </div>
  );
};

export default OrganisationSummary;
