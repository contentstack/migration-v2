// Libraries
import { useEffect, useState } from 'react';
import { Button, cbModal } from '@contentstack/venus-components';
import { useDispatch, useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';

// Redux files
import {  updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Service
import { getProject } from '../../services/api/project.service';

// Interfaces
import { DEFAULT_NEW_MIGRATION } from '../../context/app/app.interface';
import { ModalObj } from '../Modal/modal.interface';

// CSS
import './index.scss';
import NotificationModal from '../Common/NotificationModal';
import { isEmptyString } from '../../utilities/functions';
import { RootState } from '../../store';

type MigrationFlowHeaderProps = {
  handleOnClick: (event: MouseEvent, handleStepChange: (currentStep: number) => void) => void;
  isLoading: boolean;
  isCompleted: boolean;
  legacyCMSRef: React.MutableRefObject<any>; 
};

const MigrationFlowHeader = ({ handleOnClick, isLoading, isCompleted , legacyCMSRef}: MigrationFlowHeaderProps) => {
  const [projectName, setProjectName] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(0);

  const navigate = useNavigate();
  const params: Params<string> = useParams();
  const dispatch = useDispatch();

  const selectedOrganisation = useSelector((state:any)=>state?.authentication?.selectedOrganisation);
  const newMigrationData = useSelector((state:RootState)=> state?.migration?.newMigrationData);

  //const legacyCMSRef = useRef<any>(null);

  useEffect(() => {
    fetchProject();
  }, [selectedOrganisation?.value, params?.projectId]);

  /******** Function to get project  ********/
  const fetchProject = async () => {
    const response = await getProject(selectedOrganisation?.value || '', params?.projectId || '');

    if (response?.status === 200) {
      setProjectName(response?.data?.name);
      setCurrentStep(response?.data?.current_step);

      //Navigate to lastest or active Step
      const url = `/projects/${params?.projectId}/migration/steps/${response?.data?.current_step}`;
      navigate(url, { replace: true });
    }
  };

  const backNavigation = () => {
    
    const goback = () => {
      dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION))
      navigate(-1);
    }
   

    if (legacyCMSRef.current) {
      const currentIndex = legacyCMSRef.current.getInternalActiveStepIndex() + 1 ; 
      
      if(-1 < currentIndex && currentIndex < 4 && ( !isEmptyString(newMigrationData?.legacy_cms?.selectedCms?.cms_id) || !isEmptyString(newMigrationData?.legacy_cms?.affix) )&& currentStep === 1
        ){
        return cbModal({
          component: (props: ModalObj) => (
            <NotificationModal
            goBack={goback}
            {...props}
            isopen={false}
            />
          ),
          modalProps: {
            size: 'xsmall',
            shouldCloseOnOverlayClick: false
          }
        });
      }
    }

    dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION))
    navigate(-1);
  }

  return (
    <div className='d-flex align-items-center justify-content-between migration-flow-header'>
      <div className='d-flex align-items-center'>
        {/* <Button 
          aria-label='Go back'
          buttonType="secondary"
          icon="v2-LeftArrow"
          iconAlignment="left"
          size="large"
          version="v2"
          className="back-btn"
          onlyIconHoverColor="secondary"
          onClick={backNavigation}
        /> */}
        { projectName && <h1>{projectName}</h1> }
      </div>

      <Button
        buttonType='primary'
        className="ml-10"
        onClick={handleOnClick}
        version="v2"
        aria-label='Save and Continue'
        isLoading={isLoading}
      >
        {params?.stepId === '3' || params?.stepId === '4' ? 'Continue' : params?.stepId === '5' ? 'Start' : 'Save and Continue'}
      </Button>
    </div>
  )
}

export default MigrationFlowHeader;