// Libraries
import React, { useEffect, useState, useRef } from 'react';
import { Icon, Link, Notification } from '@contentstack/venus-components';
import io from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_URL } from '../../utilities/constants';

// Interface
import { INewMigration } from '../../context/app/app.interface';

// Components
import useBlockNavigation from '../../hooks/userNavigation';

// CSS
import './index.scss';

// Assets
import { MAGNIFY, DEMAGNIFY } from '../../common/assets';

const logStyles: { [key: string]: React.CSSProperties } = {
  info: { backgroundColor: '#f1f1f1' },
  warn: { backgroundColor: '#ffeeba', color: '#856404' },
  error: { backgroundColor: '#f8d7da', color: '#721c24' },
  success: { backgroundColor: '#d4edda', color: '#155724' }
};

type LogsType = {
  serverPath: string;
  handleStepChange: (currentStep: number) => void;
};

export interface LogEntry {
  level?: string;
  message?: string;
  timestamp?: string | null;
}

/**
 * MigrationLogViewer component displays logs received from the server.
 * @param {string} serverPath - The path of the server to connect to.
 */
const MigrationLogViewer = ({ serverPath }: LogsType) => {
  const [logs, setLogs] = useState<LogEntry[]>([
    { message: 'Migration logs will appear here once the process begins.', level: '' }
  ]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasShownCompletionNotification, setHasShownCompletionNotification] = useState(false);
  const [hasShownFailureNotification, setHasShownFailureNotification] = useState(false);

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);
  const selectedOrganisation = useSelector(
    (state: RootState) => state?.authentication?.selectedOrganisation
  );
  const user = useSelector((state: RootState) => state?.authentication?.user);

  const dispatch = useDispatch();

  const { projectId = '' } = useParams();

  const stackLink = `${CS_URL[user?.region]}/stack/${
    newMigrationData?.stackDetails?.value
  }/dashboard`;

  useEffect(() => {
    const socket = io(serverPath || '', {
      reconnection: true
    }); // Connect to the server

    socket.on('disconnect', () => {
      console.warn('Disconnected from server. Retrying...');
      setTimeout(() => socket.connect(), 3000); // Retry connection after 3 seconds
    });

    /**
     * Event listener for 'logUpdate' event.
     * @param {string} newLogs - The new logs received from the server.
     */
    socket.on('logUpdate', (newLogs: string) => {
      const parsedLogsArray: LogEntry[] = [];
      const logArray = newLogs?.split('\n');

      logArray?.forEach((logLine) => {
        try {
          //parse each log entry as a JSON object
          const parsedLog = JSON?.parse(logLine);

          // Build the log object with default values
          const plogs = {
            level: parsedLog.level || 'info',
            message: parsedLog.message || 'Unknown message',
            timestamp: parsedLog.timestamp || null
          };
          parsedLogsArray.push(plogs);
        } catch (error) {
          console.error('error in parsing logs : ', error);
        }
      });

      setLogs((prevLogs) => [
        ...prevLogs.filter(
          (log) => log.message !== 'Migration logs will appear here once the process begins.'
        ),
        ...parsedLogsArray
      ]);
    });

    return () => {
      socket.disconnect(); // Cleanup on component unmount
    };
  }, []);

  useBlockNavigation(isModalOpen);
  
  useEffect(() => {
    if (newMigrationData?.migration_execution?.migrationCompleted) {
      dispatch(updateNewMigrationData({ stepValue: 'Restart Migration' }));
    }
  }, [newMigrationData?.migration_execution?.migrationCompleted, dispatch]);

  // Reset notification flag AND purge stale logs when a new migration starts. The server
  // streams from a monotonic file offset (server.ts) so a normal socket reconnect never
  // replays old lines — but an API restart resets that offset to 0 and re-emits the whole
  // log file to every client. Without this purge, a prior run's terminal message surviving
  // in `logs` after an API restart would slip through the completion detector below and
  // flip the UI straight back to the previous run's completion view.
  useEffect(() => {
    if (newMigrationData?.migration_execution?.migrationStarted && !newMigrationData?.migration_execution?.migrationCompleted) {
      setHasShownCompletionNotification(false);
      setHasShownFailureNotification(false);
      setLogs([{ message: 'Migration logs will appear here once the process begins.', level: '' }]);
    }
  }, [newMigrationData?.migration_execution?.migrationStarted, newMigrationData?.migration_execution?.migrationCompleted]);

  // React Router reuses this component instance across a client-side navigation between
  // different projects on the same route (it doesn't unmount just because :projectId
  // changed) — so hasShownCompletionNotification could otherwise carry a stale `true` over
  // from a PREVIOUS project's completed run into a brand new one that hasn't finished yet.
  useEffect(() => {
    setHasShownCompletionNotification(false);
  }, [projectId]);

  
  /**
   * Scrolls to the top of the logs container.
   */
  const handleScrollToTop = () => {
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
      logsContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  /**
   * Scrolls to the bottom of the logs container.
   */
  const handleScrollToBottom = () => {
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
      logsContainer.scrollTo({
        top: logsContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  /**
   * Zooms in the logs container.
   */
  const handleZoomIn = () => {
    setZoomLevel((prevZoomLevel) => {
      const newZoomLevel = Math.min(prevZoomLevel + 0.1, 1.4); // Ensures it does not exceed 1.4
      return newZoomLevel;
    });
  };

  /**
   * Zooms out the logs container.
   */
  const handleZoomOut = () => {
    // const logsContainer = document.querySelector('.logs-magnify') as HTMLElement;
    // if (logsContainer) {
    // setZoomLevel(prevZoomLevel => prevZoomLevel - 0.1);
    // logsContainer.style.transform = `scale(${zoomLevel})`;
    // }
    setZoomLevel((prevZoomLevel) => {
      const newZoomLevel = Math.max(prevZoomLevel - 0.1, 0.6); // added minimum level for zoom out
      return newZoomLevel;
    });
  };

  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Both the "migration completed" flip and the reconciliation-status updates read AND
  // write the SAME migration_execution sub-object. These used to live in two separate
  // effects, each spreading ...newMigrationData?.migration_execution from THIS render's
  // own — necessarily stale, since redux hasn't re-rendered in between — snapshot. Because
  // updateNewMigrationData does a SHALLOW merge at the top level (migration_execution gets
  // replaced wholesale, not deep-merged), whichever effect dispatched SECOND silently
  // overwrote the first one's change. In practice the reconciliation effect ran after the
  // completion effect, so its dispatch (built from a snapshot that still said
  // migrationCompleted: false) clobbered the completion flip back to false the instant
  // reconciliation started — even though a moment earlier, in the same pass, it had
  // correctly been set true. That is exactly why reconciliation status displayed correctly
  // (its own dispatch was the last writer) while "migration completed" never stuck. Fixed
  // by computing everything in ONE pass and issuing at most one combined dispatch.
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }

    // Look for a terminal message anywhere in `logs`. Scanning the whole array is safe here
    // because the effect above purges `logs` back to the placeholder when migrationStarted
    // flips false→true — anything present is from the current run, not a replay.
    // We can't inspect only the last entry: after the CLI emits "Migration Process Completed"
    // the backend still writes uid-mapper / "No config file generated" lines, burying the
    // terminal message mid-array on the delta path.
    const migrationStarted = newMigrationData?.migration_execution?.migrationStarted;
    // On iteration 1 there's only a bulk import — "Migration Process Completed" IS terminal.
    // On iteration 2+ (delta) that message only marks the bulk-import phase; the run isn't
    // actually done until the update/localize CLI finishes and writes
    // "Entry Update Process Completed" afterward. Treating either as terminal on a delta run
    // would fire the completion modal early, hiding the still-streaming localize pass (and any
    // "Failed to update entries" error in it) behind the completion view.
    const isDeltaIteration = (newMigrationData?.iteration ?? 1) > 1;
    const requiredTerminalMessage = isDeltaIteration
      ? 'Entry Update Process Completed'
      : 'Migration Process Completed';
    const requiredFailureMessage = isDeltaIteration
      ? 'Entry Update Process Failed'
      : 'Migration Process Failed';
    const hasTerminalMessage = logs?.some(
      (log) => log?.message === requiredTerminalMessage
    );
    // Mutually exclusive with the completion branch below: the backend now writes the
    // completion marker only after every prior step actually succeeded (see
    // runCli.service.ts / migration.service.ts), so a run's log should never carry both —
    // but checking here too means a single pass never fires both notifications even if it
    // somehow did.
    const hasFailureMessage = logs?.some(
      (log) => log?.message === requiredFailureMessage
    );

    // Both the "migration completed"/"failed" flip and the reconciliation-status updates
    // read AND write the SAME migration_execution sub-object, and updateNewMigrationData
    // does a SHALLOW merge at the top level — so everything below is computed into ONE patch
    // and dispatched at most once per pass. Two separate dispatches in the same pass would
    // let whichever one lands second silently clobber the other's change back to its own,
    // stale snapshot of migration_execution (this is exactly the bug that used to hide the
    // "migration completed" flip behind a same-pass reconciliation update).
    let migrationExecutionPatch: Record<string, any> = {};

    logs?.forEach((log) => {
      const message = log.message ?? '';

      // Read the patch accumulated so far in THIS pass first: a "Starting..." and its
      // "finished..."/"failed..." log can land in the same socket batch, so falling back
      // straight to the (stale, pre-batch) redux snapshot here would lose the startedAt
      // this same forEach loop just computed a few iterations earlier.
      const currentReconciliation =
        migrationExecutionPatch.reconciliation ?? newMigrationData?.migration_execution?.reconciliation;

      if (
        message.startsWith('Starting automatic post-migration reconciliation') &&
        currentReconciliation?.status !== 'running' &&
        currentReconciliation?.status !== 'completed' &&
        currentReconciliation?.status !== 'failed'
      ) {
        migrationExecutionPatch = {
          ...migrationExecutionPatch,
          reconciliation: { status: 'running', startedAt: log.timestamp ?? new Date().toISOString() }
        };
      }

      const finished = message.match(
        /^Automatic post-migration reconciliation finished: (\d+) critical, (\d+) error, (\d+) warning finding\(s\)\. Report: (.+)$/
      );
      if (finished && currentReconciliation?.status !== 'completed') {
        const [, critical, error, warning, reportPath] = finished;
        migrationExecutionPatch = {
          ...migrationExecutionPatch,
          reconciliation: {
            status: 'completed',
            startedAt: currentReconciliation?.startedAt ?? '',
            completedAt: log.timestamp ?? new Date().toISOString(),
            summary: { critical: Number(critical), error: Number(error), warning: Number(warning) },
            reportPath
          }
        };
      }

      if (
        message.startsWith('Automatic post-migration reconciliation failed to complete') &&
        currentReconciliation?.status !== 'failed'
      ) {
        migrationExecutionPatch = {
          ...migrationExecutionPatch,
          reconciliation: {
            status: 'failed',
            startedAt: currentReconciliation?.startedAt ?? '',
            completedAt: log.timestamp ?? new Date().toISOString(),
            error: message
          }
        };
      }
    });

    if (migrationStarted && hasTerminalMessage && !hasFailureMessage) {
      try {
        const message = 'Migration Process Completed';

        if (!hasShownCompletionNotification) {
          setIsModalOpen(true);
          setHasShownCompletionNotification(true);

          dispatch(updateNewMigrationData({
            migration_execution: {
              ...newMigrationData?.migration_execution,
              ...migrationExecutionPatch,
              migrationStarted: false,
              migrationCompleted: true
              // stepValue is deliberately NOT changed here: the execute-step CTA stays
              // "Start Migration" and goes disabled on completion, rather than becoming a
              // "Restart Migration" button that invites re-running a finished migration.
            }
          }));

          Notification({
            notificationContent: { text: message },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
        } else if (Object.keys(migrationExecutionPatch).length > 0) {
          // Completion already notified this run, but a reconciliation update still needs
          // to land (e.g. it started/finished in a LATER batch than completion did).
          dispatch(
            updateNewMigrationData({
              migration_execution: { ...newMigrationData?.migration_execution, ...migrationExecutionPatch }
            })
          );
        }
      } catch (error) {
        console.error('Invalid JSON string', error);
      }
    } else if (migrationStarted && hasFailureMessage && !hasShownFailureNotification) {
      // The bulk-import CLI (non-delta) or the update/localize CLI (delta) can hard-fail
      // instead of completing — runCli.service.ts / migration.service.ts write
      // 'Migration Process Failed' / 'Entry Update Process Failed' respectively in that case.
      // Without this check the UI would otherwise wait forever for a completion message that
      // will never arrive. Reset migrationStarted so "Execute Migration" becomes clickable
      // again instead of leaving the run permanently stuck on the spinner.
      setHasShownFailureNotification(true);

      dispatch(
        updateNewMigrationData({
          migration_execution: {
            ...newMigrationData?.migration_execution,
            ...migrationExecutionPatch,
            migrationStarted: false,
            migrationCompleted: false
          }
        })
      );

      Notification({
        notificationContent: {
          text: 'Migration failed. Check the execution logs above for details, then try again.'
        },
        notificationProps: {
          position: 'bottom-center',
          hideProgressBar: true
        },
        type: 'error'
      });
    } else if (Object.keys(migrationExecutionPatch).length > 0) {
      // Neither terminal nor failure yet this pass, but reconciliation status changed on
      // its own (e.g. "Starting..." arrived before the run itself has finished).
      dispatch(
        updateNewMigrationData({
          migration_execution: { ...newMigrationData?.migration_execution, ...migrationExecutionPatch }
        })
      );
    }
  }, [logs, newMigrationData?.migration_execution?.migrationStarted, newMigrationData?.iteration]);

  const navigate = useNavigate();

  const handleLinkClick = () => {
    const activeTabState: INewMigration = {
      ...newMigrationData,
      settings: {
        active_state: 'Execution Logs',
      }
    };
    dispatch(updateNewMigrationData(activeTabState));
    navigate(`/projects/${projectId}/settings`)
  };

  return (
    <div className="logs-wrapper">
      <div
        className="logs-container"
        style={{ height: '400px', overflowY: 'auto' }}
        ref={logsContainerRef}
      >
        {newMigrationData?.migration_execution?.migrationCompleted ? (
          <div>
            <div className="log-entry text-center">
              <div className="log-message generic-log-message">
                Migration Execution process is completed in the selected stack
                <Link href={stackLink} target="_blank" className="ml-5">
                  <strong>{newMigrationData?.stackDetails?.label}</strong>
                </Link>
                . You can view logs
                <Link target="_self" className="ml-5" cbOnClick={handleLinkClick}>
                  <strong>here</strong>
                </Link>
                .
              </div>
            </div>
          </div>
        ) : (
          <div
            className="logs-magnify"
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
              transition: 'transform 0.1s ease'
            }}
          >
            {(() => {
              // Only show the "already migrated" placeholder when the user has NOT started
              // a new run on this screen — otherwise iter 2 (which legitimately targets the
              // same stack) would sit behind this message. Rendering it outside the .map
              // also fixes the previous bug where the message repeated once per log line.
              const stackAlreadyMigrated = newMigrationData?.destination_stack?.migratedStacks?.includes(
                newMigrationData?.destination_stack?.selectedStack?.value
              );
              const migrationStarted = newMigrationData?.migration_execution?.migrationStarted;
              if (stackAlreadyMigrated && !migrationStarted) {
                return (
                  <div style={logStyles.info} className="log-entry text-center">
                    <div className="log-message generic-log-message">
                      Migration has already done in selected stack. Please create a new project.
                    </div>
                  </div>
                );
              }
              return logs.map((log, index) => {
                try {
                  const { level, timestamp, message } = log;
                  return (
                    <div key={index}>
                      {message === 'Migration logs will appear here once the process begins.' ? (
                        <div
                          style={logStyles[level || ''] || logStyles.info}
                          className="log-entry text-center"
                        >
                          <div className="log-message generic-log-message">{message}</div>
                        </div>
                      ) : (
                        <div
                          style={logStyles[level || ''] || logStyles.info}
                          className="log-entry"
                        >
                          <div className="log-time">
                            {timestamp
                              ? new Date(timestamp)?.toTimeString()?.split(' ')[0]
                              : new Date()?.toTimeString()?.split(' ')[0]}
                          </div>
                          <div className="log-message">{message}</div>
                        </div>
                      )}
                    </div>
                  );
                } catch (error) {
                  console.error('Invalid log format', error);
                  return null;
                }
              });
            })()}
          </div>
        )}
      </div>
      {!newMigrationData?.migration_execution?.migrationCompleted &&
        !logs?.every(
          (log) => log.message === 'Migration logs will appear here once the process begins.'
        ) && (
          <div className="action-items">
            <Icon icon="ArrowUp" version="v2" onClick={handleScrollToTop} />
            <Icon icon="ArrowDown" version="v2" onClick={handleScrollToBottom} />
            <span onClick={handleZoomIn}>{MAGNIFY}</span>
            <span onClick={handleZoomOut}>{DEMAGNIFY}</span>
            <Icon icon="ZoomOut" version="v2" onClick={handleZoomOut} />
          </div>
        )}
    </div>
  );
};

export default MigrationLogViewer;
