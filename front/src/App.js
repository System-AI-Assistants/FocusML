import logo from './logo.svg';
import './App.css';

import React from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Layout, Menu, Button, Typography, Table, Modal, Form, Input, message } from 'antd';
import { UserOutlined, LogoutOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import './App.css';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function App() {
  const { keycloak, initialized } = useKeycloak();
  const [users, setUsers] = React.useState([]);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [form] = Form.useForm();

  // Placeholder: Replace with actual API calls to your backend
  React.useEffect(() => {
    if (keycloak?.authenticated) {
      // Fetch users from backend
      setUsers([
        { key: '1', username: 'alice', email: 'alice@example.com' },
        { key: '2', username: 'bob', email: 'bob@example.com' },
      ]);
    }
  }, [keycloak]);

  const handleAddUser = (values) => {
    // Placeholder: Call backend to add user
    setUsers([...users, { key: Date.now().toString(), ...values }]);
    setIsModalVisible(false);
    form.resetFields();
    message.success('User added (mock)');
  };

  const handleDeleteUser = (key) => {
    // Placeholder: Call backend to delete user
    setUsers(users.filter(user => user.key !== key));
    message.success('User deleted (mock)');
  };

  if (!initialized) {
    return <div>Loading...</div>;
  }

  if (!keycloak?.authenticated) {
    return <Button type="primary" onClick={() => keycloak.login()}>Login with Keycloak</Button>;
  }

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
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['1']} style={{ flex: 1 }}>
          <Menu.Item key="1" icon={<UserOutlined />}>User Management</Menu.Item>
        </Menu>
        <div>
          <span style={{ color: '#fff', marginRight: 16 }}>{keycloak.tokenParsed?.preferred_username}</span>
          <Button icon={<LogoutOutlined />} onClick={() => keycloak.logout()}>
            Logout
          </Button>
        </div>
      </Header>
      <Content style={{ margin: '24px 16px 0' }}>
        <Title level={2}>User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setIsModalVisible(true)}>
          Add User
        </Button>
        <Table columns={columns} dataSource={users} />
        <Modal
          title="Add User"
          visible={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleAddUser}>
            <Form.Item name="username" label="Username" rules={[{ required: true }]}> <Input /> </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}> <Input /> </Form.Item>
          </Form>
        </Modal>
      </Content>
      <Footer style={{ textAlign: 'center' }}>MLOps Platform ©2025</Footer>
    </Layout>
  );
}


export default App;
