import { useContext } from 'react';
import { AppContext } from '../../../context/app/app.context';
import './summary.scss';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';

interface UploadFileSummaryProps {
  stepComponentProps: any;
  stepData: IStep;
}

import { FileDetails } from '../../../context/app/app.interface';

interface Props {
  fileDetails: FileDetails;
}

const FileComponent: React.FC<Props> = ({ fileDetails }) => {
  return (
    <div className="col-11">
      {fileDetails?.isLocalPath ? (
        <div>
          <p className="summary-title">Local Path: {fileDetails?.localPath}</p>
        </div>
      ) : (
        <div>
          <p className="summary-title">AWS Region: {fileDetails?.awsData?.awsRegion}</p>
          <p className="summary-title">Bucket Name: {fileDetails?.awsData?.bucketName}</p>
          <p className="summary-title">Bucket Key: {fileDetails?.awsData?.buketKey}</p>
        </div>
      )}
    </div>
  );
};

const UploadFileSummary = ({
  stepComponentProps,
  stepData
}: UploadFileSummaryProps): JSX.Element => {
  const { newMigrationData } = useContext(AppContext);

  return (
    <div className="row bg-white">
      {!isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.name) ? (
        <div className="col-11 ">
          <FileComponent fileDetails={newMigrationData?.legacy_cms?.uploadedFile?.file_details} />
          <br></br>
          <span className="summary-title">
            {newMigrationData?.legacy_cms?.uploadedFile?.validation}
          </span>

          {!newMigrationData?.legacy_cms?.uploadedFile?.isValidated ? (
            <p className="ValidationMessage__v2">Please upload the correct file</p>
          ) : (
            <></>
          )}
        </div>
      ) : (
        <div className="col-12 bg-white">
          <span className="summary-title">{stepData?.empty_step_placeholder}</span>
          {!newMigrationData?.legacy_cms?.uploadedFile?.isValidated ? (
            <p className="ValidationMessage__v2">Please upload the correct file</p>
          ) : (
            <></>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadFileSummary;
