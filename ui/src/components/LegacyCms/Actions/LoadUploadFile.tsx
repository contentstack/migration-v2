import { useContext, useEffect } from 'react';
import DragAndDropFileUpload from '../../../components/Common/FileUpload';
import { AppContext } from '../../../context/app/app.context';
import { DEFAULT_FILE, IFile, INewMigration } from '../../../context/app/app.interface';
import { validateArray } from '../../../utilities/functions';
import { useParams } from 'react-router';

interface LoadUploadFileProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}

const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/
  const { newMigrationData, updateNewMigrationData } = useContext(AppContext);

  const { projectId = '' } = useParams();

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = (files: IFile[]) => {
    const file = validateArray(files) ? files?.[0] : DEFAULT_FILE;

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData.legacy_cms,
        uploadedFile: { ...file }
      }
    };

    updateNewMigrationData(newMigrationDataObj);

    props.handleStepChange(props.currentStep, true);
  };

  const allowedFileExtentions = `.${
    newMigrationData?.legacy_cms?.selectedFileFormat?.title || 'zip'
  }`;
  useEffect(() => {
    handleOnFileUploadCompletion([]);
  });

  return (
    <div className="row">
      <div className="col-12">
        {/* <DragAndDropFileUpload
          allowedFileExtentions={['.zip', allowedFileExtentions]}
          handleOnFileUpload={handleOnFileUploadCompletion}
          projectId={projectId}
        /> */}
        <div className="col-12 pb-2">
          <div className=" validation-container">
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
