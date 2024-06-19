import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Field, FieldLabel, TextInput, Link, Icon, Tooltip } from '@contentstack/venus-components';
import { UseDispatch,useSelector } from 'react-redux';

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

  const newMigrationData = useSelector((state:any)=>state?.migration?.newMigrationData);
  

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
    <div className='step-content-wrapper'>
      <div className='content-block'>
        <div className='content-header text-uppercase'>UID</div>
        <div className='content-body'>
          <p>Select your current Content Management system from the available options.</p>
          <Field
            id="stack"
            name="stack"
            className='pt-4'
          >
            <FieldLabel htmlFor="stackKey" version="v2" requiredText="(read only)">
              Uploaded CMS
            </FieldLabel>
            <div className='d-flex align-items-center'>
              {newMigrationData?.test_migration?.stack_api_key && (
                <TextInput
                  type="text"
                  isReadOnly
                  name="stackKey"
                  value={`${newMigrationData?.test_migration?.stack_api_key}`}
                  version="v2"
                  width="medium"
                />
              )}

              {newMigrationData?.test_migration?.stack_link && (
                <Link href={`${newMigrationData?.test_migration?.stack_link}`} target='_blank' className='ml-8'>
                  <Tooltip content='Stack Link' position="right">
                    <Icon
                      icon="Link"
                      size="small"
                      version="v2"
                    />
                  </Tooltip>
                </Link>
              )}
            </div>
          </Field>
        </div>
      </div>

      <div className='content-block'>
        <div className='content-header'>Execution Logs</div>
        <div>
          
        </div>
      </div>
      {/* <div id="test-migration" className="action-component-body">
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
      </div> */}
    </div>
  );
};

export default TestMigration;
