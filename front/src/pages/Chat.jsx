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
          // Don't auto-select any collection by default
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
    // Reset selected collection when assistant changes
    setSelectedCollection(null);
    return () => { cancelled = true; };
  }, [assistantId, initialized, keycloak]);

  // Handle sending messages with RAG when a collection is selected
  const handleSendMessage = async (message) => {
    if (!message.trim() || isSending) return;
    
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
    setInput('');
    setIsSending(true);
    
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
        response = await sendChatMessage(keycloak, assistantId, updatedTranscript);
      }
      
      // Add assistant's response to transcript
      transcriptRef.current = [...updatedTranscript, {
        role: 'assistant',
        content: response.choices[0].message.content,
        timestamp: new Date().toISOString(),
      }];
      
      // Force re-render to show the new messages
      setInput('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      antdMessage.error(error.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  // State for loading indicator
  const [isSending, setIsSending] = useState(false);
  
  // Filter out collections that don't have completed embeddings
  const availableCollections = useMemo(() => 
    collections.filter(c => c.embeddings_status === 'completed'),
    [collections]
  );
  
  // Add loading animation style
  const loadingDotsStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };
  
  const dotStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#666',
    display: 'inline-block',
    animation: 'bounce 1.4s infinite ease-in-out both',
  };
  
  const keyframes = `
    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }
  `;

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
              width: 36,
              height: 36,
              borderRadius: '50%',
            },
            title: `${assistant.name} (${assistant.model})`
          }
        : { 
            icon: <RobotOutlined />, 
            style: { 
              background: '#1890ff', 
              color: '#fff',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16
            },
            title: assistant?.model || 'AI Assistant'
          },
      typing: { step: 5, interval: 20 },
      style: { 
        maxWidth: '80%',
        minWidth: 120,
        margin: '8px 0',
        borderRadius: '18px',
        padding: '12px 16px',
        background: '#f5f5f5',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      },
    },
    local: {
      placement: 'end',
      avatar: { 
        icon: <UserOutlined />, 
        style: { 
          background: '#52c41a', 
          color: '#fff',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16
        },
        title: 'You'
      },
      style: {
        maxWidth: '80%',
        minWidth: 120,
        margin: '8px 0',
        borderRadius: '18px',
        padding: '12px 16px',
        background: '#1890ff',
        color: 'white',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
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
    <div className="chat-container page-container chat-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="chat-header" style={{ padding: '16px 32px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
        <div style={{ maxWidth: '100%', margin: 0, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
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
              <Tooltip title={availableCollections.length > 0 ? "Add data collection to enhance chat" : "No data collections available"}>
                <Select
                  placeholder={availableCollections.length > 0 ? "Add data collection..." : "No collections available"}
                  style={{ width: 250 }}
                  loading={collectionsLoading}
                  value={selectedCollection || undefined}
                  onChange={(value) => setSelectedCollection(value || null)}
                  options={availableCollections.map(c => ({
                    value: c.id,
                    label: c.name
                  }))}
                  allowClear={!!selectedCollection}
                  onClear={() => setSelectedCollection(null)}
                  disabled={availableCollections.length === 0}
                />
              </Tooltip>
            </Space>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
        <div 
          id="chat-messages"
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px', 
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
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
              <RobotOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <Typography.Title level={4} style={{ marginBottom: 8 }}>
                Chat with {assistant.name}
              </Typography.Title>
              <Typography.Text type="secondary">
                {selectedCollection 
                  ? `Ask questions about the data in ${collections.find(c => c.id === selectedCollection)?.name}`
                  : 'Ask me anything or add a data collection to enhance the chat'
                }
              </Typography.Text>
              {!selectedCollection && availableCollections.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Button 
                    type="primary" 
                    icon={<DatabaseOutlined />}
                    onClick={() => document.querySelector('.ant-select-selection-search-input')?.focus()}
                  >
                    Add Data Collection
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {transcriptRef.current.map((msg, index) => (
                <div 
                  key={index} 
                  style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={roles[msg.role === 'assistant' ? 'ai' : 'local'].avatar.style}>
                    {msg.role === 'assistant' ? (
                      assistant?.model_icon ? (
                        <img 
                          src={assistant.model_icon} 
                          alt={assistant.name}
                          style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                        />
                      ) : (
                        <RobotOutlined />
                      )
                    ) : (
                      <UserOutlined />
                    )}
                  </div>
                  <div 
                    style={{
                      ...roles[msg.role === 'assistant' ? 'ai' : 'local'].style,
                      maxWidth: '80%',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSending && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  marginTop: '8px'
                }}>
                  <div style={roles.ai.avatar.style}>
                    {assistant?.model_icon ? (
                      <img 
                        src={assistant.model_icon} 
                        alt={assistant.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                      />
                    ) : (
                      <RobotOutlined />
                    )}
                  </div>
                  <>
                    <style>{keyframes}</style>
                    <div style={{
                      ...roles.ai.style,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#666',
                      padding: '12px 16px'
                    }}>
                      <div style={loadingDotsStyle}>
                        <span style={{ ...dotStyle, animationDelay: '-0.32s' }}></span>
                        <span style={{ ...dotStyle, animationDelay: '-0.16s' }}></span>
                        <span style={dotStyle}></span>
                      </div>
                      <span>Thinking</span>
                    </div>
                  </>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #f0f0f0', 
          background: '#fff',
          position: 'sticky',
          bottom: 0,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.03)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'flex-end',
            gap: '8px',
            maxWidth: '1000px',
            margin: '0 auto',
            width: '100%'
          }}>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (input.trim()) {
                    handleSendMessage(input);
                  }
                }
              }}
              placeholder={
                selectedCollection 
                  ? `Ask about the data in ${collections.find(c => c.id === selectedCollection)?.name}...` 
                  : `Message ${assistant.name}... (or add a data collection above)`
              }
              autoSize={{ minRows: 1, maxRows: 6 }}
              style={{ 
                flex: 1,
                borderRadius: '20px',
                padding: '12px 16px',
                resize: 'none',
                border: '1px solid #d9d9d9',
                boxShadow: 'none',
                fontSize: '15px',
                lineHeight: 1.5
              }}
              disabled={isSending || assistantLoading}
            />
            <Button 
              type="primary" 
              shape="circle" 
              icon={<SendOutlined />} 
              onClick={() => input.trim() && handleSendMessage(input)}
              loading={isSending}
              disabled={!input.trim() || isSending || assistantLoading}
              style={{ 
                width: '40px', 
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            />
          </div>
          <div style={{ 
            textAlign: 'center', 
            marginTop: '8px',
            fontSize: '12px',
            color: '#999'
          }}>
            {selectedCollection && (
              <span>
                <DatabaseOutlined /> Chatting with <strong>{collections.find(c => c.id === selectedCollection)?.name}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
