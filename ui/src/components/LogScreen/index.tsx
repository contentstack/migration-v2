// Libraries
import React, { useEffect, useState } from 'react';
import { Icon } from '@contentstack/venus-components';
import io from 'socket.io-client';

// CSS
import './index.scss';

const logStyles: { [key: string]: React.CSSProperties } = {
  info: { backgroundColor: '#f1f1f1' },
  warn: { backgroundColor: '#ffeeba', color: '#856404' },
  error: { backgroundColor: '#f8d7da', color: '#721c24' },
  success: { backgroundColor: '#d4edda', color: '#155724' },
};

type LogsType = {
  serverPath: string;
}

/**
 * LogViewer component displays logs received from the server.
 * @param {string} serverPath - The path of the server to connect to.
 */
const LogViewer = ({ serverPath }: LogsType) => {
  const [logs, setLogs] = useState(["Loading logs..."]);

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

  return (
    <div className='logs-wrapper'>
      <div className="logs-container" style={{ height: '400px', overflowY: 'auto' }}>
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
                  <div className="log-time">{new Date(timestamp).toTimeString().split(' ')[0]}</div>
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
        <Icon icon="Search" version='v2' onClick={handleZoomIn} />
        <Icon icon="ZoomOut" version='v2' onClick={handleZoomOut} />
        <Icon icon="File" version='v2' onClick={handleCopyLogs} />
      </div>
    </div>
  );
};

export default LogViewer;