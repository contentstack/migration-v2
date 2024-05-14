// Libraries
import { Button, Icon, PageHeader, Search } from '@contentstack/venus-components';

// Interface
import { ProjectsHeaderType } from './projectsHeader.interface';

const ProjectsHeader = ({
  headingText,
  searchText,
  setSearchText,
  searchPlaceholder,
  cta,
  allProject,
  handleModal
}: ProjectsHeaderType) => {
  let interval: ReturnType<typeof setTimeout>;
  function setFocus() {
    clearTimeout(interval);
    interval = setTimeout(() => {
      document.getElementById('search-project-input')?.focus();
    }, 10);
  }

  const SearchProject = (
    <>
      {allProject && allProject?.length > 0 ? (
        <div className="project-search-wrapper">
          <Search
            dynamicInput={true}
            placeholder={searchPlaceholder}
            onChange={(search: string) =>
              search.replace(/\s/g, '').length
                ? setSearchText(search?.trim())
                : setSearchText(search)
            }
            onClear={true}
            onClick={setFocus}
            value={searchText}
            debounceSearch={true}
            id="search-project-input"
          />
        </div>
      ) : (
        searchText?.length > 0 && (
          <div className="project-search-wrapper">
            <Search
              placeholder={searchPlaceholder}
              onChange={(search: string) => setSearchText(search)}
              onClear={true}
              onClick={setFocus}
              value={searchText}
              debounceSearch={true}
              id="search-project-input"
            />
          </div>
        )
      )}
    </>
  );

  const pageActions: any = [
    {
      label: cta && cta?.title && (
        <Button
          buttonType={cta?.theme}
          className="ml-10"
          onClick={handleModal}
          version="v2"
          size="small"
          aria-label={cta?.title}
        >
          {cta?.with_icon && (
            <Icon icon="Plus" version="v2" size="tiny" fill="white" stroke="white" />
          )}
          {cta?.title}
        </Button>
      ),
      type: 'primary'
    }
  ];

  return (
    <>
      <PageHeader
        title={{ label: headingText, component: SearchProject }}
        actions={allProject && allProject?.length > 0 && pageActions}
      />
    </>
  );
};

export default ProjectsHeader;
