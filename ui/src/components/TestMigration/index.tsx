import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Interface
import { MigrationType } from './testMigration.interface';

//stylesheet
import './index.scss';
import { AppContext } from '../../context/app/app.context';

const TestMigration = () => {
  const [data, setData] = useState<MigrationType>({});
  const { newMigrationData } = useContext(AppContext);

  /** ALL HOOKS Here */
  const { projectId = '' } = useParams();
  const navigate = useNavigate();

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.TEST_MIGRATION)
      .then((data) => setData(data))
      .catch((err) => {
        console.error(err);
        setData({});
      });
  }, []);

  const { subtitle, cta } = data;

  return (
    <div>
      <div id="test-migration" className="action-component-body">
        <div className="selectedOptions d-flex">
          <span className="stack-link">{subtitle}:</span>
          <span className="ml-6">
            <a
              href={`${newMigrationData?.test_migration?.stack_link}`}
              rel="noreferrer"
              target="_blank"
            >
              {newMigrationData?.test_migration?.stack_link}
            </a>
          </span>
        </div>
      </div>
      <div className="test"></div>
      <div className="cta-wrapper-test-migration">
        {cta && cta?.title && (
          <Link to={cta?.url as string} className="btn primary-btn">
            <Button version="v2" aria-label={cta?.title} tabindex={1}>
              {cta?.title}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default TestMigration;
