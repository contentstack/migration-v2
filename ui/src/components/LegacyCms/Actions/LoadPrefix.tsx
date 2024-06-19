// Libraries
import { ChangeEvent, useState } from 'react';
import { useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

// Service
import { updateAffixData, affixConfirmation } from '../../../services/api/migration.service';

// Utilities
import { isEmptyString, isValidPrefix } from '../../../utilities/functions';


// Interface
import { DEFAULT_URL_TYPE, INewMigration } from '../../../context/app/app.interface';

// Style
import '../legacyCms.scss';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDebouncer } from '../../../hooks';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

//import restricted keywords
import restrictedKeywords from '../restrictedKeywords.json';

interface LoadSelectCmsProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadPreFix = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);

  const dispatch = useDispatch();

  const [prefix, setPrefix] = useState<string>(newMigrationData?.legacy_cms?.affix || '');

  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isRestictedKeywordCheckboxChecked || false
  );
  const [isRestrictedkey, setIsRestrictedKey] = useState<boolean>(false);

  const { projectId = '' } = useParams();

  const idArray = restrictedKeywords.idArray;


  /****  ALL METHODS HERE  ****/

  //Handle Prefix Change
  const handleOnBlur = async (e: any) => {
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

      dispatch(updateNewMigrationData(newMigrationDataObj));

      setIsError(false);

      //API call for saving Affix
      await updateAffixData(selectedOrganisation?.value, projectId, { affix: prefix });
      await affixConfirmation(selectedOrganisation?.value, projectId, {
        affix_confirmation: isCheckedBoxChecked
      });

      //call for Step Change
      props.handleStepChange(props?.currentStep);

      return;
    }

    //setIsError(true);
  };

  const handleOnChange = useDebouncer(async(e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    const value  = e.target.value;
    if (!isEmptyString(value) && isValidPrefix(value) ) {   
      if(! idArray?.includes(value)){      
        setPrefix(value);
        setIsError(false);
        setErrorMessage('');
        setIsRestrictedKey(false);
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData.legacy_cms,
            affix: value,
            isRestictedKeywordCheckboxChecked: isCheckedBoxChecked
          }
        };

        dispatch(updateNewMigrationData(newMigrationDataObj));
  
        setIsError(false);
  
        //API call for saving Affix
        await updateAffixData(selectedOrganisation?.value, projectId, { affix: value });
        await affixConfirmation(selectedOrganisation?.value, projectId, {
          affix_confirmation: true
        });
  
        //call for Step Change
        props.handleStepChange(props?.currentStep);
        return;

      }
      else{
        setIsError(true);
        setErrorMessage('Affix should be valid and not a restricted keyword');
        setIsRestrictedKey(true);
        return;
      }
    }
    setIsError(true);
    setErrorMessage('Affix should not be more than 5 chars');
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
    dispatch(updateNewMigrationData((newMigrationDataObj)));

    setIsCheckedBoxChecked(checked);
  };

  /****  ALL USEEffects  HERE  ****/

  const { restricted_keyword_link = DEFAULT_URL_TYPE, restricted_keyword_checkbox_text = '' } =
    migrationData.legacyCMSData;

  return (
    <div className="p-3">
      <div className="col-12">
        <TextInput
          onChange={(e:any)=>{handleOnChange(e)}}
          value={prefix}
          autoFocus={true}
          width="large"
          placeholder={'Enter Affix'}
          version="v2"
          error={isError}
        />
        {isError && <p className="errorMessage">{errorMessage}</p>}       
        
      </div>
      { isRestrictedkey && 
      <div className="col-12">
        
        <p className='link-discription'>Please refer the list of Contentstack 
          <a href={restricted_keyword_link?.href} target="_blank" rel="noreferrer" className=" link"> restricted keywords</a>
        </p>

      </div>}
    </div>
  );
};

export default LoadPreFix;
