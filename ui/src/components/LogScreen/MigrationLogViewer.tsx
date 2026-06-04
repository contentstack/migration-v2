// Libraries
import React, { useEffect, useState, useRef } from 'react';
import { Icon, Link } from '@contentstack/venus-components';
import io from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Utilities
import { CS_URL } from '../../utilities/constants';

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

const inferLogLevel = (message: string): string => {
  const normalized = message.toLowerCase();
  if (normalized.includes('error') || normalized.includes('failed')) return 'error';
  if (normalized.includes('warn')) return 'warn';
  if (normalized.includes('success') || normalized.includes('completed')) return 'success';
  return 'info';
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
  const pendingLogChunkRef = useRef('');

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
      const bufferedLogs = `${pendingLogChunkRef.current}${newLogs || ''}`;
      const logArray = bufferedLogs.split('\n');
      pendingLogChunkRef.current = logArray.pop() || '';

      logArray?.forEach((rawLine) => {
        const logLine = rawLine?.trim();
        if (!logLine) return;
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
        } catch {
          const structuredMatch = logLine.match(
            /^\[([^\]]+)\]\s*(INFO|WARN|ERROR)\s*:\s*(.*)$/i
          );
          if (structuredMatch) {
            parsedLogsArray.push({
              timestamp: structuredMatch[1],
              level: structuredMatch[2].toLowerCase(),
              message: structuredMatch[3] || 'Unknown message'
            });
            return;
          }
          parsedLogsArray.push({
            level: inferLogLevel(logLine),
            message: logLine,
            timestamp: null
          });
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
      pendingLogChunkRef.current = '';
      socket.disconnect(); // Cleanup on component unmount
    };
  }, []);

  useBlockNavigation(isModalOpen);
  
  useEffect(() => {
    if (newMigrationData?.migration_execution?.migrationCompleted) {
      dispatch(updateNewMigrationData({ stepValue: 'Restart Migration' }));
    }
  }, [newMigrationData?.migration_execution?.migrationCompleted, dispatch]);

  // Reset completion-handled flag when a new migration starts so the
  // completion effect can fire again for the next run.
  useEffect(() => {
    if (
      newMigrationData?.migration_execution?.migrationStarted &&
      !newMigrationData?.migration_execution?.migrationCompleted
    ) {
      finalMigrationCompletionHandledRef.current = false;
    }
  }, [
    newMigrationData?.migration_execution?.migrationStarted,
    newMigrationData?.migration_execution?.migrationCompleted
  ]);


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
  /** Avoid stacking duplicate toasts/dispatches when `logs` updates many times after completion. */
  const finalMigrationCompletionHandledRef = useRef(false);
  /** Only reset the log buffer on false → true (new run), not on every Redux refresh with started still true. */
  const prevFinalMigrationStartedRef = useRef<boolean | undefined>(undefined);
  const newMigrationDataRef = useRef(newMigrationData);
  newMigrationDataRef.current = newMigrationData;

  useEffect(() => {
    const started = newMigrationData?.migration_execution?.migrationStarted === true;
    const prev = prevFinalMigrationStartedRef.current;
    prevFinalMigrationStartedRef.current = started;

    if (started && prev === false) {
      finalMigrationCompletionHandledRef.current = false;
      // Never replace streamed lines with the placeholder: when the API awaits the full import,
      // Redux often flips `migrationStarted` only after logs have already arrived — wiping them
      // leaves only this placeholder until the next file change (often never).
      setLogs((prevLogs) => {
        const hasReal = prevLogs.some(
          (l) =>
            l.message &&
            l.message !== 'Migration logs will appear here once the process begins.'
        );
        if (hasReal) {
          return prevLogs;
        }
        return [{ message: 'Migration logs will appear here once the process begins.', level: '' }];
      });
    }
  }, [newMigrationData?.migration_execution?.migrationStarted]);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (finalMigrationCompletionHandledRef.current) {
      return;
    }
    const hasCompletion = logs?.some(
      (log) => log.message === 'Migration Process Completed'
    );
    if (!hasCompletion) {
      return;
    }

    finalMigrationCompletionHandledRef.current = true;
    setIsModalOpen(true);

    dispatch(
      updateNewMigrationData({
        ...newMigrationDataRef.current,
        migration_execution: {
          ...newMigrationDataRef.current?.migration_execution,
          migrationStarted: false,
          migrationCompleted: true
        },
        // Delta migration: surface restart CTA so the user can run another iteration.
        stepValue: 'Restart Migration'
      })
    );
    // Success toast is shown from Migration page after startMigration HTTP 200 (avoids duplicate toasts).
  }, [logs, dispatch]);

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
            {/** Stack may already be in migratedStacks after test migration; still show live CLI logs while running. */}
            {newMigrationData?.destination_stack?.migratedStacks?.includes(
              newMigrationData?.destination_stack?.selectedStack?.value
            ) &&
              !newMigrationData?.migration_execution?.migrationStarted &&
              !newMigrationData?.migration_execution?.migrationCompleted && (
              <div
                style={logStyles.warn}
                className="log-entry text-center mb-2"
              >
                <div className="log-message generic-log-message">
                  Migration has already been run on this stack. You can still start another run; live
                  logs will appear below when migration is in progress.
                </div>
              </div>
            )}
            {logs.map((log, index) => {
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
            })}
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
