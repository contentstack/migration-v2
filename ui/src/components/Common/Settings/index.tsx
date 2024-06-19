// Libraries
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Params, useNavigate, useParams } from 'react-router';
import {
  Icon,
  ListRow,
  Button,
  FieldLabel,
  TextInput,
  PageHeader,
  Textarea,
  PageLayout,
  Notification,
  cbModal
} from '@contentstack/venus-components';

// Interfaces
import { Setting } from './setting.interface';
import { ModalObj } from '../../../components/Modal/modal.interface';

// Context
import { AppContext } from '../../../context/app/app.context';

// Service
import { getProject, updateProject } from '../../../services/api/project.service';
import { CS_ENTRIES } from '../../../utilities/constants';
import { getCMSDataFromFile } from '../../../cmsData/cmsSelector';

// Component
import DeleteProjectModal from '../DeleteProjectModal';

//stylesheet
import './Settings.scss';
import { RootState } from '../../../store';

const Settings = () => {
  const params: Params<string> = useParams();
  
  const [cmsData, setCmsData] = useState<Setting>();
  const [active, setActive] = useState<string>();
  const [currentHeader, setCurrentHeader] = useState<string>();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  const user = useSelector((state:RootState)=>state?.authentication?.user);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      //check if offline CMS data field is set to true, if then read data from cms data file.
      getCMSDataFromFile(CS_ENTRIES.SETTING)
        .then((data) => {
          setCmsData(data);
          setActive(data?.project?.title);
          setCurrentHeader(data?.project?.title);
        })
        .catch((err) => {
          console.error(err);
        });
    };
    const fetchProject = async () => {
      const { data, status } = await getProject(
        selectedOrganisation?.value || '',
        params?.projectId ?? ''
      );

      if (status === 200) {
        setProjectName(data?.name);
        setProjectDescription(data?.description);
      }
    };

    fetchData();
    fetchProject();
  }, []);

  const handleProjectNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(event.target.value);
  };

  const handleProjectDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProjectDescription(event.target.value);
  };

  const handleUpdateProject = async () => {
    const projectData = {
      name: projectName,
      description: projectDescription
    };
    const { status } = await updateProject(
      selectedOrganisation?.value || '',
      params?.projectId ?? '',
      projectData
    );

    if (status === 200) {
      Notification({
        notificationContent: { text: 'Project Updated Successfully' },
        notificationProps: {
          hideProgressBar: true,
          position: 'bottom-center'
        },
        type: 'success'
      });
    } else {
      Notification({
        notificationContent: { text: 'Failed to Update Project' },
        notificationProps: {
          hideProgressBar: true,
          position: 'bottom-center'
        },
        type: 'error'
      });
    }
  };

  const handleClick = () => {
    cbModal({
      component: (props: ModalObj) => (
        <DeleteProjectModal
          selectedOrg={selectedOrganisation}
          projectId={params?.projectId ?? ''}
          projectName={projectName}
          navigate={navigate}
          {...props}
        />
      ),
      modalProps: {
        shouldCloseOnEscape: true,
        size: 'small',
        shouldCloseOnOverlayClick: true,
        onClose: () => {
          return;
        },
      }
    });
  };

  const pageActions = [
    {
      label: (
        <Button
          class="Button Button--secondary Button--size-large Button--icon-alignment-left Button--v2"
          aria-label="Delete Project for deleting project"
          type="button"
          onClick={handleClick}
        >
          <div className="flex-center">
            <div className="flex-v-center Button__mt-regular Button__visible">
              <Icon
                icon="Delete"
                version="v2"
                data={cmsData?.project?.delete_project?.title}
              ></Icon>
            </div>
          </div>
        </Button>
      )
    }
  ];

  const content = {
    component: (
      <div>
        {active === cmsData?.project?.title && (
          <div className="content-block">
            <div data-test-id="cs-stack-setting-general" className="stack-settings__heading">
              {cmsData?.project?.general}
            </div>
            <div className="stack-settings__section">
              <form>
                <div className="stack-settings__section__fields">
                  <div className="Field Field--full" data-test-id="cs-field">
                    <FieldLabel className="FieldLabel" htmlFor="projectName">
                      {cmsData?.project?.name}
                    </FieldLabel>
                    <div className="TextInput TextInput--large">
                      <TextInput
                        aria-label="projectname"
                        version="v2"
                        value={projectName}
                        onChange={handleProjectNameChange}
                      ></TextInput>
                    </div>
                  </div>
                </div>

                <div className="stack-settings__section__fields">
                  <div className="Field Field--full" data-test-id="cs-field">
                    <FieldLabel className="FieldLabel" htmlFor="projectDescription">
                      {cmsData?.project?.description}
                    </FieldLabel>
                    <div className="TextInput TextInput--large">
                      <Textarea
                        version="v2"
                        aria-label="description"
                        value={projectDescription}
                        onChange={handleProjectDescriptionChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="SaveButton">
                  <Button
                    buttonType="primary"
                    aria-label="save for saving update"
                    version="v2"
                    icon={'v2-Save'}
                    autoClose={5000}
                    label={'Success'}
                    onClick={handleUpdateProject}
                  >
                    {cmsData?.project?.save_project?.title}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {active === cmsData?.execution_logs?.title && (
          <div>
            
          </div>
        )}
      </div>
    )
  };

  const leftSidebar = {
    component: (
      <div>
        <div
          data-testid="cs-section-header"
          className="SectionHeader SectionHeader--extra-bold SectionHeader--medium SectionHeader--black SectionHeader--v2"
          aria-label={cmsData?.title}
          aria-level={1}
        >
          {cmsData?.title}
        </div>

        <ListRow
          rightArrow={true}
          active={active === cmsData?.project?.title}
          content={cmsData?.project?.title}
          leftIcon={<Icon icon="Stacks" version="v2" />}
          onClick={() => {
            setActive(cmsData?.project?.title);
            setCurrentHeader(cmsData?.project?.title);
          }}
          version="v2"
        />
        <ListRow
          rightArrow={true}
          active={active === cmsData?.execution_logs?.title}
          content={cmsData?.execution_logs?.title}
          leftIcon={<Icon icon="Stacks" version="v2" />}
          onClick={() => {
            setActive(cmsData?.execution_logs?.title);
            setCurrentHeader(cmsData?.execution_logs?.title);
          }}
          version="v2"
        />
      </div>
    )
  };

  const header = {
    component: (
      <div>
        {active === cmsData?.project?.title ? (
          <PageHeader
            testId="header"
            className="action-component-title"
            title={{ label: currentHeader }}
            actions={pageActions}
          />
        ) : (
          <PageHeader
            testId="header"
            className="action-component-title"
            title={{ label: currentHeader }}
          />
        )}
      </div>
    )
  };

  return (
    <div id="setting-page" className="layout-container specific-context content-body">
      <PageLayout
        testId="SettingId"
        leftSidebar={leftSidebar}
        content={content}
        type="list"
        header={header}
        hasBackground={false}
        version="v2"
      />
    </div>
  );
};

export default Settings;
