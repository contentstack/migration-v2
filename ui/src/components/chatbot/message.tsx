import React from 'react';
import { Box, Typography, Paper, Tooltip } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

function Message({ message = {} }: any) {
  const { type = 'system', content = '', timestamp } = message;

  const getMessageStyle = () => {
    switch (type) {
      case 'user':
        return {
          bgcolor: '#e3f2fd',
          alignSelf: 'flex-end',
          maxWidth: '80%',
        };
      case 'bot':
        return {
          bgcolor: '#fff',
          alignSelf: 'flex-start',
          maxWidth: '80%',
        };
      case 'system':
        return {
          bgcolor: '#f5f5f5',
          alignSelf: 'center',
          maxWidth: '90%',
        };
      case 'error':
        return {
          bgcolor: '#ffebee',
          alignSelf: 'center',
          maxWidth: '90%',
        };
      default:
        return {};
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'user':
        return <PersonOutlineOutlinedIcon color="primary" />;
      case 'bot':
        return <SmartToyOutlinedIcon color="secondary" />;
      case 'system':
        return <InfoOutlinedIcon color="info" />;
      case 'error':
        return <ErrorOutlineIcon color="error" />;
      default:
        return null;
    }
  };

  const formattedTime = timestamp ?
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <Box sx={{
      display: 'flex',
      mb: 1.5,
      justifyContent: type === 'user' ? 'flex-end' : 'flex-start',
      alignItems: 'flex-start',
      width: '100%',
      position: 'relative'
    }}>
      {type !== 'user' && (
        <Box sx={{ mr: 1, mt: 0.5, flexShrink: 0 }}>
          {getIcon()}
        </Box>
      )}

      <Tooltip title={timestamp ? new Date(timestamp).toLocaleString() : ''} placement="top">
        <Paper
          elevation={1}
          sx={{
            p: 1.5,
            borderRadius: 2,
            position: 'relative',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: { xs: '85%', sm: '80%' },
            '& pre': {
              backgroundColor: '#f1f1f1',
              padding: '8px',
              borderRadius: '4px',
              overflowX: 'auto',
              maxWidth: '100%',
            },
            '& code': {
              backgroundColor: '#f1f1f1',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '0.7em',
            },
            ...getMessageStyle(),
          }}
        >
          <ReactMarkdown
            components={{
              pre: ({ node, ...props }: any) => <pre style={{ maxWidth: '100%', overflow: 'auto' }} {...props} />,
              p: ({ node, ...props }: any) => <p style={{ margin: '0.5em 0' }} {...props} />
            }}
          >
            {content || ''}
          </ReactMarkdown>
          {formattedTime && (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                right: 6,
                bottom: 2,
                opacity: 0.6,
                fontSize: '0.6rem',
                marginTop: '4px',
                paddingLeft: '8px'
              }}
            >
              {formattedTime}
            </Typography>
          )}
        </Paper>
      </Tooltip>

      {type === 'user' && (
        <Box sx={{ ml: 1, mt: 0.5, flexShrink: 0 }}>
          {getIcon()}
        </Box>
      )}
    </Box>
  );
}

export default Message;