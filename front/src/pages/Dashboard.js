import React from 'react';
import './Dashboard.css';
import {Card, Row, Col, Statistic, List, Typography, Progress, Tag} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ExperimentOutlined,
  CloudServerOutlined,
  UserOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BlockOutlined
} from '@ant-design/icons';

import OnlineIndicator from "../components/OnlineIndicator";
import PeriodSelector from "../components/PeriodSelector";
import RequestsChart from "../components/RequestsChart";
import StackedAreaChart from "../components/StackedAreaChart";
import AssistantsPieChart from "../components/AssistantsPieChart";
import ModelLatencyChart from "../components/ModelLatency";

const {Title, Text} = Typography;


function Dashboard() {
  const recentActivity = [
    {
      title: 'Model training completed',
      time: '2 hours ago',
      status: 'success',
      icon: <CheckCircleOutlined className="status-active"/>
    },
    {
      title: 'New experiment created',
      time: '4 hours ago',
      status: 'info',
      icon: <ExperimentOutlined className="status-info"/>
    },
    {
      title: 'Alert: High CPU usage',
      time: '6 hours ago',
      status: 'warning',
      icon: <AlertOutlined className="status-warning"/>
    },
    {
      title: 'Model deployed to production',
      time: '1 day ago',
      status: 'success',
      icon: <CloudServerOutlined className="status-active"/>
    },
  ];

  const systemMetrics = [
    {name: 'CPU Usage', value: 68, color: '#1890ff'},
    {name: 'Memory Usage', value: 82, color: '#52c41a'},
    {name: 'Storage Usage', value: 45, color: '#faad14'},
    {name: 'Network I/O', value: 23, color: '#722ed1'},
  ];

  return (
    <div className="page-container">
      <div className="sticky-header">
      <div className="page-title-main">Dashboard</div>

      <div >
        <PeriodSelector
          onPeriodChange={(data) => console.log(data)}
          defaultPeriod="last7days"
          showQuickStats={true}
        />
      </div>
      </div>

      {/* Key Statistics */}
      <Row gutter={[24, 24]} style={{marginBottom: '24px'}}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Active Assistants
            </div>

            <OnlineIndicator isOnline={true} size="md" text="10/20" textClassName="stat-value"/>

            <div style={{marginTop: '8px'}}>
              <ArrowUpOutlined style={{color: '#52c41a', marginRight: '4px'}}/>
              <Text type="success">+12% from last month</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Total Users</div>
            <div className="stat-value" style={{color: '#722ed1'}}>156</div>
            <div style={{marginTop: '8px'}}>
              <UserOutlined style={{color: '#722ed1', marginRight: '4px'}}/>
              <Text>+8 new this week</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Token Usage</div>
            <div className="stat-value" style={{color: '#1890ff'}}>29 125</div>
            <div style={{marginTop: '8px'}}>
              <BlockOutlined style={{color: '#1890ff', marginRight: '4px'}}/>
              <Text>451 today</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Availability</div>
            <div className="stat-value" style={{color: '#52c41a'}}>99.9%</div>
            <div style={{marginTop: '8px'}}>
              <CheckCircleOutlined style={{color: '#52c41a', marginRight: '4px'}}/>
              <Text type="success">Up 12 days 17 hours</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{marginBottom: '24px'}}>

        <Col xs={24} lg={12}>
          <Card className="modern-card" title={<span className="card-title">Requests Over Time</span>}>
            <StackedAreaChart height={300} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card className="modern-card" title={<span className="card-title">Token Usage Over Time</span>}>

              <RequestsChart type="area"
              data={[
                               { time: '01:00', requests: 500 },
                               { time: '04:00', requests: 850 },
                               { time: '08:00', requests: 900 },
                               { time: '12:00', requests: 1920 },
                               { time: '16:00', requests: 2554 },
                               { time: '20:00', requests: 3200 },
                               { time: '24:00', requests: 3300 }
                             ]}
              />

          </Card>
        </Col>

      </Row>

      <Row gutter={[24, 24]} style={{marginBottom: '24px'}}>

        <Col xs={24} lg={10}>
          <Card className="modern-card" title={<span className="card-title">Assistant Usage Distribution</span>}>
            <AssistantsPieChart height={350} />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
            <Card className="modern-card" title={<span className="card-title">Model Latency Metrics</span>}>
              <ModelLatencyChart height={350} />
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
                <List.Item style={{padding: '16px 0', borderBottom: '1px solid #f0f2f5'}}>
                  <List.Item.Meta
                    avatar={item.icon}
                    title={<span style={{fontWeight: 500}}>{item.title}</span>}
                    description={
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <ClockCircleOutlined style={{color: '#8c8c8c'}}/>
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
            <div style={{padding: '8px 0'}}>
              {systemMetrics.map((metric, index) => (
                <div key={index} style={{marginBottom: '24px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <Text style={{fontWeight: 500}}>{metric.name}</Text>
                    <Text style={{fontWeight: 600}}>{metric.value}%</Text>
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
