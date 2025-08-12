// src/pages/Chat.js
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { Flex, Breadcrumb, Typography, Avatar, Card, Divider, Tag, message as antdMessage } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { Bubble, Sender, useXAgent, useXChat } from '@ant-design/x';
import { sendChatMessage, fetchAssistant } from '../services/api';

const { Title } = Typography;

function Chat() {
  const { assistantId } = useParams();
  const { keycloak, initialized } = useKeycloak();

  const [input, setInput] = useState('');
  const [assistant, setAssistant] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(true);

  // Canonical transcript we send to backend
  const transcriptRef = useRef([]);

  // Load assistant meta (name, model, icon)
  useEffect(() => {
    let cancelled = false;
    async function load() {
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
    load();
    // reset transcript when switching assistants
    transcriptRef.current = [];
    return () => { cancelled = true; };
  }, [assistantId, initialized, keycloak]);

  // Dynamic roles: show model icon for AI if available
  const roles = useMemo(() => ({
    ai: {
      placement: 'start',
      avatar: assistant?.model_icon
        ? {
          src: assistant.model_icon, style: {
            backgroundColor: '#fff',
            border: '1px solid #d9d9d9',
            padding: 8,               // gives breathing space
            objectFit: 'contain',
          }
        }
        : { icon: <UserOutlined />, style: { background: '#fde3cf' } },
      typing: { step: 5, interval: 20 },
      style: { maxWidth: 600 },
    },
    local: {
      placement: 'end',
      avatar: { icon: <UserOutlined />, style: { background: '#87d068' } },
    },
  }), [assistant?.model_icon]);

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

  return (
    <>
      <Breadcrumb
        items={[
          { title: <Link to="/assistants">Assistants</Link> },
          { title: assistantLoading ? 'Loading…' : (assistant?.name || `#${assistantId}`) },
        ]}
        style={{ marginBottom: 12 }}
      />


      <Card className="modern-card" >
        <Flex align="center" gap={12} style={{ padding: '0 16px 8px' }}>
          <Avatar
            src={assistant?.model_icon}
            icon={!assistant?.model_icon ? <UserOutlined /> : undefined}
            style={{
              backgroundColor: '#fff',
              border: '1px solid #d9d9d9',
              padding: 8,            
              objectFit: 'contain',
            }}
            shape="circle"
            size={42}
          />
          <Title level={3} style={{ margin: 0 }}>
            {assistantLoading ? 'Loading…' : (assistant?.name || `Assistant ${assistantId}`)}
          </Title>
          {assistant?.model && (
            <Tag style={{ marginLeft: 8 }}>{assistant.model}</Tag>
          )}
        </Flex>

        <Divider />
        <Flex vertical gap="middle" style={{ height: '100%', padding: 16 }}>
          <Bubble.List
            roles={roles}
            style={{ maxHeight: 480 }}
            items={messages.map(({ id, message, status }) => ({
              key: id,
              loading: status === 'loading',
              role: status === 'local' ? 'local' : 'ai',
              content: message,
            }))}
          />
          <Sender
            loading={agent.isRequesting()}
            value={input}
            onChange={setInput}
            onSubmit={(text) => {
              const trimmed = (text || '').trim();
              if (!trimmed) return;
              if (!initialized || !keycloak?.authenticated) {
                antdMessage.error('Please log in to chat.');
                return;
              }
              onRequest(trimmed);
              setInput('');
            }}
          />
        </Flex>
      </Card>
    </>
  );
}

export default Chat;
