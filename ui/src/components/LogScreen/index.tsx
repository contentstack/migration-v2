// Libraries
import React, { useEffect, useState, useRef } from 'react';
import { Icon, Notification } from '@contentstack/venus-components';
import io from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';

// Redux files
import { RootState } from '../../store';
import { updateNewMigrationData } from '../../store/slice/migrationDataSlice';

// Interface
import { INewMigration } from '../../context/app/app.interface';

// CSS
import './index.scss';

import { MAGNIFY,DEMAGNIFY } from '../../common/assets';

const logStyles: { [key: string]: React.CSSProperties } = {
  info: { backgroundColor: '#f1f1f1' },
  warn: { backgroundColor: '#ffeeba', color: '#856404' },
  error: { backgroundColor: '#f8d7da', color: '#721c24' },
  success: { backgroundColor: '#d4edda', color: '#155724' },
};

type LogsType = {
  serverPath: string;
  isMigrationStarted?: boolean;
  sendDataToParent?: (isMigrationStarted: boolean) => void | undefined;
}

/**
 * LogViewer component displays logs received from the server.
 * @param {string} serverPath - The path of the server to connect to.
 */
const LogViewer = ({ serverPath, sendDataToParent }: LogsType) => {
  const [logs, setLogs] = useState(["Loading logs..."]);
  const [isMigrationComplete, setIsMigrationComplete] = useState<boolean>(false);

  const newMigrationData = useSelector((state: RootState) => state?.migration?.newMigrationData);

  const dispatch = useDispatch();

  useEffect(() => {
    const socket = io(serverPath || ''); // Connect to the server

    /**
     * Event listener for 'logUpdate' event.
     * @param {string} newLogs - The new logs received from the server.
     */
    socket.on('logUpdate', (newLogs: string) => {
      // console.log("new logs", newLogs);
      const logArray = newLogs.split('\n');
      // console.log(logArray);
      setLogs(logArray);
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
        behavior: 'smooth',
      });
    }
  }

  /**
   * Scrolls to the bottom of the logs container.
   */
  const handleScrollToBottom = () => {
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
      logsContainer.scrollTo({
        top: logsContainer.scrollHeight,
        behavior: 'smooth',
      });
    }
  }

  /**
   * Copies the logs to the clipboard.
   */
  const handleCopyLogs = () => {
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
      const range = document.createRange();
      range.selectNode(logsContainer);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      navigator.clipboard.writeText(logsContainer.textContent || '');
      window.getSelection()?.removeAllRanges();
    }
  }

  const [zoomLevel, setZoomLevel] = useState(1);

  /**
   * Zooms in the logs container.
   */
  const handleZoomIn = () => {
    const logsContainer = document.querySelector('.logs-magnify') as HTMLElement;
    if (logsContainer) {
      setZoomLevel(prevZoomLevel => prevZoomLevel + 0.1);
      logsContainer.style.transform = `scale(${zoomLevel})`;
    }
  };

  /**
   * Zooms out the logs container.
   */
  const handleZoomOut = () => {
    const logsContainer = document.querySelector('.logs-magnify') as HTMLElement;
    if (logsContainer) {
      setZoomLevel(prevZoomLevel => prevZoomLevel - 0.1);
      logsContainer.style.transform = `scale(${zoomLevel})`;
    }
  };

  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }

    logs?.forEach((log) => {
      try {
        const logObject = JSON.parse(log);
        const message = logObject.message;

        if (message === "Test Migration Process Completed") {
          Notification({
            notificationContent: { text: 'Test Migration completed successfully' },
            notificationProps: {
              position: 'bottom-center',
              hideProgressBar: true
            },
            type: 'success'
          });
          sendDataToParent?.(false);
          setIsMigrationComplete(true);
  
          const newMigrationDataObj: INewMigration = {
            ...newMigrationData,
            test_migration: { ...newMigrationData?.test_migration, isMigrationComplete: true }
          };
  
          dispatch(updateNewMigrationData((newMigrationDataObj)));
  
        }
      } catch (error) {
        console.error('Invalid JSON string', error);
      }
    });
  }, [logs]);

  return (
    <div className='logs-wrapper'>
      <div className="logs-container" style={{ height: '400px', overflowY: 'auto' }} ref={logsContainerRef}>
        <div className="logs-magnify">
          {logs?.map((log, index) => {
            // console.log(log);
            try {
              const logObject = JSON.parse(log);
              const level = logObject.level;
              const timestamp = logObject.timestamp;
              const message = logObject.message;
              return (
                <div key={index} style={logStyles[level] || logStyles.info} className="log-entry">
                  <div className="log-number">{index}</div>
                  <div className="log-time">{ timestamp ? new Date(timestamp)?.toTimeString()?.split(' ')[0] : new Date()?.toTimeString()?.split(' ')[0]}</div>
                  <div className="log-message">{message}</div>
                </div>
              );
            } catch (error) {
              console.error('Invalid JSON string', error);
            }
          })}
        </div>
      </div>
      <div className='action-items'>
        <Icon icon="ArrowUp" version='v2' onClick={handleScrollToTop} />
        <Icon icon="ArrowDown" version='v2' onClick={handleScrollToBottom} />
        <span onClick={handleZoomIn}>{MAGNIFY}</span>
        <span onClick={handleZoomOut}>{DEMAGNIFY}</span>
        <Icon icon="ZoomOut" version='v2' onClick={handleZoomOut} />
        <Icon icon="File" version='v2' onClick={handleCopyLogs} />
      </div>
    </div>
  );
};

export default LogViewer;