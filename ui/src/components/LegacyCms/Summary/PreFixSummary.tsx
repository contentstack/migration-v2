import { useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import { isEmptyString } from '../../../utilities/functions';
import { DEFAULT_URL_TYPE, IStep } from '../../../context/app/app.interface';
import DocLink from '../../../components/Common/DocLink/DocLink';

import './summary.scss';
import { RootState } from '../../../store';

interface PreFixSummaryProps {
  stepData: IStep;
}

const PreFixSummary = (props: PreFixSummaryProps): JSX.Element => {
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const { restricted_keyword_link = DEFAULT_URL_TYPE, restricted_keyword_checkbox_text = '' } =
    migrationData.legacyCMSData;

  return (
    <div className="row">
      <DocLink
        cta={restricted_keyword_link}
        isCheckedBoxChecked={newMigrationData?.legacy_cms?.isRestictedKeywordCheckboxChecked}
        label={restricted_keyword_checkbox_text}
        isDisable={true}
      />
      {!isEmptyString(newMigrationData?.legacy_cms?.affix) ? (
        <div className="col-12  pb-2">
          <div className="stackselect affix-container">
            <span className="summary-title px-2">{newMigrationData?.legacy_cms?.affix || ''}</span>
          </div>
        </div>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title">{props?.stepData?.empty_step_placeholder}</span>
        </div>
      )}
    </div>
  );
};

export default PreFixSummary;
