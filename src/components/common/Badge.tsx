import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => {
  const variantClasses = {
    success: 'bg-success-100 dark:bg-success-900/50 text-success-800 dark:text-success-200',
    warning: 'bg-warning-100 dark:bg-warning-900/50 text-warning-800 dark:text-warning-200',
    danger: 'bg-danger-100 dark:bg-danger-900/50 text-danger-800 dark:text-danger-200',
    info: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200',
    neutral: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    outline: 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300',
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;