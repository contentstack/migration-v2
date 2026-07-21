import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import {
  FileDetails,
  ICMSType,
  IDropDown,
  INewMigration
} from '../../../context/app/app.interface';
import {
  fileValidation,
  uploadLocalFileToContainer
} from '../../../services/api/upload.service';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import {
  Button,
  FieldLabel,
  Icon,
  Paragraph,
  Select,
  TextInput,
  Notification
} from '@contentstack/venus-components';
import { isEmptyString, validateArray } from '../../../utilities/functions';
import {
  clearMigrationSourceSession,
  getMigrationSourceSession
} from '../../../utilities/migrationSourceSession';
import {
  HTTP_CODES,
  REGION_LOGIN_POPUP_POSTMESSAGE_SOURCE,
  VALIDATION_DOCUMENTATION_URL
} from '../../../utilities/constants';
import { useParams } from 'react-router';
import { ICardType } from '../../../components/Common/Card/card.interface';
import { store } from '../../../store';


//import progressbar
import ProgressBar from '../../../components/Common/ProgressBar';
import {
  getMigrationData,
  exportSourceStack,
  validateSourceExport,
  updateSourceConfigData,
  runSourceAudit
} from '../../../services/api/migration.service';
import { getAllStacksInOrg } from '../../../services/api/stacks.service';
import { getUserProfileWithToken } from '../../../services/api/user.service';

/** Set before opening regional login popup; applied when popup posts success. */
const PENDING_SOURCE_REGION_LOGIN_KEY = 'pendingSourceRegionLogin';

