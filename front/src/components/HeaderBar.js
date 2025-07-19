import React from 'react';
import './HeaderBar.css';
import { Layout, Input, Avatar, Dropdown, Menu, Space, Typography } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined, SearchOutlined } from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';

const { Header } = Layout;
const { Text } = Typography;

const HeaderBar = () => {
  const { keycloak } = useKeycloak();

  const handleLogout = () => {
    keycloak.logout();
  };

  const menu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        Profile
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />}>
        Settings
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Header className="modern-header">
      <Input
        placeholder="Search transactions, models, etc..."
        prefix={<SearchOutlined style={{ color: '#adb5bd' }} />}
        className="modern-search"
      />
      <Dropdown overlay={menu} placement="bottomRight" trigger={['click']}>
        <div className="user-info-container">
          <Avatar size="large" icon={<UserOutlined />} className="user-avatar" />
          <div className="user-details">
            <Text style={{ fontWeight: 600, color: '#212529' }}>{keycloak.tokenParsed?.name || 'Adam'}</Text>
            <Text type="secondary">{keycloak.tokenParsed?.email || 'adam@example.com'}</Text>
          </div>
        </div>
      </Dropdown>
    </Header>
  );
};

export default HeaderBar;
