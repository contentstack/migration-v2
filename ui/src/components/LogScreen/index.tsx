// Libraries
import React, { useEffect, useState, useRef } from 'react';
import { Icon, Link, Notification } from '@contentstack/venus-components';
import io from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Interface
import { INewMigration, TestStacks } from '../../context/app/app.interface';

// CSS
import './index.scss';

import { MAGNIFY, DEMAGNIFY } from '../../common/assets';
import { saveStateToLocalStorage } from '../../utilities/functions';
import { LogEntry } from './MigrationLogViewer';
import { useNavigate } from 'react-router';

// Define log styles for different levels
const logStyles: { [key: string]: React.CSSProperties } = {
  info: { backgroundColor: '#f1f1f1' },
  warn: { backgroundColor: '#ffeeba', color: '#856404' },
  error: { backgroundColor: '#f8d7da', color: '#721c24' },
  success: { backgroundColor: '#d4edda', color: '#155724' }
};

// Define the props for the component
type LogsType = {
  serverPath: string;
  sendDataToParent?: (isMigrationStarted: boolean) => void | undefined;
  projectId: string;
};

/**
 * TestMigrationLogViewer component displays logs received from the server.
 * @param {string} serverPath - The path of the server to connect to.
 * @param {function} sendDataToParent - Callback to inform the parent about migration status.
 * @param {string} projectId - The project ID for saving state to local storage.
 */
const TestMigrationLogViewer = ({ serverPath, sendDataToParent, projectId }: LogsType) => {
  const [isLogsLoading, setisLogsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      message: !isLogsLoading ? 'Migration logs will appear here once the process begins.' : '',
      level: ''
    }
  ]);

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  const [migratedStack, setmigratedSatck] = useState<TestStacks | undefined>(
    (newMigrationData?.testStacks ?? [])?.find(
      (test) => test?.stackUid === newMigrationData?.test_migration?.stack_api_key
    )
  );

  // Redux dispatcher
  const dispatch = useDispatch();

  useEffect(() => {
    const migratedTestStack = newMigrationData?.testStacks?.find(
      (test) => test?.stackUid === newMigrationData?.test_migration?.stack_api_key
    );
    setmigratedSatck(migratedTestStack);
  }, [newMigrationData?.test_migration]);

  // Set up WebSocket connection
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
      setisLogsLoading(true);
      const parsedLogsArray: LogEntry[] = [];
      const logArray = newLogs?.split('\n');

      logArray?.forEach((logLine) => {
        try {
          // parse each log entry as a JSON object
          const parsedLog = JSON.parse(logLine);

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

  const [zoomLevel, setZoomLevel] = useState(1);

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

    logs?.forEach((log: LogEntry) => {
      try {
        //const logObject = JSON.parse(log);
        const message = log?.message;

        if (message === 'Test Migration Process Completed') {
          setisLogsLoading(false);

          // Save test migration state to local storage
          saveStateToLocalStorage(`testmigration_${projectId}`, {
            isTestMigrationCompleted: true,
            isTestMigrationStarted: false
          });

          Notification({
            notificationContent: { text: message },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: false
            },
            type: 'success'
          });
          sendDataToParent?.(false);
          const stacks =
            newMigrationData?.testStacks?.length > 0
              ? newMigrationData?.testStacks?.map((stack) =>
                  stack?.stackUid === newMigrationData?.test_migration?.stack_api_key
                    ? {
                        ...stack,
                        stackName: newMigrationData?.test_migration?.stack_name,
                        isMigrated: true
                      }
                    : stack
                )
              : [
                  {
                    stackUid: newMigrationData?.test_migration?.stack_api_key,
                    stackName: newMigrationData?.test_migration?.stack_name,
                    isMigrated: true
                  }
                ];

          // Update testStacks data in Redux
          const newMigrationObj: INewMigration = {
            ...newMigrationData,
            testStacks: stacks,
            test_migration: {
              ...newMigrationData?.test_migration,
              isMigrationComplete: true,
              isMigrationStarted: false
            }
          };

          dispatch(updateNewMigrationData(newMigrationObj));
        }
      } catch (error) {
        console.error('Invalid JSON string', error);
      }
    });
  }, [logs]);

  useEffect(() => {
    if (!isLogsLoading && !migratedStack?.isMigrated) {
      setLogs([{ message: 'Migration logs will appear here once the process begins.', level: '' }]);
    }
  }, [isLogsLoading, migratedStack?.isMigrated]);

  const navigate = useNavigate(); 

  const handleLinkClick = () => {
    const activeTabState: INewMigration = {
      ...newMigrationData,
      settings: {
        active_state: 'Execution Logs'
      }
    };
    dispatch(updateNewMigrationData(activeTabState));
    navigate(`/projects/${projectId}/settings`);
  };

  return (
    <div className="logs-wrapper">
      {/* Logs container */}
      <div
        className="logs-container"
        style={{ height: '400px', overflowY: 'auto' }}
        ref={logsContainerRef}
      >
        {migratedStack?.isMigrated ? (
          <div>
            <div className="log-entry text-center">
              <div className="log-message">
                Test Migration is completed for stack{' '}
                <Link href={newMigrationData?.test_migration?.stack_link} target="_blank">
                  <strong>{migratedStack?.stackName}</strong>
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
            {logs?.map((log, index) => {
              try {
                const { level, timestamp, message } = log;

                return (
                  <div key={index}>
                    {message === 'Migration logs will appear here once the process begins.' ? (
                      <div
                        style={logStyles[level || ''] || logStyles.info}
                        className="log-entry text-center"
                      >
                        <div className="log-message">{message}</div>
                      </div>
                    ) : (
                      <div
                        style={logStyles[level || ''] || logStyles.info}
                        className="log-entry logs-bg"
                      >
                        <div className="log-number">{index}</div>
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
                console.error('Invalid JSON string', error);
              }
            })}
          </div>
        )}
      </div>

      {/* Action buttons for scrolling and zooming */}
      {!migratedStack?.isMigrated &&
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

export default TestMigrationLogViewer;
