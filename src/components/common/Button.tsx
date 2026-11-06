import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'default';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: React.ReactNode;
  // Obligatoire pour un bouton sans texte (icône seule) : lu par les lecteurs d'écran et affiché au survol
  ariaLabel?: string;
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
  ariaLabel,
}) => {
  // Variantes de la charte Mannyx (classes .mx-btn-* dans src/styles/gomat-mx.css)
  const variantClasses = {
    primary: 'mx-btn-primary',
    default: 'mx-btn-primary',
    secondary: 'mx-btn-secondary',
    outline: 'mx-btn-secondary',
    success: 'mx-btn-success',
    warning: 'mx-btn-warning',
    danger: 'mx-btn-danger',
  };

  // Libellé 12,5px / 600 (tronc MX). Sur mobile/tablette : cible tactile d'au moins 44px ; compact sur grand écran
  const sizeClasses = {
    sm: 'text-[length:calc(12.5px*var(--mx-scale,1))] px-2.5 py-1 min-h-[44px] min-w-[44px] lg:min-h-[28px] lg:min-w-0',
    md: 'text-[length:calc(12.5px*var(--mx-scale,1))] px-3.5 py-[7px] min-h-[44px] min-w-[44px] lg:min-h-[32px] lg:min-w-0',
    lg: 'text-[length:calc(12.5px*var(--mx-scale,1))] px-4 py-2 min-h-[44px] min-w-[44px]',
  };

  return (
    <button
      type={type}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
        mx-btn
        flex items-center justify-center gap-1.5 whitespace-nowrap
      `}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Chargement...
        </>
      ) : (
        <>
          {icon && <span className="text-[0.9em]" aria-hidden="true">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};

export default Button;
export type { ButtonProps };