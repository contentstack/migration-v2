// Libraries
import { ChangeEvent, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';

// Service
import { updateAffixData, affixConfirmation } from '../../../services/api/migration.service';

// Utilities
import { isEmptyString, isValidPrefix } from '../../../utilities/functions';

// Context
import { AppContext } from '../../../context/app/app.context';

// Interface
import { DEFAULT_URL_TYPE, INewMigration } from '../../../context/app/app.interface';

// Style
import '../legacyCms.scss';
import { Button, TextInput } from '@contentstack/venus-components';
import { useDebouncer } from '../../../hooks';
import DocLink from '../../../components/Common/DocLink/DocLink';

interface LoadSelectCmsProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadPreFix = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const { newMigrationData, updateNewMigrationData, selectedOrganisation, migrationData } =
    useContext(AppContext);

  const [prefix, setPrefix] = useState<string>(newMigrationData?.legacy_cms?.affix || '');

  const [isError, setIsError] = useState<boolean>(false);
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isRestictedKeywordCheckboxChecked || false
  );

  const { projectId = '' } = useParams();

  /****  ALL METHODS HERE  ****/

  //Handle Prefix Change
  const handleOnBlur = (e: MouseEvent) => {
    e.preventDefault();
    if (!isEmptyString(prefix) && !isError && isCheckedBoxChecked) {
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData.legacy_cms,
          affix: prefix,
          isRestictedKeywordCheckboxChecked: isCheckedBoxChecked
        }
      };

      updateNewMigrationData(newMigrationDataObj);

      setIsError(false);

      //API call for saving Affix
      updateAffixData(selectedOrganisation?.value, projectId, { affix: prefix });
      affixConfirmation(selectedOrganisation?.value, projectId, {
        affix_confirmation: isCheckedBoxChecked
      });

      //call for Step Change
      props.handleStepChange(props.currentStep);

      return;
    }

    //setIsError(true);
  };

  const handleOnChange = useDebouncer((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    const { value } = e.target;
    if (!isEmptyString(value) && isValidPrefix(value)) {
      setPrefix(value);
      setIsError(false);
      return;
    }

    setIsError(true);
  });

  // Toggles checkbox selection
  const handleCheckBoxChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      legacy_cms: {
        ...newMigrationData?.legacy_cms,
        isRestictedKeywordCheckboxChecked: checked
      }
    };
    updateNewMigrationData(newMigrationDataObj);

    setIsCheckedBoxChecked(checked);
  };



  /****  ALL USEEffects  HERE  ****/

  const { restricted_keyword_link = DEFAULT_URL_TYPE, restricted_keyword_checkbox_text = '' } =
    migrationData.legacyCMSData;

  return (
    <div className="row p-3">
      <DocLink
        cta={restricted_keyword_link}
        isCheckedBoxChecked={isCheckedBoxChecked}
        label={restricted_keyword_checkbox_text}
        onChange={handleCheckBoxChange}
        isDisable={false}
      />

      <div className="col-12 pb-2">
        <TextInput
          onChange={handleOnChange}
          value={prefix}
          autoFocus={true}
          width="large"
          placeholder={'Enter Affix'}
          version="v2"
          error={isError}
        />
      </div>
      <div className="col-12 pt-2">
        <Button version="v2" disabled={!isCheckedBoxChecked} onClick={handleOnBlur}>
          {migrationData?.legacyCMSData?.affix_cta}
        </Button>
      </div>
    </div>
  );
};

export default LoadPreFix;
