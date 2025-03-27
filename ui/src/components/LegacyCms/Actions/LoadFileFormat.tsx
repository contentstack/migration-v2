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
  const [fileIcon, setFileIcon]  = useState(newMigrationDataRef?.current?.legacy_cms?.selectedFileFormat?.title);
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
    
      const cmsType = !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.parent) ? newMigrationData?.legacy_cms?.selectedCms?.parent : newMigrationData?.legacy_cms?.uploadedFile?.cmsType;
      const filePath = newMigrationData?.legacy_cms?.uploadedFile?.file_details?.localPath?.toLowerCase();
      const fileFormat: string =  newMigrationData?.legacy_cms?.selectedFileFormat?.title?.toLowerCase();
      if(! isEmptyString(selectedCard?.fileformat_id) && selectedCard?.fileformat_id !== fileFormat && newMigrationData?.project_current_step > 1){   
        setFileIcon(selectedCard?.title);
      } else {
        const { all_cms = [] } = migrationData?.legacyCMSData || {};
        let filteredCmsData: ICMSType[] = all_cms;
        if (cmsType) {
          filteredCmsData = all_cms?.filter(
            (cms) => cms?.parent?.toLowerCase() === cmsType?.toLowerCase()
          );
        }

        const isFormatValid = filteredCmsData[0]?.allowed_file_formats?.find(
          (format: ICardType) => {
            const isValid = format?.fileformat_id?.toLowerCase() === fileFormat?.toLowerCase();
            return isValid;
          }
        );

        if (!isFormatValid) {
          setIsError(true);
          setError('File format does not support, please add the correct file format.');
        }
    
        const selectedFileFormatObj = {
          description: '',
          fileformat_id: fileFormat,
          group_name: fileFormat,
          isactive: true,
          title: fileFormat === 'zip' ? fileFormat?.charAt(0)?.toUpperCase() + fileFormat?.slice(1) : fileFormat?.toUpperCase()
        }
        
      
        setFileIcon(fileFormat === 'zip' ? fileFormat?.charAt(0).toUpperCase() + fileFormat.slice(1) : fileFormat?.toUpperCase());

      }
    } catch (error) {
      return error;
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
            value={fileIcon ? fileIcon : 'file extension not found'}
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

        {isError && <p className="errorMessage">{error}</p>}
      </div>
    </div>
  );
};

export default LoadFileFormat;
