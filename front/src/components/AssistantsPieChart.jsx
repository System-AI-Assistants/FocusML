import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * AssistantsPieChart
 * Props:
 *  - data: [{ name, value, requests }]
 *  - height: number (px) or '100%' (default 300)
 *  - stretch: boolean - if true and height === '100%', wrapper uses flex:1
 *  - legendPosition: 'right' | 'bottom' (default 'right')
 *  - legendWidth: number (px) width of right legend (default 260)
 */
const AssistantsPieChart = ({
  data,
  height = 300,
  stretch = false,
  legendPosition = 'right',
  legendWidth = 200
}) => {
  const defaultData = [
    { name: 'Coding Assistant', value: 35, requests: 2450 },
    { name: 'Data Analyst', value: 22, requests: 1540 },
    { name: 'Content Writer', value: 18, requests: 1260 },
    { name: 'Math Solver', value: 12, requests: 840 },
    { name: 'Research Assistant', value: 8, requests: 560 },
    { name: 'Design Helper', value: 5, requests: 350 }
  ];
  const chartData = data || defaultData;

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#722ed1',
    '#eb2f96', '#13c2c2', '#f5222d', '#fa8c16'
  ];

  // responsive breakpoint: when true we switch to stacked (legend bottom) layout
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 720 : false
  );
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const customTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const color = payload[0].color || '#000';
      return (
        <div style={{
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 180
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%', background: color,
              boxShadow: `0 2px 6px ${color}40`
            }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>{d.name}</div>
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
            Requests: <span style={{ fontWeight: 600, color: '#262626' }}>{d.requests.toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            Share: <span style={{ fontWeight: 600, color }}>{d.value}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // wrapper sizing strategy
  const isFixedHeight = typeof height === 'number';
  const wrapperStyle = isFixedHeight
    ? { width: '100%', height, minHeight: height, boxSizing: 'border-box' }
    : (stretch
      ? { width: '100%', flex: 1, minHeight: 200, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }
      : { width: '100%', minHeight: 200, height: height || '100%', boxSizing: 'border-box' });

  // compute radii: pixel when height fixed, percent when flexible
  const outerRadius = isFixedHeight ? Math.max(60, Math.min(Math.floor(height * 0.35), 140)) : '60%';
  const innerRadius = typeof outerRadius === 'number' ? Math.max(Math.round(outerRadius * 0.5), 30) : '40%';

  // Legend rendering: when legendPosition === 'right' and not narrow => horizontal layout with legend on right
  const LegendRight = ({ items }) => (
    <div style={{
      width: legendWidth,
      minWidth: legendWidth,
      maxWidth: legendWidth,
      boxSizing: 'border-box',
      paddingLeft: 12,
      paddingTop: 4,
      paddingBottom: 4,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      alignItems: 'stretch',
      // crucial: do not let legend expand the parent height — make it scroll internally
      overflowY: 'auto',
      overflowX: 'hidden',
      maxHeight: '100%' // ensures it won't grow past parent container
    }}>
      {items.map((entry, i) => {
        const color = colors[i % colors.length];
        return (
          <div key={i} style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '8px',
            borderRadius: 10,
            background: `${color}10`,
            border: `1px solid ${color}20`,
            minHeight: 40,
            boxSizing: 'border-box'
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600, color: '#222', fontSize: 13 }}>{entry.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{entry.value}% • {entry.requests.toLocaleString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const LegendBottom = ({ items }) => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      paddingTop: 12,
      maxWidth: '100%'
    }}>
      {items.map((entry, i) => {
        const color = colors[i % colors.length];
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 16,
            background: `${color}10`, border: `1px solid ${color}30`,
            fontSize: 12, color: '#444'
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontWeight: 600 }}>{entry.name}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{entry.value}% • {entry.requests.toLocaleString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // layout decision
  const useRightLegend = legendPosition === 'right' && !isNarrow;

  return (
    <div style={{
      display: 'flex',
      flexDirection: useRightLegend ? 'row' : 'column',
      alignItems: 'stretch',
      width: '100%',
      boxSizing: 'border-box',
      ...wrapperStyle
    }}>
      {/* Chart area: flex: 1 so it stays consistent height when legend is on right */}
      <div style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 12, right: 3, bottom: 12, left: 3 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              dataKey="value"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={outerRadius}
              innerRadius={innerRadius}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.06))' }}
                />
              ))}
            </Pie>
            <Tooltip content={customTooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend column (right) OR bottom legend */}
      {useRightLegend ? (
        <LegendRight items={chartData} />
      ) : (
        <LegendBottom items={chartData} />
      )}
    </div>
  );
};

export default AssistantsPieChart;
