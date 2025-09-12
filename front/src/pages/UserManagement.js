import React, { useState, useEffect, useCallback } from 'react';
import './UserManagement.css';
import { Card, Table, Button, Modal, Form, Input, Space, Typography, Tag, Avatar, message } from 'antd';
import { PlusOutlined, DeleteOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import axios from 'axios';

const { Title } = Typography;

const API_URL = 'https://aiassistant.smartlilac.com/api';

function UserManagement() {
  const { keycloak, initialized } = useKeycloak();
  const [users, setUsers] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    if (initialized && keycloak.authenticated) {
      try {
        setLoading(true);
        const response = await axios.get(`${API_URL}/users`, {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        });
        setUsers(response.data);
      } catch (error) {
        message.error('Failed to fetch users. Is your backend running?');
        console.error('Fetch users error:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [initialized, keycloak]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleAddUser = async (values) => {
    try {
      await axios.post(`${API_URL}/users`, values, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      message.success('User added successfully!');
      fetchUsers(); // Refetch users to update the list
      handleCancel();
    } catch (error) {
      message.error('Failed to add user.');
      console.error('Add user error:', error);
    }
  };

  const handleDelete = async (userId) => {
    try {
      await axios.delete(`${API_URL}/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      message.success('User deleted successfully!');
      fetchUsers(); // Refetch users to update the list
    } catch (error) {
      message.error('Failed to delete user.');
      console.error('Delete user error:', error);
    }
  };

  const columns = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (username, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{`${record.firstName || ''} ${record.lastName || ''}`.trim() || username}</div>
            <div style={{ color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      render: enabled => (
        <Tag color={enabled ? 'green' : 'red'}>{enabled ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="user-page-container">
      <div className="user-page-header">
        <Title level={2} style={{ margin: 0 }}>User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>Add User</Button>
      </div>
      <Card className="modern-card">
        <Table 
          dataSource={users} 
          columns={columns} 
          pagination={{ pageSize: 10 }} 
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title="Add New User"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={400}
      >
        <Form form={form} onFinish={handleAddUser} layout="vertical" style={{ marginTop: '24px' }}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="e.g. jsmith" />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="e.g. john.smith@example.com" />
          </Form.Item>
          <Form.Item name="firstName" label="First Name">
            <Input placeholder="e.g. John" />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name">
            <Input placeholder="e.g. Smith" />
          </Form.Item>
           <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password placeholder="Enter a temporary password" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginTop: '24px' }}>
            <Space>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create User</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserManagement;
