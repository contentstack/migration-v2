// Libraries
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Select,
  cbModal,
  TextInput,
  SkeletonTile,
  Icon,
  Tooltip
} from '@contentstack/venus-components';

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
import { createStacksInOrg, getAllStacksInOrg, getStackLocales } from '../../../services/api/stacks.service';

// Components
import AddStack from '../../../components/Common/AddStack/addStack';

interface LoadFileFormatProps {
  stepComponentProps?: () => {};
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
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const dispatch = useDispatch();

  /****  ALL UseStates HERE  ****/
  const [selectedStack, setSelectedStack] = useState<IDropDown | null>(null);
  const [newStackCreated, setNewStackCreated] = useState<boolean>(false);

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
        />
      ) as unknown as string,
      value: 'loading',
      default: false,
      master_locale: '',
      locales: [],
      created_at: '',
      disabled: false
    }
  ];
  const [allStack, setAllStack] = useState<IDropDown[]>(
    newMigrationData?.destination_stack?.stackArray
  );
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

  useEffect(() => {
    if (!isEmptyString(newMigrationData?.destination_stack?.selectedStack?.value)) {
      setSelectedStack(newMigrationData?.destination_stack?.selectedStack);
    }
    // setAllStack(newMigrationData?.destination_stack?.stackArray)
  }, [newMigrationData?.destination_stack?.selectedStack]);

  //Handle new stack details
  const handleOnSave = async (data: Stack) => {
    try {
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
          uid: resp?.data?.stack?.api_key,
          isNewStack: true,
          isDisabled: false
        };

        setSelectedStack(newCreatedStack);
        setNewStackCreated(true);

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
    } catch (error) {
      return error;
    }
  };

  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleDropdownChange = (name: string) => (data: IDropDown) => {
    const stackCleared =
      data?.value === '' || data?.value === null || data === null || data?.value === undefined;
    if (name === 'stacks' && data?.value != '+ Create a new Stack') {
      setSelectedStack(() => ({ ...data }));
      setNewStackCreated(newStackCreated);
      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData?.destination_stack,
          selectedStack: { ...data }
        }
      };

      if (stackCleared === true) {
        setIsError(true);
        setErrorMessage('Please select a stack');
        setSelectedStack(null);
        setNewStackCreated(false);
      }

      dispatch(updateNewMigrationData(newMigrationDataObj));
      if (!stackCleared) {
        setIsError(false);
        if (props?.handleStepChange) {
          props?.handleStepChange(props?.currentStep, true);
        }
      }
    }
  };

  const fetchData = async () => {
    try {
      if (allStack?.length <= 0) {
        setAllStack(loadingOption);
        const stackData = await getAllStacksInOrg(selectedOrganisation?.value, ''); // org id will always be there
        const csLocales = await getStackLocales(selectedOrganisation?.value);
        const stackArray = validateArray(stackData?.data?.stacks)
          ? stackData?.data?.stacks?.map((stack: StackResponse) => ({
              label: stack?.name,
              value: stack?.api_key,
              uid: stack?.api_key,
              master_locale: stack?.master_locale,
              locales: stack?.locales,
              created_at: stack?.created_at,
              isNewStack: newStackCreated,
              isDisabled: newMigrationDataRef?.current?.destination_stack?.migratedStacks?.includes(
                stack?.api_key
              )
            }))
          : [];

        stackArray.sort(
          (a: IDropDown, b: IDropDown) =>
            new Date(b?.created_at)?.getTime() - new Date(a?.created_at)?.getTime()
        );

        setAllStack(stackArray);
        //Set selected Stack
        const selectedStackData = validateArray(stackArray)
          ? stackArray.find((stack: IDropDown) => {
              return stack?.value === newMigrationData?.destination_stack?.selectedStack?.value;
            })
          : null;
        // if (stackData?.data?.stacks?.length === 0 && (!stackData?.data?.stack)) {
        //   setIsError(true);
        //   setErrorMessage("Please create new stack there is no stack available");
        // }

        if (selectedStackData) {
          setSelectedStack(selectedStackData);
          setNewStackCreated(false);
          const newMigrationDataObj: INewMigration = {
            // ...newMigrationDataRef?.current,
            ...newMigrationData,
            destination_stack: {
              ...newMigrationData?.destination_stack,
              selectedStack: selectedStackData,
              stackArray: stackArray
            }
          };
          // Dispatch the updated migration data to Redux
          dispatch(updateNewMigrationData(newMigrationDataObj));
        }
        const newMigrationDataObj: INewMigration = {
          // ...newMigrationDataRef?.current,
          ...newMigrationData,
          destination_stack: {
            ...newMigrationData?.destination_stack,
            csLocale: csLocales?.data?.locales
          }
        };  
        // Dispatch the updated migration data to Redux
        dispatch(updateNewMigrationData(newMigrationDataObj));
      }
    } catch (error) {
      return error;
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
          setIsError(false);
        },
        onOpen: () => {
          return;
        }
      }
    });
  };

  const emptyStackValue =
    selectedStack?.value === undefined ||
    selectedStack?.value === '' ||
    selectedStack?.value === null;
  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="">
      <div className="action-summary-wrapper ">
        <div>
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
                  isClearable={allStack?.length > 0 && !emptyStackValue}
                  // hideSelectedOptions={true}
                  isDisabled={newMigrationData?.project_current_step > 2}
                  error={isLoading ? false : !!isError}
                  width="600px"
                  hasAddOption={true}
                  // menuIsOpen
                  version="v2"
                  addOptionText={
                    <div className="createStack" onClick={handleCreateNewStack}>
                      + Create a new stack
                    </div>
                  }
                />
                {isError && !isLoading && <div className="errorMessage">{errorMessage}</div>}
              </div>
            </div>
            <div className="col-12">
              <label className="title">
                Master Locale <span className="asterisk_input"></span>
              </label>
              <Tooltip
                content="Master Locale is auto-selected based on the chosen stack."
                position="right"
              >
                <Icon icon="Information" version="v2" size="small"></Icon>
              </Tooltip>
            </div>
            <div className="col-12 pb-2">
              <TextInput
                version={'v2'}
                placeholder={
                  selectedStack?.master_locale
                    ? ''
                    : 'Master Locale will be set after stack selection'
                }
                value={selectedStack?.master_locale}
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
