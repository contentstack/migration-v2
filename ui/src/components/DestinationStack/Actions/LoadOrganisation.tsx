import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppContext } from '../../../context/app/app.context';
import { DEFAULT_DROPDOWN, IDropDown, INewMigration } from '../../../context/app/app.interface';
import { Select } from '@contentstack/venus-components';

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
  const organisationsList = useSelector((state:RootState)=>state?.authentication?.organisationsList);

  const dispatch = useDispatch();

  const [selectedOrg, setSelectedOrg] = useState<IDropDown>(DEFAULT_DROPDOWN);

  /****  ALL METHODS HERE  ****/

  //update new  Migration Data
  const setNewMigrationData = (data: INewMigration) => {
    dispatch(updateNewMigrationData((data)));
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

    updateNewMigrationData({
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
