import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IDropDown, INewMigration } from '../../../context/app/app.interface';
import { TextInput } from '@contentstack/venus-components';

import '../DestinationStack.scss';
import { isEmptyString } from '../../../utilities/functions';
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

const LoadOrganisation = () => {
  /****  ALL HOOKS HERE  ****/

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);

  const dispatch = useDispatch();

  const [selectedOrg, setSelectedOrg] = useState<IDropDown>();
  /****  ALL METHODS HERE  ****/

  //update new  Migration Data
  const setNewMigrationData = (data: INewMigration) => {
    dispatch(updateNewMigrationData((data)));
  };


  /****  ALL USEEffects  HERE  ****/

  useEffect(() => {
    const org :IDropDown = !isEmptyString(newMigrationData?.destination_stack?.selectedOrg?.label)
      ? newMigrationData?.destination_stack?.selectedOrg
      : selectedOrganisation;

    setSelectedOrg(org);

    setNewMigrationData({
      ...newMigrationData,
      destination_stack: {
        ...newMigrationData?.destination_stack,
        selectedOrg: { ...org }
      }
    });
  }, []);

  return (
    <div className="action-content-wrapper p-3">
      <TextInput
        version={'v2'}
        value={selectedOrg?.label ?? 'Organisation'}
        width="600px"
        className="orgInput"
        isReadOnly
        disabled
      />
    </div>
  );
};

export default LoadOrganisation;
