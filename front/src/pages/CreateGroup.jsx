import React, { useState } from 'react';
import { 
  Form, Input, Button, Typography, Space, message, Switch, Row, Col,
  InputNumber, Card, Breadcrumb, Divider, Tooltip, Slider
} from 'antd';
import { 
  TeamOutlined, InfoCircleOutlined, 
  CheckOutlined, ArrowLeftOutlined, ThunderboltOutlined,
  ApiOutlined, RobotOutlined
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { createGroup } from '../services/api';

const { Title, Text } = Typography;

// Simple limit input: toggle + number. Off = unlimited, On = set limit (0 = disabled)
const LimitInput = ({ value, onChange, min = 0, step = 1, suffix = '', placeholder = '' }) => {
  const hasLimit = value !== null && value !== undefined;
  const numValue = typeof value === 'number' ? value : 10;
  
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Switch
        checked={hasLimit}
        onChange={(checked) => onChange(checked ? numValue : null)}
        style={{ marginTop: 5 }}
      />
      {hasLimit && (
        <InputNumber
          min={min}
          step={step}
          value={value}
          onChange={(v) => onChange(v ?? 0)}
          style={{ width: '100%', marginLeft: 8 }}
          addonAfter={suffix || undefined}
          size="large"
          placeholder={placeholder || "0 = disabled"}
        />
      )}
    </Space.Compact>
  );
};

// Storage limit input with unit selector (MB/GB)
const StorageLimitInput = ({ value, onChange, placeholder = '' }) => {
  const hasLimit = value !== null && value !== undefined;
  const [unit, setUnit] = React.useState('MB');
  const numValue = typeof value === 'number' ? value : 100;
  
  const displayValue = hasLimit ? (unit === 'GB' ? value / 1024 : value) : numValue;
  
  const handleValueChange = (v) => {
    const mbValue = unit === 'GB' ? (v ?? 0) * 1024 : (v ?? 0);
    onChange(mbValue);
  };
  
  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
  };
  
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Switch
        checked={hasLimit}
        onChange={(checked) => onChange(checked ? (unit === 'GB' ? numValue * 1024 : numValue) : null)}
        style={{ marginTop: 5 }}
      />
      {hasLimit && (
        <>
          <InputNumber
            min={0}
            step={unit === 'GB' ? 0.5 : 100}
            value={displayValue}
            onChange={handleValueChange}
            style={{ width: '100%', marginLeft: 8 }}
            size="large"
            placeholder={placeholder || "0 = disabled"}
          />
          <Button.Group style={{ marginLeft: 4 }}>
            <Button 
              type={unit === 'MB' ? 'primary' : 'default'} 
              onClick={() => handleUnitChange('MB')}
              size="large"
              style={{ 
                borderRadius: '8px 0 0 8px',
                fontWeight: 500,
                ...(unit === 'MB' ? { background: '#3b82f6' } : { borderColor: '#e2e8f0' })
              }}
            >
              MB
            </Button>
            <Button 
              type={unit === 'GB' ? 'primary' : 'default'} 
              onClick={() => handleUnitChange('GB')}
              size="large"
              style={{ 
                borderRadius: '0 8px 8px 0',
                fontWeight: 500,
                ...(unit === 'GB' ? { background: '#3b82f6' } : { borderColor: '#e2e8f0' })
              }}
            >
              GB
            </Button>
          </Button.Group>
        </>
      )}
    </Space.Compact>
  );
};

