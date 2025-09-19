import React from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const StackedAreaChart = ({ data, height = 300 }) => {
  const defaultData = [
    { time: '01:00', successful: 42, failed: 3 },
    { time: '04:00', successful: 20, failed: 3 },
    { time: '08:00', successful: 82, failed: 7 },
    { time: '12:00', successful: 155, failed: 12 },
    { time: '16:00', successful: 218, failed: 16 },
    { time: '20:00', successful: 132, failed: 13 },
    { time: '24:00', successful: 61, failed: 6 }
  ];

  const chartData = data || defaultData;

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const successful = payload.find(p => p.dataKey === 'successful')?.value || 0;
      const failed = payload.find(p => p.dataKey === 'failed')?.value || 0;
      const total = successful + failed;

      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid #e8e8e8',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', marginBottom: '6px' }}>
            {`Time: ${label}`}
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#52c41a', marginBottom: '2px' }}>
            {`Successful: ${successful.toLocaleString()}`}
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#ff4d4f', marginBottom: '4px' }}>
            {`Failed: ${failed.toLocaleString()}`}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#666', borderTop: '1px solid #f0f0f0', paddingTop: '4px' }}>
            {`Total: ${total.toLocaleString()}`}
          </p>
        </div>
      );
    }
    return null;
  };

  const gradientId = "successfulGradient";
  const gradientIdFailed = "failedGradient";

  const chartMargin = { top: 10, right: 10, left: 0, bottom: 10 };
  const xAxisProps = {
    dataKey: "time",
    axisLine: false,
    tickLine: false,
    tick: { fontSize: 12, fill: '#8c8c8c' },
    padding: { left: 0, right: 0 },
    scale: "point"
  };

  return (
    <div style={{ width: '100%', height: height, minHeight: height, display: 'flex', flexDirection: 'column' }}>
      <ResponsiveContainer width="100%" height="100%" style={{ flex: 1 }}>
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#52c41a" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#52c41a" stopOpacity={0.3}/>
            </linearGradient>
            <linearGradient id={gradientIdFailed} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0.3}/>
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
            dataKey="failed"
            stackId="1"
            stroke="#ff4d4f"
            strokeWidth={2}
            fill={`url(#${gradientIdFailed})`}
          />
          <Area
            type="monotone"
            dataKey="successful"
            stackId="1"
            stroke="#52c41a"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Slick Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '24px',
        paddingTop: '8px',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: 'rgba(82, 196, 26, 0.08)',
          border: '1px solid rgba(82, 196, 26, 0.2)'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #52c41a, #73d13d)',
            boxShadow: '0 2px 4px rgba(82, 196, 26, 0.3)'
          }}></div>
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#52c41a'
          }}>
            Successful
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: 'rgba(255, 77, 79, 0.08)',
          border: '1px solid rgba(255, 77, 79, 0.2)'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
            boxShadow: '0 2px 4px rgba(255, 77, 79, 0.3)'
          }}></div>
          <span style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#ff4d4f'
          }}>
            Failed
          </span>
        </div>
      </div>
    </div>
  );
};

export default StackedAreaChart;