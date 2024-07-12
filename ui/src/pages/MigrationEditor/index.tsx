// Libraries
import { useContext, useEffect, useState } from 'react';
import { PageHeader, PageLayout } from '@contentstack/venus-components';
import { Params, useNavigate, useParams } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';

// Context
import { AppContext } from '../../context/app/app.context';
import { DEFAULT_NEW_MIGRATION } from '../../context/app/app.interface';

// Service
import { getProject } from '../../services/api/project.service';

//Component
import NewMigrationWrapper from '../../components/Migrations/NewMigration/NewMigrationWrapper';

// Style
import './index.scss';
import {  updateNewMigrationData } from '../../store/slice/migrationDataSlice';

/**
 * Represents the Migration Editor page.
 */
const MigrationEditor = () => {
  const navigate = useNavigate();
  const params: Params<string> = useParams();
  const dispatch = useDispatch();


  const selectedOrganisation = useSelector((state:any)=>state?.authentication?.selectedOrganisation);


  const [projectName, setProjectName] = useState('');

  const header = {
    backNavigation: () => {
     
      dispatch(updateNewMigrationData(DEFAULT_NEW_MIGRATION))
      navigate(-1);
    },
    component: <PageHeader title={{ label: projectName }} />
  };

  const bodyContent = {
    component: <NewMigrationWrapper />
  };
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

  // useEffect(() => {
  //   fetchProject();
  // }, []);

  useEffect(() => {
    fetchProject();
  }, [selectedOrganisation?.value, params?.projectId]);

  return (
    <div className="layout-container migration-container">
      <PageLayout header={header} content={bodyContent} type="edit" mode={'fullscreen'} />
    </div>
  );
};

export default MigrationEditor;
