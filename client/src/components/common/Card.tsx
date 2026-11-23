import React, { ReactNode } from 'react';
import LedText, { LedDisplay } from './LedText';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'outline' | 'inner';
  style?: React.CSSProperties;
  /** Shows the pulsing live-data dot next to the title. */
  live?: boolean;
  /** Controls rendered at the right end of the title row. */
  actions?: ReactNode;
}

/**
 * A reusable container component with standardized styling.
 * `default` and `glass` render as a Ticker Glass pane with an LED title strip.
 */
const Card: React.FC<CardProps> = ({ 
  title, 
  children, 
  className = '', 
  variant = 'default',
  style,
  live = false,
  actions,
}) => {
  const baseCardClasses = "p-4 flex flex-col m-0 w-full text-text-main relative z-10";

  let specificClasses = "";
  if (variant === 'default' || variant === 'glass') {
    specificClasses = "tg-pane";
  } else if (variant === 'outline') {
    specificClasses = "rounded-[20px] bg-transparent border border-[var(--tg-pane-border)]";
  } else if (variant === 'inner') {
    specificClasses = "rounded-xl bg-black/10 dark:bg-black/30 shadow-inner border border-[var(--tg-hairline)]";
  }

  return (
    <div 
      className={`${baseCardClasses} ${specificClasses} ${className}`}
      style={style}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <LedDisplay className="inline-flex" layerClassName="flex items-center gap-2.5 px-3 py-1.5">
            {live && <span className="tg-live-dot" aria-hidden="true" />}
            <h3 className="m-0 text-[15px]">
              <LedText>{title}</LedText>
            </h3>
          </LedDisplay>
          {actions}
        </div>
      )}
      <div className="flex-1 w-full min-h-0 overflow-y-auto [scrollbar-color:var(--scrollbar-color)_transparent]">
        {children}
      </div>
    </div>
  );
};

export default Card;
