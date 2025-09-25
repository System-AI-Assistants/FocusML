// src/pages/Chat.js
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { Typography, Divider, message as antdMessage, Select, Space, Tooltip, Card, Spin } from 'antd';
import { DatabaseOutlined, InfoCircleOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { Input, Button, List, Avatar } from 'antd';
import { sendChatMessage, fetchAssistant } from '../services/api';
import { queryWithRAG, getDataCollections } from '../services/ragService';

const { Title } = Typography;

function Chat() {
  const { assistantId } = useParams();
  const location = useLocation();
  const { keycloak, initialized } = useKeycloak();

  const [input, setInput] = useState('');
  const [assistant, setAssistant] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(true);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isRAGEnabled, setIsRAGEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const messagesEndRef = useRef(null);

  // Load assistant and collections
  useEffect(() => {
    let cancelled = false;
    
    const loadData = async () => {
      if (!initialized || !keycloak?.authenticated || !assistantId) return;
      
      setIsLoading(true);
      
      try {
        // Load assistant data
        const [assistantData, collectionsData] = await Promise.all([
          fetchAssistant(keycloak, assistantId),
          getDataCollections(keycloak)
        ]);
        
        if (!cancelled) {
          setAssistant(assistantData);
          setCollections(collectionsData);
          
          // If we came from a collection, pre-select it
          const collectionId = new URLSearchParams(location.search).get('collectionId');
          if (collectionId) {
            const collection = collectionsData.find(c => c.id.toString() === collectionId);
            if (collection) {
              setSelectedCollection(collection.id);
              setIsRAGEnabled(true);
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading data:', error);
          antdMessage.error(error.message || 'Failed to load data');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setAssistantLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      cancelled = true;
    };
  }, [assistantId, initialized, keycloak, location.search]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // Handle sending a message
  const handleSend = useCallback(async (messageText) => {
    if (!messageText?.trim() || isLoading) return;

    try {
      setIsLoading(true);
      
      // Add user message to transcript
      const userMessage = { 
        role: 'user', 
        content: messageText,
        timestamp: new Date().toISOString()
      };
      
      const updatedTranscript = [...transcript, userMessage];
      setTranscript(updatedTranscript);
      setInput('');
      
      let response;
      
      try {
        if (isRAGEnabled && selectedCollection) {
          // Use RAG with the selected collection
          console.log('Sending RAG query with:', {
            collectionId: selectedCollection,
            query: messageText,
            assistantId: assistantId,
            topK: 3,
            model: 'mistral:7b'
          });
          
          const ragResponse = await queryWithRAG(
            keycloak, 
            selectedCollection, // collectionId
            messageText,        // query
            assistantId,        // assistantId
            3,                  // topK
            'mistral:7b'        // model
          );
          
          console.log('RAG response:', ragResponse);
          
          response = {
            message: ragResponse.response,
            sources: ragResponse.sources || []
          };
        } else {
          // Format messages for the API
          const apiMessages = updatedTranscript.map(({ role, content }) => ({
            role,
            content
          }));
          
          const chatResponse = await sendChatMessage(keycloak, assistantId, apiMessages);
          response = {
            message: chatResponse.message,
            sources: []
          };
        }
        
        // Add AI response to transcript
        const assistantMessage = {
          role: 'assistant',
          content: response.message,
          sources: response.sources || [],
          timestamp: new Date().toISOString()
        };
        
        setTranscript(prev => [...prev, assistantMessage]);
        
      } catch (error) {
        console.error('Error in chat:', error);
        antdMessage.error(error.message || 'Failed to process your message');
      }
      
    } catch (error) {
      console.error('Error in handleSend:', error);
      antdMessage.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [assistantId, isRAGEnabled, keycloak, selectedCollection, transcript]);

  const renderMessageContent = (message) => {
    return (
      <Card 
        size="small"
        style={{ 
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div className="message-content">
          {message.content}
          
          {message.sources && message.sources.length > 0 && (
            <div className="sources-section" style={{ marginTop: 16 }}>
              <Divider style={{ margin: '12px 0' }}>
                <span style={{ fontSize: '0.8em', color: '#666' }}>Sources</span>
              </Divider>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {message.sources.map((source, index) => (
                  <Card 
                    key={index} 
                    size="small" 
                    style={{ 
                      marginBottom: 8,
                      borderLeft: '3px solid #1890ff',
                      borderRadius: 4
                    }}
                    bodyStyle={{ padding: '8px 12px' }}
                  >
                    <div style={{ fontSize: '0.85em', lineHeight: 1.5 }}>
                      {source.content?.substring(0, 300)}
                      {source.content?.length > 300 ? '...' : ''}
                    </div>
                    {source.distance !== undefined && (
                      <div style={{ 
                        fontSize: '0.75em', 
                        color: '#888', 
                        marginTop: 4,
                        fontStyle: 'italic'
                      }}>
                        Similarity: {(1 - source.distance).toFixed(2)}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (assistantLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 24px', 
        backgroundColor: '#fff',
        borderBottom: '1px solid #f0f0f0',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>
              {assistant?.name || 'Chat Assistant'}
            </h2>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {isRAGEnabled ? 'RAG Mode: Enabled' : 'Standard Chat Mode'}
            </div>
          </div>
          
          <Space>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <DatabaseOutlined style={{ marginRight: 8, color: '#666' }} />
              <Select
                style={{ width: 200 }}
                placeholder="Select a collection"
                value={selectedCollection}
                onChange={(value) => {
                  setSelectedCollection(value);
                  setIsRAGEnabled(!!value);
                }}
                disabled={isLoading}
                options={collections.map(c => ({
                  value: c.id,
                  label: c.name,
                  disabled: c.embeddings_status !== 'completed'
                }))}
                optionRender={(option) => (
                  <div>
                    {option.data.label}
                    {option.data.disabled && (
                      <Tooltip title="This collection doesn't have embeddings yet">
                        <InfoCircleOutlined style={{ marginLeft: 8, color: '#ff4d4f' }} />
                      </Tooltip>
                    )}
                  </div>
                )}
              />
            </div>
            
            {selectedCollection && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                backgroundColor: isRAGEnabled ? '#e6f7ff' : '#f5f5f5',
                padding: '4px 12px',
                borderRadius: 4,
                border: `1px solid ${isRAGEnabled ? '#91d5ff' : '#d9d9d9'}`,
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onClick={() => setIsRAGEnabled(!isRAGEnabled)}
              >
                <input
                  type="checkbox"
                  id="ragToggle"
                  checked={isRAGEnabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    setIsRAGEnabled(e.target.checked);
                  }}
                  style={{ 
                    marginRight: 8,
                    cursor: 'pointer'
                  }}
                />
                <label 
                  htmlFor="ragToggle" 
                  style={{ 
                    margin: 0, 
                    cursor: 'pointer',
                    color: isRAGEnabled ? '#1890ff' : '#666',
                    fontWeight: isRAGEnabled ? 500 : 'normal'
                  }}
                >
                  RAG
                </label>
              </div>
            )}
          </Space>
        </div>
      </div>
      
      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '24px',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <List
            dataSource={transcript}
            renderItem={(message) => (
              <List.Item style={{ 
                padding: '12px 0',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{ 
                  display: 'flex',
                  flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  maxWidth: '80%'
                }}>
                  <Avatar 
                    style={{ 
                      backgroundColor: message.role === 'user' ? '#52c41a' : '#1890ff',
                      margin: '0 8px'
                    }}
                    icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  />
                  {renderMessageContent(message)}
                </div>
              </List.Item>
            )}
          />
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Input Area */}
      <div style={{ 
        padding: '16px 24px',
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        boxShadow: '0 -1px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ 
          maxWidth: 800, 
          margin: '0 auto',
          display: 'flex',
          gap: '8px'
        }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <Button 
            type="primary" 
            onClick={() => handleSend(input)}
            loading={isLoading}
            disabled={!input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
      
      {/* Status Bar */}
      <div style={{ 
        padding: '8px 24px',
        backgroundColor: '#fff',
        borderTop: '1px solid #f0f0f0',
        fontSize: 12,
        color: '#999',
        textAlign: 'right'
      }}>
        {isRAGEnabled && selectedCollection ? (
          <span>
            Querying collection: <strong>{
              collections.find(c => c.id === selectedCollection)?.name || 'Unknown'
            }</strong>
          </span>
        ) : 'Standard chat mode'}
      </div>
    </div>
  );
}

export default Chat;
