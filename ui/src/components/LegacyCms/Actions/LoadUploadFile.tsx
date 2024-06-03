import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import DragAndDropFileUpload from '../../../components/Common/FileUpload';
import { AppContext } from '../../../context/app/app.context';
import { DEFAULT_FILE, IFile, INewMigration } from '../../../context/app/app.interface';
import { validateArray } from '../../../utilities/functions';
import { useParams } from 'react-router';
import { fileValidation } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
interface LoadUploadFileProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}

const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const dispatch = useDispatch();

  const { projectId = '' } = useParams();

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    const res: any = await fileValidation();

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData.legacy_cms,
        uploadedFile: {
          name: res?.data?.file_details?.localPath,
          url: res?.data?.file_details?.localPath,
          validation: res?.data?.message,
          isValidated: res?.data?.status == 200 ? true : false,
          file_details: {
            isLocalPath: res?.data?.file_details?.isLocalPath,
            cmsType: res?.data?.file_details?.cmsType,
            localPath: res?.data?.file_details?.localPath,
            awsData: {
              awsRegion: res?.data?.file_details?.awsData?.awsRegion,
              bucketName: res?.data?.file_details?.awsData?.bucketName,
              buketKey: res?.data?.file_details?.awsData?.buketKey
            }
          }
        }
      }
    };
    dispatch(updateNewMigrationData(newMigrationDataObj));

    props.handleStepChange(props?.currentStep, true);
  };

  const allowedFileExtentions = `.${
    newMigrationData?.legacy_cms?.selectedFileFormat?.title || 'zip'
  }`;
  useEffect(() => {
    handleOnFileUploadCompletion();
  }, []);

  return (
    <div className="row">
      <div className="col-12">
        {/* <DragAndDropFileUpload
          allowedFileExtentions={['.zip', allowedFileExtentions]}
          handleOnFileUpload={handleOnFileUploadCompletion}
          projectId={projectId}
        /> */}
        <div className="col-12 pb-2">
          <div className="validation-container">
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
