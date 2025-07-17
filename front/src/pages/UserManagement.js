import React, { useState } from 'react';
import { Card, Table, Button, Modal, Form, Input, Space, Typography, Tag, Avatar } from 'antd';
import { PlusOutlined, DeleteOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';

const { Title } = Typography;

const initialUsers = [
  { key: '1', name: 'John Doe', email: 'john.doe@example.com', role: 'Admin', status: 'active' },
  { key: '2', name: 'Jane Smith', email: 'jane.smith@example.com', role: 'Developer', status: 'active' },
  { key: '3', name: 'Sam Wilson', email: 'sam.wilson@example.com', role: 'Viewer', status: 'inactive' },
];

function UserManagement() {
  const [users, setUsers] = useState(initialUsers);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleAddUser = (values) => {
    const newUser = { ...values, key: String(users.length + 1), status: 'active' };
    setUsers([...users, newUser]);
    handleCancel();
  };

  const handleDelete = (key) => {
    setUsers(users.filter(user => user.key !== key));
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <div style={{ color: '#8c8c8c' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: role => {
        let color = 'default';
        if (role === 'Admin') color = 'volcano';
        if (role === 'Developer') color = 'geekblue';
        return <Tag color={color}>{role}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: status => (
        <Tag color={status === 'active' ? 'green' : 'red'}>{status.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.key)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>Add User</Button>
      </div>
      <Card className="modern-card">
        <Table dataSource={users} columns={columns} pagination={{ pageSize: 10 }} rowKey="key" />
      </Card>

      <Modal
        title="Add New User"
        visible={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={400}
      >
        <Form form={form} onFinish={handleAddUser} layout="vertical" style={{ marginTop: '24px' }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. John Doe" />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="e.g. john.doe@example.com" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Input placeholder="e.g. Developer" />
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
