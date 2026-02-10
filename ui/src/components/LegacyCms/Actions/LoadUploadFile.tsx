import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, ICMSType, INewMigration } from '../../../context/app/app.interface';
import { fileValidation } from '../../../services/api/upload.service';
import { getMigrationData } from '../../../services/api/migration.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { Button, Paragraph } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';
import { useParams } from 'react-router';
import { ICardType } from '../../../components/Common/Card/card.interface';

//import progressbar
import ProgressBar from '../../../components/Common/ProgressBar';
import { VALIDATION_DOCUMENTATION_URL } from '../../../utilities/constants';
interface LoadUploadFileProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}
interface Props {
  fileDetails: FileDetails;
  fileFormatId?: string; // from selectedFileFormat.fileformat_id (driven by legacyCms.json)
}
interface UploadState {
  cmsType: string;
  fileExtension: string;
  fileFormat?: string;
  isConfigLoading: boolean;
  isLoading: boolean;
  isValidated?: boolean;
  isDisabled?: boolean;
  processing: string;
  progressPercentage: number;
  showProgress: boolean;
  validationMessgae: string;
  fileDetails?: FileDetails;
}


/**
 * Data-driven FileComponent:
 * Rendering is driven by `fileFormatId` (from legacyCms.json → selectedFileFormat.fileformat_id).
 * - 'sql' → MySQL connection details
 * - any other format with isLocalPath → local file/directory path
 * - !isLocalPath → AWS S3 details
 * No CMS-specific branches — adding a new CMS to legacyCms.json works automatically.
 */
const FileComponent = ({ fileDetails, fileFormatId }: Props) => {
  const isSQL = fileFormatId?.toLowerCase() === 'sql';

  return (
    <div>
      {isSQL ? (
        // ✅ SQL format (from legacyCms.json allowed_file_formats): show MySQL details
        fileDetails?.mySQLDetails && (
          <div>
            <p className="pb-2">Host: {fileDetails?.mySQLDetails?.host}</p>
            <p className="pb-2">Database: {fileDetails?.mySQLDetails?.database}</p>
            <p className="pb-2">User: {fileDetails?.mySQLDetails?.user}</p>
          </div>
        )
      ) : fileDetails?.isLocalPath ? (
        // ✅ Local path (file or directory — format driven by legacyCms.json)
        <div className="file-container">
          <Paragraph tagName="p" variant="p1" text={`Local Path: ${fileDetails?.localPath}`} />
        </div>
      ) : (
        // ✅ AWS S3 details (isLocalPath is false)
        <div>
          <p className="pb-2">AWS Region: {fileDetails?.awsData?.awsRegion}</p>
          <p className="pb-2">Bucket Name: {fileDetails?.awsData?.bucketName}</p>
          <p className="pb-2">Bucket Key: {fileDetails?.awsData?.bucketKey}</p>
        </div>
      )}
    </div>
  );
};

const saveStateToLocalStorage = (state: UploadState, projectId: string) => {
  sessionStorage.setItem(`uploadProgressState_${projectId}`, JSON.stringify(state));
};

const getStateFromLocalStorage = (projectId: string) => {
  const state = sessionStorage.getItem(`uploadProgressState_${projectId}`);
  return state ? JSON.parse(state) : null;
};

