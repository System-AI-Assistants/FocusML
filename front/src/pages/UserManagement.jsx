import React, { useState, useEffect } from 'react';
import './UserManagement.css';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Tabs,
  InputNumber,
  Popconfirm,
  Tooltip,
  Divider,
  Switch,
  Descriptions,
  Badge,
  Progress,
  Avatar,
  Drawer,
  Collapse,
  Empty
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserOutlined,
  TeamOutlined,
  SyncOutlined,
  LockOutlined,
  MailOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useKeycloak } from '@react-keycloak/web';
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserEnabled,
  bulkAddUsersToGroup,
  getGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  addMemberToGroup,
  updateGroupMember,
  removeMemberFromGroup,
  getGroupUsage,
  syncGroupsFromKeycloak,
  getCurrentUserRoles
} from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Result, Spin } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const getPriorityColor = (level) => {
  if (level >= 8) return 'purple';
  if (level >= 5) return 'gold';
  if (level >= 3) return 'blue';
  return 'default';
};

const roleColors = {
  member: 'default',
  admin: 'blue',
  owner: 'gold'
};

// Format limit value for display
const formatLimit = (value, suffix = '') => {
  if (value === null || value === undefined) return <Text type="success">∞</Text>;
  if (value === -1) return <Text type="danger">Off</Text>;
  return <Text>{value.toLocaleString()}{suffix}</Text>;
};

// Simple limit input: toggle + number. Off = unlimited, On = set limit (0 = disabled)
const LimitInput = ({ value, onChange, min = 0, step = 1, suffix = '' }) => {
  const hasLimit = value !== null && value !== undefined;
  const numValue = typeof value === 'number' ? value : 10;
  
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Switch
        checked={hasLimit}
        onChange={(checked) => onChange(checked ? numValue : null)}
        size="small"
        style={{ marginTop: 4 }}
      />
      {hasLimit ? (
        <InputNumber
          min={min}
          step={step}
          value={value}
          onChange={(v) => onChange(v ?? 0)}
          style={{ width: '100%', marginLeft: 8 }}
          addonAfter={suffix || undefined}
          size="small"
          placeholder="0 = disabled"
        />
      ) : (
        <Text type="success" style={{ marginLeft: 8, lineHeight: '24px', fontSize: 12 }}>∞ Unlimited</Text>
      )}
    </Space.Compact>
  );
};

