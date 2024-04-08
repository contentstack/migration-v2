//venus components
import {
  Icon,
  ListRow,
  Button,
  FieldLabel,
  TextInput,
  PageHeader,
  Textarea,
  InfiniteScrollTable,
  PageLayout,
  Notification,
  cbModal,
  ModalBody,
  ModalHeader,
  ModalFooter,
  ButtonGroup
} from '@contentstack/venus-components';

//stylesheet
import './Settings.scss';

//modules
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Params, useParams } from 'react-router';

import { FieldMapType } from '../../ContentMapper/contentMapper.interface';

import { ItemStatusMapProp } from '@contentstack/venus-components/build/components/Table/types';

// Context
import { AppContext } from '../../../context/app/app.context';

import { Setting } from './setting.interface';

// Service
import { getProject, updateProject } from '../../../services/api/project.service';
import { CS_ENTRIES } from '../../../utilities/constants';
import { getCMSDataFromFile } from '../../../cmsData/cmsSelector';

const Settings = () => {
  const params: Params<string> = useParams();
  const [viewBy, updateViewBy] = useState('Comfort');
  const [itemStatusMap, updateItemStatusMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<FieldMapType[]>([]);
  const [CmsData, setData] = useState<Setting>();
  const [Active, setActive] = useState<string>();
  const [currentHeader, setCurrentHeader] = useState<string>();
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const { selectedOrganisation, user } = useContext(AppContext);

  useEffect(() => {
    const fetchData = async () => {
      //check if offline CMS data field is set to true, if then read data from cms data file.
      getCMSDataFromFile(CS_ENTRIES.SETTING)
        .then((data) => {
          setData(data), setActive(data?.project?.title), setCurrentHeader(data?.project?.title);
        })
        .catch((err) => {
          console.error(err);
        });
    };
    const fetchProject = async () => {
      const { data, status } = await getProject(
        selectedOrganisation?.value || '',
        params?.projectId || ''
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

  const closeModal = () => {
    () => {
      return;
    };
  };

  const handleUpdateProject = async () => {
    const projectData = {
      name: projectName,
      description: projectDescription
    };
    const { status } = await updateProject(
      selectedOrganisation?.value || '',
      params?.projectId || '',
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
  const ModalComponent = () => {
    return (
      <>
        <ModalHeader
          title="Delete Project"
          closeIconTestId="cs-default-header-close"
          closeModal={closeModal}
        />

        <ModalBody className="modalBodyCustomClass">
          <h3>You are about to delete the project, {projectName}</h3> <br />
          <p>
            All the content stored within the project will be deleted permanently. This action
            cannot be undone.
          </p>
        </ModalBody>

        <ModalFooter>
          <ButtonGroup>
            <Button buttonType="light" onClick={closeModal}>
              Cancel
            </Button>
            <Button className="Button Button--destructive Button--icon-alignment-left Button--size-large Button--v2">
              <div className="flex-center">
                <div className="flex-v-center Button__mt-regular Button__visible">
                  <Icon icon="Delete" version="v2" size="tiny" />
                </div>
              </div>
              Delete
            </Button>
          </ButtonGroup>
        </ModalFooter>
      </>
    );
  };

  const handleClick = () => {
    cbModal({
      component: () => <ModalComponent />,
      modalProps: {
        shouldCloseOnEscape: true,
        size: 'small',
        shouldCloseOnOverlayClick: true,
        onClose: () => {
          return;
        },
        onOpen: () => {
          return;
        }
      }
    });
  };
  const pageActions = [
    {
      label: (
        <div className="actions flex-v-center deleteButton">
          <div className="mr-16">
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
                    data={CmsData?.project?.delete_project?.title}
                  ></Icon>
                </div>
              </div>
            </Button>
          </div>
        </div>
      )
    }
  ];

  const columns = useMemo(
    () => [
      {
        Header: 'Title',
        id: 'title',
        // default: true,
        addToColumnSelector: true
      },
      {
        Header: 'Unique UID',
        accessor: 'uuid',
        default: false,
        addToColumnSelector: true,
        cssClass: 'uidCustomClass'
      },
      {
        Header: 'Status-1',
        accessor: 'status',
        default: false,
        disableSortBy: true,
        addToColumnSelector: true
      },
      {
        Header: 'Status-2',
        accessor: 'status2',
        default: false,
        disableSortBy: true,
        addToColumnSelector: true
      }
    ],
    []
  );
  const fetchData = () => {
    try {
      const itemStatusMap: ItemStatusMapProp = {};

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loading';
      }

      updateItemStatusMap(itemStatusMap);
      setLoading(true);

      for (let index = 0; index <= 30; index++) {
        itemStatusMap[index] = 'loaded';
      }

      updateItemStatusMap({ ...itemStatusMap });
      setLoading(false);
      // setTableData(tableRes)
      // setTotalCounts(tableRes.length)
    } catch (error) {
      console.log('fetchData -> error', error);
    }
  };

  const content = {
    component: (
      <div>
        {Active === CmsData?.project?.title && (
          <div className="stack-settings__section-wrapper">
            <div data-test-id="cs-stack-setting-general" className="stack-settings__heading">
              {CmsData?.project?.general}
            </div>
            <div className="stack-settings__section">
              <form>
                <div className="stack-settings__section__fields">
                  <div className="Field Field--full" data-test-id="cs-field">
                    <FieldLabel className="FieldLabel" htmlFor="projectName">
                      {CmsData?.project?.name}
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
                      {CmsData?.project?.description}
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

                <div className="stack-settings__section__fields">
                  <div className="Field Field--full" data-test-id="cs-field"></div>
                  <FieldLabel className="FieldLabel" htmlFor="projectDescription">
                    {CmsData?.project?.email}
                  </FieldLabel>
                  <div className="flex-v-center">
                    <div className="TextInput TextInput--large TextInput--disabled TextInput__read-only TextInput__read-only-disabled">
                      <TextInput
                        aria-label="email"
                        version="v2"
                        value={user?.email}
                        disabled={true}
                      ></TextInput>
                      <span className="TextInput__read-only__wrapper">
                        <div className="tippy-wrapper">
                          <Icon icon="Lock" size="small" version="v2" />
                        </div>
                      </span>
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
                    {CmsData?.project?.save_project?.title}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {Active === CmsData?.execution_logs?.title && (
          <div>
            {/* <InfiniteScrollTable
              loading={loading}
              data={tableData}
              columns={columns}
              uniqueKey={'uid'}
              canRefresh
              itemStatusMap={itemStatusMap}
              fetchTableData={fetchData}
              tableHeight={472}
              equalWidthColumns={true}
            /> */}
          </div>
        )}
      </div>
    )
  };

  const leftSidebar = {
    component: (
      <div style={{ textAlign: 'left' }}>
        <div
          data-testid="cs-section-header"
          className="SectionHeader SectionHeader--extra-bold SectionHeader--medium SectionHeader--black SectionHeader--v2"
          role="heading"
          aria-level={1}
        >
          {CmsData?.title}
        </div>

        <ListRow
          rightArrow={true}
          active={Active === CmsData?.project?.title}
          content={CmsData?.project?.title}
          leftIcon={<Icon icon="Stacks" version="v2" />}
          onClick={() => {
            setActive(CmsData?.project?.title);
            setCurrentHeader(CmsData?.project?.title);
          }}
          version="v2"
        />
        <div>
          <ListRow
            rightArrow={true}
            active={Active === CmsData?.execution_logs?.title}
            content={CmsData?.execution_logs?.title}
            leftIcon={<Icon icon="Stacks" version="v2" />}
            onClick={() => {
              setActive(CmsData?.execution_logs?.title);
              setCurrentHeader(CmsData?.execution_logs?.title);
            }}
            version="v2"
          />
        </div>
      </div>
    )
  };

  const header = {
    component: (
      <div>
        {Active === CmsData?.project?.title ? (
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
