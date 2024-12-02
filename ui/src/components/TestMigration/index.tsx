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
import { INewMigration } from '../../context/app/app.interface';


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
  const [disableTestMigration, setdisableTestMigration] = useState<boolean>(false);

  const [disableCreateStack, setDisableCreateStack] = useState<boolean>(false);
  
  const { projectId = '' } = useParams();
  const dispatch = useDispatch();

  const { create_stack_cta: createStackCta, subtitle, start_migration_cta: startMigrationCta } = data

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

  // to disable buttons as per isMigrated state
  useEffect(() => {
    if (newMigrationData?.testStacks.find((stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key)?.isMigrated === false) {
      setDisableCreateStack(true);
    }

    if (newMigrationData?.testStacks.find((stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key)?.isMigrated === true) {
      setdisableTestMigration(true);
    }
  }, [newMigrationData]);


  // Method to create test stack
  const handleCreateTestStack = async () => {
    setIsStackLoading(true);

    //get org plan details
    try {
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
    } catch (error) {
      console.log(error);
    }

    const data = {
      name: newMigrationData?.destination_stack?.selectedStack?.label,
      description: 'test migration stack',
      master_locale: newMigrationData?.destination_stack?.selectedStack?.master_locale
    };
    
    try {
      const res = await createTestStack(
        newMigrationData?.destination_stack?.selectedOrg?.value,
        projectId,
        data
      );

      if (res?.status === 200) {
        setIsStackLoading(false);
        setDisableCreateStack(true);
        setdisableTestMigration(false)
        Notification({
          notificationContent: { text: 'Test Stack created successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'success'
        });


        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          test_migration: { ...newMigrationData?.test_migration, stack_link: res?.data?.data?.url, stack_api_key: res?.data?.data?.data?.stack?.api_key }
        };
        dispatch(updateNewMigrationData((newMigrationDataObj)));
      }
    } catch (err) {
      console.log(err);
    }
  }

  // Method to start test migration
  const handleTestMigration = async () => {
    try {
      const testRes = await createTestMigration(
        newMigrationData?.destination_stack?.selectedOrg?.value,
        projectId
      );

      if (testRes?.status === 200) {
        handleMigrationState(true);
        Notification({
          notificationContent: { text: 'Test Migration started' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: false
          },
          type: 'message'
        });

        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          testStacks: [...newMigrationData?.testStacks ?? [], {stackUid: newMigrationData?.test_migration?.stack_api_key, isMigrated: true} ],
          test_migration: { ...newMigrationData?.test_migration, isMigrationStarted: true, isMigrationComplete: false }
        };
        dispatch(updateNewMigrationData((newMigrationDataObj)));
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Function to update the parent state
  const handleMigrationState = (newState: boolean) => {
    setDisableCreateStack(newState);
    setdisableTestMigration(!newState);
  } ;

  return (
    isLoading || newMigrationData?.isprojectMapped
      ? <div className="loader-container">
        <CircularLoader />
      </div>
      : <div className='migration-step-container'>
        <div className='content-block'>
          <div className='content-body'>
            {subtitle && <p>{subtitle}</p> }
            <Button
              className="mt-3"
              onClick={handleCreateTestStack}
              version="v2"
              disabled={disableCreateStack}
              isLoading={isStackLoading}
            >
              {createStackCta?.title}
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
                      disabled
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
                    disabled={disableTestMigration}
                  >
                    {startMigrationCta?.title}
                  </Button>
                </div>
              </Field>
            }
          </div>
        </div>
        <div className='content-block'>
          <div className='content-header'>Execution Logs</div>
          <div>
            <LogViewer serverPath={process.env.REACT_APP_BASE_API_URL ?? ''} sendDataToParent={handleMigrationState} />
          </div>
        </div>
      </div>
  );
};

export default TestMigration;
