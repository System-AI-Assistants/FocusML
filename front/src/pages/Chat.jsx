// src/pages/Chat.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { 
  Flex, 
  Typography, 
  Card, 
  Select, 
  Tag, 
  message as antdMessage,
  Space,
  Tooltip
} from 'antd';
import { 
  DatabaseOutlined, 
  RobotOutlined, 
  UserOutlined,
  InfoCircleOutlined,
  SendOutlined
} from '@ant-design/icons';
import { Input, Button } from 'antd';
import { useXAgent, useXChat, Bubble } from '@ant-design/x';
import { 
  sendChatMessage, 
  fetchAssistant, 
  getDataCollections, 
  sendRAGChatMessage 
} from '../services/api';

const { Title } = Typography;

function Chat() {
  const { assistantId } = useParams();
  const { keycloak, initialized } = useKeycloak();

  const [input, setInput] = useState('');
  const [assistant, setAssistant] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(true);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  // Canonical transcript we send to backend
  const transcriptRef = useRef([]);

  // Load assistant meta (name, model, icon) and collections
  useEffect(() => {
    let cancelled = false;
    
    async function loadAssistant() {
      if (!initialized || !keycloak?.authenticated || !assistantId) return;
      setAssistantLoading(true);
      try {
        const data = await fetchAssistant(keycloak, assistantId);
        if (!cancelled) setAssistant(data);
      } catch (err) {
        if (!cancelled) {
          setAssistant(null);
          antdMessage.error(err?.message || 'Failed to load assistant');
        }
      } finally {
        if (!cancelled) setAssistantLoading(false);
      }
    }

    async function loadCollections() {
      if (!initialized || !keycloak?.authenticated) return;
      setCollectionsLoading(true);
      try {
        const data = await getDataCollections(keycloak);
        if (!cancelled) {
          setCollections(data);
          // Auto-select the first collection if none selected
          if (data.length > 0 && !selectedCollection) {
            setSelectedCollection(data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load collections:', err);
      } finally {
        if (!cancelled) setCollectionsLoading(false);
      }
    }

    loadAssistant();
    loadCollections();
    
    // reset transcript when switching assistants
    transcriptRef.current = [];
    return () => { cancelled = true; };
  }, [assistantId, initialized, keycloak, selectedCollection]);

  // Handle sending messages with RAG when a collection is selected
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    
    if (!assistant) {
      antdMessage.error('Please wait for the assistant to load');
      return;
    }
    
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Add user message to transcript
    const updatedTranscript = [...transcriptRef.current, userMessage];
    transcriptRef.current = updatedTranscript;
    
    try {
      let response;
      
      if (selectedCollection) {
        // Use RAG chat with the selected collection
        response = await sendRAGChatMessage(keycloak, {
          collectionId: selectedCollection,
          messages: updatedTranscript,
          model: assistant.model // Use the assistant's configured model
        });
      } else {
        // Fallback to regular chat with the assistant's model
        response = await sendChatMessage(keycloak, assistantId, {
          ...assistant,
          messages: updatedTranscript
        });
      }
      
      // Add assistant's response to transcript
      transcriptRef.current = [...updatedTranscript, {
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
      }];
      
    } catch (error) {
      console.error('Error sending message:', error);
      antdMessage.error(error.message || 'Failed to send message');
    }
  };

  // Dynamic roles: show model icon for AI if available
  const roles = useMemo(() => ({
    ai: {
      placement: 'start',
      avatar: assistant?.model_icon
        ? {
            src: assistant.model_icon, 
            style: {
              backgroundColor: '#fff',
              border: '1px solid #d9d9d9',
              padding: 8,
              objectFit: 'contain',
            },
            title: `${assistant.name} (${assistant.model})`
          }
        : { 
            icon: <RobotOutlined />, 
            style: { background: '#1890ff', color: '#fff' },
            title: assistant?.model || 'AI Assistant'
          },
      typing: { step: 5, interval: 20 },
      style: { maxWidth: 600 },
    },
    local: {
      placement: 'end',
      avatar: { 
        icon: <UserOutlined />, 
        style: { background: '#52c41a', color: '#fff' },
        title: 'You'
      },
    },
  }), [assistant?.model_icon, assistant?.name, assistant?.model]);

  // Agent: UI -> backend request
  const [agent] = useXAgent({
    request: async ({ message }, { onSuccess, onError }) => {
      try {
        if (!initialized || !keycloak?.authenticated) {
          throw new Error('Please log in to chat.');
        }
        if (!assistantId) {
          throw new Error('Missing assistant id.');
        }

        const history = [...transcriptRef.current, { role: 'user', content: message }];
        const resp = await sendChatMessage(keycloak, assistantId, history);

        let reply = '';
        if (resp?.choices?.[0]) {
          const ch = resp.choices[0];
          if (ch.message?.content) reply = ch.message.content;
          else if (ch.delta?.content) reply = ch.delta.content;
          else if (ch.text) reply = ch.text;
        } else if (resp?.message?.content) {
          reply = resp.message.content;
        }
        if (!reply) reply = '…';

        transcriptRef.current = [...history, { role: 'assistant', content: reply }];
        onSuccess([reply]);
      } catch (err) {
        onError(err);
        antdMessage.error(err?.message || 'Request failed');
      }
    },
  });

  // AntD X chat state
  const { onRequest, messages } = useXChat({
    agent,
    requestPlaceholder: 'Thinking…',
    requestFallback: 'Sorry, something went wrong. Please try again.',
  });

  if (assistantLoading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Loading assistant...</div>;
  }

  if (!assistant) {
    return <div style={{ padding: 24, textAlign: 'center' }}>Assistant not found</div>;
  }

  return (
    <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="chat-header" style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              {assistant.model_icon ? (
                <img 
                  src={assistant.model_icon} 
                  alt={assistant.name} 
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid #f0f0f0'
                  }}
                />
              ) : (
                <RobotOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              )}
              <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.2 }}>
                {assistant.name}
                <div style={{ fontSize: 14, fontWeight: 'normal', color: '#666' }}>
                  {assistant.model}
                </div>
              </Typography.Title>
            </Space>
            <Space>
              <Select
                placeholder="Select data collection"
                style={{ width: 250 }}
                loading={collectionsLoading}
                value={selectedCollection}
                onChange={setSelectedCollection}
                options={collections.map(c => ({
                  value: c.id,
                  label: (
                    <Space>
                      <DatabaseOutlined />
                      {c.name}
                      {c.embeddings_status === 'completed' && (
                        <Tag color="green" icon={<InfoCircleOutlined />}>
                          RAG Ready
                        </Tag>
                      )}
                    </Space>
                  ),
                }))}
                allowClear
                onClear={() => setSelectedCollection(null)}
              />
              {selectedCollection && (
                <Tooltip title="Chat with selected data collection">
                  <Tag color="blue" icon={<DatabaseOutlined />}>
                    Using: {collections.find(c => c.id === selectedCollection)?.name}
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </div>
          
          {selectedCollection && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              <InfoCircleOutlined /> Chat is enhanced with data from the selected collection
            </div>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: '#fafafa' }}>
          {transcriptRef.current.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px 20px',
              color: '#666'
            }}>
              {selectedCollection ? (
                <>
                  <DatabaseOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                  <Typography.Title level={4} style={{ marginBottom: 8 }}>
                    Chat with {assistant.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Ask questions about the data in <strong>{collections.find(c => c.id === selectedCollection)?.name}</strong>
                  </Typography.Text>
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue" icon={<InfoCircleOutlined />}>
                      Using {assistant.model}
                    </Tag>
                    {selectedCollection && (
                      <Tag color="green" icon={<DatabaseOutlined />}>
                        {collections.find(c => c.id === selectedCollection)?.name}
                      </Tag>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <RobotOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                  <Typography.Title level={4} style={{ marginBottom: 8 }}>
                    Chat with {assistant.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Ask me anything or select a data collection to chat about specific data
                  </Typography.Text>
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue" icon={<InfoCircleOutlined />}>
                      Using {assistant.model}
                    </Tag>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Bubble
              messages={transcriptRef.current}
              roles={roles}
              onSend={handleSendMessage}
              input={input}
              onInputChange={setInput}
              loading={assistantLoading}
              style={{ height: '100%' }}
            />
          )}
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSendMessage(input);
              }
            }}
            placeholder={
              selectedCollection 
                ? `Ask about the data in ${collections.find(c => c.id === selectedCollection)?.name}...` 
                : `Message ${assistant.name}...`
            }
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ width: '100%' }}
            disabled={assistantLoading}
            suffix={
              <Button 
                type="primary" 
                icon={<SendOutlined />} 
                onClick={() => handleSendMessage(input)}
                loading={assistantLoading}
                style={{ marginLeft: 8 }}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}

export default Chat;
