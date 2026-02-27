import React from "react";
import ActionInputBar, { ActionInputBarProps } from "./ActionInputBar";
import "./ControlPanel.css";
interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

export interface ControlPanelProps {
    buttons?: ButtonProps[];
    actionInputBar?: ActionInputBarProps;
    children: React.ReactNode;
    info?: string;
}

/**
 * ControlPanel Component
 * 
 * A versatile layout component designed to sit above lists, tables, or complex visualizations.
 * It can render an `ActionInputBar` (for things like searching or adding items by ID), 
 * a row of customizable `buttons` (for sorting, filtering, reloading), and an optional 
 * `info` text block, all positioned nicely within a flex container.
 */
const ControlPanel = (props: ControlPanelProps) => {
    return (
        <div className="control-panel">
            <div className="controls">
                <div className="action-bar">
                {props.actionInputBar && (
                    <ActionInputBar
                        {...props.actionInputBar}
                    />
                )}
                </div>
                {props.buttons && (
                    <div className="control-panel-buttons">
                        {
                            props.buttons.map(button => (
                                <button 
                                    key={button.label} 
                                    onClick={button.onClick}
                                    disabled={button.disabled}
                                    className={button.disabled ? 'disabled' : ''}
                                >
                                    {button.label}
                                </button>
                            ))
                        }
                    </div>
                )}
                {props.info && (
                    <div className="control-panel-info">
                        {props.info}
                    </div>
                )}
            </div>

            {props.children}
        </div>
    );
}

export default ControlPanel; 