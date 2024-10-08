import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Field, FieldLabel, TextInput, Link, Icon, Tooltip, Button, Notification, CircularLoader } from '@contentstack/venus-components';
import { useSelector, useDispatch } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';


// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { getOrgDetails, createTestStack, createTestMigration } from '../../services/api/migration.service';
import { getAllStacksInOrg } from '../../services/api/stacks.service';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';

// Interface
import { MigrationType } from './testMigration.interface';
import { INewMigration, TestStacks } from '../../context/app/app.interface';


// Component
import LogViewer from '../LogScreen';

// CSS
import './index.scss';

const TestMigration = () => {
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector((state: RootState)=>state?.authentication?.selectedOrganisation);

  const [data, setData] = useState<MigrationType>({});
  const [isLoading, setIsLoading] = useState(newMigrationData?.isprojectMapped);
  const [isStackLoading, setIsStackLoading] = useState<boolean>(false);
  const [isMigrationStarted, setIsMigrationStarted] = useState<boolean>(false);

  
  const { projectId = '' } = useParams();
  const dispatch = useDispatch();

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.TEST_MIGRATION)
      .then((data) => { 
        setData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setData({});
      });
  }, []);

  // Method to create test stack
  const handleCreateTestStack = async () => {
    setIsStackLoading(true);

    //get org plan details
    const orgDetails = await getOrgDetails(selectedOrganisation?.value);
    const stacks_details_key = Object.keys(orgDetails?.data?.organization?.plan?.features).find(key => orgDetails?.data?.organization?.plan?.features[key].uid === 'stacks') || '';

    const max_stack_limit = orgDetails?.data?.organization?.plan?.features[stacks_details_key]?.max_limit;

    const stackData = await getAllStacksInOrg(selectedOrganisation?.value, ''); // org id will always be there
        
    const stack_count = stackData?.data?.stacks?.length;

    if (stack_count >= max_stack_limit) {
      // setIsLoading(false);
      Notification({
        notificationContent: { text: 'You have reached the maximum limit of stacks for your organization' },
        type: 'warning'
      });
      return;
    }

    const data = {
      name: newMigrationData?.destination_stack?.selectedStack?.label,
      description: 'test migration stack',
      master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale
    };

    const res = await createTestStack(
      newMigrationData?.destination_stack?.selectedOrg?.value,
      projectId,
      data
    );

    if (res?.status === 200) {
      setIsStackLoading(false);


      const newMigrationDataObj: INewMigration = {
        ...newMigrationData,
        test_migration: { stack_link: res?.data?.data?.url, stack_api_key: res?.data?.data?.data?.stack?.api_key }
      };

      dispatch(updateNewMigrationData((newMigrationDataObj)));
    }
  }

  const handleTestMigration = async () => {
    const testRes = await createTestMigration(
      newMigrationData?.destination_stack?.selectedOrg?.value,
      projectId
    );

    if (testRes?.status === 200) {
      setIsMigrationStarted(true);
    }
  }

  return (
    isLoading || newMigrationData?.isprojectMapped
      ? <div className="row">
      <div className="col-12 text-center center-align">
        <CircularLoader />
      </div>
    </div>
    : <div className='migration-step-container'>
      <div className='content-block'>
        <div className='content-header text-uppercase'>UID</div>
        <div className='content-body'>
          <p>Test Migration is a step where some content types are migrated in a test stack for review. A user can verify the stack and data. If the data is migrated properly then it can proceed with the final Migration Execution process.</p>
          <Button
            className="mt-3"
            onClick={handleCreateTestStack}
            version="v2"
            disabled={newMigrationData?.testStacks?.some((stack: TestStacks) => stack?.isMigrated === false)}
            isLoading={isStackLoading}
          >
            Create Test Stack
          </Button>
          {newMigrationData?.test_migration?.stack_api_key &&
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

                {newMigrationData?.test_migration?.stack_api_key && (
                  <Link href={`${newMigrationData?.test_migration?.stack_link}`} target='_blank' className='ml-8'>
                    <Tooltip content='Stack Link' position="bottom">
                      <Icon
                        icon="Link"
                        size="small"
                        version="v2"
                      />
                    </Tooltip>
                  </Link>
                )}

                <Button
                  className="ml-8"
                  onClick={handleTestMigration}
                  version="v2"
                  disabled={isMigrationStarted}
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
          <LogViewer serverPath={process.env.REACT_APP_BASE_API_URL ?? ''} />
        </div>
      </div>
    </div>
  );
};

export default TestMigration;
