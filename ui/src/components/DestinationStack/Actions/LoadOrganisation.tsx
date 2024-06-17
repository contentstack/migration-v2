import { ChangeEvent, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { INewMigration } from '../../../context/app/app.interface';
import { TextInput } from '@contentstack/venus-components';

import '../DestinationStack.scss';
import { isEmptyString } from '../../../utilities/functions';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

interface LoadOrganisationProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadOrganisation = (props: LoadOrganisationProps) => {
  /****  ALL HOOKS HERE  ****/

  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  // const organisationsList = useSelector((state:RootState)=>state?.authentication?.organisationsList);

  const dispatch = useDispatch();

  const [selectedOrg, setSelectedOrg] = useState();

  /****  ALL METHODS HERE  ****/

  //update new  Migration Data
  const setNewMigrationData = (data: INewMigration) => {
    dispatch(updateNewMigrationData((data)));
  };
   
  const textInput = newMigrationData?.destination_stack?.selectedOrg?.label 

  //Handle Organisation selection
  // const handleDropdownChange = (data: ChangeEvent<HTMLInputElement>) =>  {
  //   if (selectedOrg?.value !== data?.value) {
  //     setSelectedOrg(() => ({ ...data }));

  //     setNewMigrationData({
  //       ...newMigrationData,
  //       destination_stack: {
  //         ...newMigrationData.destination_stack,
  //         selectedOrg: { ...data }
  //       }
  //     });
  //   }

  //   call for Step Change
  //   props.handleStepChange(props.currentStep);
  // };

  /****  ALL USEEffects  HERE  ****/

  useEffect(() => {
    const org = !isEmptyString(newMigrationData.destination_stack.selectedOrg.label)
      ? newMigrationData?.destination_stack?.selectedOrg
      : selectedOrganisation;

    setSelectedOrg(org as any);

    setNewMigrationData({
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData.destination_stack,
        selectedOrg: { ...org }
      }
    });
  }, []);
  
  return (
    <div className="action-content-wrapper p-3">
      {/* <div className="Dropdown-wrapper p-0">
        <Select
          version={'v2'}
          options={organisationsList}
          onChange={handleDropdownChange}
          value={selectedOrg}
          // width='600'
          // isSearchable={true}
          isDisabled={true}
          placeholder={'Organisation'}
        />
      
      </div> */}
      <TextInput 
        version={'v2'}
        value={textInput || 'Organisation'}
        width="600px"
        className="orgInput"
        isReadOnly
        disabled
      />
    </div>
  );
};

export default LoadOrganisation;
