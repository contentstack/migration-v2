// Libraries
import { ChangeEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';


// Utilities
import { isEmptyString, isValidPrefix } from '../../../utilities/functions';

import { getRestrictedKeywords } from '../../../services/api/upload.service';


// Interface
import { DEFAULT_URL_TYPE, INewMigration } from '../../../context/app/app.interface';

// Style
import '../legacyCms.scss';
import { TextInput } from '@contentstack/venus-components';
import { useDebouncer } from '../../../hooks';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadSelectCmsProps {
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadPreFix = (props: LoadSelectCmsProps) => {
  /****  ALL HOOKS HERE  ****/
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);

  const dispatch = useDispatch();

  const [prefix, setPrefix] = useState<string>(newMigrationData?.legacy_cms?.affix || '');

  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isRestictedKeywordCheckboxChecked || false
  );
  const [isRestrictedKey, setIsRestrictedKey] = useState<boolean>(false);

  const [restrictedKeywords,  setRestrictedKeywords] = useState<string[]>([])

  useEffect(() => {
    fetchRestrictedKeywords();
  }, []);

  const fetchRestrictedKeywords = async () => {
    const restrictedIds = await getRestrictedKeywords();

    if (restrictedIds?.status === 200) {
      setRestrictedKeywords(restrictedIds?.data?.restricted)
    }
  }
  
  /****  ALL METHODS HERE  ****/

  const handleOnChange = useDebouncer(async(e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    const value  = e.target.value;
    if (!isEmptyString(value)) {   
      if (restrictedKeywords?.includes(value)) {
        setIsError(true);
        setErrorMessage('Affix should be valid and not a restricted keyword');
        setIsRestrictedKey(true);
        return;
      } else if (!isValidPrefix(value)) {
        setIsRestrictedKey(false);
        setIsError(true);
        setErrorMessage('Prefix must be 2 to 5 letters, with no numbers or special characters.');
      } else {
        setPrefix(value);
        setIsError(false);
        setErrorMessage('');
        setIsRestrictedKey(false);
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          legacy_cms: {
            ...newMigrationData?.legacy_cms,
            affix: value,
            isRestictedKeywordCheckboxChecked: isCheckedBoxChecked
          }
        };

        dispatch(updateNewMigrationData(newMigrationDataObj));
  
        setIsError(false);
  
        //call for Step Change
        props?.handleStepChange(props?.currentStep);
        return;
      }
    } else {
      setIsError(true);
      setErrorMessage('Please enter Affix');
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        legacy_cms: {
          ...newMigrationData?.legacy_cms,
          affix: value,
          isRestictedKeywordCheckboxChecked: isCheckedBoxChecked
        }
      };

      dispatch(updateNewMigrationData(newMigrationDataObj));

    }
  });


  /****  ALL USEEffects  HERE  ****/

  const { restricted_keyword_link = DEFAULT_URL_TYPE } =
    migrationData.legacyCMSData;

  return (
    <div className="p-3">
      <div className="col-12">
        <TextInput
          onChange={(e: React.ChangeEvent<HTMLInputElement>)=>{handleOnChange(e)}}
          value={prefix}
          autoFocus={true}
          width="large"
          placeholder={'Add Prefix'}
          version="v2"
          error={isError}
          aria-label='affix'
          disabled={newMigrationData?.legacy_cms?.uploadedFile?.isValidated}
          isReadOnly={newMigrationData?.legacy_cms?.uploadedFile?.isValidated}
        />
        {isError && <p className="errorMessage">{errorMessage}</p>}       
        
      </div>
      { isRestrictedKey && 
      <div className="col-12">
        
        <p className='link-discription'>
          Please refer the list of Contentstack <a href={restricted_keyword_link?.href} target="_blank" rel="noreferrer" className="link">restricted keywords</a>
        </p>

      </div>}
    </div>
  );
};

export default LoadPreFix;
