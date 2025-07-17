import React from 'react';
import { Card, Row, Col, Statistic, List, Typography, Progress, Tag } from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  ExperimentOutlined,
  CloudServerOutlined,
  UserOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

function Dashboard() {
  const recentActivity = [
    { 
      title: 'Model training completed', 
      time: '2 hours ago',
      status: 'success',
      icon: <CheckCircleOutlined className="status-active" />
    },
    { 
      title: 'New experiment created', 
      time: '4 hours ago',
      status: 'info',
      icon: <ExperimentOutlined className="status-info" />
    },
    { 
      title: 'Alert: High CPU usage', 
      time: '6 hours ago',
      status: 'warning',
      icon: <AlertOutlined className="status-warning" />
    },
    { 
      title: 'Model deployed to production', 
      time: '1 day ago',
      status: 'success',
      icon: <CloudServerOutlined className="status-active" />
    },
  ];

  const systemMetrics = [
    { name: 'CPU Usage', value: 68, color: '#1890ff' },
    { name: 'Memory Usage', value: 82, color: '#52c41a' },
    { name: 'Storage Usage', value: 45, color: '#faad14' },
    { name: 'Network I/O', value: 23, color: '#722ed1' },
  ];

  return (
    <div style={{ padding: '24px', background: '#f8f9fa', minHeight: '100vh' }}>
      <div className="page-title">Dashboard</div>
      
      {/* Key Statistics */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{ textAlign: 'center', padding: '16px' }}>
            <div className="stat-title">Active Models</div>
            <div className="stat-value" style={{ color: '#52c41a' }}>24</div>
            <div style={{ marginTop: '8px' }}>
              <ArrowUpOutlined style={{ color: '#52c41a', marginRight: '4px' }} />
              <Text type="success">+12% from last month</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{ textAlign: 'center', padding: '16px' }}>
            <div className="stat-title">Running Experiments</div>
            <div className="stat-value" style={{ color: '#1890ff' }}>8</div>
            <div style={{ marginTop: '8px' }}>
              <ExperimentOutlined style={{ color: '#1890ff', marginRight: '4px' }} />
              <Text>3 completed today</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{ textAlign: 'center', padding: '16px' }}>
            <div className="stat-title">Total Users</div>
            <div className="stat-value" style={{ color: '#722ed1' }}>156</div>
            <div style={{ marginTop: '8px' }}>
              <UserOutlined style={{ color: '#722ed1', marginRight: '4px' }} />
              <Text>+8 new this week</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{ textAlign: 'center', padding: '16px' }}>
            <div className="stat-title">System Uptime</div>
            <div className="stat-value" style={{ color: '#52c41a' }}>99.9%</div>
            <div style={{ marginTop: '8px' }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '4px' }} />
              <Text type="success">All systems operational</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Recent Activity */}
        <Col xs={24} lg={16}>
          <Card className="modern-card" title={<span className="card-title">Recent Activity</span>}>
            <List
              itemLayout="horizontal"
              dataSource={recentActivity}
              renderItem={item => (
                <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #f0f2f5' }}>
                  <List.Item.Meta
                    avatar={item.icon}
                    title={<span style={{ fontWeight: 500 }}>{item.title}</span>}
                    description={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
                        <Text type="secondary">{item.time}</Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* System Metrics */}
        <Col xs={24} lg={8}>
          <Card className="modern-card" title={<span className="card-title">System Metrics</span>}>
            <div style={{ padding: '8px 0' }}>
              {systemMetrics.map((metric, index) => (
                <div key={index} style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <Text style={{ fontWeight: 500 }}>{metric.name}</Text>
                    <Text style={{ fontWeight: 600 }}>{metric.value}%</Text>
                  </div>
                  <Progress 
                    percent={metric.value} 
                    strokeColor={metric.color}
                    showInfo={false}
                    strokeWidth={8}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
