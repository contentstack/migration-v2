import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileDetails, ICMSType, INewMigration } from '../../../context/app/app.interface';
import { fileValidation } from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { Button, Icon, Paragraph, TextInput } from '@contentstack/venus-components';
import { isEmptyString } from '../../../utilities/functions';
import { useParams } from 'react-router';
import { ICardType } from '../../../components/Common/Card/card.interface';
//import progressbar
import ProgressBar from '../../../components/Common/ProgressBar';
import { HTTP_CODES, VALIDATION_DOCUMENTATION_URL } from '../../../utilities/constants';
import { updateFileFormat } from '../../../services/api/project.service';
interface LoadUploadFileProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep: boolean) => void;
}
interface Props {
  fileDetails: FileDetails;
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

const FileComponent = ({ fileDetails }: Props) => {
  const dispatch = useDispatch();
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const authData = useSelector((state: RootState) => state?.authentication);
  const [isEditing, setIsEditing] = useState(newMigrationData?.iteration > 1 ? true : false);
  const [localPath, setLocalPath] = useState(fileDetails?.localPath || '');

  // Get the current path from Redux state
  const currentPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || fileDetails?.localPath || '';
  const projectId = useParams().projectId;
  const orgId = authData?.selectedOrganisation?.uid;

  const handleEditFile = async () => {
    setIsEditing(true);
    setLocalPath(currentPath);
  };

  const handleBlur = async () => {
    setIsEditing(false);
    
    // Update Redux state with new path
    const updatedMigrationData = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        uploadedFile: {
          ...newMigrationData?.legacy_cms?.uploadedFile,
          name: localPath,
          url: localPath,
          file_details: {
            ...newMigrationData?.legacy_cms?.uploadedFile?.file_details,
            localPath: localPath
          }
        }
      }
    };  
    
