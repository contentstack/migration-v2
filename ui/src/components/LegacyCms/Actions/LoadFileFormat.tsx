// Libraries
import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Icon, TextInput } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';

// Utilities
import { isEmptyString } from '../../../utilities/functions';

// Services
import {
  fileformatConfirmation
} from '../../../services/api/migration.service';

// Interface
import { ICardType} from '../../../components/Common/Card/card.interface';


// Components
import { RootState } from '../../../store';
import { updateNewMigrationData } from '../../../store/slice/migrationDataSlice';
import { getConfig } from '../../../services/api/upload.service';

interface LoadFileFormatProps {
  stepComponentProps: any;
  currentStep: number;
  handleStepChange: (stepIndex: number, closeStep?: boolean) => void;
}

/**
 * Component for loading file format.
 * @param {LoadFileFormatProps} props - The component props.
 * @returns {JSX.Element} The rendered component.
 */
const LoadFileFormat = (props: LoadFileFormatProps) => {

  // State variables
  const newMigrationData = useSelector((state:RootState)=>state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation); 
  const migrationData = useSelector((state:RootState)=>state?.migration?.migrationData);
  const dispatch = useDispatch();

  const [selectedCard, setSelectedCard] = useState<ICardType>(
    newMigrationData?.legacy_cms?.selectedFileFormat 
  );
  const [isCheckedBoxChecked, setIsCheckedBoxChecked] = useState<boolean>(
    newMigrationData?.legacy_cms?.isFileFormatCheckboxChecked || true
  );
  const [fileIcon, setFileIcon]  = useState(newMigrationData?.legacy_cms?.selectedFileFormat?.title);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Other code...

  return (
    <div className="p-3">
        <div className="col-12">
          <TextInput
          value={fileIcon}
          version="v2"              
          isReadOnly={true}
          disabled={true}
          width="large"
          placeholder=""
          prefix={
          <Icon icon={fileIcon} size="medium" version='v2'/>}
          />
          {isError && <p className="errorMessage">{error}</p>}
        </div>
        
    </div>
  );
};

export default LoadFileFormat;
