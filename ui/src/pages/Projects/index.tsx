// Libraries
import { useEffect, useState } from 'react';
import { PageLayout, EmptyState, Button, Icon, cbModal } from '@contentstack/venus-components';
import { jsonToHtml } from '@contentstack/json-rte-serializer';
import HTMLReactParser from 'html-react-parser';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';


// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { getAllProjects } from '../../services/api/project.service';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { validateObject } from '../../utilities/functions';

// Interfaces
import { ProjectsType, ProjectsObj } from './projects.interface';
import { ModalObj } from '../../components/Modal/modal.interface';
import { CTA } from '../Home/home.interface';


// Components
import ProjectsHeader from '../../components/ProjectsHeader';
import CardList from '../../components/Card';
import Modal from '../../components/Modal';

// Assets
import { NO_PROJECTS, NO_PROJECTS_SEARCH } from '../../common/assets';

// styles
import './index.scss';
import { getUserDetails } from '../../store/slice/authSlice';
import useBlockNavigation from '../../hooks/userNavigation';
import { RootState } from '../../store';


const Projects = () => {
  const [data, setData] = useState<ProjectsType>({});
  const {
    cta,
    restore_cta,
    heading,
    search_projects: searchProjects,
    emptystate,
    create_project_modal: createProjectModal
  } = data;

  const dispatch = useDispatch();
  const selectedOrganisation = useSelector((state:RootState)=>state?.authentication?.selectedOrganisation);
  

  const outputIntro = HTMLReactParser(jsonToHtml(emptystate?.description ?? {}));

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const search = (queryParams.get('search') ?? '').trim();
  const [projects, setProjects] = useState<ProjectsObj[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectsObj[]>([]);
  const [loadStatus, setLoadStatus] = useState(true);
  const [searchText, setSearchText] = useState(search);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(()=>{
    dispatch(getUserDetails());
  },[]);

  const fetchProjects = async () => {
    if (selectedOrganisation?.value) {
      const { data, status } = await getAllProjects(selectedOrganisation?.value || ''); //org id will always present
      if (status === 200) {
        setLoadStatus(false);
        setProjects(data);
        setAllProjects(data);
      }
    }
  };

  const fetchData = async () => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.PROJECTS)
    .then((data) => setData(data))
    .catch((err) => {
      console.error(err);
      setData({});
    });
  };

  useEffect(()=>{
    dispatch(getUserDetails());
  },[dispatch]);

  useEffect(() => {
    fetchData();
  }, []);



  useEffect(() => {
    setLoadStatus(true);
    if (searchText) {
      setProjects(
        allProjects
          ? allProjects.filter((item: ProjectsObj) =>
              item.name.toLowerCase().includes(searchText.toLowerCase())
            )
          : []
      );

      setLoadStatus(false);
    } else {
      setProjects(allProjects);
      setLoadStatus(false);
    }
  }, [searchText]);

  //update search text on re-directing back to previous route
  useEffect(() => {
    setSearchText(search);
  }, [search]);

  useEffect(() => {
    fetchProjects();
  }, [selectedOrganisation?.value]);

  const onClose = () => {
    fetchProjects();
  };
  useBlockNavigation(isModalOpen || true);
  
  // Function for open modal
  const openModal = () => {
    setIsModalOpen(true);
    
    cbModal({
      component: (props: ModalObj) => (
        <Modal
          modalData={
            createProjectModal && validateObject(createProjectModal) ? createProjectModal : {}
          }
          selectedOrg={selectedOrganisation}
          isOpen={setIsModalOpen}
          {...props}
        />
      ),
      modalProps: {
        onClose
      }
    });
  };

  const header = {
    component: (
      <ProjectsHeader
        headingText={heading}
        searchText={searchText}
        searchPlaceholder={searchProjects as string}
        setSearchText={setSearchText}
        cta={cta}
        restore_cta={restore_cta}
        handleModal={openModal}
        allProject={projects}
      />
    )
  };

  const content = {
    component: (
      <div className="flex-wrap w-100" key="project-component">
        {loadStatus ? (
          <div className="flex-wrap">
            {[...Array(20)].map((e, i) => (
              <CardList key={i} />
            ))}
          </div>
        ) : (
          projects?.map((e) => (
            <div key={e?.uid}>
              <CardList project={e} />
            </div>
          ))
        )}

        {projects && projects?.length === 0 && !searchText && (
          <EmptyState
            forPage="emptyStateV2"
            heading={emptystate?.heading}
            img={NO_PROJECTS}
            description={outputIntro}
            version="v2"
          >
            {emptystate?.cta &&
              emptystate?.cta?.length > 0 &&
              emptystate?.cta?.map((cta: CTA, index: number) => (
                <Button
                  key={`${index.toString()}`}
                  buttonType={cta?.theme}
                  className="mt-10 no-project-add-btn"
                  onClick={() => openModal()}
                  size="large"
                >
                  {cta?.with_icon && (
                    <Icon icon="Plus" version="v2" size="small" fill="white" stroke="white" />
                  )}
                  {cta?.title}
                </Button>
              ))}
              <div className='helpText'>
                {HTMLReactParser(jsonToHtml(emptystate?.help_text ?? {}))}
              </div>
          </EmptyState>
        )}

        {projects && projects?.length === 0 && searchText && (
          <EmptyState
            forPage="emptyStateV2"
            heading={<div className="empty_search_heading">{emptystate?.empty_search_heading}</div>}
            img={NO_PROJECTS_SEARCH}
            description={
              <div className="empty_search_description">
                {HTMLReactParser(jsonToHtml(emptystate?.empty_search_description ?? {}))}
              </div>
            }
            version="v2"
            className="no_results_found_page"
            testId="no-results-found-page"
          />
        )}
      </div>
    )
  };
  return (
    <div className="layout-container projects-landing">
      <PageLayout content={content} header={header} type="card" />
    </div>
  );
};

export default Projects;
