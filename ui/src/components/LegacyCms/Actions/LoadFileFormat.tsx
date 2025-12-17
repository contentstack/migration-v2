// Libraries
import { useEffect, useRef, useState } from 'react';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString, getFileExtension } from '../../../utilities/functions';

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

  const [fileIcon, setFileIcon]  = useState(newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title);

  /****  ALL USEEffects  HERE  ****/
  // Update ref whenever newMigrationData changes
  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;
  }, [newMigrationData]);

  // Handle file format extraction - RUN IMMEDIATELY ON MOUNT AND WHEN DATA CHANGES
  useEffect(() => {
    const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath || '';
    const currentFormat = newMigrationData?.legacy_cms?.selectedFileFormat?.title;
    
    // If we have a file path but no format, extract it NOW
    if (!isEmptyString(filePath) && isEmptyString(currentFormat)) {
      const extractedFormat = getFileExtension(filePath);
      
      if (!isEmptyString(extractedFormat)) {
        const fileFormatObj = {
          description: '',
          fileformat_id: extractedFormat,
          group_name: extractedFormat,
          isactive: true,
          title: extractedFormat === 'zip' ? 'Zip' : extractedFormat.toUpperCase()
        };
                
        dispatch(updateNewMigrationData({
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            selectedFileFormat: fileFormatObj
          }
        }));
        
        setFileIcon(fileFormatObj?.title);
      }
    } else if (!isEmptyString(currentFormat)) {
      setFileIcon(currentFormat);
    }
  }, [newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath, newMigrationData?.legacy_cms?.selectedFileFormat, dispatch, newMigrationData]);

  return (
    <div className="p-3">
      <div className="col-12">
        <label htmlFor="file-format">
          <TextInput
            label="File Format"
            value={fileIcon || 'File extension not found'}
            version="v2"
            isReadOnly={true}
            width="large"
            prefix={
              <Icon
                icon={fileIcon === 'DIRECTORY' ? 'Folder' : fileIcon ? fileIcon : 'CrashedPage'}
                size="medium"
                version="v2"
                aria-label="File format icon"
              />
            }
          />
        </label>
      </div>
    </div>
  );
};

export default LoadFileFormat;
