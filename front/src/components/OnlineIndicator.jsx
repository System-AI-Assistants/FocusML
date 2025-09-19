import React from 'react';

const OnlineIndicator = ({ isOnline = true, size = 'md', text, showText = true, textStyle: customTextStyle = {}, textClassName = '' }) => {
  const sizes = {
    sm: { width: 8, height: 8 },
    md: { width: 12, height: 12 },
    lg: { width: 16, height: 16 }
  };

  const currentSize = sizes[size];

  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px'
  };

  const indicatorContainerStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  };

  const pingStyle = {
    position: 'absolute',
    display: 'inline-flex',
    width: currentSize.width,
    height: currentSize.height,
    borderRadius: '50%',
    backgroundColor: '#4ade80',
    opacity: 0.75,
    animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
  };

  const dotStyle = {
    position: 'relative',
    display: 'inline-flex',
    width: currentSize.width,
    height: currentSize.height,
    borderRadius: '50%',
    backgroundColor: isOnline ? '#22c55e' : '#9ca3af'
  };

  const textStyle = textClassName ? customTextStyle : {
    margin: 0,
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    ...customTextStyle
  };

  // Add keyframe animation via style tag
  React.useEffect(() => {
    if (!document.getElementById('ping-animation')) {
      const style = document.createElement('style');
      style.id = 'ping-animation';
      style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={containerStyle}>
      {/* Indicator */}
      <div style={indicatorContainerStyle}>
        {/* Pinging animation ring */}
        {isOnline && <span style={pingStyle}></span>}

        {/* Main dot */}
        <span style={dotStyle}></span>
      </div>

      {/* Text */}
      {showText && text && (
        <span
          style={textStyle}
          className={textClassName}
        >
          {text}
        </span>
      )}
    </div>
  );
};

export default OnlineIndicator;