import React from "react";
import ActionInputBar, { ActionInputBarProps } from "./ActionInputBar";
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
        <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full bg-form-bg p-3 rounded-lg shadow-inner border border-border-main/10">
                <div className="flex-1 w-full md:max-w-[400px]">
                {props.actionInputBar && (
                    <ActionInputBar
                        {...props.actionInputBar}
                    />
                )}
                </div>
                {props.buttons && (
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                        {
                            props.buttons.map(button => (
                                <button 
                                    key={button.label} 
                                    onClick={button.onClick}
                                    disabled={button.disabled}
                                    className={`px-3 py-1.5 font-semibold text-xs rounded-md transition-all duration-200 ${
                                        button.disabled 
                                        ? 'bg-list-bg text-text-main/50 cursor-not-allowed border border-white/5 shadow-none' 
                                        : 'bg-gradient-to-r from-primary to-[#057a37] text-white hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-95 border border-primary/30 shadow-md'
                                    }`}
                                >
                                    {button.label}
                                </button>
                            ))
                        }
                    </div>
                )}
            {props.info && (
                <div className="text-sm font-medium text-text-main/70 px-2 flex justify-end">
                    {props.info}
                </div>
            )}
            </div>

            {props.children}
        </div>
    );
}

export default ControlPanel; 