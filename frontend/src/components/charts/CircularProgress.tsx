import React from 'react';
import { motion } from 'framer-motion';

interface CircularProgressProps {
  value: number;
  max: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  gradient?: 'primary' | 'secondary' | 'success' | 'warning';
  showPercentage?: boolean;
  icon?: React.ReactNode;
  subtitle?: string;
  animated?: boolean;
}

const sizeMap = {
  sm: { container: 120, stroke: 12, fontSize: '1.5rem' },
  md: { container: 180, stroke: 16, fontSize: '2.5rem' },
  lg: { container: 240, stroke: 20, fontSize: '3.5rem' },
};

const gradientMap = {
  primary: ['#00d4ff', '#ff006e'],
  secondary: ['#667eea', '#764ba2'],
  success: ['#00f260', '#0575e6'],
  warning: ['#f093fb', '#f5576c'],
};

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max,
  label,
  size = 'md',
  gradient = 'primary',
  showPercentage = true,
  icon,
  subtitle,
  animated = true,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const { container, stroke, fontSize } = sizeMap[size];
  const [gradientStart, gradientEnd] = gradientMap[gradient];
  
  const radius = (container - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <motion.div
      className="circular-progress-container"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ width: container, height: container }}
    >
      <svg
        width={container}
        height={container}
        className="circular-progress-svg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
          <filter id="neon-glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={container / 2}
          cy={container / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={stroke}
          fill="none"
        />

        {/* Progress circle */}
        <motion.circle
          cx={container / 2}
          cy={container / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: animated ? strokeDashoffset : circumference }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          filter="url(#neon-glow)"
          style={{
            filter: `drop-shadow(0 0 ${stroke / 2}px ${gradientStart})`,
          }}
        />

        {/* Decorative dots */}
        {[0, 90, 180, 270].map((angle) => (
          <circle
            key={angle}
            cx={container / 2 + radius * Math.cos((angle * Math.PI) / 180)}
            cy={container / 2 + radius * Math.sin((angle * Math.PI) / 180)}
            r={2}
            fill={gradientStart}
            opacity={0.6}
          />
        ))}
      </svg>

      {/* Center content */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ transform: 'rotate(0deg)' }}
      >
        <div className="glass-circle-inner">
          {icon && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="mb-2"
            >
              {icon}
            </motion.div>
          )}
          
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-baseline justify-center">
              <span
                className="font-bold bg-gradient-to-r text-transparent bg-clip-text"
                style={{
                  fontSize,
                  backgroundImage: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`,
                }}
              >
                {showPercentage ? `${Math.round(percentage)}` : value}
              </span>
              {showPercentage && (
                <span className="text-gray-400 ml-1" style={{ fontSize: `calc(${fontSize} * 0.4)` }}>
                  %
                </span>
              )}
            </div>
            
            <div className="mt-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
              {subtitle && (
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <style jsx>{`
        .circular-progress-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .circular-progress-svg {
          position: absolute;
          top: 0;
          left: 0;
        }

        .glass-circle-inner {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          width: 85%;
          height: 85%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 
            inset 0 0 20px rgba(255, 255, 255, 0.05),
            0 8px 32px 0 rgba(31, 38, 135, 0.2);
        }

        @media (max-width: 640px) {
          .glass-circle-inner {
            width: 80%;
            height: 80%;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default CircularProgress;
