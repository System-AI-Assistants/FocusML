import React, { useState, useEffect } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import './Dashboard.css';
import {Card, Row, Col, Statistic, List, Typography, Progress, Tag, Spin} from 'antd';
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
import {getStatistics} from "../services/api";

const {Title, Text} = Typography;

function Dashboard() {
  const { keycloak } = useKeycloak();
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');

  // Fetch statistics data
  const fetchStatistics = async (period) => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    try {
      const data = await getStatistics(keycloak, period);
      setStatistics(data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics(selectedPeriod);
  }, [keycloak?.authenticated, selectedPeriod]);

  const handlePeriodChange = (newPeriod) => {
    setSelectedPeriod(newPeriod);
    fetchStatistics(newPeriod);
  };

  // Format percentage change display
  const formatPercentageChange = (value) => {
    if (value === null || value === undefined) return null;

    const isPositive = value >= 0;
    const Icon = isPositive ? ArrowUpOutlined : ArrowDownOutlined;
    const color = isPositive ? '#52c41a' : '#ff4d4f';

    return (
      <div style={{marginTop: '8px'}}>
        <Icon style={{color, marginRight: '4px'}}/>
        <Text style={{color}}>{isPositive ? '+' : ''}{value.toFixed(1)}% from previous period</Text>
      </div>
    );
  };

  // Format uptime display
  const formatUptime = (hours) => {
    if (!hours) return 'N/A';
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} days ${remainingHours} hours`;
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (num === null || num === undefined) return 'N/A';
    return new Intl.NumberFormat().format(num);
  };

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

  // Create system metrics from statistics data
  const systemMetrics = statistics?.system_metrics ? [
    {name: 'CPU Usage', value: statistics.system_metrics.cpu_usage, color: '#1890ff'},
    {name: 'Memory Usage', value: statistics.system_metrics.memory_usage, color: '#52c41a'},
    {name: 'Storage Usage', value: statistics.system_metrics.storage_usage, color: '#faad14'},
  ] : [];

  // Add GPU metrics if available
  if (statistics?.system_metrics?.gpu_metrics && statistics.system_metrics.gpu_metrics.length > 0) {
    statistics.system_metrics.gpu_metrics.forEach((gpu, index) => {
      systemMetrics.push(
        {name: `GPU ${gpu.id} Usage`, value: gpu.gpu_usage, color: '#722ed1'},
        {name: `GPU ${gpu.id} Memory`, value: gpu.memory_usage, color: '#eb2f96'}
      );
    });
  }

  if (loading) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="sticky-header">
        <div className="page-title-main">Dashboard</div>
        <div>
          <PeriodSelector
            onPeriodChange={handlePeriodChange}
            defaultPeriod={selectedPeriod}
            showQuickStats={true}
          />
        </div>
      </div>

      {/* Key Statistics */}
      <Row gutter={[24, 24]} style={{marginBottom: '24px'}}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Active Assistants</div>

            <OnlineIndicator
              isOnline={statistics?.assistant_stats?.active_assistants > 0}
              size="md"
              text={`${statistics?.assistant_stats?.active_assistants || 0}/${statistics?.assistant_stats?.total_assistants || 0}`}
              textClassName="stat-value"
            />

            {formatPercentageChange(statistics?.assistant_stats?.active_change_percentage)}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Total Users</div>
            <div className="stat-value" style={{color: '#722ed1'}}>
              {formatNumber(statistics?.user_stats?.total_users)}
            </div>
            <div style={{marginTop: '8px'}}>
              <UserOutlined style={{color: '#722ed1', marginRight: '4px'}}/>
              <Text>
                {statistics?.user_stats?.change_percentage !== null
                  ? `${statistics?.user_stats?.change_percentage > 0 ? '+' : ''}${statistics?.user_stats?.change_percentage}% change`
                  : 'Historical data needed'
                }
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Token Usage</div>
            <div className="stat-value" style={{color: '#1890ff'}}>
              {statistics?.token_usage?.total_tokens ? formatNumber(statistics.token_usage.total_tokens) : 'N/A'}
            </div>
            <div style={{marginTop: '8px'}}>
              <BlockOutlined style={{color: '#1890ff', marginRight: '4px'}}/>
              <Text>
                {statistics?.token_usage?.total_tokens ? 'Tracking active' : 'Not tracked yet'}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="modern-card" style={{textAlign: 'left', padding: '0px'}}>
            <div className="stat-title">Availability</div>
            <div className="stat-value" style={{color: '#52c41a'}}>
              {statistics?.availability?.availability_percentage?.toFixed(2) || '99.9'}%
            </div>
            <div style={{marginTop: '8px'}}>
              <CheckCircleOutlined style={{color: '#52c41a', marginRight: '4px'}}/>
              <Text type="success">
                Up {formatUptime(statistics?.availability?.uptime_hours)}
              </Text>
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
              {systemMetrics.length > 0 ? systemMetrics.map((metric, index) => (
                <div key={index} style={{marginBottom: '24px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '8px'}}>
                    <Text style={{fontWeight: 500}}>{metric.name}</Text>
                    <Text style={{fontWeight: 600}}>{metric.value?.toFixed(1) || 0}%</Text>
                  </div>
                  <Progress
                    percent={metric.value || 0}
                    strokeColor={metric.color}
                    showInfo={false}
                    strokeWidth={8}
                  />
                </div>
              )) : (
                <div style={{textAlign: 'center', padding: '20px'}}>
                  <Text type="secondary">System metrics unavailable</Text>
                </div>
              )}

              {/* Network Stats */}
              {statistics?.system_metrics && (
                <div style={{marginTop: '16px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px'}}>
                  <Text strong style={{fontSize: '12px', color: '#666'}}>NETWORK I/O</Text>
                  <div style={{marginTop: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                      <Text style={{fontSize: '12px'}}>Bytes Sent</Text>
                      <Text style={{fontSize: '12px', fontWeight: 600}}>
                        {formatNumber(statistics.system_metrics.network_bytes_sent)}
                      </Text>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <Text style={{fontSize: '12px'}}>Bytes Received</Text>
                      <Text style={{fontSize: '12px', fontWeight: 600}}>
                        {formatNumber(statistics.system_metrics.network_bytes_recv)}
                      </Text>
                    </div>
                  </div>
                </div>
              )}

              {/* GPU Info */}
              {statistics?.system_metrics?.gpu_metrics && statistics.system_metrics.gpu_metrics.length > 0 && (
                <div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px'}}>
                  <Text strong style={{fontSize: '12px', color: '#52c41a'}}>GPU DETAILS</Text>
                  {statistics.system_metrics.gpu_metrics.map((gpu, index) => (
                    <div key={index} style={{marginTop: '8px'}}>
                      <Text style={{fontSize: '12px', fontWeight: 600}}>{gpu.name}</Text>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px'}}>
                        <Text style={{fontSize: '12px'}}>Memory: {gpu.memory_used?.toFixed(0)}MB / {gpu.memory_total?.toFixed(0)}MB</Text>
                        <Text style={{fontSize: '12px'}}>Temp: {gpu.temperature}°C</Text>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;