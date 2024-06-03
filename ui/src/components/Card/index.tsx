// Libraries
import { useContext, useEffect, useState } from 'react';
import { Tooltip, Icon } from '@contentstack/venus-components';
import { useNavigate } from 'react-router-dom';
// Utilities
import { NEW_PROJECT_STATUS } from '../../utilities/constants';
import { getDays, isEmptyString } from '../../utilities/functions';
import { AppContext } from '../../context/app/app.context';
// Interface
import { ProjectType } from './card.interface';
import { getProject } from '../../services/api/project.service';
import './card.scss';

const CardList = ({ project }: ProjectType) => {
  const navigate = useNavigate();
  const { selectedOrganisation } = useContext(AppContext);
  const [projectDetails, setprojectDetails] = useState('');

  const onClickProject = (id: string) => {
    if (isEmptyString(id)) return;
    navigate(`/projects/${id}/migration/steps/1`);
  };
  const iconMapping: { [key: string]: string } = {
    '0': 'Information',
    '1': 'WarningBold',
    '2': 'WarningBold',
    '3': 'WarningBold',
    '4': 'WarningBold',
    '5': 'CheckCircle',
    '6': 'CloseBorder',
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

  useEffect(() => {
    const fetchProject = async () => {
      if (selectedOrganisation?.value && project?.id) {
        const { data, status } = await getProject(selectedOrganisation?.value, project?.id);
        if (status === 200 && data?.legacy_cms) {
          setprojectDetails(data?.legacy_cms.cms);
        }
      }
    };
    fetchProject();
  }, [selectedOrganisation?.value, project?.id]);

  
  return (
    <div style={{ padding: '0 20px 20px 0' }}>
      <div onClick={() => onClickProject(project?.id || '')}>
        <div className="ProjectCard">
          <div className='ProjectCardWrapper'>
            <div className="ProjectCard__heading">
              {project?.name && <h4 className="ProjectCard__title flex-v-center">{project?.name}</h4>}
            </div>
            <div className="ProjectCard__content">
              <div className="ProjectCard__stats">
                <div className='ProjectCard__Staus-unit'>
                  <span className="ProjectCard__stats-Title">Source</span>
                  <div className="ProjectCard__cms">{projectDetails ? projectDetails : '-'}</div>
                </div>
                <div className="ProjectCard__unit">
                  <span className="ProjectCard__stats-Title">Project Status</span>
                  <div className={`ProjectCard__stats-category ${statusClass}`}>
                    {icon && <Icon size="small" icon={icon} version="v2" />}
                    {statusText}
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
                      {getDays(project?.updated_at)}
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
