// Libraries
import { useEffect, useRef, useState } from 'react';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString } from '../../../utilities/functions';

// Interface
import { ICardType } from '../../../components/Common/Card/card.interface';

// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { getConfig } from '../../../services/api/upload.service';
import { ICMSType } from '../../../context/app/app.interface';

interface LoadFileFormatProps {
  stepComponentProps?: () => {};
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadFileFormat = (props: LoadFileFormatProps) => {
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const dispatch = useDispatch();

  const newMigrationDataRef = useRef(newMigrationData);

  const [selectedCard] = useState<ICardType>(newMigrationData?.legacy_cms?.selectedFileFormat);
  const [isCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || true
  );
  const [fileIcon, setFileIcon] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /****  ALL METHODS HERE  ****/

  const handleBtnClick = async () => {
    if (!isEmptyString(selectedCard?.fileformat_id) && isCheckedBoxChecked) {
      dispatch(
        updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            isFileFormatCheckboxChecked: isCheckedBoxChecked
          }
        })
      );

      //call for Step Change
      props.handleStepChange(props?.currentStep);
    }
  };

  const handleFileFormat = async() =>{
    try {
      /* eslint-disable no-console */
      console.info('🔍 LoadFileFormat - handleFileFormat called');
      
      // Check if file has been validated yet
      const isFileValidated = newMigrationData?.legacy_cms?.uploadedFile?.isValidated;
      console.info('  isFileValidated:', isFileValidated);
      
      if (!isFileValidated) {
        console.info('  ⚠️ File not validated yet, skipping format check');
        // Clear any previous errors
        setIsError(false);
        setError('');
        /* eslint-enable no-console */
        return;
      }
      
      const cmsType = !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent) 
        ? newMigrationData?.legacy_cms?.selectedCms?.parent 
        : newMigrationData?.legacy_cms?.uploadedFile?.cmsType;
      const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath?.toLowerCase();
      
      console.info('  cmsType:', cmsType);
      console.info('  filePath:', filePath);
      
      // Check if this is a SQL connection with multiple fallback indicators
      const isSQLFromFlag = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.isSQL === true;
      const isSQLFromName = newMigrationData?.legacy_cms?.uploadedFile?.name?.toLowerCase() === 'sql';
      const isSQLFromPath = filePath === 'sql';
      const isSQLFromAwsData = (newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData as any)?.mysql !== undefined;
      
      console.info('  SQL Detection:');
      console.info('    isSQLFromFlag:', isSQLFromFlag);
      console.info('    isSQLFromName:', isSQLFromName);
      console.info('    isSQLFromPath:', isSQLFromPath);
      console.info('    isSQLFromAwsData:', isSQLFromAwsData);
      
      // SQL connection is true if ANY of these indicators are true
      const isSQLConnection = isSQLFromFlag || isSQLFromName || isSQLFromPath || isSQLFromAwsData;
      
      console.info('  ✓ isSQLConnection:', isSQLConnection);
      
      // Get file format from selectedFileFormat or detect from upload response
      let fileFormat: string = newMigrationData?.legacy_cms?.selectedFileFormat?.title?.toLowerCase();
      
      console.info('  fileFormat from selectedFileFormat:', fileFormat);
      
      // If SQL connection is detected but fileFormat is not 'sql', override it
      if (isSQLConnection) {
        if (fileFormat !== 'sql') {
          console.info('  ⚠️ SQL connection detected but fileFormat is:', fileFormat);
          console.info('  ⚠️ Overriding fileFormat to: sql');
        }
        fileFormat = 'sql';
      }
      
      console.info('  fileFormat after SQL check:', fileFormat);
      /* eslint-enable no-console */
      
      const { all_cms = [] } = migrationData?.legacyCMSData || {};
      let filteredCmsData: ICMSType[] = all_cms;
      if (cmsType) {
        filteredCmsData = all_cms?.filter(
          (cms) => cms?.parent?.toLowerCase() === cmsType?.toLowerCase()
        );
      }
      // Special handling for Drupal SQL format
      const isDrupal = cmsType?.toLowerCase() === 'drupal';
      
      /* eslint-disable no-console */
      console.info('  isDrupal:', isDrupal);
      console.info('  Final fileFormat:', fileFormat);
      /* eslint-enable no-console */
      
      let isFormatValid = false;
      
      // KEY FIX: Check isSQLConnection instead of comparing fileFormat string
      if (isDrupal && isSQLConnection) {
        // For Drupal SQL connections, automatically accept the format
        isFormatValid = true;
        /* eslint-disable no-console */
        console.info('  ✓ Format valid (Drupal SQL):', isFormatValid);
        /* eslint-enable no-console */
      } else {
        // For other CMS types, use the original validation logic
        const foundFormat = filteredCmsData[0]?.allowed_file_formats?.find(
          (format: ICardType) => {
            const isValid = format?.fileformat_id?.toLowerCase() === fileFormat?.toLowerCase();
            return isValid;
          }
        );
        isFormatValid = !!foundFormat;
        /* eslint-disable no-console */
        console.info('  ✓ Format valid (standard check):', isFormatValid);
        console.info('    foundFormat:', foundFormat);
        /* eslint-enable no-console */
      }

      /* eslint-disable no-console */
      console.info('');
      console.info('  📌 FINAL RESULT:');
      console.info('    isFormatValid:', isFormatValid);
      /* eslint-enable no-console */

      if (!isFormatValid) {
        setIsError(true);
        setError('File format does not support, please add the correct file format.');
        /* eslint-disable no-console */
        console.info('    ❌ Setting error - format not valid');
        /* eslint-enable no-console */
      } else {
        // Clear any previous errors
        setIsError(false);
        setError('');
        /* eslint-disable no-console */
        console.info('    ✅ Clearing error - format is valid');
        /* eslint-enable no-console */
      }
  
      // For SQL connections, use 'sql' as the format identifier
      const displayFormat = isSQLConnection ? 'sql' : fileFormat;
      
      const selectedFileFormatObj = {
        description: '',
        fileformat_id: displayFormat,
        group_name: displayFormat,
        isactive: true,
        title: displayFormat === 'zip' 
          ? displayFormat?.charAt?.(0)?.toUpperCase() + displayFormat?.slice?.(1) 
          : displayFormat?.toUpperCase()
      }
      
      // Update Redux state with the correct file format
      if (isDrupal && isSQLConnection) {
        dispatch(
          updateNewMigrationData({
            ...newMigrationData,
            legacy_cms: {
              ...newMigrationData?.legacy_cms,
              selectedFileFormat: selectedFileFormatObj
            }
          })
        );
      }
      
      // Set file icon - use SQL for SQL connections
      if (isDrupal && isSQLConnection) {
        setFileIcon('SQL');
      } else {
        const iconValue = displayFormat === 'zip' 
          ? displayFormat?.charAt?.(0).toUpperCase() + displayFormat?.slice?.(1) 
          : displayFormat === 'directory' 
            ? 'Folder' 
            : displayFormat?.toUpperCase();
        setFileIcon(iconValue);
      }
     } catch (error) {
      console.error('❌ Error in handleFileFormat:', error);
      return error;
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    handleFileFormat();
  },[]);

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

        {isError && <p className="errorMessage pt-2">{error}</p>}
      </div>
    </div>
  );
};

export default LoadFileFormat;