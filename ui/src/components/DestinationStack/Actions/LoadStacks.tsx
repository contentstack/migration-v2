// Libraries
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Select, cbModal, TextInput, SkeletonTile } from '@contentstack/venus-components';

// Redux
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

// Interface
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import { StackResponse } from '../../../services/api/service.interface';
import { Stack } from '../../../components/Common/AddStack/addStack.interface';

//Utilities
import { isEmptyString, validateArray } from '../../../utilities/functions';

// Services
import { createStacksInOrg, getAllStacksInOrg } from '../../../services/api/stacks.service';

// Components
import AddStack from '../../../components/Common/AddStack/addStack';

interface LoadFileFormatProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const defaultStack = {
  description: 'Created from Migration Destination Stack Step',
  locale: '',
  name: ''
};

const LoadStacks = (props: LoadFileFormatProps) => {
  /****  ALL HOOKS HERE  ****/
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  const dispatch = useDispatch();
  /****  ALL UseStates HERE  ****/
  const [selectedStack, setSelectedStack] = useState<IDropDown | null>(
    null
  );  
  const loadingOption = [
    {
      uid: '',
      label: (
        <SkeletonTile
        numberOfTiles={1}
        tileBottomSpace={7}
        tileHeight={20}
        tileRadius={0}
        tileTopSpace={0}
        tileWidth={200}
        tileleftSpace={0}
      />) as unknown as string,
      value: 'loading',
      default: false,
      master_locale: '',
      locales: [],
      created_at: ''
    }
  ];
  const [allStack, setAllStack] = useState<IDropDown[]>(newMigrationData?.destination_stack?.stackArray);
  const [allLocales] = useState<IDropDown[]>([]);
  // const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [placeholder] = useState<string>('Select a stack');
  const newMigrationDataRef = useRef(newMigrationData);

  useEffect(() => {
    newMigrationDataRef.current = newMigrationData;    
  }, [newMigrationData]);
  useEffect(()=>{
    if(!isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value)){
      setSelectedStack(newMigrationData?.destination_stack?.selectedStack);
    }
    setAllStack(newMigrationData?.destination_stack?.stackArray)

  },[newMigrationData?.destination_stack?.selectedStack])
  //Handle new stack details
  const handleOnSave = async (data: Stack) => {
    // Post data to backend
    const resp = await createStacksInOrg(selectedOrganisation?.value, {
      ...data,
      master_locale: data?.locale
    });
        
    if (resp.status === 201) {
      if (newMigrationData?.destination_stack?.stackArray?.length > 0) {
        await fetchData();  
      }
  
      const newCreatedStack: IDropDown = {
        label: resp?.data?.stack?.name,
        value: resp?.data?.stack?.api_key,
        master_locale: resp?.data?.stack?.master_locale,
        locales: resp?.data?.stack?.locales,
        created_at: resp?.data?.stack?.created_at,
        uid: resp?.data?.stack?.api_key
      };
  
      setSelectedStack(newCreatedStack);
      
      const updatedStackArray = [newCreatedStack, ...allStack];
      updatedStackArray.sort(
        (a: IDropDown, b: IDropDown) =>
          new Date(b?.created_at)?.getTime() - new Date(a?.created_at)?.getTime()
      );
      
      setAllStack(updatedStackArray);
  
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData.destination_stack,
          selectedStack: newCreatedStack,
          stackArray: updatedStackArray
        }
      };
  
      dispatch(updateNewMigrationData(newMigrationDataObj));
      // call for Step Change
      props.handleStepChange(props?.currentStep, true);
      
      return true;
    }
  };
  
  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleDropdownChange = (name: string) => (data: IDropDown) => {
    const stackCleared = data?.value === '' || data?.value === null || data === null || data?.value === undefined;
    if (name === 'stacks' && data?.value != '+ Create a new Stack') {
      setSelectedStack(() => ({ ...data }));
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          selectedStack:  { ...data }
        }
      };

      if (stackCleared === true) {
        setIsError(true);
        setErrorMessage("Please select a stack");
        setSelectedStack(null);
      }
      
      dispatch(updateNewMigrationData(newMigrationDataObj));
      if (!stackCleared) {
        setIsError(false)
        if (props?.handleStepChange) {
          props?.handleStepChange(props?.currentStep, true);
        }
      }
    }
    
  };
  
  const fetchData = async () => {
    if (allStack?.length <= 0) {
      setAllStack(loadingOption);
      const stackData = await getAllStacksInOrg(selectedOrganisation?.value, ''); // org id will always be there  
      const stackArray = validateArray(stackData?.data?.stacks)
        ? stackData?.data?.stacks?.map((stack: StackResponse) => ({
            label: stack?.name,
            value: stack?.api_key,
            uid: stack?.api_key,
            master_locale: stack?.master_locale,
            locales: stack?.locales,
            created_at: stack?.created_at
          }))
        : [];
  
      stackArray.sort(
        (a: IDropDown, b: IDropDown) =>
          new Date(b?.created_at)?.getTime() - new Date(a?.created_at)?.getTime()
      );
  
      setAllStack(stackArray);      
      //Set selected Stack
      const selectedStackData = validateArray(stackArray)
        ? stackArray.find(
            (stack: IDropDown) =>
            {
              return stack?.value === newMigrationData?.destination_stack?.selectedStack?.value
            }
          )
        : DEFAULT_DROPDOWN;
      if (stackData?.data?.stacks?.length === 0 && (!stackData?.data?.stack)) {
        setIsError(true);
        setErrorMessage("Please create new stack there is no stack available");
      } 
      if(selectedStackData){
        setSelectedStack(selectedStackData);
        const newMigrationDataObj: INewMigration = {
          ...newMigrationDataRef?.current,
          destination_stack: {
            ...newMigrationDataRef?.current?.destination_stack,
            selectedStack: selectedStackData,
            stackArray: stackArray
          }
        };  
        // Dispatch the updated migration data to Redux
        dispatch(updateNewMigrationData(newMigrationDataObj));

      }
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
        onClose: () => {
          setIsError(false)
        },
        onOpen: () => {
          return;
        }
      }
    });
  };

  const emptyStackValue = selectedStack?.value === undefined || selectedStack?.value === '' || selectedStack?.value === null
  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    fetchData();
  }, []);
  return (
    <div className="">
      <div className="action-summary-wrapper ">
        <div className="service_list ">
          <div className="row">
            <div className="col-12">
              <div className="Dropdown-wrapper p-0 active ">
                <Select
                  className="stackselect"
                  value={selectedStack}
                  options={allStack}
                  onChange={handleDropdownChange('stacks')}
                  isSearchable={true}
                  // placeholder='Select a stack'
                  placeholder={placeholder}

                  isClearable={newMigrationData?.destination_stack?.stackArray?.length > 0 && !emptyStackValue ? true : false }
                  // hideSelectedOptions={true}
                  isDisabled={props?.stepComponentProps?.isSummary || false}
                  error={isLoading ? false : isError ? true : false }
                  width="600px"
                  hasAddOption={true}
                  // menuIsOpen
                  version='v2'
                  addOptionText={
                  <div className='createStack' onClick={handleCreateNewStack}>
                    + Create a new Stack
                  </div>} 
                />
                {(isError && !isLoading) && <div className='errorMessage'>{errorMessage}</div>}
              </div>
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