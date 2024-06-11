// Libraries
import { useEffect, useState } from 'react';
import { Button } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';

// Redux files
import {  updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Service
import { getProject } from '../../services/api/project.service';

// Interfaces
import { DEFAULT_NEW_MIGRATION } from '../../context/app/app.interface';

// CSS
import './index.scss';

type MigrationFlowHeaderProps = {
  handleOnClick: (event: MouseEvent, handleStepChange: (currentStep: number) => void) => void;
};

const MigrationFlowHeader = ({ handleOnClick }: MigrationFlowHeaderProps) => {
  const [projectName, setProjectName] = useState('');

  const navigate = useNavigate();
  const params: Params<string> = useParams();
  const dispatch = useDispatch();

  const selectedOrganisation = useSelector((state:any)=>state?.authentication?.selectedOrganisation);

  useEffect(() => {
    fetchProject();
  }, [selectedOrganisation?.value, params?.projectId]);

  /******** Function to get project  ********/
  const fetchProject = async () => {
    const response = await getProject(selectedOrganisation?.value || '', params?.projectId || '');

    if (response?.status === 200) {
      setProjectName(response?.data?.name);

      //Navigate to lastest or active Step
      const url = `/projects/${params?.projectId}/migration/steps/${response?.data?.current_step}`;
      navigate(url, { replace: true });
    }
  };

  const backNavigation = () => {
    dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION))
    navigate(-1);
  }

  return (
    <div className='d-flex align-items-center justify-content-between migration-flow-header'>
      <div className='d-flex align-items-center'>
        <Button 
          aria-label='Go back'
          buttonType="secondary"
          icon="v2-LeftArrow"
          iconAlignment="left"
          size="large"
          version="v2"
          className="back-btn"
          onlyIconHoverColor="secondary"
          onClick={backNavigation}
        />
        { projectName && <h1>{projectName}</h1> }
      </div>

      <Button
        buttonType='primary'
        className="ml-10"
        onClick={handleOnClick}
        version="v2"
        aria-label='Save and Continue'
      >
        Save and Continue
      </Button>
    </div>
  )
}

export default MigrationFlowHeader;