// Libraries
import React, { useEffect, useState, useRef } from 'react';
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

const LogViewer = ({serverPath}: LogsType) => {
  const [logs, setLogs] = useState(["Loading logs..."]);

  useEffect(() => {
    const socket = io(serverPath || ''); // Connect to the server
    socket.on('logUpdate', (newLogs: string) => {
      console.log("new logs", newLogs);
      
      const logArray = newLogs.split('\n');
      console.log(logArray);
      setLogs(logArray);

    });
  
    return () => {
      socket.disconnect(); // Cleanup on component unmount
    };
  }, []);
  
  //SCROLL LISTENER
  useEffect(() => {
    window.addEventListener("scroll", handleScrollToTop);
  });

  const refScrollUp = useRef<HTMLDivElement>(null);
  const handleScrollToTop = () => {
    console.log("=============", refScrollUp, refScrollUp?.current);
    
    refScrollUp?.current?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <div className='logs-wrapper'>
      <div className="logs-container" style={{ height: '400px', overflowY: 'auto' }}>
        {logs?.map((log, index) => {
          console.log(log);
          try {
            const logObject = JSON.parse(log);
            const level = logObject.level;
            const timestamp = logObject.timestamp;
            const message = logObject.message;
            return (
              <div key={index} style={logStyles[level] || logStyles.info} className="log-entry" ref={index === 0 ? refScrollUp : null}>
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
      <div className='action-items'>
        <Icon icon="ArrowUp" version='v2' onClick={handleScrollToTop} />
      </div>
    </div>
  );
};

export default LogViewer;