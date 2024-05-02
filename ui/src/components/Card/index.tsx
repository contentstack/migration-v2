// Libraries
import { useContext, useEffect, useState } from 'react';
import { Tooltip } from '@contentstack/venus-components';
import { useNavigate } from 'react-router-dom';
// Utilities
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
          <div className="ProjectCard__heading">
            {project?.name && <h4 className="ProjectCard__title flex-v-center">{project?.name}</h4>}
          </div>
          <div className="ProjectCard__content">
            <div className="ProjectCard__stats">
              <div className="ProjectCard__unit">
                <span className="ProjectCard__stats-number">Project Status</span>
                <span className="ProjectCard__stats-category">{project?.status}</span>
              </div>
              <div className="ProjectCard__unit">
                <span className="ProjectCard__stats-number">Current Status</span>
                <span className="ProjectCard__stats-category validation-color">
                  Validation Failed
                </span>
              </div>
            </div>
          </div>
          <div className="ProjectCard__footer">
            <div className="ProjectCard__cms">{projectDetails}</div>
            <div className="tippy-wrapper" data-test-id="cs-tooltip">
              <div className="ProjectCard__modified flex-v-center">
                <Tooltip content="Last Modified" position="top" type="primary" variantType="basic">
                  <div className="flex-v-center">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="ProjectCard__modified-  icon Icon--original"
                      name="ModifiedBy"
                      data-test-id="cs-icon"
                    >
                      <path d="M5 1a4 4 0 104 4M5 2v3h2" stroke="#A9B6CB"></path>
                    </svg>
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
