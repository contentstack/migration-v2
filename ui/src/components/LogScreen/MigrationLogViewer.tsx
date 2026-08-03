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

  // Reset notification flag AND purge stale logs when a new migration starts. Without the log
  // purge, a replayed "Migration Process Completed" line from the previous run (on socket
  // reconnect / late buffered emit) would slip through the completion detector below and flip
  // the UI straight back to the iter-1 completion view.
  useEffect(() => {
    if (newMigrationData?.migration_execution?.migrationStarted && !newMigrationData?.migration_execution?.migrationCompleted) {
      setHasShownCompletionNotification(false);
      setLogs([{ message: 'Migration logs will appear here once the process begins.', level: '' }]);
    }
  }, [newMigrationData?.migration_execution?.migrationStarted, newMigrationData?.migration_execution?.migrationCompleted]);

  
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

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }

    // Only inspect the tail — completion is always the terminal message. Scanning the whole
    // array made a replayed / rehydrated "Migration Process Completed" mid-array flip the UI
    // back to the completion view on iter 2. Also gate on migrationStarted so a rehydrated
    // log array from a previous run doesn't trigger completion on mount.
    const lastLog = logs?.[logs.length - 1];
    const migrationStarted = newMigrationData?.migration_execution?.migrationStarted;
    // Full/master import ends with "Migration Process Completed"; the delta update path ends
    // with "Entry Update Process Completed" — accept either as the terminal message.
    const TERMINAL_MESSAGES = new Set([
      'Migration Process Completed',
      'Entry Update Process Completed'
    ]);
    if (migrationStarted && lastLog) {
      try {
        const message = lastLog.message;

        if (message && TERMINAL_MESSAGES.has(message) && !hasShownCompletionNotification) {
          setIsModalOpen(true);
          setHasShownCompletionNotification(true);

          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            migration_execution: {
              ...newMigrationData?.migration_execution,
              migrationStarted: false,
              migrationCompleted: true
            },
            stepValue: 'Restart Migration'
          };

          dispatch(updateNewMigrationData(newMigrationDataObj));

          /**
           * Updates the Migration excution step as completed in backend if migration completes.
           */
          //await updateCurrentStepData(selectedOrganisation.value, projectId);

          Notification({
            notificationContent: { text: message },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
        }
      } catch (error) {
        console.error('Invalid JSON string', error);
      }
    }
  }, [logs, newMigrationData?.migration_execution?.migrationStarted]);

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
