import { useContext } from 'react';
import StepIcon from '../../../components/Stepper/FlowStepper/StepIcon';
import { AppContext } from '../../../context/app/app.context';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';

import './summary.scss';
import DocLink from '../../../components/Common/DocLink/DocLink';
import { ICardType } from '../../Common/Card/card.interface';

interface FileFormatSummaryProps {
  stepData: IStep;
}

const FileFormatSummary = ({ stepData }: FileFormatSummaryProps): JSX.Element => {
  const { newMigrationData, migrationData } = useContext(AppContext);

  const { doc_url = { href: '', title: '' }, allowed_file_formats = [] } =
    newMigrationData?.legacy_cms?.selectedCms || {};

  const { file_format_checkbox_text = '' } = migrationData.legacyCMSData;

  return (
    <div className="row">
      <div className="col-12">
        <DocLink
          cta={doc_url}
          isCheckedBoxChecked={newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked}
          label={file_format_checkbox_text}
          isDisable={true}
        />
      </div>
      {!isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.group_name) &&
      !isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.title) ? (
        <div className="col-12 bg-white">
          {allowed_file_formats.map((format: ICardType, index) => (
            <>
              <StepIcon icon={format?.group_name} />{' '}
              <span key={index} className="summary-title">
                {format?.title}
              </span>
              {'     '}
            </>
          ))}
        </div>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title">{stepData?.empty_step_placeholder}</span>
        </div>
      )}
    </div>
  );
};

export default FileFormatSummary;
