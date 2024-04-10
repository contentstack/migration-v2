import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../../context/app/app.context';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import { Select } from '@contentstack/venus-components';

import '../DestinationStack.scss';
import { isEmptyString } from '../../../utilities/functions';

interface LoadOrganisationProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

const LoadOrganisation = (props: LoadOrganisationProps) => {
  /****  ALL HOOKS HERE  ****/
  const { newMigrationData, updateNewMigrationData, organisationsList, selectedOrganisation } =
    useContext(AppContext);

  const [selectedOrg, setSelectedOrg] = useState<IDropDown>(DEFAULT_DROPDOWN);

  /****  ALL METHODS HERE  ****/

  //update new  Migration Data
  const setNewMigrationData = (data: INewMigration) => {
    updateNewMigrationData(data);
  };

  //Handle Organisation selection
  const handleDropdownChange = (data: IDropDown) => {
    if (selectedOrg?.value !== data?.value) {
      setSelectedOrg(() => ({ ...data }));

      setNewMigrationData({
        ...newMigrationData,
        destination_stack: {
          ...newMigrationData.destination_stack,
          selectedOrg: { ...data }
        }
      });
    }

    //call for Step Change
    props.handleStepChange(props.currentStep);
  };

  /****  ALL USEEffects  HERE  ****/

  useEffect(() => {
    const org = !isEmptyString(newMigrationData.destination_stack.selectedOrg.label)
      ? newMigrationData?.destination_stack?.selectedOrg
      : selectedOrganisation;

    setSelectedOrg(org);

    setNewMigrationData({
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData.destination_stack,
        selectedOrg: { ...org }
      }
    });
  }, []);

  return (
    <div className="row bg-white action-content-wrapper p-3">
      <div className="col-12">
        <div className="Dropdown-wrapper p-0">
          <Select
            version={'v2'}
            options={organisationsList}
            onChange={handleDropdownChange}
            value={selectedOrg}
            isSearchable={true}
            isDisabled={props?.stepComponentProps?.isSummary || false}
            placeholder={'Organisation'}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadOrganisation;
