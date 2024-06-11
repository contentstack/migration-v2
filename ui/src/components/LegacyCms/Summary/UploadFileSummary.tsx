import { useContext, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppContext } from '../../../context/app/app.context';
import './summary.scss';
import { isEmptyString } from '../../../utilities/functions';
import { IStep } from '../../../context/app/app.interface';

interface UploadFileSummaryProps {
  stepComponentProps: any;
  stepData: IStep;
}

import { FileDetails } from '../../../context/app/app.interface';
import { RootState } from '../../../store';
import { Paragraph } from '@contentstack/venus-components';

interface Props {
  fileDetails: FileDetails;
}

export const FileComponent: React.FC<Props> = ({ fileDetails }) => {

  return (
    <div className="">
      {fileDetails?.isLocalPath ? (
        <div>
          <Paragraph className="p-3" tagName="p" variant='p1' text={`Local Path: ${fileDetails?.localPath}`}/>
          
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

  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
 const [isLoading, setIsLoading] = useState(false);
  return (
    <div className="row bg-white">
      {!isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.name) ? (
        <div className="col-11 ">
          <FileComponent fileDetails={newMigrationData?.legacy_cms?.uploadedFile?.file_details || {}} />
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
