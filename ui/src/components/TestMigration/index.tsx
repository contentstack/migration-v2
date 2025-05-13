// Libraries
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import {
  Field,
  FieldLabel,
  TextInput,
  Link,
  Icon,
  Tooltip,
  Button,
  Notification,
  CircularLoader
} from '@contentstack/venus-components';
import { useSelector, useDispatch } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import {
  getOrgDetails,
  createTestStack,
  createTestMigration
} from '../../services/api/migration.service';
import { getAllStacksInOrg } from '../../services/api/stacks.service';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { getStateFromLocalStorage, saveStateToLocalStorage } from '../../utilities/functions';

// Interface
import { MigrationType } from './testMigration.interface';
import { INewMigration } from '../../context/app/app.interface';

// Component
import TestMigrationLogViewer from '../LogScreen';

// CSS
import './index.scss';

interface ErrorObject {
  error_message?: string;
  errors?: Errors;
}

interface Errors {
  org_uid?: string[];
}

const TestMigration = () => {
  // Access Redux state for migration data and selected organization
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );

  const [data, setData] = useState<MigrationType>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isStackLoading, setIsStackLoading] = useState<boolean>(false);
  const [disableTestMigration, setDisableTestMigration] = useState<boolean>(
    newMigrationData?.test_migration?.isMigrationStarted
  );

  const [disableCreateStack, setDisableCreateStack] = useState<boolean>(false);
  const [stackLimitReached, setStackLimitReached] = useState<boolean>(false);
  const [isProjectMapped, setisProjectMapped] = useState<boolean>(newMigrationData?.isprojectMapped);

  // Extract project ID from URL parameters
  const { projectId = '' } = useParams();
  const dispatch = useDispatch();

  // Destructure CMS data for button labels and subtitles
  const {
    create_stack_cta: createStackCta,
    subtitle,
    start_migration_cta: startMigrationCta
  } = data;

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

  /**
   * to disable Create Test Stack and Start Test Migration buttons as per isMigrated state
   */
  useEffect(() => {
    // Check if the stack_api_key exists and evaluate the logic
    const shouldDisable =
      newMigrationData?.test_migration?.stack_api_key &&
      !newMigrationData?.migration_execution?.migrationCompleted
        ? !newMigrationData?.testStacks?.some(
            (stack) =>
              stack?.stackUid === newMigrationData?.test_migration?.stack_api_key &&
              stack?.isMigrated
          ) || newMigrationData?.test_migration?.isMigrationStarted
        : newMigrationData?.migration_execution?.migrationCompleted ||
          newMigrationData?.migration_execution?.migrationStarted ||
          false;

    setDisableCreateStack(shouldDisable);

    if (
      newMigrationData?.testStacks?.find(
        (stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key
      )?.isMigrated === true
    ) {
      setDisableTestMigration(true);
    }
    setisProjectMapped(newMigrationData?.isprojectMapped)
  }, [newMigrationData]);

  useEffect(() => {
    // Retrieve and apply saved state from sessionStorage
    const savedState = getStateFromLocalStorage(`testmigration_${projectId}`);
    if (savedState && newMigrationData?.testStacks?.find(
      (stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key
    )?.isMigrated !== true) {
      setDisableTestMigration(savedState?.isTestMigrationStarted);
      setDisableCreateStack(savedState?.isTestMigrationStarted);
    }
  }, []);

  /**
   * Handles create test stack function
   */
  const handleCreateTestStack = async () => {
    setIsStackLoading(true);

    //get org plan details
    try {
      // Fetch organization details to determine stack limit
      const orgDetails = await getOrgDetails(selectedOrganisation?.value);
      const stacks_details_key =
        Object.keys(orgDetails?.data?.organization?.plan?.features)?.find(
          (key) => orgDetails?.data?.organization?.plan?.features[key].uid === 'stacks'
        ) ?? '';

      const max_stack_limit =
        orgDetails?.data?.organization?.plan?.features[stacks_details_key]?.max_limit;

      // Check the current stack count
      const stackData = await getAllStacksInOrg(selectedOrganisation?.value, ''); // org id will always be there

      const stack_count = stackData?.data?.stacks?.length;

      // Handle stack limit reached
      if (stack_count >= max_stack_limit) {
        setIsLoading(false);
        setDisableCreateStack(true);
        setIsStackLoading(false);
        setStackLimitReached(true);
        Notification({
          notificationContent: {
            text: 'You have reached the maximum limit of stacks for your organization'
          },
          type: 'warning'
        });
        return;
      }
    } catch (error) {
      console.error(error);
    }

    // Prepare data for stack creation
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

      if (res?.status === 201) {
        setIsStackLoading(false);
        setDisableCreateStack(true);
        setDisableTestMigration(false);
        Notification({
          notificationContent: { text: res?.data?.data?.data?.notice ?? 'Test Stack created successfully' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'success'
        });

        // Update migration data in Redux
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          test_migration: {
            ...newMigrationData?.test_migration,
            stack_link: res?.data?.data?.url,
            stack_api_key: res?.data?.data?.data?.stack?.api_key,
            stack_name: res?.data?.data?.data?.stack?.name
          },
          testStacks: [
            ...newMigrationData.testStacks,
            {
              stackUid: res?.data?.data?.data?.stack?.api_key,
              stackName: res?.data?.data?.data?.stack?.name,
              isMigrated: false
            }
          ]
        };
        dispatch(updateNewMigrationData(newMigrationDataObj));
      } else {
        const errorMessage = formatErrorMessage(res?.data?.data);
        setIsStackLoading(false);
        Notification({
          notificationContent: { text: errorMessage },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'error'
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  /**
   * Function to format the error message
   */
  const formatErrorMessage = (errorData: ErrorObject) => {
    let message = errorData.error_message;

    if (errorData.errors) {
      Object.entries(errorData.errors).forEach(([key, value]) => {
        message += `\n${key}: ${(value as string[]).join(", ")}`;
      });
    }

    return message;
  }

  /**
   * Start the test migration
   */
  const handleTestMigration = async () => {
    try {
      const testRes = await createTestMigration(
        newMigrationData?.destination_stack?.selectedOrg?.value,
        projectId
      );

      if (testRes?.status === 200) {
        setDisableTestMigration(true);

        //dispatch test migration started flag in redux
        const newMigrationDataObj: INewMigration = {
          ...newMigrationData,
          test_migration: {
            ...newMigrationData?.test_migration,
            isMigrationStarted: true,
            isMigrationComplete: false
          }
        };
        dispatch(updateNewMigrationData(newMigrationDataObj));

        //update test migration started flag in localstorage
        saveStateToLocalStorage(`testmigration_${projectId}`, {
          isTestMigrationCompleted: false,
          isTestMigrationStarted: true
        });

        handleMigrationState(true);

        Notification({
          notificationContent: { text: 'Test Migration started' },
          notificationProps: {
            position: 'bottom-center',
            hideProgressBar: true
          },
          type: 'message'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Function to update the parent state
  const handleMigrationState = (newState: boolean) => {
    setDisableCreateStack(newState);
    if (
      newMigrationData?.testStacks?.find(
        (stack) => stack?.stackUid === newMigrationData?.test_migration?.stack_api_key
      )?.isMigrated === true
    ) {
      setDisableTestMigration(!newState);
    }
  };

  return (isLoading || isProjectMapped) ? (
    <div className="loader-container">
      <CircularLoader />
    </div>
  ) : (
    <div className="migration-step-container">
      <div className="content-block">
        <div className="content-body">
          {subtitle && <p>{subtitle}</p>}
          <Tooltip
            content={stackLimitReached ? 'Please contact support team' : null}
            position="top"
            disabled={!stackLimitReached}
          >
            <Button
              className="mt-3"
              onClick={handleCreateTestStack}
              version="v2"
              disabled={disableCreateStack}
              isLoading={isStackLoading}
            >
              {createStackCta?.title}
            </Button>
          </Tooltip>

          {newMigrationData?.test_migration?.stack_api_key && (
            <Field id="stack" name="stack" className="pt-4">
              <FieldLabel htmlFor="stackKey" version="v2" requiredText="(read only)">
                Test Stack
              </FieldLabel>
              <div className="d-flex align-items-center">
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
                  <Link
                    href={`${newMigrationData?.test_migration?.stack_link}`}
                    target="_blank"
                    className="ml-8"
                  >
                    <Tooltip content="Stack Link" position="bottom">
                      <Icon icon="Link" size="small" version="v2" />
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
          )}
        </div>
      </div>
      <div className="content-block">
        <div className="content-header">Execution Logs</div>
        <div>
          <TestMigrationLogViewer
            serverPath={process.env.REACT_APP_BASE_API_URL ?? ''}
            sendDataToParent={handleMigrationState}
            projectId={projectId}
          />
        </div>
      </div>
    </div>
  );
};

export default TestMigration;