/** Region for the current app session (Redux profile or JWT payload). */
const getSessionContentstackRegion = (
  userRegion: string | undefined,
  authToken: string | undefined | null
): string | undefined => {
  const r = userRegion?.trim();
  if (r) return r;
  if (!authToken) return undefined;
  try {
    const payload = jwtDecode<{ region?: string }>(authToken);
    return payload?.region?.trim() || undefined;
  } catch {
    return undefined;
  }
};
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
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const isValidated = newMigrationData?.legacy_cms?.uploadedFile?.isValidated;
  const [isEditing, setIsEditing] = useState((newMigrationData?.iteration > 1 && !newMigrationData?.legacy_cms?.uploadedFile?.isValidated) ? true : false);
  const [localPath, setLocalPath] = useState(fileDetails?.localPath || '');
  const dispatch = useDispatch();
  const currentPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || fileDetails?.localPath || '';

  // SQL editing state — mirrors the local-path edit flow but for the 3 MySQL fields.
  // Prefer the most up-to-date MySQL values from Redux over the (potentially stale) prop,
  // so the edit inputs (which can start open when iteration > 1) don't seed/overwrite with stale data.
  const currentMysql = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.mysql || fileDetails?.mysql;
  const [isEditingSql, setIsEditingSql] = useState((newMigrationData?.iteration > 1 && !newMigrationData?.legacy_cms?.uploadedFile?.isValidated) ? true : false);
  const [sqlDetails, setSqlDetails] = useState({
    host: currentMysql?.host || '',
    database: currentMysql?.database || '',
    user: currentMysql?.user || ''
  });

  const handleEditFile = async () => {
    // Once the file is validated, editing the path is disabled
    if (isValidated) return;
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
    };

  const handleEditSql = async () => {
    // Once the connection is validated, editing the details is disabled
    if (isValidated) return;
    setIsEditingSql(true);
    setSqlDetails({
      host: currentMysql?.host || '',
      database: currentMysql?.database || '',
      user: currentMysql?.user || ''
    });
  };

  const handleSqlBlur = async (e: React.FocusEvent<HTMLDivElement>) => {
    // Only exit edit mode when focus leaves the whole group, not when moving
    // between the host/database/user inputs.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;

    setIsEditingSql(false);

    // Update Redux state with new MySQL details, preserving other mysql fields (e.g. port)
    const updatedMigrationData = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        uploadedFile: {
          ...newMigrationData?.legacy_cms?.uploadedFile,
          file_details: {
            ...newMigrationData?.legacy_cms?.uploadedFile?.file_details,
            mysql: {
              ...newMigrationData?.legacy_cms?.uploadedFile?.file_details?.mysql,
              host: sqlDetails.host,
              database: sqlDetails.database,
              user: sqlDetails.user
            }
          }
        }
      }
    };
    dispatch(updateNewMigrationData(updatedMigrationData));
  };


  return (
    <div>
      {isSQL ? (
        // ✅ SQL format (from legacyCms.json allowed_file_formats): show MySQL details
        fileDetails?.mysql && (
          <div className="file-container">
            <div className="file-path-text">
              {isEditingSql ? (
                <div className="sql-edit-fields" onBlur={handleSqlBlur}>
                  <TextInput
                    value={sqlDetails.host}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSqlDetails((prev) => ({ ...prev, host: e.target.value }))}
                    width="full"
                    version="v2"
                    placeholder="Enter host"
                    aria-label="MySQL host"
                    autoFocus
                  />
                  <TextInput
                    value={sqlDetails.database}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSqlDetails((prev) => ({ ...prev, database: e.target.value }))}
                    width="full"
                    version="v2"
                    placeholder="Enter database"
                    aria-label="MySQL database"
                  />
                  <TextInput
                    value={sqlDetails.user}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSqlDetails((prev) => ({ ...prev, user: e.target.value }))}
                    width="full"
                    version="v2"
                    placeholder="Enter user"
                    aria-label="MySQL user"
                  />
                </div>
              ) : (
                <div>
                  <p className="pb-2">Host: { currentMysql?.host }</p>
                  <p className="pb-2">Database: { currentMysql?.database }</p>
                  <p className="pb-2">User: { currentMysql?.user }</p>
                </div>
              )}
            </div>
            <div className={`edit-icon${isValidated ? ' edit-icon--disabled' : ''}`}>
              <Icon icon="EditSmallActive" size="small" onClick={handleEditSql} tooltipContent="Edit SQL Details" tooltipPosition='bottom'/>
            </div>
          </div>
        )
      ) : fileDetails?.isLocalPath ? (
        // ✅ Local path (file or directory — format driven by legacyCms.json)
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
            // Inserts zero-width spaces (​) after each "/" so a long path
            // wraps at segment boundaries instead of breaking mid-segment.
            // Displayed text is visually unchanged.
            <Paragraph
              tagName="p"
              variant="p1"
              text={`Local Path: ${currentPath?.replace(/\//g, '/​')}`}
            />
          )}
        </div>
        <div className={`edit-icon${isValidated ? ' edit-icon--disabled' : ''}`}>
          <Icon icon="EditSmallActive" size="small" onClick={handleEditFile} tooltipContent="Edit Local Path" />
        </div>
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
  const organisationsList = useSelector(
    (state: RootState) => state?.authentication?.organisationsList
  );

  const newMigrationDataRef = useRef( newMigrationData );
  // Keep the ref in sync with Redux so dispatches built from `ref.current` don't clobber
  // recent state (e.g. a fresh restart resets `iteration` and `isValidated`, but the ref
  // would otherwise still hold the pre-restart snapshot and overwrite those on next dispatch).
  useEffect( () =>
  {
    newMigrationDataRef.current = newMigrationData;
  }, [ newMigrationData ] );
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state?.authentication?.user);
  const authToken = useSelector((state: RootState) => state?.authentication?.authToken);
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
  // Use newMigrationData directly from Redux, not the ref, so it updates when Redux changes
  const [fileDetails, setFileDetails] = useState(
    newMigrationData?.legacy_cms?.uploadedFile?.file_details
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

  // Contentstack-specific state variables
  const isContentstackSource = newMigrationData?.legacy_cms?.selectedCms?.cms_id === 'contentstack';
  const sourceDetails = newMigrationData?.legacy_cms?.source_details;
  const isCredentialsMode =
    isContentstackSource && (sourceDetails?.source_mode || 'credentials') === 'credentials';

  const [sourceOrgOptions, setSourceOrgOptions] = useState<IDropDown[]>([]);
  const [sourceStackOptions, setSourceStackOptions] = useState<IDropDown[]>([]);
  const [isExportingStack, setIsExportingStack] = useState<boolean>(false);
  const [isValidatingExport, setIsValidatingExport] = useState<boolean>(false);
  const sourceRegionOptions: IDropDown[] = [
    { label: 'North America (NA)', value: 'NA', master_locale: '', locales: [], created_at: '' },
    { label: 'Europe (EU)', value: 'EU', master_locale: '', locales: [], created_at: '' },
    {
      label: 'Azure North America (AZURE_NA)',
      value: 'AZURE_NA',
      master_locale: '',
      locales: [],
      created_at: ''
    },
    {
      label: 'Azure Europe (AZURE_EU)',
      value: 'AZURE_EU',
      master_locale: '',
      locales: [],
      created_at: ''
    },
    {
      label: 'GCP North America (GCP_NA)',
      value: 'GCP_NA',
      master_locale: '',
      locales: [],
      created_at: ''
    }
  ];

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

      // Upload file/dir to container if path is a new local path (not already in container, not SQL).
      // upload-api reads from host filesystem mounted at /host and copies to /app/extracted_files.
      let resolvedPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '';
      const isSQLFormat = newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() === 'sql';
      const isAlreadyContainerPath = resolvedPath.startsWith('/app/extracted_files') || resolvedPath.startsWith('/data/');

      if (!isSQLFormat && !isAlreadyContainerPath) {
        const uploadResult = await uploadLocalFileToContainer(resolvedPath);
        if (uploadResult?.containerPath) {
          resolvedPath = uploadResult.containerPath;
        }
      }

      const validationMysql = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.mysql;
      const { data, status } = await fileValidation({
        projectId,
        affix: newMigrationData?.legacy_cms?.affix,
        localPath: resolvedPath,
        mysql: validationMysql
          ? {
              host: validationMysql.host,
              database: validationMysql.database,
              user: validationMysql.user
            }
          : undefined
      });

      setProgressPercentage(70);
      setProcessing('Processing...70%');

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Preserve existing file_details from Redux when validation fails,
      // since the API response may not include file_details on error.
      const existingFileDetails =
        newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.file_details;
      const responseFileDetails = data?.file_details;
      const isSuccess = status === 200;

      const newMigrationDataObj: INewMigration = {
        ...newMigrationDataRef?.current,
        legacy_cms: {
          ...newMigrationDataRef?.current?.legacy_cms, 
          uploadedFile: {
            ...newMigrationDataRef?.current?.legacy_cms?.uploadedFile,
            name: isSuccess
              ? responseFileDetails?.localPath || ''
              : newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.name || '',
            url: isSuccess
              ? responseFileDetails?.localPath
              : newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.url || '',
            validation: data?.message,
            isValidated: isSuccess,
            reValidate: false,
            file_details: isSuccess
              ? {
                  isLocalPath: responseFileDetails?.isLocalPath,
                  cmsType: responseFileDetails?.cmsType,
                  localPath: responseFileDetails?.localPath,
                  awsData: {
                    awsRegion: responseFileDetails?.awsData?.awsRegion,
                    bucketName: responseFileDetails?.awsData?.bucketName,
                    bucketKey: responseFileDetails?.awsData?.bucketKey
                  },
                  mysql: {
                    host: responseFileDetails?.mysql?.host,
                    user: responseFileDetails?.mysql?.user,
                    database: responseFileDetails?.mysql?.database,
                    port: responseFileDetails?.mysql?.port
                  },
                  assetsConfig: {
                    base_url: responseFileDetails?.assetsConfig?.base_url,
                    public_path: responseFileDetails?.assetsConfig?.public_path
                  }
                }
              : {
                  // On failure, preserve existing file_details so UI doesn't lose filled data
                  ...existingFileDetails
                },
            cmsType: isSuccess
              ? data?.cmsType
              : newMigrationDataRef?.current?.legacy_cms?.uploadedFile?.cmsType || ''
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

      let migrationPayload: INewMigration = newMigrationDataObj;

      // Derive SQL check from selectedFileFormat (data-driven via legacyCms.json)
      const currentFormatId =
        migrationPayload?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase();
      const isSQL = currentFormatId === 'sql';
      const isContentstackImported =
        isContentstackSource && (sourceDetails?.source_mode || 'credentials') === 'imported_export';

      if (status === 200) {
        setIsValidated(true);
        setValidationMessage(
          isSQL ? 'Connection established successfully.' : 'File validated successfully.'
        );

        try {
          if (selectedOrganisation?.value && projectId) {
            if (isContentstackImported) {
              await updateSourceConfigData(selectedOrganisation.value, projectId, {
                source_details: sourceDetails
              });
              await validateSourceExport(selectedOrganisation.value, projectId);
            }

            const migrationDataResponse = await getMigrationData(
              selectedOrganisation.value,
              projectId
            );
            const projectData = migrationDataResponse?.data;

            if (projectData?.source_locales && Array.isArray(projectData.source_locales)) {
              migrationPayload = {
                ...migrationPayload,
                legacy_cms: {
                  ...migrationPayload.legacy_cms,
                  cms: 'contentstack',
                  file_format: migrationPayload.legacy_cms?.file_format || 'json',
                  is_fileValid: true
                },
                destination_stack: {
                  ...migrationPayload.destination_stack,
                  sourceLocale: projectData.source_locales
                }
              };
            }
          }
        } catch (fetchError) {
          console.warn('⚠️ [LoadUploadFile] Could not fetch source_locales:', fetchError);
        }

        setIsDisabled(true);

        if (
          !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) &&
          !isEmptyString(migrationPayload?.legacy_cms?.selectedFileFormat?.fileformat_id)
        ) {
          props.handleStepChange(props?.currentStep, true);
        }
      } else if (status === 500) {
        setIsValidated(false);
        setValidationMessage(isSQL ? 'Connection failed' : 'File not found');
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
        setValidationMessage(isSQL && data?.message ? data.message : 'Validation failed.');
        setIsValidationAttempted(true);
        setProgressPercentage(100);
      }

      setProgressPercentage(100);
      setProcessing('Processing...100%');

      await new Promise((resolve) => setTimeout(resolve, 1000));
      newMigrationDataRef.current = migrationPayload;
      dispatch(updateNewMigrationData(migrationPayload));

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

      // Derive SQL check from selectedFileFormat (data-driven via legacyCms.json)
      const isSQL =
        newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id?.toLowerCase() === 'sql';

      let extension = '';
      let isFormatValid = false;

      if (isSQL) {
        // For SQL connections, check if SQL format is allowed for the CMS
        extension = 'sql';
        const { all_cms = [] } = migrationData?.legacyCMSData || {};
        // Fix: Use file_details.cmsType instead of uploadedFile.cmsType
        const cmsTypeValue =
          newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType ||
          newMigrationData?.legacy_cms?.uploadedFile?.cmsType ||
          '';
        const filteredCmsData = all_cms?.filter(
          (cms: ICMSType) => cms?.parent?.toLowerCase() === cmsTypeValue?.toLowerCase()
        );

        isFormatValid =
          filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
            return format?.fileformat_id?.toLowerCase() === 'sql';
          }) || false;
      } else {
        // For file uploads, validate file extension
        extension = getFileExtension(
          newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || ''
        );
        const { all_cms = [] } = migrationData?.legacyCMSData || {};
        let filteredCmsData: ICMSType[] = all_cms;
        // Fix: Use file_details.cmsType instead of uploadedFile.cmsType
        const cmsTypeValue =
          newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType ||
          newMigrationData?.legacy_cms?.uploadedFile?.cmsType ||
          '';
        if (cmsTypeValue) {
          filteredCmsData = all_cms?.filter(
            (cms: ICMSType) => cms?.parent?.toLowerCase() === cmsTypeValue?.toLowerCase()
          );
        }

        isFormatValid =
          filteredCmsData[0]?.allowed_file_formats?.some((format: ICardType) => {
            const isValid = format?.fileformat_id?.toLowerCase() === extension;
            return isValid;
          }) || false;
      }

      // Fix: Use file_details.cmsType as primary source
      setCmsType(
        newMigrationData?.legacy_cms?.uploadedFile?.file_details?.cmsType ||
          newMigrationData?.legacy_cms?.uploadedFile?.cmsType ||
          ''
      );
      setFileExtension(extension);

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
    if (
      !isEmptyString(newMigrationData?.legacy_cms?.affix) &&
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

  const applySourceRegionSelection = useCallback(
    (regionValue: string) => {
      const currentDetails = newMigrationData?.legacy_cms?.source_details || {};
      const defaultSourceDetails = {
        source_mode: 'credentials',
        source_region_id: '',
        source_org_id: '',
        source_stack_id: '',
        source_branch: '',
        imported_data_path: ''
      };
      const updatedSourceDetails = {
        ...defaultSourceDetails,
        ...currentDetails,
        source_region_id: regionValue,
        source_org_id: '',
        source_stack_id: ''
      };
      dispatch(
        updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            source_details: updatedSourceDetails
          }
        })
      );
    },
    [newMigrationData, dispatch]
  );

  /** Opens login in a new window (same pattern as SSO); parent applies region after postMessage. */
  const openRegionLoginInPopup = useCallback(async (regionValue: string) => {
    const existing = await getMigrationSourceSession();
    if (existing?.region && existing.region !== regionValue) {
      await clearMigrationSourceSession();
    }
    try {
      sessionStorage.setItem(PENDING_SOURCE_REGION_LOGIN_KEY, regionValue);
    } catch {
      /* ignore */
    }
    const url = `${window.location.origin}/login?region=${encodeURIComponent(regionValue)}&loginWindow=1`;
    const features =
      'width=520,height=720,left=80,top=48,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no';
    const win = window.open(url, 'csMigrationRegionAuth', features);
    if (!win) {
      try {
        sessionStorage.removeItem(PENDING_SOURCE_REGION_LOGIN_KEY);
      } catch {
        /* ignore */
      }
      Notification({
        notificationContent: {
          text: 'Sign-in window was blocked. Allow pop-ups for this site, then select the region again.'
        },
        type: 'error'
      });
      return;
    }
    Notification({
      notificationContent: {
        text: 'Complete sign-in in the new window. This page will update when you are done.'
      },
      type: 'info',
      notificationProps: { hideProgressBar: true }
    });
  }, []);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data as { source?: string; ok?: boolean };
      if (d?.source !== REGION_LOGIN_POPUP_POSTMESSAGE_SOURCE || d?.ok !== true) return;

      let pending = '';
      try {
        pending = sessionStorage.getItem(PENDING_SOURCE_REGION_LOGIN_KEY) || '';
      } catch {
        /* ignore */
      }

      if (pending) {
        const state = store.getState();
        const nm = state.migration.newMigrationData;
        const legacy = nm?.legacy_cms || {};
        const currentDetails = legacy.source_details || {};
        const defaultSourceDetails = {
          source_mode: 'credentials',
          source_region_id: '',
          source_org_id: '',
          source_stack_id: '',
          source_branch: '',
          imported_data_path: ''
        };
        const updatedSourceDetails = {
          ...defaultSourceDetails,
          ...currentDetails,
          source_region_id: pending,
          source_org_id: '',
          source_stack_id: ''
        };
        store.dispatch(
          updateNewMigrationData({
            ...nm,
            legacy_cms: { ...legacy, source_details: updatedSourceDetails }
          })
        );
        try {
          sessionStorage.removeItem(PENDING_SOURCE_REGION_LOGIN_KEY);
        } catch {
          /* ignore */
        }
      }

      const src = await getMigrationSourceSession();
      if (src?.appToken && pending && src.region === pending) {
        try {
          const resp = await getUserProfileWithToken(src.appToken);
          if (resp?.status === 200 && validateArray(resp?.data?.user?.orgs)) {
            const orgOptions = resp.data.user.orgs.map(
              (org: { org_id: string; org_name: string }) => ({
                label: org?.org_name || 'Unnamed Organization',
                value: org?.org_id || '',
                master_locale: '',
                locales: [],
                created_at: ''
              })
            );
            setSourceOrgOptions(orgOptions);
          }
        } catch (e) {
          console.error('Failed to load orgs after regional sign-in:', e);
        }
      }

      Notification({
        notificationContent: {
          text: 'Signed in for the selected region. Choose source organization and stack.'
        },
        type: 'success'
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const updateSourceDetails = (key: string, value: string) => {
    const currentSourceDetails = newMigrationData?.legacy_cms?.source_details || {};
    const defaultSourceDetails = {
      source_mode: 'credentials',
      source_region_id: '',
      source_org_id: '',
      source_stack_id: '',
      source_branch: '',
      imported_data_path: ''
    };

    const updatedSourceDetails = {
      ...defaultSourceDetails,
      ...currentSourceDetails,
      [key]: value
    };

    const updatedData = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        source_details: updatedSourceDetails
      }
    };

    dispatch(updateNewMigrationData(updatedData));
  };

  const fetchOrganizationsForRegion = async (region: string) => {
    if (isEmptyString(region)) {
      setSourceOrgOptions([]);
      return;
    }

    const src = await getMigrationSourceSession();
    if (src?.appToken && src.region === region) {
      try {
        const resp = await getUserProfileWithToken(src.appToken);
        if (resp?.status === 200 && validateArray(resp?.data?.user?.orgs)) {
          const orgOptions = resp.data.user.orgs.map(
            (org: { org_id: string; org_name: string }) => ({
              label: org?.org_name || 'Unnamed Organization',
              value: org?.org_id || '',
              master_locale: '',
              locales: [],
              created_at: ''
            })
          );
          setSourceOrgOptions(orgOptions);
          return;
        }
      } catch (e) {
        console.error('Failed to fetch source orgs for region:', e);
      }
      setSourceOrgOptions([]);
      return;
    }

    const sessionRegion = getSessionContentstackRegion(user?.region, authToken);
    if (sessionRegion && region !== sessionRegion) {
      setSourceOrgOptions([]);
      return;
    }

    if (validateArray(organisationsList)) {
      const orgOptions = organisationsList.map((org: IDropDown) => ({
        label: org?.label || 'Unnamed Organization',
        value: org?.value || '',
        master_locale: '',
        locales: [],
        created_at: ''
      }));

      setSourceOrgOptions(orgOptions);

      if (
        sessionRegion === region &&
        !sourceDetails?.source_org_id &&
        selectedOrganisation?.value
      ) {
        const currentOrgExists = orgOptions.some(
          (org) => org.value === selectedOrganisation?.value
        );
        if (currentOrgExists) {
          updateSourceDetails('source_org_id', selectedOrganisation.value);
        }
      }
    } else {
      setSourceOrgOptions([]);
    }
  };

  const fetchSourceStacks = async (orgId: string, region: string) => {
    if (isEmptyString(orgId)) {
      setSourceStackOptions([]);
      return;
    }
    const sessionRegion = getSessionContentstackRegion(user?.region, authToken);
    const src = await getMigrationSourceSession();
    const regionalToken =
      src?.appToken && src.region && region && src.region === region ? src.appToken : undefined;

    if (sessionRegion && region && region !== sessionRegion && !regionalToken) {
      setSourceStackOptions([]);
      return;
    }
    try {
      const stackResp = await getAllStacksInOrg(
        orgId,
        '',
        region || sessionRegion || '',
        regionalToken
      );
      const options = validateArray(stackResp?.data?.stacks)
        ? stackResp.data.stacks.map((stack: any) => ({
            label: stack?.name,
            value: stack?.api_key,
            uid: stack?.api_key,
            master_locale: stack?.master_locale || '',
            locales: stack?.locales || [],
            created_at: stack?.created_at || '',
            isDisabled: false
          }))
        : [];
      setSourceStackOptions(options);
    } catch (error) {
      console.error('Failed to fetch stacks for org:', error);
      setSourceStackOptions([]);
    }
  };

  // Load organizations when region changes
  useEffect(() => {
    if (!isContentstackSource || !isCredentialsMode) return;
    const region = sourceDetails?.source_region_id;
    if (region) {
      fetchOrganizationsForRegion(region);
    } else {
      setSourceOrgOptions([]);
    }
  }, [
    sourceDetails?.source_region_id,
    isContentstackSource,
    isCredentialsMode,
    user?.region,
    authToken,
    organisationsList
  ]);

  // Load stacks when organization changes
  useEffect(() => {
    if (!isContentstackSource || !isCredentialsMode) return;
    const orgId = sourceDetails?.source_org_id;
    const region = sourceDetails?.source_region_id;
    if (orgId) {
      fetchSourceStacks(orgId, region || 'NA');
    } else {
      setSourceStackOptions([]);
    }
  }, [
    sourceDetails?.source_org_id,
    sourceDetails?.source_region_id,
    isContentstackSource,
    isCredentialsMode,
    user?.region,
    authToken
  ]);

  // Initialize default mode if not set
  useEffect(() => {
    if (!isContentstackSource) return;
    const currentMode = sourceDetails?.source_mode;
    if (!currentMode) {
      updateSourceDetails('source_mode', 'credentials');
    }
  }, [isContentstackSource]);

  const handleExportSourceStack = async () => {
    if (!selectedOrganisation?.value || !projectId) {
      Notification({
        notificationContent: {
          text: 'Select an organization in the header and open a project before exporting.'
        },
        type: 'error'
      });
      return;
    }
    if (
      !sourceDetails?.source_org_id ||
      !sourceDetails?.source_stack_id ||
      !sourceDetails?.source_region_id
    ) {
      Notification({
        notificationContent: {
          text: 'Select source region, organization and stack before exporting.'
        },
        type: 'error'
      });
      return;
    }

    setIsExportingStack(true);
    try {
      // First, save the source details to the project
      await updateSourceConfigData(selectedOrganisation?.value, projectId, {
        source_details: sourceDetails
      });

      // Then call the export API which will read from the saved project data
      const res = await exportSourceStack(selectedOrganisation?.value, projectId);

      if (res?.status === 200) {
        const payload = res?.data?.data ?? res?.data;
        const exportPath =
          payload?.export_path || payload?.exportPath || payload?.file_details?.localPath || '';
        const exportedAt = new Date().toISOString();

        // Update Redux with export success. Reset isValidated so the user can re-validate
        // the new export (a stale is_fileValid:true from a previous validation must not block it).
        dispatch(
          updateNewMigrationData({
            ...newMigrationData,
            legacy_cms: {
              ...newMigrationData?.legacy_cms,
              uploadedFile: {
                ...newMigrationData?.legacy_cms?.uploadedFile,
                isValidated: false,
                name: exportPath,
                url: exportPath,
                file_details: {
                  ...newMigrationData?.legacy_cms?.uploadedFile?.file_details,
                  localPath: exportPath,
                  isLocalPath: true,
                  cmsType: 'contentstack'
                }
              },
              source_details: {
                ...sourceDetails,
                exported_at: exportedAt,
                export_path: exportPath
              }
            }
          })
        );

        Notification({
          notificationContent: { text: `Source stack exported successfully to: ${exportPath}` },
          type: 'success'
        });
      } else {
        const msg = res?.data?.error?.message || res?.data?.message || 'Export failed.';
        Notification({
          notificationContent: { text: msg },
          type: 'error'
        });
      }
    } catch (e: any) {
      Notification({
        notificationContent: { text: e?.message || 'Export failed.' },
        type: 'error'
      });
    } finally {
      setIsExportingStack(false);
    }
  };

  const handleValidateExport = async () => {
    if (!selectedOrganisation?.value || !projectId) {
      Notification({
        notificationContent: {
          text: 'Select an organization in the header and open a project before validating.'
        },
        type: 'error'
      });
      return;
    }

    setIsValidatingExport(true);
    try {
      // Make sure source details are saved first
      await updateSourceConfigData(selectedOrganisation?.value, projectId, {
        source_details: sourceDetails
      });

      // Then call the validation API
      const res = await validateSourceExport(selectedOrganisation?.value, projectId);

      if (res?.status === 200) {
        const payload = res?.data?.data ?? res?.data;
        const exportPath =
          payload?.export_path || payload?.exportPath || payload?.file_details?.localPath || '';

        // Fetch updated project so we can include source_locales in the dispatch.
        let sourceLocales: any[] | undefined;
        try {
          if (selectedOrganisation?.value && projectId) {
            const migrationDataResponse = await getMigrationData(
              selectedOrganisation.value,
              projectId
            );
            const projectData = migrationDataResponse?.data;
            if (projectData?.source_locales && Array.isArray(projectData.source_locales)) {
              sourceLocales = projectData.source_locales;
            }
          }
        } catch {
          // Non-fatal — language mapper step will still show empty but user can continue
        }

        // Update Redux with validation success - similar to other CMS validation
        dispatch(
          updateNewMigrationData({
            ...newMigrationData,
            legacy_cms: {
              ...newMigrationData?.legacy_cms,
              cms: 'contentstack', // Set the CMS type for step completion
              file_format: 'json', // Set the file format for step completion
              is_fileValid: true, // Mark file as valid
              uploadedFile: {
                ...newMigrationData?.legacy_cms?.uploadedFile,
                isValidated: true,
                validation: payload?.message || 'Source stack export validated successfully.',
                name: exportPath,
                url: exportPath,
                file_details: {
                  ...newMigrationData?.legacy_cms?.uploadedFile?.file_details,
                  localPath: exportPath,
                  isLocalPath: true,
                  cmsType: 'contentstack'
                }
              }
            },
            ...(sourceLocales !== undefined && {
              destination_stack: {
                ...newMigrationData?.destination_stack,
                sourceLocale: sourceLocales
              }
            })
          })
        );

        // Trigger step completion like other CMS validations
        if (props.handleStepChange) {
          props.handleStepChange(props?.currentStep, true);
        }

        // Trigger audit generation in background for better UX
        const currentMigrationData = { ...newMigrationData };

        runSourceAudit(selectedOrganisation?.value, projectId)
          .then((auditResp) => {
            if (auditResp?.status === 200 && auditResp?.data?.summary) {
              // Update Redux with the audit summary
              dispatch(
                updateNewMigrationData({
                  ...currentMigrationData,
                  legacy_cms: {
                    ...currentMigrationData?.legacy_cms,
                    audit: {
                      ...currentMigrationData?.legacy_cms?.audit,
                      summary: auditResp?.data?.summary
                    }
                  }
                })
              );
            }
          })
          .catch((error) => {
            // Silent failure - user can still generate audit manually on Step 3
            console.warn('Background audit generation failed:', error);
          });

        Notification({
          notificationContent: { text: payload?.message || 'Source stack export validated.' },
          type: 'success'
        });
      } else {
        const msg = res?.data?.error?.message || res?.data?.message || 'Validation failed.';
        Notification({
          notificationContent: { text: msg },
          type: 'error'
        });
      }
    } catch (e: any) {
      Notification({
        notificationContent: { text: e?.message || 'Validation failed.' },
        type: 'error'
      });
    } finally {
      setIsValidatingExport(false);
    }
  };

  const validationClassName = isValidated ? 'success' : 'error';

  const containerClassName = `validation-container ${
    isValidationAttempted && !isValidated ? 'error-container pb-2' : ''
  }`;

  const renderUploadedFileValidation = (nestedInPanel = false) => (
    <div
      className={
        nestedInPanel
          ? 'contentstack-source-panel__imported-section contentstack-source-panel__file-validation'
          : undefined
      }>
      <div className={containerClassName}>
        {!isConfigLoading &&
        (!isEmptyString(fileDetails?.localPath) || !isEmptyString(fileFormat)) ? (
          <FileComponent fileDetails={fileDetails || {}} fileFormatId={fileFormat} />
        ) : (
          <div className="errorMessage fs-6">No file added. Please add the file to validate.</div>
        )}
        {showMessage && !showProgress && (
          <div className="message-container">
            {!isValidated &&
            isValidationAttempted &&
            fileFormat?.toLowerCase() === 'sql' &&
            documentationUrl ? (
              <p className={`${validationClassName} p2`}>
                {validationMessgae} Please check the requirements{' '}
                <a href={documentationUrl} target="_blank" rel="noreferrer" className="link">
                  here
                </a>
              </p>
            ) : (
              <>
                <Paragraph
                  className={`${validationClassName}`}
                  tagName="p"
                  variant="p2"
                  text={validationMessgae}
                />
                {!isValidated &&
                  validationMessgae === 'Validation failed.' &&
                  fileFormat?.toLowerCase() !== 'sql' && (
                    <p className={`${validationClassName} p2 doc-link`}>
                      Please check the requirements{' '}
                      <a href={documentationUrl} target="_blank" rel="noreferrer" className="link">
                        here
                      </a>
                    </p>
                  )}
              </>
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
        disabled={
          !(reValidate || (!isDisabled && !isEmptyString(newMigrationData?.legacy_cms?.affix)))
        }>
        {fileFormat?.toLowerCase() === 'sql' ? 'Check Connection' : 'File Validate'}
      </Button>
    </div>
  );

  return (
    <div className="row">
      <div className="col-12">
        <div className="col-12">
          {/* File validation for non-Contentstack sources only (Contentstack import mode uses panel below) */}
          {!isContentstackSource && renderUploadedFileValidation()}

          {/* Contentstack-specific configuration UI */}
          {isContentstackSource && (
            <div className="contentstack-source-panel">
              <p className="contentstack-source-panel__title">Configure Source Contentstack</p>

              <div className="contentstack-source-panel__field">
                <FieldLabel version="v2" htmlFor="source-mode">
                  Source Mode
                </FieldLabel>
                <div className="contentstack-source-panel__radio-group">
                  <label className="contentstack-source-panel__radio-label" htmlFor="source-mode-credentials">
                    <input
                      id="source-mode-credentials"
                      type="radio"
                      name="source_mode"
                      value="credentials"
                      checked={(sourceDetails?.source_mode || 'credentials') === 'credentials'}
                      onChange={() => updateSourceDetails('source_mode', 'credentials')}
                    />
                    Select Stack
                  </label>
                  <label
                    className="contentstack-source-panel__radio-label"
                    htmlFor="source-mode-imported-export">
                    <input
                      id="source-mode-imported-export"
                      type="radio"
                      name="source_mode"
                      value="imported_export"
                      checked={(sourceDetails?.source_mode || 'credentials') === 'imported_export'}
                      onChange={() => updateSourceDetails('source_mode', 'imported_export')}
                    />
                    Import Exported Data
                  </label>
                </div>
              </div>

              {(sourceDetails?.source_mode || 'credentials') === 'credentials' ? (
                <>
                  <div className="contentstack-source-panel__field">
                    <FieldLabel version="v2" htmlFor="source-region">
                      Source Region
                    </FieldLabel>
                    <Select
                      version="v2"
                      width="400px"
                      options={sourceRegionOptions}
                      value={
                        sourceRegionOptions.find(
                          (opt) => opt.value === sourceDetails?.source_region_id
                        ) || null
                      }
                      onChange={async (option: any) => {
                        const regionValue = option?.value ?? '';
                        const sessionRegion = getSessionContentstackRegion(
                          user?.region,
                          authToken
                        );
                        if (!regionValue) {
                          await clearMigrationSourceSession();
                          applySourceRegionSelection('');
                          return;
                        }
                        if (sessionRegion && regionValue === sessionRegion) {
                          await clearMigrationSourceSession();
                          applySourceRegionSelection(regionValue);
                          return;
                        }
                        if (sessionRegion && regionValue !== sessionRegion) {
                          await openRegionLoginInPopup(regionValue);
                          return;
                        }
                        applySourceRegionSelection(regionValue);
                      }}
                      placeholder="Select Source Region"
                      isClearable
                      isSearchable={false}
                    />
                  </div>

                  <div className="contentstack-source-panel__field">
                    <FieldLabel version="v2" htmlFor="source-org">
                      Source Organization
                    </FieldLabel>
                    <Select
                      version="v2"
                      width="400px"
                      options={sourceOrgOptions}
                      value={
                        sourceOrgOptions.find(
                          (opt) => opt.value === sourceDetails?.source_org_id
                        ) || null
                      }
                      onChange={(option: any) => {
                        const orgValue = option?.value || '';

                        // Update org and clear stack in one call
                        const currentDetails = newMigrationData?.legacy_cms?.source_details || {};
                        const defaultSourceDetails = {
                          source_mode: 'credentials',
                          source_region_id: '',
                          source_org_id: '',
                          source_stack_id: '',
                          source_branch: '',
                          imported_data_path: ''
                        };

                        const updatedSourceDetails = {
                          ...defaultSourceDetails,
                          ...currentDetails,
                          source_org_id: orgValue,
                          source_stack_id: ''
                        };

                        const updatedData = {
                          ...newMigrationData,
                          legacy_cms: {
                            ...newMigrationData?.legacy_cms,
                            source_details: updatedSourceDetails
                          }
                        };

                        dispatch(updateNewMigrationData(updatedData));
                      }}
                      placeholder="Select Source Organization"
                      isDisabled={!sourceDetails?.source_region_id}
                    />
                  </div>

                  <div className="contentstack-source-panel__field">
                    <FieldLabel version="v2" htmlFor="source-stack">
                      Source Stack
                    </FieldLabel>
                    <Select
                      version="v2"
                      width="400px"
                      options={sourceStackOptions}
                      value={
                        sourceStackOptions.find(
                          (opt) => opt.value === sourceDetails?.source_stack_id
                        ) || null
                      }
                      onChange={(option: any) => {
                        const stackValue = option?.value || '';
                        updateSourceDetails('source_stack_id', stackValue);
                      }}
                      placeholder="Select Source Stack"
                      isDisabled={!sourceDetails?.source_org_id}
                    />
                  </div>

                  <div className="contentstack-source-panel__field">
                    <FieldLabel version="v2" htmlFor="source-branch">
                      Source Branch (optional)
                    </FieldLabel>
                    <div className="contentstack-source-panel__input-wrap">
                      <TextInput
                        version="v2"
                        placeholder="main"
                        value={sourceDetails?.source_branch || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateSourceDetails('source_branch', e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="contentstack-source-panel__actions">
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Button
                        buttonType="primary"
                        version="v2"
                        onClick={handleExportSourceStack}
                        disabled={
                          !sourceDetails?.source_region_id ||
                          !sourceDetails?.source_org_id ||
                          !sourceDetails?.source_stack_id ||
                          isExportingStack
                        }
                        isLoading={isExportingStack}>
                        Export Source Stack
                      </Button>

                      <Button
                        buttonType="secondary"
                        version="v2"
                        onClick={handleValidateExport}
                        disabled={
                          isValidatingExport ||
                          isExportingStack ||
                          Boolean(newMigrationData?.legacy_cms?.uploadedFile?.isValidated) ||
                          !(
                            sourceDetails?.exported_at ||
                            !isEmptyString(sourceDetails?.export_path) ||
                            !isEmptyString(
                              newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath
                            )
                          )
                        }
                        isLoading={isValidatingExport}
                        title={
                          newMigrationData?.legacy_cms?.uploadedFile?.isValidated
                            ? 'Export is already validated.'
                            : !(
                                  sourceDetails?.exported_at ||
                                  !isEmptyString(sourceDetails?.export_path) ||
                                  !isEmptyString(
                                    newMigrationData?.legacy_cms?.uploadedFile?.file_details
                                      ?.localPath
                                  )
                                )
                              ? 'Export the source stack first, then validate.'
                              : undefined
                        }>
                        Validate Export
                      </Button>
                    </div>

                    {(sourceDetails?.exported_at ||
                      newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath) && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '8px',
                          backgroundColor: '#f0f8f0',
                          border: '1px solid #d4edda',
                          borderRadius: '4px'
                        }}>
                        {sourceDetails?.exported_at && (
                          <div style={{ color: '#155724', margin: 0, fontSize: '14px' }}>
                            ✅ Exported at {new Date(sourceDetails.exported_at).toLocaleString()}
                          </div>
                        )}
                        {(sourceDetails?.export_path ||
                          newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath) && (
                          <div style={{ color: '#6c757d', margin: '4px 0 0 0', fontSize: '12px' }}>
                            📁 Path:{' '}
                            {sourceDetails?.export_path ||
                              newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath}
                          </div>
                        )}
                        {newMigrationData?.legacy_cms?.uploadedFile?.isValidated && (
                          <div style={{ color: '#155724', margin: '4px 0 0 0', fontSize: '14px' }}>
                            ✅ Export validated. You can continue to the next step.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                renderUploadedFileValidation(true)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadUploadFile;
