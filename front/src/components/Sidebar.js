import React from 'react';
import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  BellOutlined,
  UserOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { Link, useLocation } from 'react-router-dom';

const { Sider } = Layout;

const Sidebar = () => {
  const location = useLocation();
  return (
    <Sider width={220} style={{ background: '#fff', boxShadow: '2px 0 8px #f0f1f2' }}>
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 22, letterSpacing: 1, color: '#1a1a1a' }}>
        MLOps Platform
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ height: '100%', borderRight: 0, fontSize: 16 }}
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
    </Sider>
  );
};

export default Sidebar;
