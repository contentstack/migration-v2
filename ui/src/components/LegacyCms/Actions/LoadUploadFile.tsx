import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, INewMigration } from '../../../context/app/app.interface';
import { fileValidation, getConfig } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { Button, Paragraph } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';
import { updateFileFormatData } from '../../../services/api/migration.service';
import { useParams } from 'react-router';
import { ICardType , defaultCardType} from '../../../components/Common/Card/card.interface';

//import progressbar
import ProgressBar from '../../../components/Common/ProgressBar';
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
          <Paragraph tagName="p" variant='p1' text={`Local Path: ${fileDetails?.localPath}`}/>
          
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
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation); 

 
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(newMigrationData?.legacy_cms?.uploadedFile?.isValidated || false);
  const [showMessage, setShowMessage] = useState<boolean>(!!newMigrationData?.legacy_cms?.uploadedFile?.isValidated);
  const [validationMessgae, setValidationMessage] = useState<string>('');
  const [isValidationAttempted, setIsValidationAttempted] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState<boolean>(false);
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);
  const [cmsType, setCmsType]= useState('');
  const [fileDetails, setFileDetails] = useState<FileDetails>(newMigrationData?.legacy_cms?.uploadedFile?.file_details || {});
  const [fileExtension, setFileExtension] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [showProgress, setShowProgress]= useState<boolean>(false);

  const { projectId = '' } = useParams();
  
  
  const [selectedCard, setSelectedCard] = useState<ICardType>(
    newMigrationData?.legacy_cms?.selectedFileFormat ?? defaultCardType
  );

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    setIsLoading(true);
    setProgressPercentage(30);
    setShowProgress(true);

    const res: any = await fileValidation(projectId);
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

      await updateFileFormatData(selectedOrganisation?.value, projectId, {
        file_format: newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toString(),
        file_path: res?.data?.file_details?.localPath,
        is_fileValid: res?.status == 200 ? true : false,
        awsDetails:{
          awsRegion: res?.data?.file_details?.awsData?.awsRegion,
          bucketName: res?.data?.file_details?.awsData?.bucketName,
          buketKey: res?.data?.file_details?.awsData?.buketKey
        }
      });
      
      dispatch(updateNewMigrationData(newMigrationDataObj));
      
      
      if(! isEmptyString(newMigrationData?.legacy_cms?.affix) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id)){
        props.handleStepChange(props?.currentStep, true);
      }
      
    }
    else{
      setIsValidated(false);
      setValidationMessage('Validation Falied');
      setIsValidationAttempted(true);
      setProgressPercentage(100);
      await updateFileFormatData(selectedOrganisation?.value, projectId, {
        file_format: newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toString(),
        file_path: res?.data?.file_details?.localPath,
        is_fileValid: res?.status == 200 ? true : false,
        awsDetails:{
          awsRegion: res?.data?.file_details?.awsData?.awsRegion,
          bucketName: res?.data?.file_details?.awsData?.bucketName,
          buketKey: res?.data?.file_details?.awsData?.buketKey
        }
      });
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

    }

    setShowMessage(true);
    setIsLoading(false);
    setProgressPercentage(100);
    setTimeout(() => {
      setShowProgress(false); 
    }, 1000);
  
    
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
            isValidated: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
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
      if(selectedCard?.fileformat_id && res?.data?.awsData ){
        await updateFileFormatData(selectedOrganisation?.value, projectId, {
          file_format: selectedCard?.fileformat_id?.toString(),
          file_path: '',
          is_fileValid: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
          awsDetails:{
            awsRegion: res?.data?.awsData?.awsRegion,
            bucketName: res?.data?.awsData?.bucketName,
            buketKey: res?.data?.awsData?.buketKey
          }
        });

      }

        
    if (res?.data?.localPath !== newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath) {
      setIsDisabled(false); 
      setShowMessage(true);
      setValidationMessage('');
    }
      
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
      setIsDisabled(true);
      props.handleStepChange(props?.currentStep, true);
  
    }
    else{
      setIsValidated(false);
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
          {showProgress && 
            <div className='bar-container'>
              <ProgressBar percentage={progressPercentage} type='bar' color='#6c5ce7'/>
          </div>
          }
          
           <Button 
            className="validation-cta" 
            buttonType="secondary"
            onClick={handleOnFileUploadCompletion}
            isLoading={isLoading}
            loadingColor="#6c5ce7"
            version="v2"
            disabled={isDisabled}
          > 
            Validate
          </Button>
           
        </div>

      </div>
    </div>
  );
};

export default LoadUploadFile;
