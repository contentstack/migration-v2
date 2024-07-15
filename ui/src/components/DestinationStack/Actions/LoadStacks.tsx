import { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AsyncSelect, cbModal, TextInput } from '@contentstack/venus-components';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import { isEmptyString, validateArray } from '../../../utilities/functions';
import { createStacksInOrg, getAllStacksInOrg } from '../../../services/api/stacks.service';
import { StackResponse } from '../../../services/api/service.interface';
import AddStack from '../../Common/AddStack/addStack';
import { Stack } from '../../Common/AddStack/addStack.interface';
import { updateDestinationStack } from '../../../services/api/migration.service';
import { Params, useParams } from 'react-router';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadFileFormatProps {
  stepComponentProps: stepComponentPropsType;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}
interface stepComponentPropsType {
  isSummary: boolean;
}

const defaultStack = {
  description: 'Created from Migration Destination Stack Step',
  locale: '',
  name: ''
};

const LoadStacks = (props: LoadFileFormatProps) => {
  const ref = useRef<HTMLDivElement>(null);
  /****  ALL HOOKS HERE  ****/
  
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  const dispatch = useDispatch();
  /****  ALL UseStates HERE  ****/
  const [selectedStack, setSelectedStack] = useState<IDropDown>(
    !isEmptyString(newMigrationData?.destination_stack?.selectedOrg?.value)
      ? newMigrationData?.destination_stack?.selectedStack
      : DEFAULT_DROPDOWN
  );  

  /****  ALL METHODS HERE  ****/

  const [allStack, setAllStack] = useState<IDropDown[]>([]);
  const [allLocales, setAllLocales] = useState<IDropDown[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setisLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [placeholder, setPlaceholder] = useState('Select a stack');
  const [asyncMount, setAsyncMount] = useState(true)


  const { projectId = '' }: Params<string> = useParams();
  useEffect(()=>{
    if(!isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value)){
      setSelectedStack(newMigrationData?.destination_stack?.selectedStack);
    }
  },[newMigrationData?.destination_stack?.selectedStack])

  //Handle new stack details
  const handleOnSave = async (data: Stack) => {
    if (isSaving) return false;
    setIsSaving(true);

    if (isEmptyString(data?.name) || isEmptyString(data?.locale)) {
      setIsSaving(false);
      return false;
    }

    //Post data to backend
    const resp = await createStacksInOrg(newMigrationData?.destination_stack?.selectedOrg?.value, {
      ...data,
      master_locale: data?.locale
    });

    setIsSaving(false);

    if (resp.status === 201) {
      const newCreatedStack: IDropDown = {
        label: resp?.data?.stack?.name,
        value: resp?.data?.stack?.api_key,
        master_locale: resp?.data?.stack?.master_locale,
        locales: resp?.data?.stack?.locales,
        created_at: resp?.data?.stack?.created_at,
        uid: resp?.data?.stack?.api_key
      };
      setSelectedStack(newCreatedStack);
      setisLoading(false)
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          selectedStack: newCreatedStack
        }
      };

      dispatch(updateNewMigrationData((newMigrationDataObj)));

      //API call for saving selected CMS
      if (resp?.data?.stack?.api_key) {
        updateDestinationStack(selectedOrganisation?.value, projectId, {
          stack_api_key: resp?.data?.stack?.api_key
        });
      }
      //call for Step Change

      props.handleStepChange(props?.currentStep, true);
      return true;
    }

    return false;
  };

  

  //Handle Legacy cms selection
  const handleDropdownChange = (name: string) => (data: IDropDown) => {
    const stackCleared = data?.value === '' || data?.value === null || data === null;
    
    if (stackCleared === true) {
      setPlaceholder('Select a stack');
    }
        
    if (name === 'stacks' && data?.value != '+ Create a new Stack') {
      setSelectedStack(() => ({ ...data }));
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          selectedStack: stackCleared ? DEFAULT_DROPDOWN : { ...data }
        }
      };
      
      dispatch(updateNewMigrationData((newMigrationDataObj)));
      if (!stackCleared) {
        if (props?.handleStepChange) {
          props?.handleStepChange(props?.currentStep, true);
        }
      }
    }
  };

  const resetAsyncSelect = () => {
    setAsyncMount(false)
    setTimeout(() => {
      setAsyncMount(true)
    }, 10);
  }

  
  const emptyStackValue = selectedStack?.value === undefined || selectedStack?.value === '' || selectedStack?.value === null

  const loadMoreOptions: any = async ({
    search,
  }: {
    search: string;
  }) => {
    try {
      setisLoading(true);
      const stackData = await getAllStacksInOrg(selectedOrganisation?.value, search); // org id will always be there
      if (stackData?.status === 200) {
        const stackArray = validateArray(stackData?.data?.stacks)
          ? stackData?.data?.stacks?.map((stack: StackResponse) => ({
              label: stack?.name,
              value: stack?.api_key,
              uid: stack?.api_key,
              master_locale: stack?.master_locale,
              locales: stack?.locales,
              created_at: stack?.created_at,
            }))
          : [];

        if (stackData?.data?.stacks?.length === 0 && (!stackData?.data?.stack)) {
          setIsError(true);
          setErrorMessage("Please create new stack there is no stack available");
        } else {
          setIsError(true)
          setErrorMessage("Please select a stack")
        }
        stackArray.sort((a: IDropDown, b: IDropDown) => {
          return new Date(b?.created_at).getTime() - new Date(a?.created_at).getTime();
        });
        return { options: stackArray };
      } else {
        setIsError(true);
        setErrorMessage("Failed to load stacks");
      }
    } catch (error) {
      setIsError(true);
      setErrorMessage("An error occurred while fetching stacks");
    } finally {
      setisLoading(false);
    }
  };

  const handleCreateNewStack = () => {
    cbModal({
      component: (props: LoadFileFormatProps) => (
        <AddStack
          locales={allLocales}
          closeModal={() => {
            return;
          }}
          onSubmit={handleOnSave}
          defaultValues={defaultStack}
          selectedOrganisation={selectedOrganisation?.value}
          {...props}
        />
      ),
      modalProps: {
        shouldCloseOnOverlayClick: true,
        shouldCloseOnEscape: true,
        onOpen: () => {
          return;
        },
        onClose: () => {
          resetAsyncSelect();
          return;
        }
      }
    });
  };

  const [ isSelectOpen, setIsSelectOpen ] = useState<boolean>(false)

  useEffect(() => {
    // Fetch the select element using its class name or testId
    const selectElement = document.querySelector('.selectElementlabel .Select__menu');
    const selectElement1 = document.querySelector('.createStack');
    if (selectElement && !selectElement1) {
      const div = document.createElement('div')
      div.textContent = "+ Create a new Stack"
      div.className = 'createStack'
      div.onclick = handleCreateNewStack
      selectElement.appendChild(div)
    }
  }, [asyncMount, isSelectOpen]);  

  const handleDivClick = () => {
    setIsSelectOpen(!isSelectOpen)
  }

  return (
    <div className="">
      <div className="action-summary-wrapper ">
        <div className="service_list ">
          <div className="row">
            <div className="col-12">
                <div  className="Dropdown-wrapper p-0 active selectElementlabel">
                  {asyncMount ? 
                  <div onClick={handleDivClick}>
                    <AsyncSelect
                      version={'v2'}
                      loadMoreOptions={loadMoreOptions}
                      onChange={handleDropdownChange('stacks')}
                      canEditOption={true}
                      value={selectedStack}
                      isSearchable={true}
                      isClearable={!emptyStackValue ? true : false }
                      width="600px"
                      isDisabled={props?.stepComponentProps?.isSummary || false}
                      hideSelectedOptions={true}
                      placeholder={placeholder}
                      limit={10}
                      updateOption={()=> undefined}
                      error={isLoading ? false : emptyStackValue ? true : false }
                      defaultOptions={true}
                      debounceTimeout={0}
                      menuIsOpen={isSelectOpen}
                    />
                  </div>
                    : null
                  }
                </div>
                {(emptyStackValue && !isLoading) && <div className='errorMessage'>{errorMessage}</div>}
            </div> 
            <div className="col-12">
              <label className="title">Master Locale <span className='asterisk_input'></span>
              </label>
            </div>
            <div className="col-12 pb-2">
              <TextInput 
                version={'v2'}
                value={selectedStack?.master_locale || 'Selected Language'}
                width="600px"
                className="orgInput"
                isReadOnly
                disabled
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadStacks;
