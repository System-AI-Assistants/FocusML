import React from 'react';
import { Layout, Input, Avatar, Dropdown, Menu, Button } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';

const { Header } = Layout;

const HeaderBar = () => {
  const { keycloak } = useKeycloak();

  const menu = (
    <Menu>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={() => keycloak.logout()}>Logout</Menu.Item>
    </Menu>
  );

  return (
    <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, boxShadow: '0 2px 8px #f0f1f2' }}>
      <Input.Search
        placeholder="Search..."
        style={{ width: 320, borderRadius: 8 }}
        allowClear
      />
      <Dropdown overlay={menu} placement="bottomRight" trigger={['click']}>
        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <Avatar style={{ backgroundColor: '#1890ff', marginRight: 12 }} icon={<UserOutlined />} />
          <span style={{ fontWeight: 500, color: '#222' }}>{keycloak.tokenParsed?.preferred_username || 'User'}</span>
        </div>
      </Dropdown>
    </Header>
  );
};

export default HeaderBar;
