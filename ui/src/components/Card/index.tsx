// Libraries
import { Tooltip, Icon } from '@contentstack/venus-components';
import { useNavigate } from 'react-router-dom';
// Utilities
import { NEW_PROJECT_STATUS } from '../../utilities/constants';
import { getDays, isEmptyString } from '../../utilities/functions';
// Interface
import { ProjectType } from './card.interface';
import './card.scss';

/**
 * Renders a card component for a project in a list.
 * @param project - The project object containing project details.
 */
const CardList = ({ project }: ProjectType) => {
  const navigate = useNavigate();

  /**
   * Handles the click event when a project card is clicked.
   * Navigates to the project migration steps page.
   * @param id - The ID of the project.
   */
  const onClickProject = (id: string) => {
    if (isEmptyString(id)) return;
    navigate(`/projects/${id}/migration/steps/${project?.current_step}`);
  };

  const iconMapping: { [key: string]: string } = {
    '0': 'Information',
    '1': 'Warning',
    '2': 'Warning',
    '3': 'Warning',
    '4': 'Warning',
    '5': 'CheckCircleDark',
    '6': 'Close',
  };

  const statusClassMapping: { [key: string]: string } = {
    '0': 'draft',
    '1': 'pending',
    '2': 'pending',
    '3': 'pending',
    '4': 'pending',
    '5': 'completed',
    '6': 'failed',
  };

  const status = project?.status ?? '0';
  const statusClass = statusClassMapping[status] || '';
  const icon = iconMapping[status] || '';
  const statusText = NEW_PROJECT_STATUS[status];

  // useEffect(() => {
  //   const fetchProject = async () => {
  //     if (selectedOrganisation?.value && project?.id) {
  //       const { data, status } = await getProject(selectedOrganisation?.value, project?.id);
  //       if (status === 200 && data?.legacy_cms) {
  //         setprojectDetails(data?.legacy_cms.cms);
  //       }
  //     }
  //   };
  //   fetchProject();
  // }, [selectedOrganisation?.value, project?.id]);

  return (
    <div style={{ margin: '0 19px 20px 0' }}>
      <div onClick={() => onClickProject(project?.id ?? '')}>
        <div className="ProjectCard">
          <div className='ProjectCardWrapper'>
            <Tooltip content={project?.name} position="right" type="primary" variantType="basic">
              <div className="ProjectCard__heading">
                {project?.name && <h4 className="ProjectCard__title flex-v-center">{project?.name}</h4>}
              </div>
            </Tooltip>
            <div className="ProjectCard__content">
              <div className="ProjectCard__stats">
                <div className='ProjectCard__Staus-unit'>
                  <span className="ProjectCard__stats-Title">Source</span>
                  <div className="ProjectCard__cms">{project?.legacy_cms?.cms ? project?.legacy_cms?.cms : '-'}</div>
                </div>
                <div className="ProjectCard__unit">
                  <span className="ProjectCard__stats-Title">Project Status</span>
                  <div className={`ProjectCard__stats-category ${statusClass}`}>
                    {icon && <Icon size="mini" icon={icon} version="v2" />}
                    {statusText && <span className='ml-5'>{statusText}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="ProjectCard__footer">
            <div className="tippy-wrapper" data-test-id="cs-tooltip">
              <div className="ProjectCard__modified flex-v-center">
                <Tooltip content="Last Modified" position="top" type="primary" variantType="basic">
                  <div className="flex-v-center">
                    <Icon version="v2" icon="Clock" height="18" width="18" size='small' fill='none' stroke='#6E6B86' />
                    <span className="ProjectCard__modified-date">
                      {project?.updated_at && getDays(project?.updated_at)}
                    </span>
                  </div>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardList;
