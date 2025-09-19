import React, { useState } from 'react';
import { Space } from 'antd';

const PeriodSelector = ({
  onPeriodChange,
  defaultPeriod = 'last7days'
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  const periods = [
    { value: 'today', label: 'Today' },
    { value: 'last7days', label: '7 Days' },
    { value: 'last30days', label: '30 Days' },
    { value: 'last90days', label: '90 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'allTime', label: 'All Time' },
  ];

  const handlePeriodClick = (value) => {
    setSelectedPeriod(value);
    onPeriodChange && onPeriodChange(value);
  };

  const chipStyle = (isSelected) => ({
    padding: '8px 16px',
    borderRadius: '20px',
    border: isSelected ? '2px solid #1890ff' : '2px solid #d9d9d9',
    background: isSelected ? '#1890ff' : '#fff',
    color: isSelected ? '#fff' : '#666',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: isSelected ? '500' : '400',
    transition: 'all 0.3s ease',
    userSelect: 'none'
  });

  return (
    <Space size={12} wrap>
      {periods.map(period => (
        <div
          key={period.value}
          style={chipStyle(selectedPeriod === period.value)}
          onClick={() => handlePeriodClick(period.value)}
          onMouseEnter={(e) => {
            if (selectedPeriod !== period.value) {
              e.target.style.borderColor = '#1890ff';
              e.target.style.background = '#f0f8ff';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedPeriod !== period.value) {
              e.target.style.borderColor = '#d9d9d9';
              e.target.style.background = '#fff';
            }
          }}
        >
          {period.label}
        </div>
      ))}
    </Space>
  );
};

export default PeriodSelector;