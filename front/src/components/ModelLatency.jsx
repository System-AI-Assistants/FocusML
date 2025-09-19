import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

/**
 * ModelLatencyChart
 * Props:
 *  - data: array of data
 *  - height: number (px) or string '100%' (default 350)
 *  - stretch: boolean (if true and height === '100%', wrapper uses flex:1)
 *  - legendPosition: 'right' | 'bottom' (default 'right')
 *  - legendWidth: number (px) width of right legend (default 260)
 */
const ModelLatencyChart = ({
  data,
  height = 350,
  stretch = false,
  legendPosition = 'right',
  legendWidth = 260
}) => {
  const defaultData = [
    { model: 'GPT-4', p50: 120, p95: 280, p99: 450, average: 145 },
    { model: 'Claude-3', p50: 95, p95: 220, p99: 380, average: 118 },
    { model: 'Gemini Pro', p50: 110, p95: 260, p99: 420, average: 135 },
    { model: 'Llama-2', p50: 85, p95: 190, p99: 310, average: 102 },
    { model: 'Mistral-7B', p50: 75, p95: 170, p99: 285, average: 92 }
  ];
  const chartData = data || defaultData;

  const colors = {
    p50: '#52c41a',
    average: '#1890ff',
    p95: '#faad14',
    p99: '#ff4d4f'
  };

  // small responsive breakpoint to switch legend placement
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 720 : false
  );
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const useRightLegend = legendPosition === 'right' && !isNarrow;

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          minWidth: 220
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#262626',
            marginBottom: 12,
            borderBottom: '1px solid #f0f0f0',
            paddingBottom: 8
          }}>
            {label} Latency
          </div>
          {payload.map((entry, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: entry.color,
                  boxShadow: `0 2px 4px ${entry.color}40`
                }} />
                <span style={{
                  fontSize: 13, color: '#666', textTransform: 'uppercase', fontWeight: 500
                }}>{entry.dataKey}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: entry.color }}>
                {entry.value}ms
              </span>
            </div>
          ))}
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0',
            fontSize: 12, color: '#999'
          }}>
            Lower is better
          </div>
        </div>
      );
    }
    return null;
  };

  const legendItems = [
    { dataKey: 'p50', name: 'P50', description: '50% of requests', color: colors.p50 },
    { dataKey: 'average', name: 'Average', description: 'Mean latency', color: colors.average },
    { dataKey: 'p95', name: 'P95', description: '95% of requests', color: colors.p95 },
    { dataKey: 'p99', name: 'P99', description: '99% of requests', color: colors.p99 }
  ];

  const LegendRight = ({ items }) => (
    <div style={{
      width: legendWidth,
      minWidth: legendWidth,
      maxWidth: legendWidth,
      boxSizing: 'border-box',
      paddingLeft: 12,
      paddingTop: 6,
      paddingBottom: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      // crucial: keep legend height limited so it won't push the chart taller
      overflowY: 'auto',
      overflowX: 'hidden',
      maxHeight: '100%'
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '8px',
          borderRadius: 10,
          background: `${item.color}10`,
          border: `1px solid ${item.color}20`,
          minHeight: 44,
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: 2, background: item.color,
            boxShadow: `0 1px 3px ${item.color}40`
          }} />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 600, color: '#222', fontSize: 13 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const LegendBottom = ({ items }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 12,
      paddingTop: 12,
      paddingBottom: 6
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 16,
          background: `${item.color}10`,
          border: `1px solid ${item.color}30`,
          fontSize: 12
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: 2,
            background: item.color,
            boxShadow: `0 1px 3px ${item.color}40`
          }} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ fontWeight: 600, color: item.color }}>{item.name}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: -2 }}>{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );

  // wrapper sizing strategy (outer container)
  const isFixedHeight = typeof height === 'number';
  const outerBase = isFixedHeight
    ? { width: '100%', height, minHeight: height, boxSizing: 'border-box' }
    : (stretch
      ? { width: '100%', flex: 1, minHeight: 200, height: '100%', boxSizing: 'border-box' }
      : { width: '100%', minHeight: 200, height: height || '100%', boxSizing: 'border-box' });

  // final outer container style: row when legend right, column otherwise
  const outerStyle = {
    display: 'flex',
    flexDirection: useRightLegend ? 'row' : 'column',
    alignItems: 'stretch',
    width: '100%',
    ...outerBase
  };

  return (
    <div style={outerStyle}>
      {/* Chart area: flex:1 so it maintains consistent height when legend is on right */}
      <div style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 24, left: 12, bottom: 48 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="model"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#8c8c8c' }}
              angle={-30}
              textAnchor="end"
              height={54}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#8c8c8c' }}
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip content={customTooltip} />

            <Bar dataKey="p50" fill={colors.p50} radius={[6, 6, 0, 0]} name="P50" />
            <Bar dataKey="average" fill={colors.average} radius={[6, 6, 0, 0]} name="Average" />
            <Bar dataKey="p95" fill={colors.p95} radius={[6, 6, 0, 0]} name="P95" />
            <Bar dataKey="p99" fill={colors.p99} radius={[6, 6, 0, 0]} name="P99" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend column (right) OR bottom legend */}
      {useRightLegend ? (
        <LegendRight items={legendItems} />
      ) : (
        <LegendBottom items={legendItems} />
      )}
    </div>
  );
};

export default ModelLatencyChart;
