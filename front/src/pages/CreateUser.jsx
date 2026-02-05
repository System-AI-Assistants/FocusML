import React, { useState } from 'react';
import { 
  Form, Input, Button, Typography, Space, message, Switch, Row, Col, 
  Breadcrumb, Card, Divider 
} from 'antd';
import { 
  UserOutlined, MailOutlined, LockOutlined,
  CheckOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import { createUser } from '../services/api';

const { Title, Text } = Typography;

const CreateUser = () => {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      await createUser(keycloak, values);
      message.success('User created successfully');
      navigate('/users');
    } catch (error) {
      message.error('Failed to create user: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Breadcrumb 
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link to="/users">User Management</Link> },
          { title: 'Create User' }
        ]}
      />
      <div className="page-header">
        <h2 className="page-header-title">Create New User</h2>
        <span className="page-header-subtitle">Add a new user to the platform. They will receive login credentials via Keycloak.</span>
      </div>

      {/* Main Content */}
      <Row gutter={24}>
        <Col xs={24} xl={18} xxl={16}>
          <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ enabled: true }}
              size="large"
            >
              <Title level={5} style={{ marginBottom: 16 }}>Account Information</Title>
              
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label="Username"
                    rules={[{ required: true, message: 'Username is required' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="johndoe" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="email"
                    label="Email Address"
                    rules={[
                      { required: true, message: 'Email is required' },
                      { type: 'email', message: 'Enter a valid email' }
                    ]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="john@example.com" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />
              <Title level={5} style={{ marginBottom: 16 }}>Personal Details</Title>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item name="firstName" label="First Name">
                    <Input placeholder="John" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="lastName" label="Last Name">
                    <Input placeholder="Doe" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />
              <Title level={5} style={{ marginBottom: 16 }}>Security</Title>

              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="Initial Password"
                    rules={[
                      { required: true, message: 'Password is required' },
                      { min: 8, message: 'Minimum 8 characters' }
                    ]}
                    extra="User can change this after first login"
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="Min. 8 characters" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item 
                    name="enabled" 
                    label="Account Status" 
                    valuePropName="checked"
                  >
                    <Switch defaultChecked />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Form.Item style={{ marginBottom: 0 }}>
                <Space size="middle">
                  <Button 
                    onClick={() => navigate('/users')} 
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
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CreateUser;
