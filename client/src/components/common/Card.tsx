import React, { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'outline';
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
  return (
    <div 
      className={`start-card variant-${variant} ${className}`}
      style={style}
    >
      {title && (
        <div className="start-card-header">
          <h3 className="start-card-title">{title}</h3>
        </div>
      )}
      <div className="start-card-content">
        {children}
      </div>
    </div>
  );
};

export default Card;
