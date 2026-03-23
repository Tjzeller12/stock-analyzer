import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'outline' | 'inner';
  style?: React.CSSProperties;
}

/**
 * A reusable container component with standardized styling.
 * Supports different visuaßl variants and an optional title.
 */
const Card: React.FC<CardProps> = ({ 
  title, 
  children, 
  className = '', 
  variant = 'default',
  style 
}) => {
  const baseCardClasses = "backdrop-blur-xl rounded-xl p-4 transition-all duration-300 ease-in-out flex flex-col overflow-y-auto m-0 w-full text-text-main [scrollbar-color:var(--scrollbar-color)] relative z-10";

  let specificClasses = "";
  if (variant === 'default') {
    specificClasses = "bg-form-bg border border-border-main/20 shadow-lg dark:shadow-none hover:shadow-2xl";
  } else if (variant === 'glass') {
    specificClasses = "bg-glass-bg border border-border-main/20 dark:border-white/10 shadow-xl hover:shadow-2xl";
  } else if (variant === 'outline') {
    specificClasses = "bg-transparent border-2 border-border-main/30 shadow-none hover:shadow-none";
  } else if (variant === 'inner') {
    specificClasses = "bg-form-bg shadow-inner border border-border-main/10 hover:shadow-none";
  }

  return (
    <div 
      className={`${baseCardClasses} ${specificClasses} ${className}`}
      style={style}
    >
      {title && (
        <div className="mb-3 border-b border-border-main/20 pb-2 w-full">
          <h3 className="m-0 text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-500 tracking-tight">{title}</h3>
        </div>
      )}
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
};

export default Card;
