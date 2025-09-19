import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const RequestsChart = ({ data, type = 'line', height = 300 }) => {
  const defaultData = [
    { time: '01:00', requests: 45 },
    { time: '04:00', requests: 23 },
    { time: '08:00', requests: 89 },
    { time: '12:00', requests: 167 },
    { time: '16:00', requests: 234 },
    { time: '20:00', requests: 145 },
    { time: '24:00', requests: 67 }
  ];

  const chartData = data || defaultData;

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', marginBottom: '4px' }}>
            {`Time: ${label}`}
          </p>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1890ff' }}>
            {`Requests: ${payload[0].value.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const gradientId = "requestsGradient";

  // NOTE: changed margin.left to 0, added XAxis padding and scale="point"
  const chartMargin = { top: 10, right: 10, left: 0, bottom: 10 };
  const xAxisProps = {
    dataKey: "time",
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 12, fill: '#8c8c8c' },
    padding: { left: 0, right: 0 },
    scale: "point" // avoids band padding for categorical axis
  };

  if (type === 'area') {
    return (
      <div style={{ width: '100%', height: height, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={chartMargin}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#1890ff" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
              vertical={false}
            />
            <XAxis {...xAxisProps} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#8c8c8c' }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip content={customTooltip} />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="#1890ff"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#1890ff', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: height, minHeight: height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={chartMargin}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            vertical={false}
          />
          <XAxis {...xAxisProps} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#8c8c8c' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={customTooltip} />
          <Line
            type="monotone"
            dataKey="requests"
            stroke="#1890ff"
            strokeWidth={3}
            dot={{ fill: '#1890ff', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#1890ff', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RequestsChart;
