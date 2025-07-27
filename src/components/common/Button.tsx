import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'default';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  className?: string;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  icon,
  type = 'button',
  onClick,
  className = '',
  loading = false,
}) => {
  const variantClasses = {
    primary: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100',
    success: 'bg-success-600 hover:bg-success-700 dark:bg-success-500 dark:hover:bg-success-600 text-white',
    warning: 'bg-warning-500 hover:bg-warning-600 dark:bg-warning-500 dark:hover:bg-warning-600 text-white',
    danger: 'bg-danger-600 hover:bg-danger-700 dark:bg-danger-500 dark:hover:bg-danger-600 text-white',
    outline: 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-300 dark:border-gray-600',
    default: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white', // Identique à primary pour compatibilité
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-xs px-3 py-1.5',
    lg: 'text-sm px-4 py-2',
  };

  return (
    <button
      type={type}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
        rounded-md font-medium shadow-sm
        focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:ring-opacity-50
        transition-colors duration-200
        flex items-center justify-center gap-1.5
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Chargement...
        </>
      ) : (
        <>
          {icon && <span className="text-[0.9em]">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
export type { ButtonProps };