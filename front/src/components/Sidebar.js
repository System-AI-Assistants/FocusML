import React, { useState } from 'react';
import { Layout, Menu, Divider, Typography, Button, Drawer, Grid } from 'antd';
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
      <div style={{
        display: 'flex', alignItems: 'center', padding: '20px 16px', marginBottom: 0
      }}>
        <CodeSandboxOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
        <Title level={4} style={{ margin: 0, marginLeft: '12px', color: '#1a1a1a', fontWeight: 700, letterSpacing: 1 }}>MLOps</Title>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        style={{ borderRight: 0, fontSize: 16, fontWeight: 500, background: 'transparent', padding: '16px 0' }}
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

  // Responsive: Drawer on mobile, Sider on desktop
  if (isMobile) {
    return (
      <>
        <Button
          className="sidebar-mobile-trigger"
          type="primary"
          icon={<MenuOutlined />}
          onClick={() => setDrawerVisible(true)}
          style={{ position: 'fixed', top: 16, left: 16, zIndex: 1100, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
        />
        <Drawer
          placement="left"
          closable={false}
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={240}
          bodyStyle={{ padding: 0, background: '#fff' }}
          style={{ zIndex: 1200 }}
        >
          {menuContent}
        </Drawer>
      </>
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
      collapsedWidth={64}
      style={{
        minHeight: '100vh',
        background: '#fff',
        boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        borderRight: '1px solid #f0f0f0',
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
