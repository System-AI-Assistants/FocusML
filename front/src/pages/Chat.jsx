import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { Card, Input, Button, List, message, Spin, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { sendChatMessage } from '../services/api';
import './Chat.css';

const { Title } = Typography;
const { TextArea } = Input;

function Chat() {
  const { assistantId } = useParams();
  const { keycloak, initialized } = useKeycloak();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialized || !keycloak.authenticated) {
      message.error('Please log in to access chat.');
    }
  }, [initialized, keycloak]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!initialized || !keycloak.authenticated) {
      message.error('Not authenticated.');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(keycloak, assistantId, [
        ...messages,
        userMessage
      ]);
      const assistantMessage = response.choices[0].message;
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      message.error(`Failed to send message: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-page-container">
      <Title level={2}>Chat with Assistant {assistantId}</Title>
      <Card className="chat-card">
        <div className="chat-messages">
          <List
            dataSource={messages}
            renderItem={(item) => (
              <List.Item
                className={item.role === 'user' ? 'user-message' : 'assistant-message'}
              >
                <div>
                  <strong>{item.role === 'user' ? 'You' : 'Assistant'}:</strong> {item.content}
                </div>
              </List.Item>
            )}
          />
          {loading && <Spin style={{ display: 'block', textAlign: 'center', margin: '16px 0' }} />}
        </div>
        <div className="chat-input">
          <TextArea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            onPressEnter={(e) => {
              if (e.ctrlKey) {
                handleSendMessage();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            style={{ marginTop: 8 }}
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default Chat;