const UserManagement = () => {
  const { keycloak } = useKeycloak();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  
  // Admin access check
  const [isAdmin, setIsAdmin] = useState(null); // null = loading, false = not admin, true = admin
  const [accessLoading, setAccessLoading] = useState(true);
  
  // Users state
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Groups state
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupUsage, setGroupUsage] = useState(null);
  
  // Modals
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false);
  const [editGroupModalVisible, setEditGroupModalVisible] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [groupDetailsDrawerVisible, setGroupDetailsDrawerVisible] = useState(false);
  const [userDetailsDrawerVisible, setUserDetailsDrawerVisible] = useState(false);
  const [bulkAddToGroupModalVisible, setBulkAddToGroupModalVisible] = useState(false);

  // Check admin access on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const rolesData = await getCurrentUserRoles(keycloak);
        setIsAdmin(rolesData.is_admin);
        if (rolesData.is_admin) {
          fetchUsers();
          fetchGroups();
        }
      } catch (error) {
        console.error('Failed to check admin access:', error);
        setIsAdmin(false);
      } finally {
        setAccessLoading(false);
      }
    };

    if (keycloak?.authenticated) {
      checkAdminAccess();
    }
  }, [keycloak]);
  
  // Forms
  const [editUserForm] = Form.useForm();
  const [resetPasswordForm] = Form.useForm();
  const [editGroupForm] = Form.useForm();
  const [addMemberForm] = Form.useForm();

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMembers(selectedGroup.id);
      fetchGroupUsage(selectedGroup.id);
    }
  }, [selectedGroup]);

  // ============ Fetch Functions ============

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers(keycloak, userSearch);
      setUsers(data);
    } catch (error) {
      message.error('Failed to fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await getGroups(keycloak);
      setGroups(data);
    } catch (error) {
      message.error('Failed to fetch groups: ' + error.message);
    }
  };

  const fetchGroupMembers = async (groupId) => {
    try {
      const data = await getGroupMembers(keycloak, groupId);
      setGroupMembers(data);
    } catch (error) {
      message.error('Failed to fetch group members: ' + error.message);
    }
  };

  const fetchGroupUsage = async (groupId) => {
    try {
      const data = await getGroupUsage(keycloak, groupId);
      setGroupUsage(data);
    } catch (error) {
      console.error('Failed to fetch group usage:', error);
    }
  };

  const fetchUserDetails = async (userId) => {
    try {
      const data = await getUser(keycloak, userId);
      setSelectedUser(data);
      setUserDetailsDrawerVisible(true);
    } catch (error) {
      message.error('Failed to fetch user details: ' + error.message);
    }
  };

  // ============ User Handlers ============

  const handleUpdateUser = async (values) => {
    try {
      await updateUser(keycloak, selectedUser.id, values);
      message.success('User updated successfully');
      setEditUserModalVisible(false);
      editUserForm.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('Failed to update user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(keycloak, userId);
      message.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      message.error('Failed to delete user: ' + error.message);
    }
  };

  const handleResetPassword = async (values) => {
    try {
      await resetUserPassword(keycloak, selectedUser.id, values.password, values.temporary);
      message.success('Password reset successfully');
      setResetPasswordModalVisible(false);
      resetPasswordForm.resetFields();
    } catch (error) {
      message.error('Failed to reset password: ' + error.message);
    }
  };

  const handleToggleUserEnabled = async (userId) => {
    try {
      const result = await toggleUserEnabled(keycloak, userId);
      message.success(result.message);
      fetchUsers();
    } catch (error) {
      message.error('Failed to toggle user status: ' + error.message);
    }
  };

  // ============ Group Handlers ============

  const handleUpdateGroup = async (values) => {
    try {
      await updateGroup(keycloak, selectedGroup.id, values);
      message.success('Group updated successfully');
      setEditGroupModalVisible(false);
      editGroupForm.resetFields();
      fetchGroups();
      // Refresh selected group
      const updated = await getGroup(keycloak, selectedGroup.id);
      setSelectedGroup(updated);
    } catch (error) {
      message.error('Failed to update group: ' + error.message);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      await deleteGroup(keycloak, groupId);
      message.success('Group deleted successfully');
      setSelectedGroup(null);
      setGroupDetailsDrawerVisible(false);
      fetchGroups();
    } catch (error) {
      message.error('Failed to delete group: ' + error.message);
    }
  };

  const handleAddMember = async (values) => {
    try {
      await addMemberToGroup(keycloak, selectedGroup.id, values.user_id, values.role);
      message.success('Member added successfully');
      setAddMemberModalVisible(false);
      addMemberForm.resetFields();
      fetchGroupMembers(selectedGroup.id);
      fetchGroups();
    } catch (error) {
      message.error('Failed to add member: ' + error.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeMemberFromGroup(keycloak, selectedGroup.id, userId);
      message.success('Member removed successfully');
      fetchGroupMembers(selectedGroup.id);
      fetchGroups();
    } catch (error) {
      message.error('Failed to remove member: ' + error.message);
    }
  };

  const handleUpdateMemberRole = async (userId, newRole) => {
    try {
      await updateGroupMember(keycloak, selectedGroup.id, userId, { role: newRole });
      message.success('Member role updated');
      fetchGroupMembers(selectedGroup.id);
    } catch (error) {
      message.error('Failed to update member role: ' + error.message);
    }
  };

  const handleSyncFromKeycloak = async () => {
    try {
      const result = await syncGroupsFromKeycloak(keycloak);
      message.success(result.message);
      fetchGroups();
    } catch (error) {
      message.error('Failed to sync from Keycloak: ' + error.message);
    }
  };

  const handleBulkAddToGroup = async (values) => {
    try {
      const result = await bulkAddUsersToGroup(keycloak, selectedUsers, values.group_id, values.role);
      message.success(result.message);
      setBulkAddToGroupModalVisible(false);
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      message.error('Failed to add users to group: ' + error.message);
    }
  };

  // ============ Table Columns ============

  const userColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: record.enabled ? '#1890ff' : '#d9d9d9' }} />
          <div>
            <Text strong>{record.username}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, record) => `${record.firstName || ''} ${record.lastName || ''}`.trim() || '-',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Badge 
          status={record.enabled ? 'success' : 'error'} 
          text={record.enabled ? 'Active' : 'Disabled'} 
        />
      ),
    },
    {
      title: 'Groups',
      key: 'groups',
      render: (_, record) => (
        <Space wrap>
          {record.groups?.length > 0 ? (
            record.groups.map((group, i) => (
              <Tag key={i} color="blue">{group}</Tag>
            ))
          ) : (
            <Text type="secondary">No groups</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => fetchUserDetails(record.id)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => {
                setSelectedUser(record);
                editUserForm.setFieldsValue({
                  firstName: record.firstName,
                  lastName: record.lastName,
                  email: record.email,
                });
                setEditUserModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button 
              type="text" 
              icon={<LockOutlined />} 
              onClick={() => {
                setSelectedUser(record);
                setResetPasswordModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title={record.enabled ? 'Disable' : 'Enable'}>
            <Button 
              type="text" 
              icon={record.enabled ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleUserEnabled(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this user?"
            description="This action cannot be undone."
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const groupColumns = [
    {
      title: 'Group',
      key: 'group',
      render: (_, record) => (
        <Space>
          <Avatar icon={<TeamOutlined />} style={{ backgroundColor: '#722ed1' }} />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.description || 'No description'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority_level',
      key: 'priority_level',
      render: (level) => <Tag color={getPriorityColor(level)}>P{level}</Tag>,
      sorter: (a, b) => b.priority_level - a.priority_level,
    },
    {
      title: 'Members',
      dataIndex: 'member_count',
      key: 'member_count',
      render: (count) => <Badge count={count} showZero color="#1890ff" />,
    },
    {
      title: 'Limits',
      key: 'limits',
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          <Tooltip title="Assistants created">
            <Tag>{formatLimit(record.max_assistants_created)} asst</Tag>
          </Tooltip>
          <Tooltip title="Daily tokens">
            <Tag>{formatLimit(record.daily_token_limit)} tkn/d</Tag>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Badge 
          status={record.is_active ? 'success' : 'error'} 
          text={record.is_active ? 'Active' : 'Inactive'} 
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedGroup(record);
                setGroupDetailsDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => {
                setSelectedGroup(record);
                editGroupForm.setFieldsValue(record);
                setEditGroupModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this group?"
            description="All members will be removed from this group."
            onConfirm={() => handleDeleteGroup(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const memberColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" />
          <div>
            <Text strong>{record.username || record.user_id}</Text>
            {record.email && <><br /><Text type="secondary" style={{ fontSize: 11 }}>{record.email}</Text></>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role, record) => (
        <Select
          value={role}
          size="small"
          style={{ width: 100 }}
          onChange={(newRole) => handleUpdateMemberRole(record.user_id, newRole)}
        >
          <Option value="member">Member</Option>
          <Option value="admin">Admin</Option>
          <Option value="owner">Owner</Option>
        </Select>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'joined_at',
      key: 'joined_at',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Remove from group?"
          onConfirm={() => handleRemoveMember(record.user_id)}
          okText="Remove"
          okType="danger"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />}>
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // ============ Render ============

  // Show loading while checking access
  if (accessLoading) {
    return (
      <div className="user-page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Checking access..." />
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="user-page-container">
        <Result
          status="403"
          title="Access Denied"
          subTitle="You don't have permission to access this page. Only platform administrators can manage users and groups."
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="user-page-container">
      <div className="user-page-header">
        <Title level={2} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 12 }} />
          User Management
        </Title>
      </div>
      
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'users',
            label: <span><UserOutlined /> Users</span>,
            children: (
              <Card>
                <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onSearch={fetchUsers}
                      style={{ width: 300 }}
                      allowClear
                    />
                    <Button icon={<SyncOutlined />} onClick={fetchUsers}>
                      Refresh
                    </Button>
                  </Space>
                  <Space>
                    {selectedUsers.length > 0 && (
                      <Button 
                        icon={<TeamOutlined />}
                        onClick={() => setBulkAddToGroupModalVisible(true)}
                      >
                        Add {selectedUsers.length} to Group
                      </Button>
                    )}
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => navigate('/users/create')}
                    >
                      Create User
                    </Button>
                  </Space>
                </Space>
                
                <Table
                  dataSource={users}
                  columns={userColumns}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 'max-content' }}
                  rowSelection={{
                    selectedRowKeys: selectedUsers,
                    onChange: setSelectedUsers,
                  }}
                  pagination={{ 
                    pageSize: 10, 
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    locale: { items_per_page: '' }
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'groups',
            label: <span><TeamOutlined /> Groups</span>,
            children: (
              <Card>
                <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                  <Button icon={<SyncOutlined />} onClick={fetchGroups}>
                    Refresh
                  </Button>
                  <Space>
                    <Button 
                      icon={<CloudSyncOutlined />}
                      onClick={handleSyncFromKeycloak}
                    >
                      Sync from Keycloak
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => navigate('/groups/create')}
                    >
                      Create Group
                    </Button>
                  </Space>
                </Space>
                
                <Table
                  dataSource={groups}
                  columns={groupColumns}
                  rowKey="id"
                  scroll={{ x: 'max-content' }}
                  pagination={{ 
                    pageSize: 10, 
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    locale: { items_per_page: '' }
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={editUserModalVisible}
        onCancel={() => {
          setEditUserModalVisible(false);
          editUserForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={editUserForm} layout="vertical" onFinish={handleUpdateUser}>
          <Form.Item name="email" label="Email">
            <Input prefix={<MailOutlined />} placeholder="Enter email" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="firstName" label="First Name">
                <Input placeholder="First name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label="Last Name">
                <Input placeholder="Last name" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Update User
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        title="Reset Password"
        open={resetPasswordModalVisible}
        onCancel={() => {
          setResetPasswordModalVisible(false);
          resetPasswordForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form form={resetPasswordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item
            name="password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 8, message: 'Password must be at least 8 characters' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Enter new password" />
          </Form.Item>
          <Form.Item name="temporary" valuePropName="checked">
            <Switch /> <Text style={{ marginLeft: 8 }}>Require password change on next login</Text>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Reset Password
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        title="Edit Group"
        open={editGroupModalVisible}
        onCancel={() => {
          setEditGroupModalVisible(false);
          editGroupForm.resetFields();
        }}
        footer={null}
        width={650}
      >
        <Form form={editGroupForm} layout="vertical" onFinish={handleUpdateGroup}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Group Name">
                <Input prefix={<TeamOutlined />} placeholder="Enter group name" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="priority_level" label="Priority (0-10)">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="is_active" valuePropName="checked" label="Status">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Collapse 
            ghost 
            style={{ marginBottom: 16 }}
            items={[
              {
                key: 'resources',
                label: <Text strong>Resource Limits</Text>,
                children: (
                  <Row gutter={[16, 8]}>
                    <Col span={8}><Form.Item name="max_assistants_created" label="Assistants Created" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_assistants_running" label="Concurrent Running" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_data_collections" label="Data Collections" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_storage_mb" label="Storage (MB)" style={{ marginBottom: 8 }}><LimitInput suffix="MB" /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_api_keys" label="API Keys" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_widgets" label="Widgets" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                  </Row>
                )
              },
              {
                key: 'hardware',
                label: <Text strong>Hardware Limits</Text>,
                children: (
                  <Row gutter={[16, 8]}>
                    <Col span={8}><Form.Item name="max_model_size_gb" label="Model Size (GB)" style={{ marginBottom: 8 }}><LimitInput step={0.5} suffix="GB" /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_gpu_memory_gb" label="GPU Memory (GB)" style={{ marginBottom: 8 }}><LimitInput step={1} suffix="GB" /></Form.Item></Col>
                    <Col span={8}><Form.Item name="max_cpu_cores" label="CPU Cores" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                  </Row>
                )
              },
              {
                key: 'usage',
                label: <Text strong>Usage Quotas</Text>,
                children: (
                  <Row gutter={[16, 8]}>
                    <Col span={8}><Form.Item name="daily_token_limit" label="Daily Tokens" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="monthly_token_limit" label="Monthly Tokens" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                    <Col span={8}><Form.Item name="daily_api_requests" label="Daily API Calls" style={{ marginBottom: 8 }}><LimitInput /></Form.Item></Col>
                  </Row>
                )
              }
            ]}
          />

          <Form.Item style={{ marginTop: 8, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              Update Group
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        title="Add Member to Group"
        open={addMemberModalVisible}
        onCancel={() => {
          setAddMemberModalVisible(false);
          addMemberForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        <Form form={addMemberForm} layout="vertical" onFinish={handleAddMember}>
          <Form.Item
            name="user_id"
            label="Select User"
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <Select
              showSearch
              placeholder="Search users..."
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.username} ({user.email})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="member">
            <Select>
              <Option value="member">Member</Option>
              <Option value="admin">Admin</Option>
              <Option value="owner">Owner</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add Member
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Add to Group Modal */}
      <Modal
        title={`Add ${selectedUsers.length} Users to Group`}
        open={bulkAddToGroupModalVisible}
        onCancel={() => setBulkAddToGroupModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form layout="vertical" onFinish={handleBulkAddToGroup}>
          <Form.Item
            name="group_id"
            label="Select Group"
            rules={[{ required: true, message: 'Please select a group' }]}
          >
            <Select placeholder="Select a group">
              {groups.map(group => (
                <Option key={group.id} value={group.id}>
                  {group.name} (P{group.priority_level})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="member">
            <Select>
              <Option value="member">Member</Option>
              <Option value="admin">Admin</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              Add to Group
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Group Details Drawer */}
      <Drawer
        title={
          <Space>
            <Avatar icon={<TeamOutlined />} style={{ backgroundColor: '#722ed1' }} />
            <span>{selectedGroup?.name}</span>
            <Tag color={getPriorityColor(selectedGroup?.priority_level)}>Priority {selectedGroup?.priority_level}</Tag>
          </Space>
        }
        open={groupDetailsDrawerVisible}
        onClose={() => {
          setGroupDetailsDrawerVisible(false);
          setSelectedGroup(null);
        }}
        width={600}
      >
        {selectedGroup && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Status" span={2}>
                <Badge status={selectedGroup.is_active ? 'success' : 'error'} text={selectedGroup.is_active ? 'Active' : 'Inactive'} />
              </Descriptions.Item>
              <Descriptions.Item label="Members">{selectedGroup.member_count}</Descriptions.Item>
              <Descriptions.Item label="Priority">{selectedGroup.priority_level}</Descriptions.Item>
              <Descriptions.Item label="Created">{new Date(selectedGroup.created_at).toLocaleDateString()}</Descriptions.Item>
              <Descriptions.Item label="Keycloak ID">{selectedGroup.keycloak_group_id || 'Not synced'}</Descriptions.Item>
            </Descriptions>

            {groupUsage && (
              <Card title="Usage" size="small">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic 
                      title="API Requests Today" 
                      value={groupUsage.total_api_requests_today}
                      suffix={groupUsage.daily_api_limit ? `/ ${groupUsage.daily_api_limit}` : '/ ∞'}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic 
                      title="Tokens Today" 
                      value={groupUsage.total_tokens_today}
                      suffix={groupUsage.daily_token_limit ? `/ ${groupUsage.daily_token_limit}` : '/ ∞'}
                    />
                  </Col>
                </Row>
                {groupUsage.storage_limit_mb > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Text>Storage: {groupUsage.storage_used_mb.toFixed(2)} MB / {groupUsage.storage_limit_mb} MB</Text>
                    <Progress 
                      percent={Math.round((groupUsage.storage_used_mb / groupUsage.storage_limit_mb) * 100)} 
                      size="small" 
                    />
                  </div>
                )}
              </Card>
            )}

            <Card 
              title="Members" 
              size="small"
              extra={
                <Button 
                  type="primary" 
                  size="small" 
                  icon={<PlusOutlined />}
                  onClick={() => setAddMemberModalVisible(true)}
                >
                  Add Member
                </Button>
              }
            >
              <Table
                dataSource={groupMembers}
                columns={memberColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5 }}
              />
            </Card>

            <Collapse defaultActiveKey={['limits']}>
              <Panel header="Assistant Limits" key="limits">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Max Created">{formatLimit(selectedGroup.max_assistants_created)}</Descriptions.Item>
                  <Descriptions.Item label="Max Running">{formatLimit(selectedGroup.max_assistants_running)}</Descriptions.Item>
                  <Descriptions.Item label="Max Collections">{formatLimit(selectedGroup.max_data_collections)}</Descriptions.Item>
                  <Descriptions.Item label="Max Storage">{selectedGroup.max_storage_mb !== null ? <Tag color="blue">{selectedGroup.max_storage_mb} MB</Tag> : <Tag color="green">Unlimited</Tag>}</Descriptions.Item>
                </Descriptions>
              </Panel>
              <Panel header="Hardware & Model Limits" key="hardware">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Max Model Size">{selectedGroup.max_model_size_gb !== null ? <Tag color="blue">{selectedGroup.max_model_size_gb} GB</Tag> : <Tag color="green">Unlimited</Tag>}</Descriptions.Item>
                  <Descriptions.Item label="Max GPU Memory">{selectedGroup.max_gpu_memory_gb !== null ? <Tag color="blue">{selectedGroup.max_gpu_memory_gb} GB</Tag> : <Tag color="green">Unlimited</Tag>}</Descriptions.Item>
                  <Descriptions.Item label="Max CPU Cores">{formatLimit(selectedGroup.max_cpu_cores)}</Descriptions.Item>
                </Descriptions>
              </Panel>
              <Panel header="API & Token Limits" key="api">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Max API Keys">{formatLimit(selectedGroup.max_api_keys)}</Descriptions.Item>
                  <Descriptions.Item label="Max Widgets">{formatLimit(selectedGroup.max_widgets)}</Descriptions.Item>
                  <Descriptions.Item label="Daily Tokens">{formatLimit(selectedGroup.daily_token_limit)}</Descriptions.Item>
                  <Descriptions.Item label="Monthly Tokens">{formatLimit(selectedGroup.monthly_token_limit)}</Descriptions.Item>
                  <Descriptions.Item label="Daily API Requests">{formatLimit(selectedGroup.daily_api_requests)}</Descriptions.Item>
                  <Descriptions.Item label="Monthly API Requests">{formatLimit(selectedGroup.monthly_api_requests)}</Descriptions.Item>
                </Descriptions>
              </Panel>
            </Collapse>
          </Space>
        )}
      </Drawer>

      {/* User Details Drawer */}
      <Drawer
        title={
          <Space>
            <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <span>{selectedUser?.username}</span>
            <Badge status={selectedUser?.enabled ? 'success' : 'error'} text={selectedUser?.enabled ? 'Active' : 'Disabled'} />
          </Space>
        }
        open={userDetailsDrawerVisible}
        onClose={() => {
          setUserDetailsDrawerVisible(false);
          setSelectedUser(null);
        }}
        width={500}
      >
        {selectedUser && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="User ID">{selectedUser.id}</Descriptions.Item>
              <Descriptions.Item label="Username">{selectedUser.username}</Descriptions.Item>
              <Descriptions.Item label="Email">{selectedUser.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="First Name">{selectedUser.firstName || '-'}</Descriptions.Item>
              <Descriptions.Item label="Last Name">{selectedUser.lastName || '-'}</Descriptions.Item>
            </Descriptions>

            <Card title="Groups" size="small">
              {selectedUser.groups?.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selectedUser.groups.map((group, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 8 }}>
                      <Space>
                        <TeamOutlined />
                        <Text strong>{group.name}</Text>
                        <Tag color={getPriorityColor(group.priority_level)}>P{group.priority_level}</Tag>
                        <Tag color={roleColors[group.role]}>{group.role}</Tag>
                      </Space>
                    </Card>
                  ))}
                </Space>
              ) : (
                <Empty description="Not a member of any groups" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default UserManagement;
