import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tabs,
  InputNumber,
  Popconfirm,
  Tooltip,
  Divider,
  Alert,
  Switch,
  Descriptions,
  Badge,
  Empty,
  Collapse
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  ApiOutlined,
  BarChartOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  LockOutlined,
  GlobalOutlined,
  CopyTwoTone,
  MessageOutlined,
  SettingOutlined,
  BgColorsOutlined,
  HistoryOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  toggleAPIKey,
  getAPIKeyStatistics,
  getAssistantStatistics,
  addWhitelistEntry,
  listWhitelistEntries,
  removeWhitelistEntry,
  getAssistants,
  getAssistantEndpoints,
  createWidget,
  getWidgets,
  updateWidget,
  deleteWidget,
  regenerateWidgetToken,
  getWidgetSessions,
  getWidgetSessionMessages,
  getWidgetStatistics,
  getWidgetEmbedCode
} from '../services/api';
import './Integration.css';

// Date formatting helper
const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const formatDateShort = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const API_BASE_URL = 'http://localhost:8000';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

function Integration() {
  const { keycloak } = useKeycloak();
  const [apiKeys, setApiKeys] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [whitelistEntries, setWhitelistEntries] = useState([]);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [copiedKey, setCopiedKey] = useState(null);
  const [fullKeys, setFullKeys] = useState(new Map()); // Store full keys temporarily (keyId -> fullKey)
  const [testResponse, setTestResponse] = useState(null); // Store test response
  const [testLoading, setTestLoading] = useState(false);

  // Widget states
  const [widgets, setWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [widgetStatistics, setWidgetStatistics] = useState(null);
  const [widgetSessions, setWidgetSessions] = useState([]);
  const [widgetFullTokens, setWidgetFullTokens] = useState(new Map());
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [embedCode, setEmbedCode] = useState(null);
  const [mainTab, setMainTab] = useState('api'); // 'api' or 'widget'
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [customWidgetUrl, setCustomWidgetUrl] = useState('');

  // Modal states
  const [createKeyModalVisible, setCreateKeyModalVisible] = useState(false);
  const [whitelistModalVisible, setWhitelistModalVisible] = useState(false);
  const [codeSnippetModalVisible, setCodeSnippetModalVisible] = useState(false);
  const [playgroundModalVisible, setPlaygroundModalVisible] = useState(false);
  const [createWidgetModalVisible, setCreateWidgetModalVisible] = useState(false);
  const [widgetEmbedModalVisible, setWidgetEmbedModalVisible] = useState(false);
  const [widgetSessionsModalVisible, setWidgetSessionsModalVisible] = useState(false);

  // Forms
  const [createKeyForm] = Form.useForm();
  const [whitelistForm] = Form.useForm();
  const [playgroundForm] = Form.useForm();
  const [createWidgetForm] = Form.useForm();

  useEffect(() => {
    fetchAssistants();
    fetchAPIKeys();
    fetchWidgets();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      fetchStatistics();
      fetchWhitelistEntries();
    }
  }, [selectedKey]);

  useEffect(() => {
    if (selectedWidget) {
      fetchWidgetStats();
      fetchWidgetSessionsList();
    }
  }, [selectedWidget]);

  const fetchAssistants = async () => {
    try {
      const data = await getAssistants(keycloak);
      setAssistants(data);
    } catch (error) {
      message.error('Failed to fetch assistants');
    }
  };

  const fetchAPIKeys = async (assistantId = null) => {
    setLoading(true);
    try {
      const data = await listAPIKeys(keycloak, assistantId);
      setApiKeys(data);
    } catch (error) {
      message.error('Failed to fetch API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    if (!selectedKey) return;
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const data = await getAPIKeyStatistics(keycloak, selectedKey.id, startDate, endDate);
      setStatistics(data);
    } catch (error) {
      message.error('Failed to fetch statistics');
    }
  };

  const fetchWhitelistEntries = async () => {
    if (!selectedKey) return;
    try {
      const data = await listWhitelistEntries(keycloak, selectedKey.id);
      setWhitelistEntries(data);
    } catch (error) {
      message.error('Failed to fetch whitelist entries');
    }
  };

  const handleCreateKey = async (values) => {
    try {
      const apiKeyData = {
        assistant_id: values.assistant_id,
        name: values.name,
        expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
        usage_quota: values.usage_quota || null,
        usage_period: values.usage_period || null,
      };
      const response = await createAPIKey(keycloak, apiKeyData);

      // Store the full key temporarily
      setFullKeys(prev => new Map(prev).set(response.id, response.full_key));

      message.success('API key created successfully!');
      setCreateKeyModalVisible(false);
      createKeyForm.resetFields();

      // Show the full key in a modal
      Modal.info({
        title: 'API Key Created',
        width: 700,
        content: (
          <div>
            <Alert
              message="Important: Copy your API key now. You won't be able to see it again!"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong>Your API Key:</Text>
            </div>
            <Input.Group compact style={{ display: 'flex', marginBottom: 16 }}>
              <Input
                value={response.full_key}
                readOnly
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  wordBreak: 'break-all'
                }}
              />
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(response.full_key);
                  message.success('API key copied to clipboard!');
                }}
                style={{ minWidth: 100 }}
              >
                Copy Key
              </Button>
            </Input.Group>
            <Alert
              message="This key will be stored temporarily in your browser session for use in code snippets. Refresh the page to clear it."
              type="info"
              showIcon
            />
          </div>
        ),
        okText: 'I\'ve copied it',
      });

      fetchAPIKeys();
    } catch (error) {
      message.error(error.message || 'Failed to create API key');
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      await revokeAPIKey(keycloak, keyId);
      message.success('API key revoked successfully');
      fetchAPIKeys();
      if (selectedKey?.id === keyId) {
        setSelectedKey(null);
      }
    } catch (error) {
      message.error(error.message || 'Failed to revoke API key');
    }
  };

  const handleToggleKey = async (keyId) => {
    try {
      await toggleAPIKey(keycloak, keyId);
      message.success('API key status updated');
      fetchAPIKeys();
    } catch (error) {
      message.error(error.message || 'Failed to toggle API key');
    }
  };

  const handleAddWhitelist = async (values) => {
    try {
      await addWhitelistEntry(keycloak, selectedKey.id, values);
      message.success('Whitelist entry added');
      setWhitelistModalVisible(false);
      whitelistForm.resetFields();
      fetchWhitelistEntries();
    } catch (error) {
      message.error(error.message || 'Failed to add whitelist entry');
    }
  };

  const handleRemoveWhitelist = async (entryId) => {
    try {
      await removeWhitelistEntry(keycloak, selectedKey.id, entryId);
      message.success('Whitelist entry removed');
      fetchWhitelistEntries();
    } catch (error) {
      message.error(error.message || 'Failed to remove whitelist entry');
    }
  };

  // Widget handlers
  const fetchWidgets = async () => {
    try {
      const data = await getWidgets(keycloak);
      setWidgets(data);
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    }
  };

  const fetchWidgetStats = async () => {
    if (!selectedWidget) return;
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const data = await getWidgetStatistics(
        keycloak,
        selectedWidget.id,
        thirtyDaysAgo.toISOString(),
        now.toISOString()
      );
      setWidgetStatistics(data);
    } catch (error) {
      console.error('Failed to fetch widget statistics:', error);
    }
  };

  const fetchWidgetSessionsList = async () => {
    if (!selectedWidget) return;
    try {
      const data = await getWidgetSessions(keycloak, selectedWidget.id);
      setWidgetSessions(data);
    } catch (error) {
      console.error('Failed to fetch widget sessions:', error);
    }
  };

  const handleCreateWidget = async (values) => {
    try {
      const widgetData = {
        assistant_id: values.assistant_id,
        name: values.name,
        position: values.position || 'bottom-right',
        primary_color: values.primary_color || '#1890ff',
        button_size: values.button_size || 60,
        start_message: values.start_message || null,
        placeholder_text: values.placeholder_text || 'Type a message...',
        allow_attachments: values.allow_attachments || false,
        enable_persistence: values.enable_persistence !== false,
        window_title: values.window_title || 'Chat with us',
        allowed_domains: values.allowed_domains ? values.allowed_domains.split(',').map(d => d.trim()).filter(d => d) : [],
      };
      const response = await createWidget(keycloak, widgetData);

      // Store the full token
      setWidgetFullTokens(prev => new Map(prev).set(response.id, response.full_token));

      message.success('Widget created successfully!');
      setCreateWidgetModalVisible(false);
      createWidgetForm.resetFields();
      fetchWidgets();

      // Show the embed code modal
      setSelectedWidget(response);
      setEmbedCode(null);
      handleGetEmbedCode(response.id);

    } catch (error) {
      message.error(error.message || 'Failed to create widget');
    }
  };

  const handleDeleteWidget = async (widgetId) => {
    try {
      await deleteWidget(keycloak, widgetId);
      message.success('Widget deleted successfully');
      fetchWidgets();
      if (selectedWidget?.id === widgetId) {
        setSelectedWidget(null);
      }
    } catch (error) {
      message.error(error.message || 'Failed to delete widget');
    }
  };

  const handleRegenerateWidgetToken = async (widgetId) => {
    try {
      const response = await regenerateWidgetToken(keycloak, widgetId);
      setWidgetFullTokens(prev => new Map(prev).set(response.id, response.full_token));
      message.success('Widget token regenerated!');
      fetchWidgets();

      Modal.info({
        title: 'New Widget Token',
        width: 600,
        content: (
          <div>
            <Alert
              message="Important: Update your website with the new token!"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Input.Password
              value={response.full_token}
              readOnly
              addonAfter={
                <CopyOutlined onClick={() => copyToClipboard(response.full_token)} style={{ cursor: 'pointer' }} />
              }
            />
          </div>
        ),
      });
    } catch (error) {
      message.error(error.message || 'Failed to regenerate token');
    }
  };

  const handleGetEmbedCode = async (widgetId) => {
    try {
      const data = await getWidgetEmbedCode(keycloak, widgetId);
      setEmbedCode(data);
      setWidgetEmbedModalVisible(true);
    } catch (error) {
      message.error(error.message || 'Failed to get embed code');
    }
  };

  const handleViewSessions = async (widget) => {
    setSelectedWidget(widget);
    setWidgetSessionsModalVisible(true);
    try {
      const data = await getWidgetSessions(keycloak, widget.id);
      setWidgetSessions(data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch sessions');
    }
  };

  const handleViewSessionMessages = async (session) => {
    setSelectedSession(session);
    try {
      const data = await getWidgetSessionMessages(keycloak, selectedWidget.id, session.session_id);
      setSessionMessages(data);
    } catch (error) {
      message.error(error.message || 'Failed to fetch messages');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  const generateCodeSnippet = (language, keyId, endpoint) => {
    // Try to get full key from stored keys, otherwise use placeholder
    const fullKey = fullKeys.get(keyId);
    const apiKey = fullKey || 'YOUR_API_KEY';
    const showPlaceholder = !fullKey;

    switch (language) {
      case 'curl':
        return `curl -X POST "${API_BASE_URL}${endpoint}" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`;
      case 'python':
        return `import requests

url = "${API_BASE_URL}${endpoint}"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
}
data = {
    "messages": [
        {"role": "user", "content": "Hello!"}
    ]
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`;
      case 'javascript':
        return `const response = await fetch("${API_BASE_URL}${endpoint}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    messages: [
      { role: "user", content: "Hello!" }
    ]
  })
});

const data = await response.json();
console.log(data);`;
      default:
        return '';
    }
  };

  const apiKeyColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Assistant',
      key: 'assistant',
      render: (_, record) => {
        const assistant = assistants.find(a => a.id === record.assistant_id);
        return assistant ? assistant.name : 'Unknown';
      },
    },
    {
      title: 'API Key',
      key: 'key',
      render: (_, record) => {
        const isVisible = visibleKeys.has(record.id);
        return (
          <Space>
            <Text code style={{ fontFamily: 'monospace' }}>
              {isVisible ? record.masked_key : '••••••••••••••••'}
            </Text>
            <Button
              type="text"
              size="small"
              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => {
                const newVisible = new Set(visibleKeys);
                if (isVisible) {
                  newVisible.delete(record.id);
                } else {
                  newVisible.add(record.id);
                }
                setVisibleKeys(newVisible);
              }}
            />
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_, record) => {
        if (record.usage_quota) {
          const percentage = (record.current_usage / record.usage_quota) * 100;
          return (
            <Text>
              {record.current_usage} / {record.usage_quota} ({percentage.toFixed(0)}%)
            </Text>
          );
        }
        return <Text>{record.current_usage} requests</Text>;
      },
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (date) => formatDate(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => setSelectedKey(record)}
          >
            View Details
          </Button>
          <Button
            size="small"
            onClick={() => handleToggleKey(record.id)}
          >
            {record.is_active ? 'Deactivate' : 'Activate'}
          </Button>
          <Popconfirm
            title="Are you sure you want to revoke this API key?"
            onConfirm={() => handleRevokeKey(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Revoke
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const widgetColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Assistant',
      key: 'assistant',
      render: (_, record) => {
        const assistant = assistants.find(a => a.id === record.assistant_id);
        return assistant ? assistant.name : 'Unknown';
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (position) => (
        <Tag>{position?.replace('-', ' ')}</Tag>
      ),
    },
    {
      title: 'Sessions',
      key: 'sessions',
      render: (_, record) => (
        <Space>
          <TeamOutlined />
          <Text>{record.total_sessions} total / {record.active_sessions} active</Text>
        </Space>
      ),
    },
    {
      title: 'Messages',
      dataIndex: 'total_messages',
      key: 'messages',
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used',
      render: (date) => date ? formatDateShort(date) : 'Never',
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<CodeOutlined />}
            onClick={() => handleGetEmbedCode(record.id)}
          >
            Embed
          </Button>
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => handleViewSessions(record)}
          >
            Sessions
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedWidget(record)}
          >
            Details
          </Button>
          <Popconfirm
            title="Delete this widget?"
            onConfirm={() => handleDeleteWidget(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="integration-container">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <ApiOutlined /> Integration Management
          </Title>
          <Paragraph type="secondary">
            Manage API keys, widgets, and configure access controls for your assistants
          </Paragraph>
        </div>

        <Tabs
          activeKey={mainTab}
          onChange={setMainTab}
          type="card"
          className="integration-tabs"
          items={[
            {
              key: 'api',
              label: (
                <span>
                  <ApiOutlined />
                  API Keys
                </span>
              ),
              children: (
                <>
                  <Card style={{ marginTop: 16 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                      <Title level={4}>API Keys</Title>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateKeyModalVisible(true)}
                      >
                        Create API Key
                      </Button>
                    </Space>

                    <Table
                      columns={apiKeyColumns}
                      dataSource={apiKeys}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 'max-content' }}
                    />
                  </Card>
                </>
              ),
            },
            {
              key: 'widget',
              label: (
                <span>
                  <MessageOutlined />
                  Chat Widget
                </span>
              ),
              children: (
                <>
                  <Card style={{ marginTop: 16 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                      <Title level={4}>Chat Widgets</Title>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateWidgetModalVisible(true)}
                      >
                        Create Widget
                      </Button>
                    </Space>

                    <Table
                      columns={widgetColumns}
                      dataSource={widgets}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 'max-content' }}
                    />
                  </Card>

                  {/* Widget Details */}
                  {selectedWidget && mainTab === 'widget' && (
                    <Card style={{ marginTop: 16 }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Title level={4}>{selectedWidget.name} - Details</Title>
                        <Button onClick={() => setSelectedWidget(null)}>Close</Button>
                      </Space>

                      <Tabs
                        items={[
                          {
                            key: 'overview',
                            label: 'Overview',
                            children: (
                              <Row gutter={16}>
                                <Col span={6}>
                                  <Statistic
                                    title="Total Sessions"
                                    value={widgetStatistics?.total_sessions || 0}
                                    prefix={<TeamOutlined />}
                                  />
                                </Col>
                                <Col span={6}>
                                  <Statistic
                                    title="Active Sessions"
                                    value={widgetStatistics?.active_sessions || 0}
                                    valueStyle={{ color: '#52c41a' }}
                                  />
                                </Col>
                                <Col span={6}>
                                  <Statistic
                                    title="Total Messages"
                                    value={widgetStatistics?.total_messages || 0}
                                    prefix={<MessageOutlined />}
                                  />
                                </Col>
                                <Col span={6}>
                                  <Statistic
                                    title="Avg Latency"
                                    value={widgetStatistics?.avg_latency_ms?.toFixed(0) || 0}
                                    suffix="ms"
                                  />
                                </Col>
                              </Row>
                            ),
                          },
                          {
                            key: 'config',
                            label: 'Configuration',
                            children: (
                              <Descriptions bordered column={2}>
                                <Descriptions.Item label="Position">{selectedWidget.position}</Descriptions.Item>
                                <Descriptions.Item label="Primary Color">
                                  <Space>
                                    <div style={{
                                      width: 20,
                                      height: 20,
                                      backgroundColor: selectedWidget.primary_color,
                                      borderRadius: 4,
                                      border: '1px solid #d9d9d9'
                                    }} />
                                    {selectedWidget.primary_color}
                                  </Space>
                                </Descriptions.Item>
                                <Descriptions.Item label="Window Title">{selectedWidget.window_title}</Descriptions.Item>
                                <Descriptions.Item label="Placeholder">{selectedWidget.placeholder_text}</Descriptions.Item>
                                <Descriptions.Item label="Start Message">{selectedWidget.start_message || 'None'}</Descriptions.Item>
                                <Descriptions.Item label="Attachments">{selectedWidget.allow_attachments ? 'Allowed' : 'Disabled'}</Descriptions.Item>
                                <Descriptions.Item label="Persistence">{selectedWidget.enable_persistence ? 'Enabled' : 'Disabled'}</Descriptions.Item>
                                <Descriptions.Item label="Session Timeout">{selectedWidget.session_timeout_hours}h</Descriptions.Item>
                                <Descriptions.Item label="Allowed Domains" span={2}>
                                  {selectedWidget.allowed_domains?.length > 0
                                    ? selectedWidget.allowed_domains.map(d => <Tag key={d}>{d}</Tag>)
                                    : <Text type="secondary">All domains (not recommended)</Text>
                                  }
                                </Descriptions.Item>
                              </Descriptions>
                            ),
                          },
                          {
                            key: 'token',
                            label: 'Token',
                            children: (
                              <Space direction="vertical" style={{ width: '100%' }}>
                                <Alert
                                  message="Widget Token"
                                  description="Use this token to authenticate your widget. Keep it secret!"
                                  type="info"
                                  showIcon
                                />
                                <Space>
                                  <Text code>{selectedWidget.masked_token}</Text>
                                  <Popconfirm
                                    title="Regenerate token? Your current embed code will stop working."
                                    onConfirm={() => handleRegenerateWidgetToken(selectedWidget.id)}
                                  >
                                    <Button icon={<ReloadOutlined />}>Regenerate</Button>
                                  </Popconfirm>
                                </Space>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  )}
                </>
              ),
            },
          ]}
        />

        {selectedKey && (
          <Card>
            <Tabs
              defaultActiveKey="overview"
              items={[
                {
                  key: 'overview',
                  label: 'Overview',
                  children: (
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="Name">{selectedKey.name}</Descriptions.Item>
                      <Descriptions.Item label="Status">
                        <Tag color={selectedKey.is_active ? 'success' : 'default'}>
                          {selectedKey.is_active ? 'Active' : 'Inactive'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Created">
                        {formatDate(selectedKey.created_at)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Last Used">
                        {formatDate(selectedKey.last_used_at)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Usage Quota">
                        {selectedKey.usage_quota
                          ? `${selectedKey.current_usage} / ${selectedKey.usage_quota} (${selectedKey.usage_period})`
                          : 'Unlimited'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Expires">
                        {formatDate(selectedKey.expires_at)}
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'statistics',
                  label: 'Statistics',
                  icon: <BarChartOutlined />,
                  children: statistics ? (
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Statistic
                            title="Total Requests"
                            value={statistics.total_requests}
                            prefix={<ApiOutlined />}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="Success Rate"
                            value={100 - statistics.error_rate}
                            suffix="%"
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="Avg Latency"
                            value={statistics.avg_latency_ms}
                            suffix="ms"
                            prefix={<ReloadOutlined />}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="Avg TTFT"
                            value={statistics.avg_ttft_ms || 0}
                            suffix="ms"
                            prefix={<PlayCircleOutlined />}
                          />
                        </Col>
                      </Row>

                      <Card title="Requests Over Time">
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={statistics.requests_over_time}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="timestamp"
                              tickFormatter={(value) => formatDateShort(value)}
                            />
                            <YAxis />
                            <RechartsTooltip
                              labelFormatter={(value) => formatDate(value)}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="count"
                              stroke="#8884d8"
                              fill="#8884d8"
                              fillOpacity={0.6}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Card>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Card title="Requests by Endpoint">
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={Object.entries(statistics.requests_by_endpoint).map(([name, value]) => ({ name, value }))}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip />
                                <Bar dataKey="value" fill="#8884d8" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Card>
                        </Col>
                        <Col span={12}>
                          <Card title="Error Breakdown">
                            {Object.keys(statistics.error_breakdown).length > 0 ? (
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Pie
                                    data={Object.entries(statistics.error_breakdown).map(([name, value]) => ({ name, value }))}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                  >
                                    {Object.entries(statistics.error_breakdown).map((_, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <Empty description="No errors" />
                            )}
                          </Card>
                        </Col>
                      </Row>
                    </Space>
                  ) : (
                    <Empty description="No statistics available" />
                  ),
                },
                {
                  key: 'whitelist',
                  label: 'Whitelist',
                  icon: <LockOutlined />,
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setWhitelistModalVisible(true)}
                      >
                        Add Entry
                      </Button>
                      <Table
                        dataSource={whitelistEntries}
                        rowKey="id"
                        columns={[
                          { title: 'Type', dataIndex: 'type', key: 'type' },
                          { title: 'Value', dataIndex: 'value', key: 'value' },
                          { title: 'Description', dataIndex: 'description', key: 'description' },
                          {
                            title: 'Actions',
                            key: 'actions',
                            render: (_, record) => (
                              <Button
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveWhitelist(record.id)}
                              >
                                Remove
                              </Button>
                            ),
                          },
                        ]}
                      />
                    </Space>
                  ),
                },
                {
                  key: 'code',
                  label: 'Code Snippets',
                  icon: <CodeOutlined />,
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Alert
                        message="Use these code snippets to integrate with your assistant"
                        type="info"
                        showIcon
                      />
                      {fullKeys.has(selectedKey.id) ? (
                        <Alert
                          message="Using your stored API key in code snippets"
                          type="success"
                          showIcon
                          style={{ marginBottom: 16 }}
                          action={
                            <Button
                              size="small"
                              onClick={() => {
                                setFullKeys(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(selectedKey.id);
                                  return newMap;
                                });
                                message.info('Full key removed from snippets. Using placeholder.');
                              }}
                            >
                              Clear
                            </Button>
                          }
                        />
                      ) : (
                        <Alert
                          message="No full key stored. Replace YOUR_API_KEY with your actual API key."
                          type="warning"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}
                      <Tabs
                        items={['curl', 'python', 'javascript'].map((lang) => {
                          const assistant = assistants.find(a => a.id === selectedKey.assistant_id);
                          const endpoint = assistant ? `/assistants/${assistant.id}/chat` : '/assistants/{id}/chat';
                          const snippet = generateCodeSnippet(lang, selectedKey.id, endpoint);
                          return {
                            key: lang,
                            label: lang.toUpperCase(),
                            children: (
                              <div>
                                <Space style={{ marginBottom: 16 }}>
                                  <Button
                                    icon={<CopyOutlined />}
                                    onClick={() => copyToClipboard(snippet)}
                                  >
                                    Copy Snippet
                                  </Button>
                                  {fullKeys.has(selectedKey.id) && (
                                    <Button
                                      icon={<CopyOutlined />}
                                      onClick={() => {
                                        copyToClipboard(fullKeys.get(selectedKey.id));
                                      }}
                                    >
                                      Copy API Key Only
                                    </Button>
                                  )}
                                </Space>
                                <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto', fontSize: '13px' }}>
                                  <code>{snippet}</code>
                                </pre>
                              </div>
                            ),
                          };
                        })}
                      />
                      <Divider />
                      <Card
                        title={
                          <Space>
                            <PlayCircleOutlined />
                            <span>Test API</span>
                          </Space>
                        }
                      >
                        <Form
                          form={playgroundForm}
                          layout="vertical"
                          onFinish={async (values) => {
                            try {
                              const assistant = assistants.find(a => a.id === selectedKey.assistant_id);
                              if (!assistant) {
                                message.error('Assistant not found');
                                return;
                              }

                              // Use full key if available, otherwise show error
                              const apiKeyToUse = fullKeys.get(selectedKey.id);
                              if (!apiKeyToUse) {
                                message.error('Please create a new API key to test. Full keys are only shown once after creation.');
                                return;
                              }

                              setTestLoading(true);
                              setTestResponse(null);
                              message.loading({ content: 'Sending request...', key: 'testRequest', duration: 0 });

                              const response = await fetch(`${API_BASE_URL}/assistants/${assistant.id}/chat/`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${apiKeyToUse}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  messages: [
                                    { role: 'user', content: values.message }
                                  ]
                                }),
                              });

                              message.destroy('testRequest');
                              setTestLoading(false);

                              const data = await response.json();
                              console.log('Test response:', data);

                              if (!response.ok) {
                                setTestResponse({
                                  success: false,
                                  status: response.status,
                                  data,
                                  model: assistant.model
                                });
                                return;
                              }

                              // Extract the assistant's response content
                              const assistantMessage = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);

                              setTestResponse({
                                success: true,
                                message: assistantMessage,
                                data,
                                model: assistant.model
                              });

                            } catch (error) {
                              message.destroy('testRequest');
                              setTestLoading(false);
                              console.error('Test error:', error);
                              setTestResponse({
                                success: false,
                                error: error.message
                              });
                            }
                          }}
                        >
                          <Form.Item
                            name="message"
                            label="Test Message"
                            rules={[{ required: true, message: 'Please enter a message' }]}
                          >
                            <TextArea rows={4} placeholder="Enter a test message..." />
                          </Form.Item>
                          <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={testLoading}>
                              Send Test Request
                            </Button>
                          </Form.Item>
                        </Form>

                        {/* Response Section */}
                        {testResponse && (
                          <div style={{ marginTop: 16 }}>
                            <Divider>Response</Divider>
                            {testResponse.success ? (
                              <div>
                                <div style={{ marginBottom: 12 }}>
                                  <Tag color="green">Success</Tag>
                                  {testResponse.model && <Tag color="blue">{testResponse.model}</Tag>}
                                </div>
                                <Card size="small" title="Assistant Response" style={{ marginBottom: 16 }}>
                                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                    {testResponse.message}
                                  </div>
                                </Card>
                                <Collapse size="small">
                                  <Collapse.Panel header="Raw JSON Response" key="1">
                                    <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, maxHeight: 300, overflow: 'auto', margin: 0, fontSize: 12 }}>
                                      {JSON.stringify(testResponse.data, null, 2)}
                                    </pre>
                                  </Collapse.Panel>
                                </Collapse>
                              </div>
                            ) : (
                              <Alert
                                type="error"
                                message={`Error${testResponse.status ? ` (${testResponse.status})` : ''}`}
                                description={
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                    {testResponse.error || JSON.stringify(testResponse.data, null, 2)}
                                  </pre>
                                }
                              />
                            )}
                          </div>
                        )}
                      </Card>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Space>

      {/* Create API Key Modal */}
      <Modal
        title="Create API Key"
        open={createKeyModalVisible}
        onCancel={() => {
          setCreateKeyModalVisible(false);
          createKeyForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createKeyForm}
          layout="vertical"
          onFinish={handleCreateKey}
        >
          <Form.Item
            name="assistant_id"
            label="Assistant"
            rules={[{ required: true, message: 'Please select an assistant' }]}
          >
            <Select placeholder="Select an assistant">
              {assistants.map((assistant) => (
                <Option key={assistant.id} value={assistant.id}>
                  {assistant.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="name"
            label="Key Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g., Production Key" />
          </Form.Item>
          <Form.Item name="expires_at" label="Expires At">
            <DatePicker
              showTime
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="usage_quota" label="Usage Quota">
            <InputNumber
              min={1}
              style={{ width: '100%' }}
              placeholder="Maximum requests per period"
            />
          </Form.Item>
          <Form.Item
            name="usage_period"
            label="Usage Period"
            dependencies={['usage_quota']}
          >
            <Select placeholder="Select period" disabled={!createKeyForm.getFieldValue('usage_quota')}>
              <Option value="day">Day</Option>
              <Option value="week">Week</Option>
              <Option value="month">Month</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Create API Key
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Whitelist Modal */}
      <Modal
        title="Add Whitelist Entry"
        open={whitelistModalVisible}
        onCancel={() => {
          setWhitelistModalVisible(false);
          whitelistForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={whitelistForm}
          layout="vertical"
          onFinish={handleAddWhitelist}
        >
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="ip">IP Address</Option>
              <Option value="domain">Domain</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="value"
            label="Value"
            rules={[{ required: true }]}
          >
            <Input placeholder="IP address or domain" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add Entry
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Widget Modal */}
      <Modal
        title="Create Chat Widget"
        open={createWidgetModalVisible}
        onCancel={() => {
          setCreateWidgetModalVisible(false);
          createWidgetForm.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Form
          form={createWidgetForm}
          layout="vertical"
          onFinish={handleCreateWidget}
          initialValues={{
            position: 'bottom-right',
            primary_color: '#1890ff',
            button_size: 60,
            placeholder_text: 'Type a message...',
            window_title: 'Chat with us',
            enable_persistence: true,
            session_timeout_hours: 24,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="assistant_id"
                label="Assistant"
                rules={[{ required: true, message: 'Please select an assistant' }]}
              >
                <Select placeholder="Select an assistant">
                  {assistants.map((assistant) => (
                    <Option key={assistant.id} value={assistant.id}>
                      {assistant.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Widget Name"
                rules={[{ required: true, message: 'Please enter a name' }]}
              >
                <Input placeholder="e.g., Support Chat" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Appearance</Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="position" label="Button Position">
                <Select>
                  <Option value="bottom-right">Bottom Right</Option>
                  <Option value="bottom-left">Bottom Left</Option>
                  <Option value="top-right">Top Right</Option>
                  <Option value="top-left">Top Left</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="primary_color" label="Primary Color">
                <Input type="color" style={{ width: '100%', height: 32 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="button_size" label="Button Size (px)">
                <InputNumber min={40} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="window_title" label="Window Title">
                <Input placeholder="Chat with us" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="placeholder_text" label="Input Placeholder">
                <Input placeholder="Type a message..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Behavior</Divider>

          <Form.Item name="start_message" label="Welcome Message">
            <TextArea
              rows={3}
              placeholder="Hello! How can I help you today?"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="allow_attachments" label="Allow Attachments" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="enable_persistence" label="Session Persistence" valuePropName="checked">
                <Switch defaultChecked />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="session_timeout_hours" label="Session Timeout (hours)">
                <InputNumber min={1} max={720} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Security</Divider>

          <Form.Item
            name="allowed_domains"
            label="Allowed Domains"
            extra="Comma-separated list of domains where widget can be embedded (e.g., example.com, app.example.com)"
          >
            <TextArea
              rows={2}
              placeholder="example.com, app.example.com"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              Create Widget
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Widget Embed Code Modal */}
      <Modal
        title="Embed Widget"
        open={widgetEmbedModalVisible}
        onCancel={() => setWidgetEmbedModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setWidgetEmbedModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {embedCode && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Show token if available */}
            {selectedWidget && widgetFullTokens.has(selectedWidget.id) ? (
              <Alert
                message="Your Widget Token"
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text>This token has been automatically inserted into the embed code below:</Text>
                    <Input.Password
                      value={widgetFullTokens.get(selectedWidget.id)}
                      readOnly
                      addonAfter={
                        <CopyOutlined
                          onClick={() => copyToClipboard(widgetFullTokens.get(selectedWidget.id))}
                          style={{ cursor: 'pointer' }}
                        />
                      }
                    />
                  </Space>
                }
                type="success"
                showIcon
              />
            ) : (
              <Alert
                message="Widget Token Required"
                description="Replace 'YOUR_WIDGET_TOKEN' in the code below with the token you received when creating this widget."
                type="warning"
                showIcon
              />
            )}

            <Alert
              message="Installation Instructions"
              description={
                <ol style={{ paddingLeft: 20, marginBottom: 0 }}>
                  {embedCode.instructions?.map((instruction, i) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              }
              type="info"
              showIcon
            />

            <Card title="URL Configuration (Optional)" size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Widget Script URL</Text>
                  <Input
                    placeholder="e.g., https://yourdomain.com"
                    value={customWidgetUrl}
                    onChange={(e) => setCustomWidgetUrl(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>Where the widget JS file is hosted</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>API Base URL</Text>
                  <Input
                    placeholder="e.g., https://yourdomain.com/api"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>Your backend API endpoint</Text>
                </Col>
              </Row>
            </Card>

            <Card title="Embed Code" size="small">
              <pre style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 200,
                margin: 0,
                fontSize: 12
              }}>
                {(() => {
                  let code = embedCode.embed_code;
                  // Replace token if available
                  if (selectedWidget && widgetFullTokens.has(selectedWidget.id)) {
                    code = code.replace('YOUR_WIDGET_TOKEN', widgetFullTokens.get(selectedWidget.id));
                  }
                  // Replace URLs if custom values provided
                  if (customWidgetUrl) {
                    code = code.replace(/w\.src = '[^']+\/widget\/focusml-chat\.js'/, `w.src = '${customWidgetUrl}/widget/focusml-chat.js'`);
                  }
                  if (customApiUrl) {
                    code = code.replace(/data-api-base', '[^']+'\)/, `data-api-base', '${customApiUrl}')`);
                  }
                  return code;
                })()}
              </pre>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => {
                  let code = embedCode.embed_code;
                  if (selectedWidget && widgetFullTokens.has(selectedWidget.id)) {
                    code = code.replace('YOUR_WIDGET_TOKEN', widgetFullTokens.get(selectedWidget.id));
                  }
                  if (customWidgetUrl) {
                    code = code.replace(/w\.src = '[^']+\/widget\/focusml-chat\.js'/, `w.src = '${customWidgetUrl}/widget/focusml-chat.js'`);
                  }
                  if (customApiUrl) {
                    code = code.replace(/data-api-base', '[^']+'\)/, `data-api-base', '${customApiUrl}')`);
                  }
                  copyToClipboard(code);
                }}
                style={{ marginTop: 16 }}
              >
                Copy Code
              </Button>
            </Card>
          </Space>
        )}
      </Modal>

      {/* Widget Sessions Modal */}
      <Modal
        title={`Sessions - ${selectedWidget?.name || ''}`}
        open={widgetSessionsModalVisible}
        onCancel={() => {
          setWidgetSessionsModalVisible(false);
          setSelectedSession(null);
          setSessionMessages([]);
        }}
        footer={null}
        width={900}
      >
        <Row gutter={16}>
          <Col span={selectedSession ? 10 : 24}>
            <Table
              dataSource={widgetSessions}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: 'Session',
                  dataIndex: 'session_id',
                  key: 'session_id',
                  render: (id) => <Text code>{id.substring(0, 8)}...</Text>,
                },
                {
                  title: 'Messages',
                  dataIndex: 'message_count',
                  key: 'messages',
                },
                {
                  title: 'Status',
                  dataIndex: 'is_active',
                  key: 'status',
                  render: (active) => (
                    <Badge status={active ? 'success' : 'default'} text={active ? 'Active' : 'Ended'} />
                  ),
                },
                {
                  title: 'Last Activity',
                  dataIndex: 'last_activity_at',
                  key: 'last_activity',
                  render: (date) => formatDateShort(date),
                },
                {
                  title: '',
                  key: 'action',
                  render: (_, record) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleViewSessionMessages(record)}
                    >
                      View
                    </Button>
                  ),
                },
              ]}
            />
          </Col>
          {selectedSession && (
            <Col span={14}>
              <Card
                title={`Conversation - ${selectedSession.session_id.substring(0, 8)}...`}
                size="small"
                extra={
                  <Button size="small" onClick={() => setSelectedSession(null)}>
                    Close
                  </Button>
                }
                style={{ maxHeight: 500, overflow: 'auto' }}
              >
                {sessionMessages.length === 0 ? (
                  <Empty description="No messages" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {sessionMessages.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                          color: msg.role === 'user' ? 'white' : 'inherit',
                          marginLeft: msg.role === 'user' ? 'auto' : 0,
                          marginRight: msg.role === 'user' ? 0 : 'auto',
                          maxWidth: '80%',
                        }}
                      >
                        <Text style={{ color: msg.role === 'user' ? 'white' : 'inherit' }}>
                          {msg.content}
                        </Text>
                        <div style={{
                          fontSize: 10,
                          opacity: 0.7,
                          marginTop: 4,
                          color: msg.role === 'user' ? 'white' : '#666'
                        }}>
                          {formatDateShort(msg.created_at)}
                          {msg.response_time_ms && ` • ${msg.response_time_ms}ms`}
                        </div>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          )}
        </Row>
      </Modal>
    </div>
  );
}

export default Integration;

