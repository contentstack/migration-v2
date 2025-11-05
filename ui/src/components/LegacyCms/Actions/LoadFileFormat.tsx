// Libraries
import { useEffect, useRef, useState } from 'react';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString } from '../../../utilities/functions';

// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadFileFormatProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LoadFileFormat = (_props: LoadFileFormatProps) => {
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const dispatch = useDispatch();

  const newMigrationDataRef = useRef(newMigrationData);
  const lastProcessedInputRef = useRef<string>('');
  const isProcessingRef = useRef<boolean>(false);

  const [fileIcon, setFileIcon] = useState<string>(
    newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title || ''
  );

  /****  ALL METHODS HERE  ****/

  const getFileExtension = (filePath: string): string => {
    const normalizedPath = filePath?.replace(/\\/g, "/")?.replace(/\/$/, "");
    const match = normalizedPath?.match(/\.([a-zA-Z0-9]+)$/);
    const isDirectory = !/\.[a-zA-Z0-9]{1,5}$/.test(normalizedPath);
    const ext = match ? match?.[1]?.toLowerCase() : isDirectory ? "directory" : "";
    const validExtensionRegex = /\.(pdf|zip|xml|json|directory|sql)$/i;
    return ext && validExtensionRegex?.test(`.${ext}`) ? `${ext}` : '';
  };

  /****  ALL USEEffects  HERE  ****/
  // Update ref whenever newMigrationData changes
  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
    
    const localPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath;
    const isLocalPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isLocalPath;
    
    // Check if SQL connection and update icon immediately
    const isSQLFromFlag = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isSQL === true;
    const isSQLFromName = newMigrationData?.legacy_cms?.uploadedFile?.name?.toLowerCase() === 'sql';
    const isSQLFromPath = localPath?.toLowerCase() === 'sql';
    const isSQLFromAwsData = (newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData as any)?.mysql !== undefined;
    const isSQLConnection = isSQLFromFlag || isSQLFromName || isSQLFromPath || isSQLFromAwsData;
    const isDrupal = newMigrationData?.legacy_cms?.selectedCms?.parent?.toLowerCase() === 'drupal';
    
    // Set icon based on file type
    if (isDrupal && isSQLConnection) {
      setFileIcon('SQL');
    } else if (isLocalPath && localPath) {
      // Check if it's a directory (no file extension)
      const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(localPath);
      if (!hasExtension) {
        setFileIcon('Folder');
      } else {
        // Extract extension
        const ext = localPath.split('.').pop()?.toUpperCase();
        setFileIcon(ext || 'Folder');
      }
    }
  }, [newMigrationData]);

  // Handle file format extraction - RUN IMMEDIATELY ON MOUNT AND WHEN DATA CHANGES
  useEffect(() => {
    // 🔧 CRITICAL: Prevent re-entry while processing
    if (isProcessingRef.current) {
      return;
    }
    
    const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '';
    const currentFormat = newMigrationData?.legacy_cms?.selectedFileFormat?.title;
    
    // Check if this is a SQL connection with multiple fallback indicators
    const isSQLFromFlag = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isSQL === true;
    const isSQLFromName = newMigrationData?.legacy_cms?.uploadedFile?.name?.toLowerCase() === 'sql';
    const isSQLFromPath = filePath?.toLowerCase() === 'sql';
    const isSQLFromAwsData = (newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData as any)?.mysql !== undefined;
    const isSQLConnection = isSQLFromFlag || isSQLFromName || isSQLFromPath || isSQLFromAwsData;
    const cmsType = !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent) 
      ? newMigrationData?.legacy_cms?.selectedCms?.parent 
      : newMigrationData?.legacy_cms?.uploadedFile?.cmsType;
    const isDrupal = cmsType?.toLowerCase() === 'drupal';
    
    // 🔧 CRITICAL FIX: Track input data to prevent infinite loops
    const inputDataKey = JSON.stringify({
      filePath,
      currentFormat,
      isSQLFromFlag,
      isSQLFromName,
      isSQLFromPath,
      isSQLFromAwsData,
      isDrupal
    });
    
    // Skip if we already processed this exact input data
    if (inputDataKey === lastProcessedInputRef.current) {
      return;
    }
    
    // Mark as processing
    isProcessingRef.current = true;
    
    // For SQL connections (especially Drupal), handle immediately
    if (isDrupal && isSQLConnection) {
      const sqlFormatObj = {
        description: '',
        fileformat_id: 'sql',
        group_name: 'sql',
        isactive: true,
        title: 'SQL'
      };
      
      dispatch(updateNewMigrationData({
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedFileFormat: sqlFormatObj
        }
      }));
      
      lastProcessedInputRef.current = inputDataKey;
      setFileIcon('SQL');
      
      // Reset processing flag after dispatch completes
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 0);
      return;
    }
    
    // If we have a file path but no format, extract it NOW
    if (!isEmptyString(filePath) && isEmptyString(currentFormat)) {
      let extractedFormat = getFileExtension(filePath);
      
      // If SQL connection is detected but fileFormat is not 'sql', override it
      if (isSQLConnection && extractedFormat !== 'sql') {
        extractedFormat = 'sql';
      }
      
      if (!isEmptyString(extractedFormat)) {
        const fileFormatObj = {
          description: '',
          fileformat_id: extractedFormat,
          group_name: extractedFormat,
          isactive: true,
          title: extractedFormat === 'zip' 
            ? extractedFormat.charAt(0).toUpperCase() + extractedFormat.slice(1) 
            : extractedFormat === 'directory'
              ? 'DIRECTORY'
              : extractedFormat.toUpperCase()
        };
        
        dispatch(updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            selectedFileFormat: fileFormatObj
          }
        }));
        
        lastProcessedInputRef.current = inputDataKey;
        
        // Set file icon based on format
        if (isSQLConnection) {
          setFileIcon('SQL');
        } else if (extractedFormat === 'directory') {
          setFileIcon('Folder');
        } else {
        setFileIcon(fileFormatObj.title);
        }
      }
    } else if (!isEmptyString(currentFormat)) {
      // Update icon when format changes
      if (isSQLConnection) {
        setFileIcon('SQL');
      } else if (currentFormat?.toLowerCase() === 'directory') {
        setFileIcon('Folder');
      } else {
      setFileIcon(currentFormat);
      }
    }
    
    // Reset processing flag after all updates are queued
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 0);
  }, [newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath, newMigrationData?.legacy_cms?.selectedFileFormat, dispatch, newMigrationData]);

  
  return (
    <div className="p-3">
      <div className="col-12">
        <label htmlFor="file-format">
          <TextInput
            value={
              fileIcon === 'SQL' ? 'SQL' : 
              fileIcon === 'Folder' ? 'DIRECTORY' : 
              fileIcon ? fileIcon : 
              'file extension not found'
            }
            version="v2"
            isReadOnly={true}
            disabled={true}
            width="large"
            placeholder=""
            prefix={
              <Icon
                icon={fileIcon === 'SQL' ? 'ApiTokens' : fileIcon ? fileIcon : 'CrashedPage'}
                size="medium"
                version="v2"
                aria-label="fileformat"
              />
            }
          />
        </label>
      </div>
    </div>
  );
};

export default LoadFileFormat;