const CreateGroup = () => {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await createGroup(keycloak, values);
      message.success('Group created successfully');
      navigate('/users?tab=groups');
    } catch (error) {
      message.error('Failed to create group: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const priorityMarks = {
    0: '0',
    3: '3',
    5: '5',
    7: '7',
    10: '10'
  };

  return (
    <div style={{ padding: '24px 32px', background: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
      {/* Breadcrumb */}
      <Breadcrumb 
        style={{ marginBottom: 20 }}
        items={[
          { title: <Link to="/users?tab=groups">Groups</Link> },
          { title: 'Create Group' }
        ]}
      />

      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <Title level={2} style={{ margin: 0, marginBottom: 8, color: '#0f172a', fontWeight: 700, letterSpacing: '-0.02em' }}>Create New Group</Title>
        <Text style={{ color: '#64748b', fontSize: 15 }}>
          Groups define resource limits and feature access for users. Members inherit the group's permissions.
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        size="large"
        initialValues={{
          priority_level: 5,
          max_assistants_created: null,
          max_assistants_running: null,
          max_data_collections: null,
          max_storage_mb: null,
          max_model_size_gb: null,
          max_gpu_memory_gb: null,
          max_cpu_cores: null,
          daily_token_limit: null,
          monthly_token_limit: null,
          daily_api_requests: null
        }}
      >
        <Row gutter={24}>
          <Col xs={24} xl={18} xxl={16}>
            {/* Basic Info Card */}
            <Card style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Title level={5} style={{ marginBottom: 20, color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TeamOutlined style={{ color: '#3b82f6' }} />
                Basic Information
              </Title>
              
              <Row gutter={24}>
                <Col span={16}>
                  <Form.Item
                    name="name"
                    label="Group Name"
                    rules={[{ required: true, message: 'Group name is required' }]}
                  >
                    <Input placeholder="e.g., Data Science Team, Marketing, Developers" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item 
                    name="priority_level" 
                    label={
                      <Space>
                        Priority Level
                        <Tooltip title="Higher priority groups get preferential access to resources and shorter queue times">
                          <InfoCircleOutlined style={{ color: '#8c8c8c' }} />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Slider 
                      min={0} 
                      max={10} 
                      marks={priorityMarks}
                      tooltip={{ formatter: (v) => `Priority ${v}` }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="description" label="Description">
                <Input.TextArea 
                  rows={2} 
                  placeholder="Describe the purpose of this group and who should be a member" 
                />
              </Form.Item>
            </Card>

            {/* Resource Limits Card */}
            <Card style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Title level={5} style={{ marginBottom: 8, color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RobotOutlined style={{ color: '#8b5cf6' }} />
                Assistant Limits
              </Title>
              <Text style={{ display: 'block', marginBottom: 20, color: '#64748b', fontSize: 14 }}>
                Control how many AI assistants this group can create and run
              </Text>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="max_assistants_created" label="Max Created">
                    <LimitInput placeholder="Total assistants" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_assistants_running" label="Max Concurrent">
                    <LimitInput placeholder="Running at once" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_data_collections" label="Data Collections">
                    <LimitInput placeholder="Uploaded datasets" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Hardware Limits Card */}
            <Card style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Title level={5} style={{ marginBottom: 8, color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ThunderboltOutlined style={{ color: '#f59e0b' }} />
                Hardware Limits
              </Title>
              <Text style={{ display: 'block', marginBottom: 20, color: '#64748b', fontSize: 14 }}>
                Restrict model sizes and compute resources this group can use
              </Text>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="max_model_size_gb" label="Max Model Size">
                    <LimitInput step={1} suffix="GB" placeholder="e.g., 7 for 7B models" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_gpu_memory_gb" label="GPU Memory">
                    <LimitInput step={1} suffix="GB" placeholder="VRAM limit" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_cpu_cores" label="CPU Cores">
                    <LimitInput placeholder="For CPU inference" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Usage Quotas Card */}
            <Card style={{ marginBottom: 20, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Title level={5} style={{ marginBottom: 8, color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ApiOutlined style={{ color: '#10b981' }} />
                Usage Quotas
              </Title>
              <Text style={{ display: 'block', marginBottom: 20, color: '#64748b', fontSize: 14 }}>
                Set limits on API calls, tokens, and storage consumption
              </Text>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="max_storage_mb" label="Storage Limit">
                    <StorageLimitInput placeholder="For uploads" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="daily_token_limit" label="Daily Tokens">
                    <LimitInput placeholder="LLM tokens/day" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="monthly_token_limit" label="Monthly Tokens">
                    <LimitInput placeholder="LLM tokens/month" />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={24}>
                <Col span={8}>
                  <Form.Item name="daily_api_requests" label="Daily API Calls">
                    <LimitInput placeholder="Requests/day" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_api_keys" label="API Keys">
                    <LimitInput placeholder="Keys per group" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="max_widgets" label="Widgets">
                    <LimitInput placeholder="Chat widgets" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Action Buttons */}
            <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Space size="middle">
                <Button 
                  onClick={() => navigate('/users?tab=groups')} 
                  icon={<ArrowLeftOutlined />}
                  size="large"
                  style={{ 
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    fontWeight: 500
                  }}
                >
                  Back
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading} 
                  icon={<CheckOutlined />}
                  size="large"
                  style={{ 
                    background: '#3b82f6', 
                    borderRadius: 10, 
                    fontWeight: 600,
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                  }}
                >
                  Create
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default CreateGroup;
