import { useEffect, useState } from 'react';
import { Field, FieldLabel, TextInput, Link, Icon, Tooltip, Button } from '@contentstack/venus-components';
import { useSelector } from 'react-redux';

// Redux files
import { RootState } from '../../store';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Interface
import { MigrationType } from './testMigration.interface';

// Component
import LogViewer from '../LogScreen';

// CSS
import './index.scss';

const TestMigration = () => {
  const [data, setData] = useState<MigrationType>({});

  const newMigrationData = useSelector((state: RootState)=>state?.migration?.newMigrationData);
  

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

  return (
    <div className='migration-step-container'>
      <div className='content-block'>
        <div className='content-header text-uppercase'>UID</div>
        <div className='content-body'>
          <p>Test Migration is a step where some content types are migrated in a test stack for review. A user can verify the stack and data. If the data is migrated properly then it can proceed with the final Migration Execution process.</p>
          <Button
            className="mt-3"
            // onClick={handleSaveContentType}
            version="v2"
            // size="medium"
          >
          Create Test Stack
          </Button>
          {(newMigrationData?.test_migration?.stack_api_key || newMigrationData?.test_migration?.stack_link) &&
            <Field
              id="stack"
              name="stack"
              className='pt-4'
            >
              <FieldLabel htmlFor="stackKey" version="v2" requiredText="(read only)">
                Test Stack
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

                <Button
                  className="mt-3"
                  // onClick={handleSaveContentType}
                  version="v2"
                  // size="medium"
                >
                  Start Test Migration
                </Button>
              </div>
            </Field>
          }
        </div>
      </div>

      <div className='content-block'>
        <div className='content-header'>Execution Logs</div>
        <div>
          <LogViewer serverPath="http://localhost:5001" />
        </div>
      </div>
    </div>
  );
};

export default TestMigration;