    dispatch(updateNewMigrationData(updatedMigrationData));
    const fileFormatData = {
      "file_path": localPath,
    }
    //const { status } = await updateFileFormat(orgId || '', projectId || '', fileFormatData);
    // if (status === HTTP_CODES?.OK) {
    //  console.info('File path updated successfully');
    // } else {
    //   console.info('Failed to update file path');
    // }
  };

  return (
    <div>
      {fileDetails?.isLocalPath &&
      (!isEmptyString(fileDetails?.localPath) ||
        !isEmptyString(fileDetails?.awsData?.awsRegion)) ? (
        <div className="file-container">
          <div className="file-path-text">
            {isEditing ? (
              <TextInput
                value={localPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalPath(e.target.value)}
                onBlur={handleBlur}
                width="full"
                version="v2"
                placeholder="Enter local path"
                aria-label="local path"
                autoFocus
              />
            ) : (
              <Paragraph tagName="p" variant="p1" text={`Local Path: ${currentPath}`} />
            )}
          </div>
          {isEditing && (
            <div className="edit-icon">
              <Icon icon="EditSmallActive" size="small" onClick={handleEditFile} />
            </div>
          )}
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

  const newMigrationDataRef = useRef(newMigrationData);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidated, setIsValidated] = useState<boolean>(
    newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.isValidated
  );
  const [showMessage, setShowMessage] = useState<boolean>(
    newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.isValidated
  );
  const [validationMessgae, setValidationMessage] = useState<string>('');
  const [isValidationAttempted, setIsValidationAttempted] = useState<boolean>(false);
  const [isDisabled, setIsDisabled] = useState<boolean>(
    newMigrationData?.legacy_cms?.uploadedFile?.isValidated ||
      isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix)
  );
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(false);
  const [cmsType, setCmsType] = useState('');
  const [fileDetails, setFileDetails] = useState(
    newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details
  );
  const [fileExtension, setFileExtension] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [showProgress, setShowProgress] = useState<boolean>(false);
  const [fileFormat, setFileFormat] = useState(
    newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id
  );
  const [processing, setProcessing] = useState('');
  const [affix, setAffix] = useState<string>(newMigrationData?.legacy_cms?.affix);
  const [reValidate, setReValidate] = useState<boolean>(
    newMigrationData?.legacy_cms?.uploadedFile?.reValidate || false
  );

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

      const { data, status } = await fileValidation(projectId, newMigrationData?.legacy_cms?.affix, newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '' );

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
                buketKey: data?.file_details?.awsData?.buketKey
              }
            },
            cmsType: data?.cmsType
          }
        }
      };

      dispatch(updateNewMigrationData(newMigrationDataObj));

      if (status === 200) {
        setIsValidated(true);
        setValidationMessage('File validated successfully.');

        setIsDisabled(true);

        if (
          !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) &&
          !isEmptyString(newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id)
        ) {
          props.handleStepChange(props?.currentStep, true);
        }
      } else if (status === 500) {
        setIsValidated(false);
        setValidationMessage('File not found');
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      } else if (status === 429) {
        setIsValidated(false);
        setValidationMessage('Rate limit exceeded. Please wait and try again.');
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      } else if (status === 401) {
        setIsValidated(false);
        setValidationMessage(
          `${data?.message} Please add correct file with ${newMigrationData?.legacy_cms?.selectedCms?.cms_id} supported format.`
        );
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      } else {
        setIsValidated(false);
        setValidationMessage(`${data?.message}`);
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

      if (
        !isEmptyString(fileDetails?.localPath) &&
        newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath !==
          fileDetails?.localPath &&
        !isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix)
      ) {
        setIsDisabled(false);
        setShowMessage(true);
        setValidationMessage('');
      }

      const extension = getFileExtension(
        newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || ''
      );
      setCmsType(newMigrationData?.legacy_cms?.uploadedFile?.cmsType);
      //setFileDetails(data);
      setFileExtension(extension);

      const { all_cms = [] } = migrationData?.legacyCMSData || {};
      let filteredCmsData: ICMSType[] = all_cms;
      if (newMigrationData?.legacy_cms?.uploadedFile?.cmsType) {
        filteredCmsData = all_cms?.filter(
          (cms: ICMSType) =>
            cms?.parent?.toLowerCase() ===
            newMigrationData?.legacy_cms?.uploadedFile?.cmsType?.toLowerCase()
        );
      }

      const isFormatValid = filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
        const isValid = format?.fileformat_id?.toLowerCase() === extension;
        return isValid;
      });

      //setIsFormatValid(isFormatValid);
      setIsDisabled(
        !isFormatValid || isEmptyString(newMigrationDataRef?.current?.legacy_cms?.affix)
      );
      if (!isFormatValid) {
        console.warn('⚠️ LoadUploadFile: File format is not valid, setting isValidated to false');
        setValidationMessage('⚠️ File format is not valid');
        setIsValidated(false);
        dispatch(
          updateNewMigrationData({
            ...newMigrationData,
            legacy_cms: {
              ...newMigrationData?.legacy_cms,
              uploadedFile: {
                ...newMigrationData?.legacy_cms?.uploadedFile,
                isValidated: false
              }
            }
          })
        );
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

  useEffect(() => {
    getConfigDetails();
  }, []);

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
      setValidationMessage('File validated successfully.');
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
    if (
      !newMigrationData?.legacy_cms?.uploadedFile?.isValidated &&
      !newMigrationData?.legacy_cms?.uploadedFile?.reValidate
    ) {
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
            {!isConfigLoading && !isEmptyString(fileDetails?.localPath) ? (
              // <div className='file-icon-group'>
              <FileComponent fileDetails={fileDetails || {}} />
            ) : (
              <div className="errorMessage fs-6">
                No file added. Please add the file to validate.
              </div>
            )}
            {showMessage && !showProgress && (
              <div className="message-container">
                <Paragraph
                  className={`${validationClassName}`}
                  tagName="p"
                  variant="p2"
                  text={validationMessgae}
                />
                {!isValidated && validationMessgae === 'File validation failed.' && (
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
            disabled={!(reValidate || !isDisabled)}>
            Validate File
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
