import React from 'react';
import { Card, Button, Table, Modal, Form, Input, message, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

const UserManagement = () => {
  const [users, setUsers] = React.useState([
    { key: '1', username: 'alice', email: 'alice@example.com' },
    { key: '2', username: 'bob', email: 'bob@example.com' },
  ]);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [form] = Form.useForm();

  const handleAddUser = (values) => {
    setUsers([...users, { key: Date.now().toString(), ...values }]);
    setIsModalVisible(false);
    form.resetFields();
    message.success('User added (mock)');
  };

  const handleDeleteUser = (key) => {
    setUsers(users.filter(user => user.key !== key));
    message.success('User deleted (mock)');
  };

  const columns = [
    { title: 'Username', dataIndex: 'username', key: 'username' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteUser(record.key)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 16, boxShadow: '0 2px 16px #e6e6e6', margin: 32 }}>
      <Title level={3} style={{ marginBottom: 24 }}>User Management</Title>
      <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setIsModalVisible(true)}>
        Add User
      </Button>
      <Table columns={columns} dataSource={users} pagination={false} style={{ background: 'white', borderRadius: 8 }} />
      <Modal
        title="Add User"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleAddUser}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}> <Input /> </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}> <Input /> </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagement;
