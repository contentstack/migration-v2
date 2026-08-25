import { useEffect, useState } from 'react';
import { Icon, Field, TextInput, FieldLabel, CircularLoader, Tooltip, OutlineTag, Link, Notification } from '@contentstack/venus-components';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router';

// Services
import { getCMSDataFromFile } from '../../cmsData/cmsSelector';
import { getReconciliationReport } from '../../services/api/migration.service';

// Redux
import { RootState } from '../../store';
import { updateMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_ENTRIES } from '../../utilities/constants';
import { validateArray } from '../../utilities/functions';

// Interface
import { DEFAULT_MIGRATION_EXECUTION } from '../../context/app/app.interface';

// Component
import MigrationLogViewer from '../LogScreen/MigrationLogViewer';

//stylesheet
import './index.scss';

export type migrationWxecutionProps = {
  handleStepChange: (currentStep: number) => void;
};

const MigrationExecution = ({ handleStepChange }: migrationWxecutionProps) => {
  const dispatch = useDispatch();

  const migrationData = useSelector((state: RootState) => state?.migration?.migrationData);
  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const { projectId = '' } = useParams();
  const {
    migrationexecution: { migration_information: MigrationInformation }
  } = migrationData;

  const [isLoading, setIsLoading] = useState(newMigrationData?.isprojectMapped);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  /********** ALL USEEFFECT HERE *************/
  useEffect(() => {
    //check if offline CMS data field is set to true, if then read data from cms data file.
    getCMSDataFromFile(CS_ENTRIES.MIGRATION_EXECUTION)
      .then((data) => {
        //Check for null
        if (!data) {
          //updateMigrationData({ migrationexecution: DEFAULT_MIGRATION_EXECUTION });
          dispatch(updateMigrationData({ migrationexecution: DEFAULT_MIGRATION_EXECUTION }));
          setIsLoading(false);
          return;
        }

        //updateMigrationData({ migrationexecution: data });
        dispatch(updateMigrationData({ migrationexecution: data }));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  const reconciliation = newMigrationData?.migration_execution?.reconciliation;

  /**
   * Fetches the report as a blob and triggers a real browser download — a plain
   * `<a href>` to the API route would not work, since that endpoint sits behind the
   * same app_token header auth every other API call uses, which only axios attaches.
   */
  const handleDownloadReport = async () => {
    if (isDownloadingReport) return;
    setIsDownloadingReport(true);
    try {
      const res = await getReconciliationReport(selectedOrganisation?.value, projectId);
      if (res?.status !== 200 || !res?.data) {
        throw new Error('Report could not be downloaded');
      }
      const filename = reconciliation?.reportPath?.split(/[\\/]/)?.pop() || 'reconciliation-report.xlsx';
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      Notification({
        notificationContent: { text: 'Could not download the reconciliation report' },
        type: 'error'
      });
    } finally {
      setIsDownloadingReport(false);
    }
  };

  /**
   * Reconciliation now runs automatically once a SAP SmartEdit migration completes
   * (previously it only ran if someone remembered to invoke it by hand). This just
   * surfaces whatever the backend already recorded on the project — no separate
   * fetch/poll here; MigrationLogViewer keeps it current while this page is open by
   * watching the same log stream the backend writes reconciliation progress to.
   */
  const renderReconciliationStatus = () => {
    if (!reconciliation) return null;

    if (reconciliation.status === 'running') {
      return (
        <div className="d-flex align-items-center">
          <CircularLoader />
          <span className="ml-10">
            Automatically verifying the migrated data against the live stack…
          </span>
        </div>
      );
    }

    if (reconciliation.status === 'failed') {
      return (
        <OutlineTag
          content="Reconciliation could not complete — check server logs"
          style={{ backgroundColor: '#f8d7da', color: '#721c24' }}
        />
      );
    }

    const { critical = 0, error = 0, warning = 0 } = reconciliation.summary ?? {};
    const isClean = critical + error === 0 && warning === 0;
    const style = isClean
      ? undefined
      : critical + error > 0
        ? { backgroundColor: '#f8d7da', color: '#721c24' }
        : { backgroundColor: '#ffeeba', color: '#856404' };

    // The report is worth linking to regardless of whether reconciliation found
    // anything — a clean report is still a real, useful document (e.g. to archive
    // or hand off as proof a migration was verified), not just a findings list.
    return (
      <>
        {isClean ? (
          <OutlineTag content="Reconciliation passed — no issues found" type="positive" />
        ) : (
          <OutlineTag
            content={`Reconciliation: ${critical} critical, ${error} error, ${warning} warning finding(s)`}
            style={style}
          />
        )}
        {reconciliation.reportPath?.endsWith('.xlsx') ? (
          <p className="mt-10">
            Full report:{' '}
            <Link target="_self" cbOnClick={handleDownloadReport}>
              <strong>{isDownloadingReport ? 'Downloading…' : reconciliation.reportPath}</strong>
            </Link>
          </p>
        ) : (
          reconciliation.reportPath && (
            <p className="mt-10">
              Full report saved on the server: <code>{reconciliation.reportPath}</code>
            </p>
          )
        )}
      </>
    );
  };

  const getPlaceHolder = (title: string) => {
    switch (title) {
      case 'Legacy CMS':
        return newMigrationData?.legacy_cms?.selectedCms?.title;

      case 'Organization':
        return newMigrationData?.destination_stack?.selectedOrg?.label;

      case 'Selected Stack':
        return newMigrationData?.destination_stack?.selectedStack?.label;

      case 'Selected Locale':
        return newMigrationData?.destination_stack?.selectedStack?.master_locale;
    }
  };

  return isLoading || newMigrationData?.isprojectMapped ? (
    <div className="loader-container">
      <CircularLoader />
    </div>
  ) : (
    <div className="migration-step-container">
      <div className="content-block">
        <div className="content-body">
          <p>
            Your legacy CMS, organization, stack, and locale are configured. You can now begin the
            migration process
          </p>
          <div className="select-wrapper mt-3">
            {MigrationInformation &&
              validateArray(MigrationInformation) &&
              MigrationInformation?.map((item, index) => (
                <div className="select-wrapper" key={`${index.toString()}`}>
                  <Field disabled={item?.disable}>
                    <FieldLabel className="selectedOptions" htmlFor="label">
                      {item?.title}
                    </FieldLabel>
                    <Tooltip 
                    position='top'
                    content={getPlaceHolder(item?.title)}>
                      <TextInput
                        inputClassName='textInput-ellipse'
                        type="text"
                        isReadOnly
                        name="stackKey"
                        value={getPlaceHolder(item?.title)}
                        version="v2"
                        disabled
                        // width="regular"
                      />

                    </Tooltip>
                   
                  </Field>
                  {index < MigrationInformation?.length - 1 && (
                    <Icon className="arrow-wrapper" icon="ArrowRight" size="large" />
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {reconciliation && (
        <div className="content-block">
          <div className="content-header">Reconciliation</div>
          <div className="content-body">{renderReconciliationStatus()}</div>
        </div>
      )}

      <div className="content-block">
        <div className="content-header">Execution Logs</div>
        <div>
          <MigrationLogViewer
            serverPath={import.meta.env.VITE_BASE_API_URL ?? ''}
            handleStepChange={handleStepChange}
          />
        </div>
      </div>
    </div>
  );
};

export default MigrationExecution;
