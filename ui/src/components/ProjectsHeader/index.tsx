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
      <div className="project-search-wrapper" onClick={setFocus}>
        <Search
          placeholder={searchPlaceholder}
          onChange={(search: string) => setSearchText(search)}
          onClear={true}
          value={searchText}
          debounceSearch={true}
          id="search-project-input"
        />
      </div>
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
      {/* <PageHeader title={{ label: headingText, component: SearchProject }} actions={pageActions} /> */}
    </>
  );
};

export default ProjectsHeader;
