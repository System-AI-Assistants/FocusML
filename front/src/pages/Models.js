import React, { useEffect, useState, useCallback } from 'react';
import { Card, Table, Button, Space, Typography, Tag, message, Modal, List } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CodeSandboxOutlined, ApiOutlined, MessageOutlined } from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';
import { getAssistants, getAssistantEndpoints } from '../services/api';
import './Models.css';

const { Title } = Typography;

function Assistants() {
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEndpointsModalVisible, setIsEndpointsModalVisible] = useState(false);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [endpointsLoading, setEndpointsLoading] = useState(false);

  const fetchAssistants = useCallback(async () => {
    if (initialized && keycloak.authenticated) {
      try {
        setLoading(true);
        const data = await getAssistants(keycloak);
        setAssistants(data);
      } catch (err) {
        message.error('Failed to fetch assistants.');
        console.error('Fetch assistants error:', err);
      } finally {
        setLoading(false);
      }
    } else {
      console.warn('Keycloak not initialized or not authenticated');
    }
  }, [initialized, keycloak]);

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const handleOpenChat = (assistantId) => {
    navigate(`/chat/${assistantId}`);
  };

  const handleViewEndpoints = async (assistant) => {
    setSelectedAssistant(assistant);
    setIsEndpointsModalVisible(true);
    setEndpointsLoading(true);
    try {
      const data = await getAssistantEndpoints(keycloak, assistant.id);
      setEndpoints(data);
    } catch (err) {
      message.error('Failed to fetch API endpoints.');
      console.error('Fetch endpoints error:', err);
    } finally {
      setEndpointsLoading(false);
    }
  };

  const handleEndpointsModalClose = () => {
    setIsEndpointsModalVisible(false);
    setSelectedAssistant(null);
    setEndpoints([]);
  };

  const handleDelete = async (id) => {
    message.warning('Delete functionality not implemented yet.');
    // If a delete endpoint is added, implement it here:
    /*
    try {
      await axios.delete(`${API_URL}/api/assistants/${id}`, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      message.success('Assistant deleted');
      fetchAssistants();
    } catch (err) {
      message.error('Failed to delete assistant');
      console.error('Delete assistant error:', err);
    }
    */
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <CodeSandboxOutlined style={{ color: 'var(--color-accent)' }} />
          <span style={{ fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (version) => version || 'N/A',
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage) => (
        <Tag color={stage === 'production' ? 'green' : stage === 'staging' ? 'blue' : 'orange'}>
          {stage ? stage.toUpperCase() : 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Location',
      dataIndex: 'is_local',
      key: 'is_local',
      render: (is_local) => (
        <Tag color={is_local ? 'purple' : 'cyan'}>
          {is_local ? 'Local' : 'Cloud'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'create_time',
      key: 'create_time',
      render: (create_time) => new Date(create_time).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            icon={<MessageOutlined />}
            onClick={() => handleOpenChat(record.id)}
            title="Open Chat"
          />
          <Button
            icon={<ApiOutlined />}
            onClick={() => handleViewEndpoints(record)}
            title="View API Endpoints"
          />
          <Button icon={<EditOutlined />} disabled title="Edit functionality not implemented" />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="models-page-container">
      <div className="models-page-header">
        <Title level={2} style={{ margin: 0 }}>Assistants</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/models/add')}>
          Add Assistant
        </Button>
      </div>
      <Card className="modern-card">
        <Table
          dataSource={assistants}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>
      <Modal
        title={`API Endpoints for ${selectedAssistant?.name || 'Assistant'}`}
        open={isEndpointsModalVisible}
        onCancel={handleEndpointsModalClose}
        footer={null}
        width={600}
      >
        {endpointsLoading ? (
          <div>Loading endpoints...</div>
        ) : endpoints.length > 0 ? (
          <List
            dataSource={endpoints}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<span><Tag>{item.method}</Tag> {item.endpoint}</span>}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        ) : (
          <div>No endpoints available.</div>
        )}
      </Modal>
    </div>
  );
}

export default Assistants;