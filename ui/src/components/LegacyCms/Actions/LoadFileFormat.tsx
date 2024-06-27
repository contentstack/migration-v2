// Libraries
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString } from '../../../utilities/functions';

// Services
import {
  fileformatConfirmation
} from '../../../services/api/migration.service';

// Interface
import { ICardType} from '../../../components/Common/Card/card.interface';


// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { getConfig } from '../../../services/api/upload.service';

interface LoadFileFormatProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadFileFormat = (props: LoadFileFormatProps) => {

  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation); 
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const dispatch = useDispatch();

  const [selectedCard, setSelectedCard] = useState<ICardType>(
    newMigrationData?.legacy_cms?.selectedFileFormat 
  );
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || true
  );
  const [fileIcon, setFileIcon]  = useState(newMigrationData?.legacy_cms?.selectedFileFormat?.title);
  const { projectId = '' } = useParams();


  /****  ALL METHODS HERE  ****/

  const handleBtnClick = async () => {
    
    if (!isEmptyString(selectedCard?.fileformat_id) && isCheckedBoxChecked) {
      dispatch(updateNewMigrationData({
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          isFileFormatCheckboxChecked: isCheckedBoxChecked
        }
      }));
      await fileformatConfirmation(selectedOrganisation?.value, projectId, {
        fileformat_confirmation: true
      });

      //call for Step Change
      props.handleStepChange(props?.currentStep);
    }
  };

  // Toggles checkbox selection
  const handleCheckBoxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setIsCheckedBoxChecked(checked);
  };

  const handleFileFormat = async() =>{
    const apiRes: any = await getConfig();
    const cmsType = apiRes?.data?.cmsType?.toLowerCase();

    const { all_cms = [] } = migrationData?.legacyCMSData || {}; 
    let filteredCmsData = all_cms;
    if (cmsType) {
      filteredCmsData = all_cms.filter((cms: any) => cms?.parent?.toLowerCase() === cmsType);
    }

    const newMigrationDataObj = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        selectedFileFormat: filteredCmsData[0].allowed_file_formats[0]
      }
    };
    setFileIcon(filteredCmsData[0].allowed_file_formats[0].title);
    dispatch(updateNewMigrationData(newMigrationDataObj));
  }

  /****  ALL USEEffects  HERE  ****/
  useEffect(()=>{
    handleFileFormat();
    handleBtnClick();
  },[]);

  const { file_format_checkbox_text = '' } = migrationData.legacyCMSData;

  return (
    <div className="row">
        <div className="service_list_legacy">
                <TextInput
                value={newMigrationData?.legacy_cms?.selectedFileFormat?.fileformat_id}
                version="v2"              
                isReadOnly={true}
                disabled={true}
                width="large"
                placeholder=""
                prefix={
                <Icon icon={fileIcon} size="medium" version='v2'/>}
                />
        </div>
    </div>
  );
};

export default LoadFileFormat;
