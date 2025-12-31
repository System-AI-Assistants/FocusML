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
  CopyTwoTone
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
  getAssistantEndpoints
} from '../services/api';
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
  
  // Modal states
  const [createKeyModalVisible, setCreateKeyModalVisible] = useState(false);
  const [whitelistModalVisible, setWhitelistModalVisible] = useState(false);
  const [codeSnippetModalVisible, setCodeSnippetModalVisible] = useState(false);
  const [playgroundModalVisible, setPlaygroundModalVisible] = useState(false);
  
  // Forms
  const [createKeyForm] = Form.useForm();
  const [whitelistForm] = Form.useForm();
  const [playgroundForm] = Form.useForm();

  useEffect(() => {
    fetchAssistants();
    fetchAPIKeys();
  }, []);

  useEffect(() => {
    if (selectedKey) {
      fetchStatistics();
      fetchWhitelistEntries();
    }
  }, [selectedKey]);

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

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <ApiOutlined /> Integration Management
          </Title>
          <Paragraph type="secondary">
            Manage API keys, monitor usage, and configure access controls for your assistants
          </Paragraph>
        </div>

        <Card>
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
          />
        </Card>

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
    </div>
  );
}

export default Integration;

