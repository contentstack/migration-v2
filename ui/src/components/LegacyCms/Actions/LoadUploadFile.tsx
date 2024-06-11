import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, INewMigration } from '../../../context/app/app.interface';

import { useParams } from 'react-router';
import { fileValidation, getConfig } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { Button, Paragraph } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';

interface LoadUploadFileProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}
interface Props {
  fileDetails: FileDetails;
}

const FileComponent = ({fileDetails}:Props ) => {
  
  return (
    <div>
      {fileDetails?.isLocalPath && (!isEmptyString(fileDetails?.localPath) || !isEmptyString(fileDetails?.awsData?.awsRegion)) ? (
        <div>
          <Paragraph className="pb-2" tagName="p" variant='p1' text={`Local Path: ${fileDetails?.localPath}`}/>
          
        </div>
      ) : (
        <div>
          <p className="pb-2">AWS Region: {fileDetails?.awsData?.awsRegion}</p>
          <p className="pb-2">Bucket Name: {fileDetails?.awsData?.bucketName}</p>
          <p className="pb-2">Bucket Key: {fileDetails?.awsData?.buketKey}</p>
        </div>
      )}
    </div>
  );
};


const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
 
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(false);
  const [showMessage, setShowMessage] = useState<boolean>(false);
  const [validationMessgae, setValidationMessage] = useState<string>('');
  const [isValidationAttempted, setIsValidationAttempted] = useState<boolean>(false);
  const [isDasabled, setIsDisabled] = useState<boolean>(false);
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);
  const [cmsType, setCmsType]= useState('');
  const [fileDetails, setFileDetails] = useState<FileDetails>();
  const [fileExtension, setFileExtension] = useState<string>('');
  

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    setIsLoading(true);

    const res: any = await fileValidation();
  
    if(res?.status === 200){ 
      setIsValidated(true);
      setValidationMessage('Validated');
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          uploadedFile: {
            name: res?.data?.localPath,
            url: res?.data?.localPath,
            validation: res?.data?.message,
            isValidated: res?.status == 200 ? true : false,
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
  

    }
    else{
      setIsValidated(false);
      setValidationMessage('Validation Falied');
      setIsValidationAttempted(true)

    }

    setShowMessage(true);
    setIsLoading(false);
  
    
  };

  const getFileExtension = (filePath: string): string => {
    const ext = filePath.split('.').pop();
    return ext ? `${ext}` : '';
  };

  //function to get config details
  const getConfigDetails = async () =>{
    setIsConfigLoading(true);
    const res: any = await getConfig();

    
    if(res?.status === 200){
      const extension = getFileExtension(res?.data?.localPath);     
      setCmsType(res?.data?.cmsType);
      setFileDetails(res?.data);
      setFileExtension(extension);

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          uploadedFile: {
            name: res?.data?.localPath,
            url: res?.data?.localPath,
            file_details: {
              isLocalPath: res?.data?.isLocalPath,
              cmsType: res?.data?.cmsType,
              localPath: res?.data?.localPath,
              awsData: {
                awsRegion: res?.data?.awsData?.awsRegion,
                bucketName: res?.data?.awsData?.bucketName,
                buketKey: res?.data?.awsData?.buketKey
              }
            }
          }
        }
      };

      dispatch(updateNewMigrationData(newMigrationDataObj));
    
  }
  else if(! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent?.toLowerCase()) && 
    newMigrationData?.legacy_cms?.selectedCms?.parent.toLowerCase() !== res?.data?.cmsType.toLowerCase()
     || fileExtension !== newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id
    )
    {  
      setIsValidated(false);
      setValidationMessage('Validation Falied');
      setIsValidationAttempted(true);
      setShowMessage(true);
      setIsLoading(false);
      setIsDisabled(true);
    }
     setIsConfigLoading(false);
    

  }

  const allowedFileExtentions = `.${
    newMigrationData?.legacy_cms?.selectedFileFormat?.title || 'zip'
  }`;

  useEffect(() => {
    getConfigDetails();
  }, []);

  useEffect(()=>{
    if(newMigrationData?.legacy_cms?.uploadedFile?.isValidated){
      setIsValidated(true);
      setValidationMessage('Validated');
      props.handleStepChange(props?.currentStep, true);  
    }
    
  },[isValidated,newMigrationData])

  const validationClassName = isValidated ? 'success' : 'error';
  
  const containerClassName = `validation-container ${isValidationAttempted && !isValidated ? 'error-container pb-2' : ''}`;

  return (
    <div className="row">
      <div className="col-12">
        <div className="col-12">
          <div className={containerClassName}>
            {!isConfigLoading && !isEmptyString(cmsType) ? (
              <FileComponent fileDetails={fileDetails || {}} />
            ) :
              <Paragraph className="pb-2" tagName="p" variant='p1' text={'Please verify the CMS'}/>}
            {showMessage  &&
              (<Paragraph className={`${validationClassName} pb-2` } tagName='p' variant="p2" text={validationMessgae}/>)
            }
           
          </div>
           <Button className="validation-cta" buttonType="secondary"
           onClick={handleOnFileUploadCompletion}
           isLoading={isLoading}
           version={"v2"}
           disabled={isDasabled}>Validate</Button>
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
