import { useContext, useEffect, useState } from 'react';
import { Icon, Select, cbModal } from '@contentstack/venus-components';

import { AppContext } from '../../../context/app/app.context';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import { isEmptyString, validateArray } from '../../../utilities/functions';
import { createStacksInOrg, getAllStacksInOrg } from '../../../services/api/stacks.service';
import { StackResponse } from '../../../services/api/service.interface';
import AddStack, { Stack } from '../../../components/Common/AddStack/addStack';
import { updateDestinationStack } from '../../../services/api/migration.service';
import { Params, useParams } from 'react-router';

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
  const { newMigrationData, updateNewMigrationData, selectedOrganisation } = useContext(AppContext);

  /****  ALL UseStates HERE  ****/
  const [selectedStack, setSelectedStack] = useState<IDropDown>(
    !isEmptyString(newMigrationData.destination_stack.selectedOrg.value)
      ? newMigrationData?.destination_stack?.selectedStack
      : DEFAULT_DROPDOWN
  );
  const loadingOption = [
    {
      uid: '',
      label: 'Loading stacks...',
      value: 'loading',
      default: false,
      master_locale:'',
      locales:[],
      created_at: ''
    }
  ];
  const [allStack, setAllStack] = useState<IDropDown[]>(loadingOption);
  const [allLocales, setAllLocales] = useState<IDropDown[]>([]);

  const [isSaving, setIsSaving] = useState<boolean>(false);

  const { projectId = '' }: Params<string> = useParams();

  //Handle new stack details
  const handleOnSave = async (data: Stack) => {
    if (isSaving) return false;
    setIsSaving(true);

    if (isEmptyString(data?.name) || isEmptyString(data?.locale)) {
      setIsSaving(false);
      return false;
    }

    //Post data to backend
    const resp = await createStacksInOrg(newMigrationData.destination_stack.selectedOrg.value, {
      ...data,
      master_locale: data?.locale
    });

    setIsSaving(false);

    if (resp.status === 201) {
      //fetch all Stacks
      fetchData();

      const newCreatedStack: IDropDown = {
        label: resp?.data?.stack?.name,
        value: resp?.data?.stack?.api_key,
        master_locale: resp?.data?.stack?.master_locale,
        locales: resp?.data?.stack?.locales,
        created_at: resp?.data?.stack?.created_at,
        uid: resp?.data?.stack?.api_key
      };

      setSelectedStack(newCreatedStack);

      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData.destination_stack,
          selectedStack: newCreatedStack
        }
      };

      updateNewMigrationData(newMigrationDataObj);

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

  /****  ALL METHODS HERE  ****/

  //Handle Legacy cms selection
  const handleDropdownChange = (name: string) => (data: IDropDown) => {
    const stackChanged = selectedStack?.value !== data?.value;
    const stackCleared = data?.value === '';
    if (name === 'stacks') {
      if (stackChanged || stackCleared) {
        setSelectedStack(() => ({ ...data }));

        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          destination_stack: {
            ...newMigrationData.destination_stack,
            selectedStack: stackCleared ? DEFAULT_DROPDOWN : { ...data }
          }
        };

        updateNewMigrationData(newMigrationDataObj);

        //call for Step Change
        if (props?.handleStepChange) {
          props.handleStepChange(props?.currentStep, true);
        }
        //.handleStepChange(props?.currentStep, true);
      }
    }
  };

  const fetchData = async () => {
    const stackData = await getAllStacksInOrg(
      newMigrationData?.destination_stack?.selectedOrg?.value
    ); //org id will always be there

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
        stack?.value === newMigrationData?.destination_stack?.selectedStack?.value
    )
    : DEFAULT_DROPDOWN;
  
    setSelectedStack(selectedStackData);

    const newMigrationDataObj: INewMigration = {
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData?.destination_stack,
        selectedStack: selectedStackData
      }
    };

    updateNewMigrationData(newMigrationDataObj);
  };

  /****  ALL USEEffects  HERE  ****/
  useEffect(() => {
    fetchData();
  }, []);
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
          selectedOrganisation=  {selectedOrganisation?.value}
          {...props}
        />
      ),
      modalProps: {
        onClose: () => {
          return;
        },
        onOpen: () => {
          return;
        }
      }
    });
  };
  return (
    <div className="">
      <div className="action-summary-wrapper ">
        <div className="service_list ">
          <div className="row">
            <div className="col-12 pb-3 ">
              <div className="Dropdown-wrapper p-0 active ">
                <Select
                  className="stackselect"
                  version={'v2'}
                  options={allStack}
                  onChange={handleDropdownChange('stacks')}
                  value={selectedStack}
                  isSearchable={true}
                  isClearable={true}
                  isDisabled={props?.stepComponentProps?.isSummary || false}
                  placeholder={'Stacks'}
                />
              </div>
            </div>
            <div className="col-12 pb-2">
              <label className="title">Master Locale</label>
            </div>
            <div className="col-12 pb-2">
              <div className="stackselect locale-container">
                <span>{selectedStack?.master_locale}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="stackselect pb-3 text-end">
          <a className={`link`} onClick={handleCreateNewStack}>
            <span className="small">
              <Icon icon="Plus" size="extraSmall" version="v2" active={true} />
              Create New Stack
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoadStacks;
