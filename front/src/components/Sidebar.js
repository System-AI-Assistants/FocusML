import React, { useState } from 'react';
import { Layout, Menu, Typography, Button, Drawer, Grid } from 'antd';
import './Sidebar.css';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  UserOutlined,
  CodeSandboxOutlined,
  MenuOutlined
} from '@ant-design/icons';

const { Sider } = Layout;
const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const Sidebar = ({ collapsed, onCollapse }) => {
  const location = useLocation();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md; // md = 768px, below is mobile

  // Menu content
  const menuContent = (
    <>
      <div className="sidebar-logo">
        <CodeSandboxOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0, marginLeft: '12px', color: '#1a1a1a', fontWeight: 700, letterSpacing: 1 }}>MLOps</Title>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        className="sidebar-menu"
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
      
    </>
  );

  // Mobile: bottom navigation bar
  if (isMobile) {
    const navItems = [
      { key: '/', icon: <HomeOutlined />, label: 'Home' },
      { key: '/experiments', icon: <ExperimentOutlined />, label: 'Experiments' },
      { key: '/models', icon: <AppstoreOutlined />, label: 'Models' },
      { key: '/monitoring', icon: <BarChartOutlined />, label: 'Monitor' },
      { key: '/alerts', icon: <BellOutlined />, label: 'Alerts' },
      { key: '/users', icon: <UserOutlined />, label: 'Users' }
    ];

    return (
      <div className="bottom-nav">
        {navItems.map(item => (
          <Link
            key={item.key}
            to={item.key}
            className={`nav-item${location.pathname === item.key ? ' nav-item-active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    );
  }

  // Desktop: Sider
  return (
    <Sider
      width={240}
      className="modern-sidebar"
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="md"
      collapsedWidth={80}
      style={{
        minHeight: '100vh',
        background: '#fff',
        transition: 'all 0.2s',
        zIndex: 100,
      }}
      trigger={null}
    >
      {menuContent}
    </Sider>
  );
};

export default Sidebar;
