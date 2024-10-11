import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, ICMSType, INewMigration } from '../../../context/app/app.interface';
import { fileValidation, getConfig } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import {  Button, CircularLoader, Paragraph } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';
import { useParams } from 'react-router';
import { ICardType } from '../../../components/Common/Card/card.interface';

//import progressbar
import ProgressBar from '../../../components/Common/ProgressBar';
interface LoadUploadFileProps {
  stepComponentProps: ()=>{};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}
interface Props {
  fileDetails: FileDetails;
}
interface UploadState {
  cmsType:string;
  fileExtension: string;
  fileFormat?: string;
  isConfigLoading:boolean;
  isLoading:boolean;
  isValidated: boolean;
  isDisabled?:boolean;
  processing: string;
  progressPercentage:number;
  showProgress: boolean;
  validationMessgae:string;
  fileDetails?: FileDetails
}

const FileComponent = ({fileDetails}:Props ) => { 
  
  return (
    <div>
      {fileDetails?.isLocalPath && (!isEmptyString(fileDetails?.localPath) || !isEmptyString(fileDetails?.awsData?.awsRegion)) ? (
        <div className='file-container'>
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

const saveStateToLocalStorage = (state:UploadState, projectId : string) => {
  sessionStorage.setItem(`uploadProgressState_${projectId}`, JSON.stringify(state));
};

const getStateFromLocalStorage = (projectId : string) => {
  const state = sessionStorage.getItem(`uploadProgressState_${projectId}`);
  return state ? JSON.parse(state) : null;
};

const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  //const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation); 
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);

  const newMigrationDataRef = useRef(newMigrationData);
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
  //const [isCancelLoading, setIsCancelLoading] = useState<boolean>(false);
  //const [setIsFormatValid] = useState<boolean>(false);

  const { projectId = '' } = useParams();


  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    setIsValidationAttempted(false);
    setValidationMessage('');
    setIsLoading(true);
    setProgressPercentage(30);
    setShowProgress(true);
    setProcessing('Processing...30%');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const {data, status} =  await fileValidation(projectId);
    

    setProgressPercentage(70);
    setProcessing('Processing...70%');


    await new Promise(resolve => setTimeout(resolve, 1000));
    
   
    const newMigrationDataObj: INewMigration = {
      ...newMigrationDataRef?.current,
      legacy_cms: {
        ...newMigrationDataRef?.current?.legacy_cms,
        uploadedFile: {
          name: data?.file_details?.localPath || '',
          url: data?.file_details?.localPath,
          validation: data?.message,
          isValidated: status == 200 ? true : false,
          file_details: {
            isLocalPath: data?.file_details?.isLocalPath,
            cmsType: data?.file_details?.cmsType,
            localPath: data?.file_details?.localPath,
            awsData: {
              awsRegion: data?.file_details?.awsData?.awsRegion,
              bucketName: data?.file_details?.awsData?.bucketName,
              buketKey: data?.file_details?.awsData?.buketKey
            }
          }
          
        }
      }
    };
   
    dispatch(updateNewMigrationData(newMigrationDataObj));

    if(status === 200){ 
      setIsValidated(true);
      setValidationMessage('Validation is successful');
   
      setIsDisabled(true); 
      
      if(! isEmptyString(newMigrationData?.legacy_cms?.affix) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) && ! isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id)){
        props.handleStepChange(props?.currentStep, true);
      }
      
    }
    else if(status === 500){
      setIsValidated(false);
      setValidationMessage('File not found');
      setIsValidationAttempted(true);
      setProgressPercentage(100);
    
    }
    else if(status === 429){
      setIsValidated(false);
      setValidationMessage('Rate limit exceeded. Please wait and try again.');
      setIsValidationAttempted(true);
      setProgressPercentage(100);

    }
    else{
      setIsValidated(false);
      setValidationMessage('Validation is failed');
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
    const fileName = filePath?.split('/')?.pop();
    const ext = fileName?.split('.')?.pop();
    const validExtensionRegex = /\.(pdf|zip|xml|json)$/i;
    return ext && validExtensionRegex?.test(`.${ext}`) ? `${ext}` : 'zip';
  };

  //function to get config details
  const getConfigDetails = async () =>{
    setIsConfigLoading(true);
    const {data, status} = await getConfig();
  
    if (!isEmptyString(fileDetails?.localPath) && data?.localPath !== fileDetails?.localPath) {
      setIsDisabled(false); 
      setShowMessage(true);
      setValidationMessage('');
      
    }
    
    if(status === 200){
      const extension = getFileExtension(data?.localPath);     
      setCmsType(data?.cmsType);
      setFileDetails(data);
      setFileExtension(extension);

      const newMigrationDataObj: INewMigration = {
        ...newMigrationDataRef?.current,
        legacy_cms: {
          ...newMigrationDataRef?.current?.legacy_cms,
          uploadedFile: {
            name: data?.localPath,
            url: data?.localPath,
            isValidated: newMigrationData?.legacy_cms?.uploadedFile?.isValidated,
            file_details: {
              isLocalPath: data?.isLocalPath,
              cmsType: data?.cmsType,
              localPath: data?.localPath,
              awsData: {
                awsRegion: data?.awsData?.awsRegion,
                bucketName: data?.awsData?.bucketName,
                buketKey: data?.awsData?.buketKey
              }
            }
          }
        }
      };

      if(isEmptyString(newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath) ){
        dispatch(updateNewMigrationData(newMigrationDataObj));

      }
      
      const { all_cms = [] } = migrationData?.legacyCMSData || {}; 
      let filteredCmsData:ICMSType[] = all_cms;
      if (data?.cmsType) {
        filteredCmsData = all_cms?.filter((cms: ICMSType) => cms?.parent?.toLowerCase() === data?.cmsType?.toLowerCase());
      }
   
      const isFormatValid = filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
        const isValid = format?.fileformat_id?.toLowerCase() === extension;
        return isValid;
      });

      //setIsFormatValid(isFormatValid);    
      
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
    newMigrationData?.legacy_cms?.selectedCms?.parent.toLowerCase() !== data?.cmsType.toLowerCase()))
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
      fileFormat: fileFormat ?? '',
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

  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
  }, [newMigrationData]);
  
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
