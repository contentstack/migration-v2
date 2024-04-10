import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@contentstack/venus-components';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Interface
import { MigrationType } from './testMigration.interface';

//stylesheet
import './index.scss';

const TestMigration = () => {
  const [data, setData] = useState<MigrationType>({});

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
      <div className="action-component-body">
        <div className="selectedOptions d-flex">
          <span>{subtitle}:</span>
          <span className="ml-6">
            <a href="https://app.contentstack.com/#!/stack/bltd3620ec6418ad3ad/dashboard?branch=main">
              https://app.contentstack.com/#!/stack/bltd3620ec6418ad3ad/dashboard?branch=main
            </a>
          </span>
        </div>
      </div>
      <div className="terminal-container"></div>
      <div className="cta-wrapper">
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
