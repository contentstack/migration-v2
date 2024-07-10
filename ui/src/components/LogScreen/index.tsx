import React, { useEffect, useState } from 'react';
import { PageLayout, PageTitle, Button } from '@contentstack/venus-components';
import io from 'socket.io-client';
import './index.scss';
const logStyles: { [key: string]: React.CSSProperties } = {
  info: { backgroundColor: '#f1f1f1' },
  warn: { backgroundColor: '#ffeeba', color: '#856404' },
  error: { backgroundColor: '#f8d7da', color: '#721c24' },
  success: { backgroundColor: '#d4edda', color: '#155724' },
};

const LogViewer = () => {
  const [logs, setLogs] = useState(["Loading logs..."]);

  useEffect(() => {
    const socket = io('http://localhost:5000'); // Connect to the server
    socket.on('logUpdate', (newLogs: string) => {
      const logArray = newLogs.split('\n');
      // console.log(logArray);
      setLogs(logArray);

    });
  
    return () => {
      socket.disconnect(); // Cleanup on component unmount
    };
  }, []);

return(
<div
  style={{
    height: '100vh',
    overflow: 'auto',
    transform: 'scale(0.6)',
    width: '100vw'
  }}
>
  <PageLayout
    content={{
      component: <div style={{height: '600px', padding: '20px 0', textAlign: 'center'}}>List Data</div>
    }}
    footer={{
      // component: <div className="flex-justify flex-v-center"><div>2020 Contentstack. All rights reserved. Support | Privacy | Terms</div><div><Button buttonType="primary">Save</Button></div></div>
    }}
    header={{
      // backNavigation: function noRefCheck(){},
      component: <h2>Logs</h2>,
    }}
    type="edit"
    // version="v1"
  />
</div>
)
  // return (
  //   <div style={{ fontFamily: 'monospace' }}>
  //     <h2>Execution Logs</h2>
  //     <div className="logs-container" style={{ height: '400px', overflowY: 'scroll' }}>
  //       {logs?.map((log, index) => {
  //         console.log(log);
  //         try {
  //           const logObject = JSON.parse(log);
  //           const level = logObject.level;
  //           const timestamp = logObject.timestamp;
  //           const message = logObject.message;
  //           return (
  //             <div key={index} style={logStyles[level] || logStyles.info}  className="log-entry">
  //               <span className="log-time">{index}</span>
  //               <span className="log-time">{new Date(timestamp).toTimeString().split(' ')[0]}</span>
  //               <span className="log-message">{message}</span>
  //             </div>
  //           );
  //         } catch (error) {
  //           console.error('Invalid JSON string', error);
  //         }
  //       })}
  //     </div>
  //     </div>
  // );
};

export default LogViewer;