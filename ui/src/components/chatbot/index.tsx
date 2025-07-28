import React, { useState } from 'react';
import { Icon, TextInput, Button } from '@contentstack/venus-components';
import api from './api';
import Message from './message';
import { Divider, Typography, Box } from '@mui/material';

const ChatbotButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<
    { type: string; content: string; timestamp?: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMsg = {
      type: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setChatHistory(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const context = chatHistory.map(msg => msg.content).join('\n');
      const response = await api.askQuestion(message, context);
      setChatHistory(prev => [
        ...prev,
        {
          type: 'bot',
          content: response.answer || 'Sorry, no answer found.',
          timestamp: Date.now(),
        },
      ]);
    } catch (error) {
      setChatHistory(prev => [
        ...prev,
        {
          type: 'error',
          content: 'Sorry, something went wrong.',
          timestamp: Date.now(),
        },
      ]);
    }
    setMessage('');
    setLoading(false);
  };

  return (
    <>
      <button
        style={{
          border: 'none',
          borderRadius: '50%',
          width: 36,
          height: 36,
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
        aria-label="Open Chatbot"
        onClick={() => setOpen(!open)}
      >
        <Icon icon="Help" version="v2" size="large" />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            right: 20,
            width: 500,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: 16,
            height: 680,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h4>
            <Icon icon="Question" size="medium" style={{ marginRight: 8, marginBottom: 2 }} />
            Migration Assistant
            <Divider />
          </h4>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: 12,
              borderRadius: 4,
              padding: 8,
              minHeight: 100,
            }}
          >
            {chatHistory.length === 0 && (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Welcome to Migration Chat Assistant
                </Typography>
              </Box>
            )}
            {chatHistory.map((msg, idx) => (
              <Message key={idx} message={msg} />
            ))}
          </div>
          <Divider />
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <TextInput
              name="chatbot-input"
              value={message}
              onChange={(e: any) => setMessage(e.target.value)}
              placeholder="Type your question..."
              size="large"
              version="v2"
              style={{ flex: 1 }}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter' && !loading) handleSend();
              }}
              disabled={loading}
            />
            <Button
              // icon="Unlink"
              onClick={null}
              // buttonType="secondary"
              size="large"
              // version="v2"
              style={{
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                position: 'relative',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
              }}
              aria-label="Take Snapshot"
            >
              <Icon icon="Question" size="medium" />
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              icon="Send"
              onClick={handleSend}
              disabled={!message || loading}
              buttonType="primary"
              size="medium"
              version="v2"
              isLoading={loading}
            >
              Send
            </Button>
            <Button
              onClick={() => setOpen(false)}
              buttonType="secondary"
              size="medium"
              version="v2"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotButton;