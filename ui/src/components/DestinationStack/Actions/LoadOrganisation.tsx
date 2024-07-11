// Importing necessary React hooks and Redux functions for state management.
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Importing type definitions for dropdown and migration data structures.
import { IDropDown, INewMigration } from '../../../context/app/app.interface';

// Importing UI components from @contentstack/venus-components.
import { TextInput } from '@contentstack/venus-components';

// Importing stylesheet for the DestinationStack component.
import '../DestinationStack.scss';

// Utility function to check for empty strings.
import { isEmptyString } from '../../../utilities/functions';

// RootState type for accessing the Redux store's state.
import { RootState } from '../../../store';

// Action creator for updating migration data in the Redux store.
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';

// Interface defining the props expected by the LoadOrganisation component.
interface LoadOrganisationProps {
  stepComponentProps: any; // Props for the step component, type not specified.
  currentStep: number; // The current step in a multi-step process.
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void; // Function to handle step changes.
}

// The LoadOrganisation component is responsible for loading and displaying the selected organisation.
const LoadOrganisation = (props: LoadOrganisationProps) => {
  // State and dispatch hooks for interacting with the Redux store.
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState) => state?.authentication?.selectedOrganisation);
  const dispatch = useDispatch();

  // Local state for tracking the selected organisation.
  const [selectedOrg, setSelectedOrg] = useState<IDropDown>();

  // Function to update the new migration data in the Redux store.
  const setNewMigrationData = (data: INewMigration) => {
    dispatch(updateNewMigrationData(data));
  };

  // Effect hook to initialize the selected organisation based on the Redux store or local state.
  useEffect(() => {
    const org = !isEmptyString(newMigrationData.destination_stack.selectedOrg.label)
      ? newMigrationData.destination_stack.selectedOrg
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

  // Render function for the LoadOrganisation component.
  return (
    <div className="action-content-wrapper p-3">
      <TextInput 
        version={'v2'}
        value={selectedOrg?.label || 'Organisation'}
        width="600px"
        className="orgInput"
        isReadOnly
        disabled
      />
    </div>
  );
};

// Exporting the LoadOrganisation component as the default export.
export default LoadOrganisation;