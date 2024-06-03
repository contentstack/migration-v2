import { useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import './summary.scss';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';
import { RootState } from '../../../store';


interface SelectCmsSummaryProps {
  stepData: IStep;
}

const SelectCmsSummary = (props: SelectCmsSummaryProps): JSX.Element => {
  //const { newMigrationData } = useContext(AppContext);
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);

  return (
    <div className="row">
      {!isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.group_name) &&
      !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.title) ? (
        <div className="col-12 bg-white">
          <StepIcon icon={newMigrationData?.legacy_cms?.selectedCms?.group_name} />{' '}
          <span className="summary-title">
            {newMigrationData?.legacy_cms?.selectedCms?.title || ''}
          </span>
        </div>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title"> {props?.stepData?.empty_step_placeholder}</span>
        </div>
      )}
    </div>
  );
};

export default SelectCmsSummary;
