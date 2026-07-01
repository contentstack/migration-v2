// Libraries
import { useEffect, useState } from 'react';
import { Button, Dropdown, Icon, PageHeader, Search } from '@contentstack/venus-components';

// Interface
import { ProjectsHeaderType } from './projectsHeader.interface';
import { ProjectsObj } from '../../pages/Projects/projects.interface';

const ProjectsHeader = ({
  headingText,
  searchText,
  setSearchText,
  searchPlaceholder,
  cta,
  allProject,
  handleModal,
  handleImportModal
}: ProjectsHeaderType) => {
  const [disableCreateProject, setDisableCreateProject] = useState<boolean>(false);

  useEffect(() => {
    allProject?.forEach((project: ProjectsObj) => {
      setDisableCreateProject(project?.isMigrationStarted && !project?.isMigrationCompleted);
    });
  }, [allProject]);

  let interval: ReturnType<typeof setTimeout>;
  function setFocus() {
    clearTimeout(interval);
    interval = setTimeout(() => {
      document.getElementById('search-project-input')?.focus();
    }, 10);
  }

  const SearchProject = (
    <div className="project-search-wrapper">
      <Search
        placeholder={searchPlaceholder}
        type="secondary"
        onChange={(search: string) => {
          search.trim()?.length > 0 ? setSearchText(search?.trim()) : setSearchText(search);
        }}
        width="large"
        onClear={true}
        onClick={setFocus}
        value={searchText}
        debounceSearch={true}
        id="search-project-input"
        version="v2"
      />
    </div>
  );

  const pageActions: any = [
    {
      label: cta?.title && (
        <div className="new-project-dropdown">
        <Dropdown
          type="click"
          dropDownPosition="bottom"
          list={[
            {
              label: 'Create New',
              action: () => handleModal?.()
            },
            {
              label: 'Import Existing',
              action: () => handleImportModal?.()
            }
          ]}
        >
          <Button
            buttonType={cta?.theme}
            className="ml-10 create-project-cta"
            version="v2"
            size="medium"
            aria-label={cta?.title}
            disabled={disableCreateProject}
          >
            {cta?.with_icon && (
              <Icon icon="Plus" version="v2" size="tiny" fill="white" stroke="white" />
            )}
            {cta?.title}
          </Button>
        </Dropdown>
        </div>
      ),
      type: 'primary'
    }
  ];

  return (
    <PageHeader
      title={{ label: headingText, component: SearchProject }}
      actions={allProject && allProject?.length > 0 && pageActions}
    />
  );
};

export default ProjectsHeader;
