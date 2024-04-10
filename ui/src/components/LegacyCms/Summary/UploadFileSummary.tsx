import { useContext } from 'react';
import { AppContext } from '../../../context/app/app.context';
import { Icon } from '@contentstack/venus-components';
import './summary.scss';
import { TRASH } from '../../../common/assets';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';

interface UploadFileSummaryProps {
  stepComponentProps: any;
  stepData: IStep;
}

const UploadFileSummary = ({
  stepComponentProps,
  stepData
}: UploadFileSummaryProps): JSX.Element => {
  const { newMigrationData } = useContext(AppContext);

  return (
    <div className="row bg-white">
      {!isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.name) ? (
        <>
          <div className="col-11 ">
            <Icon icon="File" size="medium" className="configure_action_logo" />
            <span className="summary-title">
              {newMigrationData?.legacy_cms?.uploadedFile?.name || ''}
            </span>
          </div>
          <div className="col-1 ">
            <button className="btn p-0" onClick={stepComponentProps?.handleDeleteFile}>
              {TRASH}
            </button>
          </div>
        </>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title">{stepData?.empty_step_placeholder}</span>
        </div>
      )}
    </div>
  );
};

export default UploadFileSummary;
