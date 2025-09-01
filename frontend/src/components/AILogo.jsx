import React from 'react';
import { Brain } from 'lucide-react';

const AILogo = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Brain className={`${sizeClasses[size]} text-cyan-400`} />
      {size !== 'sm' && (
        <span className="text-white font-bold text-xl">
          AI Job Chommie
        </span>
      )}
    </div>
  );
};

export default AILogo;
