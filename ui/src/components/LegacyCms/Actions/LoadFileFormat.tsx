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

  const [selectedCard] = useState<ICardType>(newMigrationData?.legacy_cms?.selectedFileFormat || {});
  const [isCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || true
  );
  const [fileIcon, setFileIcon]  = useState(newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title || '');
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
      console.info('🔍 [LoadFileFormat] handleFileFormat called');
      console.info('  newMigrationData:', newMigrationData);
      console.info('  uploadedFile:', newMigrationData?.legacy_cms?.uploadedFile);
      console.info('  file_details:', newMigrationData?.legacy_cms?.uploadedFile?.file_details);
      
      // Safety check: Return early if no file uploaded yet
      if (!newMigrationData?.legacy_cms?.uploadedFile?.file_details) {
        console.info('  ⚠️ No file_details found, returning early');
        return;
      }
      
      console.info('  ✓ File details exist, continuing...');
    
      const cmsType = !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent) ? newMigrationData?.legacy_cms?.selectedCms?.parent : newMigrationData?.legacy_cms?.uploadedFile?.cmsType;
      const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath?.toLowerCase();
      
      console.info('  cmsType:', cmsType);
      console.info('  filePath:', filePath);
      
      // Extract file extension from uploaded file
      let detectedExtension = '';
      const localPath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath;
      const awsBucketKey = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.awsData?.buketKey;
      
      console.info('  localPath:', localPath);
      console.info('  awsBucketKey:', awsBucketKey);
      
      if (localPath) {
        console.info('  Extracting from localPath...');
        // Extract extension from local path
        const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(localPath);
        console.info('  hasExtension:', hasExtension);
        if (hasExtension) {
          detectedExtension = localPath.split('.').pop()?.toLowerCase() || '';
          console.info('  detectedExtension:', detectedExtension);
        } else {
          detectedExtension = 'directory';
          console.info('  No extension, setting to: directory');
        }
      } else if (awsBucketKey) {
        console.info('  Extracting from awsBucketKey...');
        // Extract extension from AWS bucket key
        const fileName = awsBucketKey.split('/').pop() || '';
        console.info('  fileName:', fileName);
        const hasExtension = /\.[a-zA-Z0-9]{1,5}$/.test(fileName);
        console.info('  hasExtension:', hasExtension);
        if (hasExtension) {
          detectedExtension = fileName.split('.').pop()?.toLowerCase() || '';
          console.info('  detectedExtension:', detectedExtension);
        }
      }
      
      const fileFormat: string = detectedExtension || newMigrationData?.legacy_cms?.selectedFileFormat?.title?.toLowerCase();
      console.info('  Final fileFormat:', fileFormat);
      console.info('  selectedCard?.fileformat_id:', selectedCard?.fileformat_id);
      console.info('  project_current_step:', newMigrationData?.project_current_step);
      
      if(! isEmptyString(selectedCard?.fileformat_id) && selectedCard?.fileformat_id !== fileFormat && newMigrationData?.project_current_step > 1){   
        console.info('  Setting icon from selectedCard.title:', selectedCard?.title);
        setFileIcon(selectedCard?.title);
      } else {
        console.info('  Proceeding to validate format...');
        // Safety check for migrationData
        if (!migrationData?.legacyCMSData) {
          console.info('  ⚠️ No legacyCMSData found, returning early');
          return;
        }
        
        const { all_cms = [] } = migrationData?.legacyCMSData || {};
        console.info('  all_cms length:', all_cms?.length);
        let filteredCmsData: ICMSType[] = all_cms;
        if (cmsType) {
          filteredCmsData = all_cms?.filter(
            (cms) => cms?.parent?.toLowerCase() === cmsType?.toLowerCase()
          );
          console.info('  filteredCmsData length:', filteredCmsData?.length);
        }

        const isFormatValid = filteredCmsData?.[0]?.allowed_file_formats?.find(
          (format: ICardType) => {
            const isValid = format?.fileformat_id?.toLowerCase() === fileFormat?.toLowerCase();
            return isValid;
          }
        );
        console.info('  isFormatValid:', isFormatValid);

        if (!isFormatValid && fileFormat) {
          console.info('  ❌ Format not valid, setting error');
          setIsError(true);
          setError('File format does not support, please add the correct file format.');
        }
    
        const selectedFileFormatObj = {
          description: '',
          fileformat_id: fileFormat,
          group_name: fileFormat,
          isactive: true,
          title: fileFormat === 'zip' ? fileFormat?.charAt?.(0)?.toUpperCase() + fileFormat?.slice?.(1) : fileFormat?.toUpperCase()
        }
        
        // Set file icon with safety checks
        if (fileFormat) {
          console.info('  Setting file icon for format:', fileFormat);
          if (fileFormat === 'zip') {
            const icon = fileFormat.charAt(0).toUpperCase() + fileFormat.slice(1);
            console.info('  ✓ Setting icon to:', icon);
            setFileIcon(icon);
          } else if (fileFormat === 'directory') {
            console.info('  ✓ Setting icon to: Folder');
            setFileIcon('Folder');
          } else {
            const icon = fileFormat.toUpperCase();
            console.info('  ✓ Setting icon to:', icon);
            setFileIcon(icon);
          }
        } else {
          console.info('  ⚠️ No fileFormat, skipping icon update');
        }

      }
    } catch (error) {
      console.error('❌ Error in handleFileFormat:', error);
      // Don't throw error, just log it to prevent UI crash
    }
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    handleFileFormat();
  },[]);

  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
  }, [newMigrationData]);

  
  return (
    <div className="p-3">
      <div className="col-12">
        <label htmlFor="file-format">
          <TextInput
            value={fileIcon === 'Folder' ? 'DIRECTORY' : fileIcon ? fileIcon :  'file extension not found'}
            version="v2"
            isReadOnly={true}
            disabled={true}
            width="large"
            placeholder=""
            prefix={
              <Icon
                icon={fileIcon ? fileIcon : 'CrashedPage'}
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
