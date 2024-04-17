// Libraries
import { ChangeEvent, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '@contentstack/venus-components';

// Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';

// Services
import { updateFileFormatData } from '../../../services/api/migration.service';

// Interface
import { ICardType, defaultCardType } from '../../../components/Common/Card/card.interface';
import { INewMigration } from '../../../context/app/app.interface';

// Context
import { AppContext } from '../../../context/app/app.context';

// Components
import Card from '../../../components/Common/Card/card';
import DocLink from '../../../components/Common/DocLink/DocLink';

interface LoadFileFormatProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadFileFormat = (props: LoadFileFormatProps) => {
  /****  ALL HOOKS HERE  ****/
  const { newMigrationData, updateNewMigrationData, selectedOrganisation, migrationData } =
    useContext(AppContext);
  const [selectedCard, setSelectedCard] = useState<ICardType>(
    newMigrationData?.legacy_cms?.selectedFileFormat ?? defaultCardType
  );
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || false
  );

  const { projectId = '' } = useParams();
  const { allowed_file_formats = [], doc_url = { href: '', title: '' } } =
    newMigrationData?.legacy_cms?.selectedCms || {};

  /****  ALL METHODS HERE  ****/

  const handleBtnClick = (e: MouseEvent) => {
    e.preventDefault();
    if (!isEmptyString(selectedCard.fileformat_id) && isCheckedBoxChecked) {
      updateNewMigrationData({
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData.legacy_cms,
          isFileFormatCheckboxChecked: isCheckedBoxChecked
        }
      });
      updateFileFormatData(selectedOrganisation.value, projectId, {
        file_format: selectedCard?.fileformat_id
      });

      //call for Step Change
      props.handleStepChange(props.currentStep);
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
        description: allowed_file_formats[0]?.description,
        group_name: allowed_file_formats[0]?.group_name,
        title: allowed_file_formats[0]?.title,
        fileformat_id: allowed_file_formats[0]?.fileformat_id
      };
      setSelectedCard(initialFormat);
      const newMigrationDataObj = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData.legacy_cms,
          selectedFileFormat: initialFormat
        }
      };
      updateNewMigrationData(newMigrationDataObj);
    }
  }, [allowed_file_formats]);

  const { file_format_checkbox_text = '' } = migrationData.legacyCMSData;

  return (
    <div className="row">
      <DocLink
        cta={doc_url}
        isCheckedBoxChecked={isCheckedBoxChecked}
        label={file_format_checkbox_text}
        onChange={handleCheckBoxChange}
        isDisable={false}
      />
      <div className="col-12 pb-2">
        <span className="stepper-discription">
          Following is the file format in which data is exported from your current CMS
        </span>
      </div>
      <div className="col-12 bg-white action-content-wrapper p-2">
        <div className="service_list">
          {validateArray(allowed_file_formats) ? (
            allowed_file_formats?.map((data: ICardType, index: number) => (
              <Card
                key={data.fileformat_id || index}
                data={data}
                selectedCard={data?.fileformat_id}
                idField="fileformat_id"
                onCardClick={() => {
                  return;
                }}
              />
            ))
          ) : (
            <>No File formats available</>
          )}
        </div>
      </div>
      <div className="col-12 pt-2">
        <Button version="v2" disabled={!isCheckedBoxChecked} onClick={handleBtnClick}>
          {migrationData?.legacyCMSData?.file_format_cta}
        </Button>
      </div>
    </div>
  );
};

export default LoadFileFormat;
