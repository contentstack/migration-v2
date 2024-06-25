// Libraries
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';

// Services
import {
  updateFileFormatData,
  fileformatConfirmation
} from '../../../services/api/migration.service';

// Interface
import { ICardType, defaultCardType } from '../../../components/Common/Card/card.interface';


// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

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
    newMigrationData?.legacy_cms?.selectedFileFormat ?? defaultCardType
  );
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || true
  );

  const { projectId = '' } = useParams();
  const { allowed_file_formats = [], doc_url = { href: '', title: '' } } =
    newMigrationData?.legacy_cms?.selectedCms || {};

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

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    if (validateArray(allowed_file_formats)) {
      const initialFormat = {
        description: allowed_file_formats?.[0]?.description,
        group_name: allowed_file_formats?.[0]?.group_name,
        title: allowed_file_formats?.[0]?.title,
        fileformat_id: allowed_file_formats?.[0]?.fileformat_id
      };
      setSelectedCard(initialFormat);
      const newMigrationDataObj = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          selectedFileFormat: initialFormat
        }
      };
      dispatch(updateNewMigrationData(newMigrationDataObj));
      handleBtnClick();
    }
  }, [allowed_file_formats]);

  const { file_format_checkbox_text = '' } = migrationData.legacyCMSData;

  return (
    <div className="row">
        <div className="service_list_legacy">
          {validateArray(allowed_file_formats) ? (
            allowed_file_formats?.map((data: ICardType, index: number) => (
              <div key={data?.fileformat_id || index}>             
                <TextInput
                value={data?.fileformat_id}
                version="v2"              
                isReadOnly={true}
                disabled={true}
                width="large"
                placeholder=""
                prefix={
                <Icon icon={data?.title} size="medium" version='v2'/>}
                />

              </div>
            ))
          ) : (
            <>No File formats available</>
          )}
        </div>
    </div>
  );
};

export default LoadFileFormat;
