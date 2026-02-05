import React, { useEffect, useState } from 'react';
import { 
  Card, Typography, Space, Tag, Descriptions, Statistic, Row, Col, 
  Table, Badge, Spin, Result, Button, Breadcrumb, Avatar, Progress,
  Divider
} from 'antd';
import { 
  UserOutlined, TeamOutlined, RobotOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ArrowLeftOutlined,
  ThunderboltOutlined, DatabaseOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { getUserProfile } from '../services/api';

const { Title, Text } = Typography;

const getPriorityColor = (level) => {
  if (level >= 8) return 'purple';
  if (level >= 5) return 'gold';
  if (level >= 3) return 'blue';
  return 'default';
};

const roleColors = {
  member: 'default',
  admin: 'blue',
  owner: 'gold'
};

const formatLimit = (value, suffix = '') => {
  if (value === null || value === undefined) return <Text type="success">Unlimited</Text>;
  if (value === -1) return <Text type="danger">Disabled</Text>;
  return <Text>{value.toLocaleString()}{suffix}</Text>;
};

function UserProfile() {
  const { userId } = useParams();
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (initialized && keycloak.authenticated && userId) {
        try {
          setLoading(true);
          const data = await getUserProfile(keycloak, userId);
          setProfile(data);
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchProfile();
  }, [initialized, keycloak, userId]);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Result
          status="error"
          title="Failed to load profile"
          subTitle={error}
          extra={
            <Button type="primary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const assistantColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Model',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'running' ? 'green' : status === 'stopped' ? 'red' : 'default'}>
          {status?.toUpperCase() || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
  ];

  const groupColumns = [
    {
      title: 'Group',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <TeamOutlined style={{ color: '#8b5cf6' }} />
          <Text strong>{name}</Text>
          <Tag color={getPriorityColor(record.priority_level)}>P{record.priority_level}</Tag>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <Tag color={roleColors[role]}>{role}</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'joined_at',
      key: 'joined_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)}
            style={{ borderRadius: 10 }}
          >
            Back
          </Button>
          <Breadcrumb 
            items={[
              { title: <Link to="/users">Users</Link> },
              { title: profile.username }
            ]}
          />
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: profile.enabled ? '#3b82f6' : '#94a3b8' }} />
        <div>
          <Title level={2} style={{ margin: 0, color: '#0f172a' }}>{profile.username}</Title>
          <Space>
            <Text type="secondary">{profile.email}</Text>
            <Badge 
              status={profile.enabled ? 'success' : 'error'} 
              text={profile.enabled ? 'Active' : 'Disabled'} 
            />
          </Space>
        </div>
      </div>

      <Row gutter={24}>
        {/* Left Column - Stats & Info */}
        <Col xs={24} lg={8}>
          {/* Quick Stats */}
          <Card 
            style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}
            title={<Space><ThunderboltOutlined style={{ color: '#f59e0b' }} /> Overview</Space>}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic 
                  title="Assistants" 
                  value={profile.stats?.total_assistants || 0}
                  prefix={<RobotOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="Running" 
                  value={profile.stats?.running_assistants || 0}
                  valueStyle={{ color: '#10b981' }}
                />
              </Col>
            </Row>
            <Divider style={{ margin: '16px 0' }} />
            <Row gutter={16}>
              <Col span={24}>
                <Statistic 
                  title="Groups" 
                  value={profile.stats?.total_groups || 0}
                  prefix={<TeamOutlined />}
                />
              </Col>
            </Row>
          </Card>

          {/* User Info */}
          <Card 
            style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}
            title={<Space><UserOutlined style={{ color: '#3b82f6' }} /> User Information</Space>}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="User ID">
                <Text copyable style={{ fontSize: 12 }}>{profile.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Username">{profile.username}</Descriptions.Item>
              <Descriptions.Item label="Email">{profile.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="First Name">{profile.firstName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Last Name">{profile.lastName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                {profile.enabled ? (
                  <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
                ) : (
                  <Tag icon={<CloseCircleOutlined />} color="error">Disabled</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {profile.createdTimestamp ? new Date(profile.createdTimestamp).toLocaleDateString() : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Effective Limits */}
          <Card 
            style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
            title={<Space><DatabaseOutlined style={{ color: '#10b981' }} /> Effective Limits</Space>}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Max Assistants">{formatLimit(profile.effective_limits?.max_assistants_created)}</Descriptions.Item>
              <Descriptions.Item label="Concurrent Running">{formatLimit(profile.effective_limits?.max_assistants_running)}</Descriptions.Item>
              <Descriptions.Item label="Data Collections">{formatLimit(profile.effective_limits?.max_data_collections)}</Descriptions.Item>
              <Descriptions.Item label="Storage">{formatLimit(profile.effective_limits?.max_storage_mb, ' MB')}</Descriptions.Item>
              <Descriptions.Item label="Daily Tokens">{formatLimit(profile.effective_limits?.daily_token_limit)}</Descriptions.Item>
              <Descriptions.Item label="Monthly Tokens">{formatLimit(profile.effective_limits?.monthly_token_limit)}</Descriptions.Item>
              <Descriptions.Item label="Max Model Size">{formatLimit(profile.effective_limits?.max_model_size_gb, ' GB')}</Descriptions.Item>
              <Descriptions.Item label="GPU Memory">{formatLimit(profile.effective_limits?.max_gpu_memory_gb, ' GB')}</Descriptions.Item>
            </Descriptions>
            {profile.groups?.length === 0 && (
              <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                No group membership. Default limits apply.
              </Text>
            )}
          </Card>
        </Col>

        {/* Right Column - Groups & Assistants */}
        <Col xs={24} lg={16}>
          {/* Groups */}
          <Card 
            style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}
            title={<Space><TeamOutlined style={{ color: '#8b5cf6' }} /> Groups ({profile.groups?.length || 0})</Space>}
          >
            {profile.groups?.length > 0 ? (
              <Table 
                dataSource={profile.groups}
                columns={groupColumns}
                rowKey="id"
                size="small"
                pagination={false}
              />
            ) : (
              <Text type="secondary">Not a member of any groups</Text>
            )}
          </Card>

          {/* Assistants */}
          <Card 
            style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
            title={<Space><RobotOutlined style={{ color: '#3b82f6' }} /> Assistants ({profile.assistants?.length || 0})</Space>}
          >
            {profile.assistants?.length > 0 ? (
              <Table 
                dataSource={profile.assistants}
                columns={assistantColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
              />
            ) : (
              <Text type="secondary">No assistants created</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default UserProfile;