const LoadUploadFile = (props: LoadUploadFileProps) => {
  /****  ALL HOOKS HERE  ****/

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );

  const newMigrationDataRef = useRef(newMigrationData);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.isValidated);
  const [showMessage, setShowMessage] = useState<boolean>(newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.isValidated);
  const [validationMessgae, setValidationMessage] = useState<string>('');
  const [isValidationAttempted, setIsValidationAttempted] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState<boolean>(
    newMigrationData?.legacy_cms?.uploadedFile?.isValidated ||
      isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix)
  );
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(false);
  const [cmsType, setCmsType]= useState('');
  // Use newMigrationData directly from Redux, not the ref, so it updates when Redux changes
  const [fileDetails, setFileDetails] = useState(newMigrationData?.legacy_cms?.uploadedFile?.file_details);
  const [fileExtension, setFileExtension] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [fileFormat, setFileFormat] = useState(
    newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id
  );
  const [processing, setProcessing] = useState('');
  const [affix, setAffix] = useState<string>(newMigrationData?.legacy_cms?.affix);
  const [reValidate, setReValidate] = useState<boolean>(newMigrationData?.legacy_cms?.uploadedFile?.reValidate || false);

  const { projectId = '' } = useParams();

  //Handle further action on file is uploaded to server
  const handleOnFileUploadCompletion = async () => {
    try {
      setIsValidationAttempted(false);
      setValidationMessage('');
      setIsLoading(true);
      setProgressPercentage(30);
      setShowProgress(true);
      setProcessing('Processing...30%');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const { data, status } = await fileValidation(projectId, newMigrationData?.legacy_cms?.affix);
      
      setProgressPercentage(70);
      setProcessing('Processing...70%');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newMigrationDataObj: INewMigration = {
        ...newMigrationDataRef?.current,
        legacy_cms: {
          ...newMigrationDataRef?.current?.legacy_cms,
          uploadedFile: {
            ...newMigrationDataRef?.current?.legacy_cms?.uploadedFile,
            name: data?.file_details?.localPath || '',
            url: data?.file_details?.localPath,
            validation: data?.message,
            isValidated: status == 200 ? true : false,
            reValidate: false,
            file_details: {
              isLocalPath: data?.file_details?.isLocalPath,
              cmsType: data?.file_details?.cmsType,
              localPath: data?.file_details?.localPath,
              awsData: {
                awsRegion: data?.file_details?.awsData?.awsRegion,
                bucketName: data?.file_details?.awsData?.bucketName,
                bucketKey: data?.file_details?.awsData?.bucketKey
              },
              mySQLDetails: {
                host: data?.file_details?.mySQLDetails?.host,
                user: data?.file_details?.mySQLDetails?.user,
                database: data?.file_details?.mySQLDetails?.database,
                port: data?.file_details?.mySQLDetails?.port
              },
              assetsConfig: {
                base_url: data?.file_details?.assetsConfig?.base_url,
                public_path: data?.file_details?.assetsConfig?.public_path
              }
            },
            cmsType: data?.cmsType
          }
        }
      };

      // Ensure selectedFileFormat is preserved in the migration data update.
      // selectedFileFormat is already set by LoadSelectCms from legacyCms.json's allowed_file_formats.
      // If not yet set (edge case), fall back to the current Redux state.
      if (status === 200 && !newMigrationDataObj.legacy_cms.selectedFileFormat) {
        newMigrationDataObj.legacy_cms.selectedFileFormat =
          newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat;
      }

      // Update the ref immediately before dispatching to avoid stale data in subsequent operations
      newMigrationDataRef.current = newMigrationDataObj;
      dispatch(updateNewMigrationData(newMigrationDataObj));

      // Derive SQL check from selectedFileFormat (data-driven via legacyCms.json)
      const currentFormatId = newMigrationDataObj?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase();
      const isSQL = currentFormatId === 'sql';

      if (status === 200) {
        setIsValidated(true);
        setValidationMessage(
          isSQL 
            ? 'Connection established successfully.' 
            : 'File validated successfully.'
        );

        // 🔧 FIX: Fetch updated project data to get source_locales and dispatch to Redux
        // This ensures the Language Mapper has access to source locales immediately after validation
        try {
          if (selectedOrganisation?.value && projectId) {
            const migrationDataResponse = await getMigrationData(selectedOrganisation?.value, projectId);
            const projectData = migrationDataResponse?.data;
            
            if (projectData?.source_locales && Array.isArray(projectData.source_locales)) {
              // Dispatch source_locales to Redux so LanguageMapper can access them
              // Use newMigrationDataObj (the just-dispatched data) instead of stale ref
              const updatedMigrationData: INewMigration = {
                ...newMigrationDataObj,
                destination_stack: {
                  ...newMigrationDataObj?.destination_stack,
                  sourceLocale: projectData.source_locales
                }
              };
              // Update ref again before second dispatch
              newMigrationDataRef.current = updatedMigrationData;
              dispatch(updateNewMigrationData(updatedMigrationData));
            }
          }
        } catch (fetchError) {
          console.warn('⚠️ [LoadUploadFile] Could not fetch source_locales:', fetchError);
          // Don't block the flow if this fails
        }

        setIsDisabled(true);

        if (
          !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) &&
          !isEmptyString(newMigrationDataObj?.legacy_cms?.selectedFileFormat?.fileformat_id)
        ) {
          props.handleStepChange(props?.currentStep, true);
        }
      } else if (status === 500) {
        setIsValidated(false);
        setValidationMessage(
          isSQL 
            ? 'Connection failed' 
            : 'File not found'
        );
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      } else if (status === 429) {
        setIsValidated(false);
        setValidationMessage('Rate limit exceeded. Please wait and try again.');
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      } else {
        setIsValidated(false);
        // For SQL connections, show the specific backend error message
        // For other formats, show generic validation failed message
        setValidationMessage(
          isSQL && data?.message 
            ? data.message 
            : 'Validation failed.'
        );
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      }

      setProgressPercentage(100);
      setProcessing('Processing...100%');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setTimeout(() => {
        setShowProgress(false);
        setShowMessage(true);
      }, 1000);

      setIsLoading(false);

      saveStateToLocalStorage(
        {
          isLoading,
          isConfigLoading,
          //isValidated,
          validationMessgae,
          isDisabled,
          cmsType,
          //fileDetails,
          fileExtension,
          progressPercentage,
          showProgress,
          fileFormat,
          processing
        },
        projectId
      );
    } catch (error) {
      return error;
    }
  };

  const getFileExtension = (filePath: string): string => {
    const fileName = filePath?.split('/')?.pop();
    const ext = fileName?.split('.')?.pop();
    const validExtensionRegex = /\.(pdf|zip|xml|json)$/i;
    return ext && validExtensionRegex?.test(`.${ext}`) ? `${ext}` : 'zip';
  };

  //function to get config details
  const getConfigDetails = async () => {
    try {
      //setIsConfigLoading(true);
  
    if (!isEmptyString(fileDetails?.localPath) && newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath !== fileDetails?.localPath && !isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix)) {
      setIsDisabled(false); 
      setShowMessage(true);
      setValidationMessage('');
      
    }
    
      // Derive SQL check from selectedFileFormat (data-driven via legacyCms.json)
      const isSQL = newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() === 'sql';
      
      let extension = '';
      let isFormatValid = false;
      
      if (isSQL) {
        // For SQL connections, check if SQL format is allowed for the CMS
        extension = 'sql';
        const { all_cms = [] } = migrationData?.legacyCMSData || {}; 
        // Fix: Use file_details.cmsType instead of uploadedFile.cmsType
        const cmsTypeValue = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType || 
                            newMigrationData?.legacy_cms?.uploadedFile?.cmsType || '';
        const filteredCmsData = all_cms?.filter((cms: ICMSType) => 
          cms?.parent?.toLowerCase() === cmsTypeValue?.toLowerCase()
        );
        
        isFormatValid = filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
          return format?.fileformat_id?.toLowerCase() === 'sql';
        }) || false;
      } else {
        // For file uploads, validate file extension
        extension = getFileExtension(newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '');     
        const { all_cms = [] } = migrationData?.legacyCMSData || {}; 
        let filteredCmsData:ICMSType[] = all_cms;
        // Fix: Use file_details.cmsType instead of uploadedFile.cmsType
        const cmsTypeValue = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType || 
                            newMigrationData?.legacy_cms?.uploadedFile?.cmsType || '';
        if (cmsTypeValue) {
          filteredCmsData = all_cms?.filter((cms: ICMSType) => cms?.parent?.toLowerCase() === cmsTypeValue?.toLowerCase());
        }
     
        isFormatValid = filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
          const isValid = format?.fileformat_id?.toLowerCase() === extension;
          return isValid;
        }) || false;
      }
      
      // Fix: Use file_details.cmsType as primary source
      setCmsType(newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType || 
                 newMigrationData?.legacy_cms?.uploadedFile?.cmsType || '');
      setFileExtension(extension);

      
      //setIsFormatValid(isFormatValid); 
      setIsDisabled(!isFormatValid || isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix));
      if(!isFormatValid){
        console.warn('⚠️ LoadUploadFile: File format is not valid, setting isValidated to false');
        setValidationMessage('⚠️ File format is not valid');
        setIsValidated(false);
        dispatch(updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            uploadedFile: {
              ...newMigrationData?.legacy_cms?.uploadedFile,
              isValidated: false,
            }
          }
        }))

      }
    //}
  // if((! isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent?.toLowerCase()) && 
  //   newMigrationData?.legacy_cms?.selectedCms?.parent.toLowerCase() !== data?.cmsType.toLowerCase()))
  //   {     
  //     setIsValidated(false);
  //     setValidationMessage('file format is not appropriate');
  //     setIsValidationAttempted(true);
  //     setShowMessage(true);
  //     setIsLoading(false);
  //     setIsDisabled(true);
  //   }
     setIsConfigLoading(false);
      
    } catch (error) {
      return error;
    }
  };

  // Update fileDetails whenever Redux state changes
  useEffect(() => {
    const latestFileDetails = newMigrationData?.legacy_cms?.uploadedFile?.file_details;
    
    // Always update fileDetails from Redux, even if it's empty (to clear stale data)
    setFileDetails(latestFileDetails);
    
  }, [newMigrationData?.legacy_cms?.uploadedFile?.file_details]);

  useEffect(() => {
      getConfigDetails();   
  }, [
    // Re-run when selectedFileFormat or file_details change (e.g., after LoadSelectCms or fetchProjectData dispatches)
    newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id,
    newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath
  ]);

  useEffect(() => {
    const savedState = getStateFromLocalStorage(projectId);
    
    if (savedState) {
      setIsLoading(savedState.isLoading);
      setIsConfigLoading(savedState.isConfigLoading);
      //setIsValidated(savedState?.isValidated);
      setValidationMessage(savedState?.validationMessage);
      //setIsDisabled(savedState?.isDisabled);
      setCmsType(savedState?.cmsType);
      //setFileDetails(savedState.fileDetails);
      setFileExtension(savedState?.fileExtension);
      setProgressPercentage(savedState?.progressPercentage);
      setShowProgress(savedState?.showProgress);
      setFileFormat(savedState?.fileFormat);
      setProcessing(savedState?.processing);
    }
    if (
      savedState &&
      savedState?.isLoading &&
      !newMigrationData?.legacy_cms?.uploadedFile?.isValidated
    ) {
      handleOnFileUploadCompletion();
    }
  }, []);

  useEffect(() => {
    saveStateToLocalStorage(
      {
        isLoading,
        isConfigLoading,
        //isValidated,
        validationMessgae,
        //isDisabled,
        cmsType,
        //fileDetails,
        fileExtension,
        progressPercentage,
        showProgress,
        fileFormat: fileFormat ?? '',
        processing
      },
      projectId
    );
  }, [
    isLoading,
    isConfigLoading,
    //isValidated,
    validationMessgae,
    //isDisabled,
    cmsType,
    //fileDetails,
    fileExtension,
    progressPercentage,
    showProgress,
    fileFormat,
    processing
  ]);

  useEffect(() => {
    if (
      newMigrationData?.legacy_cms?.uploadedFile?.isValidated &&
      !showProgress &&
      !newMigrationData?.legacy_cms?.uploadedFile?.reValidate
    ) {
      setIsValidated(true);
      setShowMessage(true);
      // Use selectedFileFormat.fileformat_id (data-driven via legacyCms.json) for SQL check
      setValidationMessage(
        newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() === 'sql'
          ? 'Connection established successfully.' 
          : 'File validated successfully.'
      );
      setIsDisabled(true);
      if (
        !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) ||
        !isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id)
      ) {
        props.handleStepChange(props?.currentStep, true);
      }
    }
    if (newMigrationData?.legacy_cms?.uploadedFile?.reValidate) {
      setValidationMessage('');
    }
    if(!newMigrationData?.legacy_cms?.uploadedFile?.isValidated && !newMigrationData?.legacy_cms?.uploadedFile?.reValidate){
      setIsDisabled(false);
    }
    setReValidate(newMigrationData?.legacy_cms?.uploadedFile?.reValidate || false);
  }, [isValidated, newMigrationData]);


  useEffect(() => {
    if (newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id) {
      setFileFormat(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id);
    }
  }, [newMigrationData?.legacy_cms?.selectedFileFormat]);

  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
    setAffix(newMigrationData?.legacy_cms?.affix);
  }, [newMigrationData]);

  const sanitizedCmsType = cmsType?.toLowerCase().replace(/[^\w\s-]/g, '');

  const documentationUrl = VALIDATION_DOCUMENTATION_URL?.[sanitizedCmsType];
  
  const validationClassName = isValidated ? 'success' : 'error';

  const containerClassName = `validation-container ${
    isValidationAttempted && !isValidated ? 'error-container pb-2' : ''
  }`;

  return (
    <div className="row">
      <div className="col-12">
        <div className="col-12">
          <div className={containerClassName}>
            {!isConfigLoading && (!isEmptyString(fileDetails?.localPath) || !isEmptyString(fileFormat)) ? (
              // <div className='file-icon-group'>
              <FileComponent fileDetails={fileDetails || {}} fileFormatId={fileFormat} />
            ) : (
              <div className='errorMessage fs-6'>No file added. Please add the file to validate.</div>
            )}
            {showMessage && !showProgress && (
              <div className="message-container">
                <Paragraph
                  className={`${validationClassName}`}
                  tagName="p"
                  variant="p2"
                  text={validationMessgae}
                />
                {!isValidated && validationMessgae === 'Validation failed.' && fileFormat?.toLowerCase() !== 'sql' && (
                  <p className={`${validationClassName} p2 doc-link`}>
                    Please check the requirements{' '}
                    <a href={documentationUrl} target="_blank" rel="noreferrer" className="link">
                      here
                    </a>
                  </p>
                )}
              </div>
            )}
            {showProgress && isLoading && (
              <Paragraph
                className="pb-2 processing-test"
                tagName="p"
                variant="p2"
                text={processing}
              />
            )}
          </div>
          {showProgress && (
            <div className="bar-container">
              <ProgressBar percentage={progressPercentage} type="bar" color="#6c5ce7" />
            </div>
          )}

          <Button
            className="validation-cta"
            buttonType="secondary"
            onClick={handleOnFileUploadCompletion}
            isLoading={isLoading}
            loadingColor="#6c5ce7"
            version="v2"
            disabled={!(reValidate || (!isDisabled))}
          > 
            {fileFormat?.toLowerCase() === 'sql' ? 'Check Connection' : 'File Validate'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
