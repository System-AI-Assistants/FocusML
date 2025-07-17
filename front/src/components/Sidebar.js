import React from 'react';
import { Layout, Menu, Divider, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  UserOutlined,
  CodeSandboxOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { Title, Text } = Typography;

const Sidebar = () => {
  const location = useLocation();

  return (
    <Sider width={240} className="modern-sidebar">
      <div className="logo-container">
        <CodeSandboxOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0, marginLeft: '12px', color: '#1a1a1a' }}>MLOps</Title>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        className="modern-menu"
      >
        <Menu.Item key="/" icon={<HomeOutlined />}>
          <Link to="/">Dashboard</Link>
        </Menu.Item>
        <Menu.Item key="/experiments" icon={<ExperimentOutlined />}>
          <Link to="/experiments">Experiments</Link>
        </Menu.Item>
        <Menu.Item key="/models" icon={<AppstoreOutlined />}>
          <Link to="/models">Models</Link>
        </Menu.Item>
        <Menu.Item key="/monitoring" icon={<BarChartOutlined />}>
          <Link to="/monitoring">Monitoring</Link>
        </Menu.Item>
        <Menu.Item key="/alerts" icon={<BellOutlined />}>
          <Link to="/alerts">Alerts</Link>
        </Menu.Item>
        <Menu.Item key="/users" icon={<UserOutlined />}>
          <Link to="/users">User Management</Link>
        </Menu.Item>
      </Menu>
      <Divider style={{ margin: '16px 0' }} />
      <div className="workspace-info">
        <Text style={{ fontWeight: 600, color: '#1a1a1a' }}>Workspace</Text>
        <Text type="secondary">Personal</Text>
      </div>
    </Sider>
  );
};

export default Sidebar;
