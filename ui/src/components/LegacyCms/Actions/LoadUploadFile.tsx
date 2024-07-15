import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, INewMigration } from '../../../context/app/app.interface';
import { fileValidation, getConfig } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import {  Button, CircularLoader, Paragraph } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';
import { removeContentMapper } from '../../../services/api/migration.service';
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

const saveStateToLocalStorage = (state:any, projectId : string) => {
  sessionStorage.setItem(`uploadProgressState_${projectId}`, JSON.stringify(state));
};

const getStateFromLocalStorage = (projectId : string) => {
  const state = sessionStorage.getItem(`uploadProgressState_${projectId}`);
  return state ? JSON.parse(state) : null;
};

const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation); 
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);

 
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(newMigrationData?.legacy_cms?.uploadedFile?.isValidated);
  const [showMessage, setShowMessage] = useState<boolean>(newMigrationData?.legacy_cms?.uploadedFile?.isValidated);
  const [validationMessgae, setValidationMessage] = useState<string>('');
  const [isValidationAttempted, setIsValidationAttempted] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState<boolean>( newMigrationData?.legacy_cms?.uploadedFile?.isValidated);
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(false);
  const [cmsType, setCmsType]= useState('');
  const [fileDetails, setFileDetails] = useState(newMigrationData?.legacy_cms?.uploadedFile?.file_details);
  const [fileExtension, setFileExtension] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [showProgress, setShowProgress]= useState<boolean>(false);
  const [fileFormat, setFileFormat] = useState(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id);
  const [processing, setProcessing] = useState('');
  const [isCancelLoading, setIsCancelLoading] = useState<boolean>(false);
  const [isFormatValid, setIsFormatValid] = useState<boolean>(false);

  const { projectId = '' } = useParams();
  
  
  const [selectedCard, setSelectedCard] = useState<ICardType>(
    newMigrationData?.legacy_cms?.selectedFileFormat ?? defaultCardType
  );

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    setIsValidationAttempted(false);
    setValidationMessage('');
    setIsLoading(true);
    setProgressPercentage(30);
    setShowProgress(true);
    setProcessing('Processing...30%');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const res: any = await fileValidation(projectId);

    setProgressPercentage(70);
    setProcessing('Processing...70%');


    await new Promise(resolve => setTimeout(resolve, 1000));
    
   
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

    if(res?.status === 200){ 
      setIsValidated(true);
      setValidationMessage('Validation is successful');
   
      setIsDisabled(true); 
      
      if(! isEmptyString(newMigrationData?.legacy_cms?.affix) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id)){
        props.handleStepChange(props?.currentStep, true);
      }
      
    }
    else if(res?.status === 500){
      setIsValidated(false);
      setValidationMessage('File not found');
      setIsValidationAttempted(true);
      setProgressPercentage(100);
    
    }
    else if(res?.status === 429){
      setIsValidated(false);
      setValidationMessage('Rate limit exceeded. Please wait and try again.');
      setIsValidationAttempted(true);
      setProgressPercentage(100);

    }
    else{
      //setIsValidated(false);
      setValidationMessage('Validation Falied');
      setIsValidationAttempted(true);
      setProgressPercentage(100);

    }

    setProgressPercentage(100);
    setProcessing('Processing...100%');

    await new Promise(resolve => setTimeout(resolve, 1000));

    setTimeout(() => { 
      setShowProgress(false); 
      setShowMessage(true);
    }, 1000);

    setIsLoading(false);
    saveStateToLocalStorage({
      isLoading,
      isConfigLoading,
      isValidated,
      validationMessgae,
      isDisabled,
      cmsType,
      fileDetails,
      fileExtension,
      progressPercentage,
      showProgress,
      fileFormat,
      processing
    }, projectId);
    

    
  };

  const getFileExtension = (filePath: string): string => {
    const ext = filePath.split('.').pop();
    return ext ? `${ext}` : '';
  };

  //function to get config details
  const getConfigDetails = async () =>{
    setIsConfigLoading(true);
    const res: any = await getConfig();
  
    if (!isEmptyString(fileDetails?.localPath) && res?.data?.localPath !== fileDetails?.localPath) {
      setIsDisabled(false); 
      setShowMessage(true);
      setValidationMessage('');
      
    }
    
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

      if(isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath) ){
        dispatch(updateNewMigrationData(newMigrationDataObj));

      }
      
      const { all_cms = [] } = migrationData?.legacyCMSData || {}; 
      let filteredCmsData:any = all_cms;
      if (res?.data?.cmsType) {
        filteredCmsData = all_cms?.filter((cms: any) => cms?.parent?.toLowerCase() === res?.data?.cmsType?.toLowerCase());
      }
   
      const isFormatValid = filteredCmsData[0]?.allowed_file_formats?.some((format: any) => {
        const isValid = format?.fileformat_id?.toLowerCase() === extension;
        return isValid;
      });

      setIsFormatValid(isFormatValid);    
      
      setIsDisabled(!isFormatValid);
      if(!isFormatValid){
        setValidationMessage('');
        dispatch(updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            uploadedFile: {
              isValidated: false,
            }


          }
        }))

      } 

    
    }
  if((! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent?.toLowerCase()) && 
    newMigrationData?.legacy_cms?.selectedCms?.parent.toLowerCase() !== res?.data?.cmsType.toLowerCase()))
    {     
      setIsValidated(false);
      setValidationMessage('file format is not appropriate');
      setIsValidationAttempted(true);
      setShowMessage(true);
      setIsLoading(false);
      setIsDisabled(true);
    }
     setIsConfigLoading(false);
    

  }

  const handleCancelValidation = async() => {
    setIsCancelLoading(true);
    const response = await removeContentMapper(selectedOrganisation?.uid || '',projectId);

    if (response?.status === 200) {
      setIsValidated(false);
      setValidationMessage('');
      setShowMessage(false);
      setIsDisabled(false);
      setIsValidationAttempted(false);
      const newMig = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          uploadedFile: {
            validation: validationMessgae,
            isValidated: false,
          }
        }
      }
      dispatch(updateNewMigrationData(newMig));
    }
  
    setIsCancelLoading(false);
  }

  useEffect(() => {
    if(isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath)){
      getConfigDetails();
    }
    
  }, []);

  useEffect(() => {
    const savedState = getStateFromLocalStorage(projectId);
    if (savedState) {
      setIsLoading(savedState.isLoading);
      setIsConfigLoading(savedState.isConfigLoading);
      setIsValidated(savedState?.isValidated);
      setValidationMessage(savedState?.validationMessage);
      setIsDisabled(savedState?.isDisabled);
      setCmsType(savedState.cmsType);
      setFileDetails(savedState.fileDetails);
      setFileExtension(savedState.fileExtension);
      setProgressPercentage(savedState.progressPercentage);
      setShowProgress(savedState.showProgress);
      setFileFormat(savedState.fileFormat);
      setProcessing(savedState.processing);
    }
    if (savedState && savedState.isLoading && !newMigrationData?.legacy_cms?.uploadedFile?.isValidated) {

      handleOnFileUploadCompletion();
    }
  },[]);

  useEffect(() => {
    saveStateToLocalStorage({
      isLoading,
      isConfigLoading,
      isValidated,
      validationMessgae,
      //isDisabled,
      cmsType,
      fileDetails,
      fileExtension,
      progressPercentage,
      showProgress,
      fileFormat,
      processing
    },projectId);
  }, [
    isLoading,
    isConfigLoading,
    isValidated,
    validationMessgae,
    //isDisabled,
    cmsType,
    fileDetails,
    fileExtension,
    progressPercentage,
    showProgress,
    fileFormat,
    processing
  ]);

  useEffect(()=>{ 
    if(newMigrationData?.legacy_cms?.uploadedFile?.isValidated && ! showProgress)
    {   
      
      setIsValidated(true);
      setShowMessage(true)
      setValidationMessage('Validation is successful');
      setIsDisabled(true);
      ! isEmptyString(newMigrationData?.legacy_cms?.affix) || ! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) || ! isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id) && props.handleStepChange(props?.currentStep, true);
  
    }

    // else{
    //   setIsValidated(false);
    // }
    
  },[isValidated,newMigrationData])

  useEffect(()=>{
    if(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id){
    setFileFormat(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id);}

  },[newMigrationData?.legacy_cms?.selectedFileFormat]);

  const validationClassName = isValidated ? 'success' : 'error';

  const containerClassName = `validation-container ${isValidationAttempted && !isValidated ? 'error-container pb-2' : ''}`;
  
  return (
    <div className="row">
      <div className="col-12">
        <div className="col-12">
          <div className={containerClassName}>
            {!isConfigLoading && !isEmptyString(fileDetails?.localPath) ? (
              <div className='file-icon-group'>
                <FileComponent fileDetails={fileDetails || {}} />
                {/* {(showMessage &&  !isCancelLoading) && 
                  (<Tooltip content='cancel validation' position='top'>
                    <Icon icon='CloseNoborder' version='v2' onClick={handleCancelValidation}/>

                  </Tooltip> )
                } */}
                {/* { isCancelLoading &&   
                  <div style={{justifyContent:'center', alignItems:'center', marginTop:'7px'}}>
                    <AsyncLoader color='$color-brand-primary-base'/>
                  </div>
              } */}
              </div>
              

            ) :
               
            <div className='loader'>
              <CircularLoader/>
             </div>
             }
            {showMessage  && ! showProgress &&
              (
              <>
                <Paragraph className={`${validationClassName}` } tagName='p' variant="p2" text={validationMessgae}/>
              </>
              )
            }
            {showProgress && isLoading && 
              <Paragraph className='pb-2 processing-test' tagName='p' variant="p2" text={processing}/>
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
