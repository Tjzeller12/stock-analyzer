import React from "react";
import ActionInputBar, { ActionInputBarProps } from "./ActionInputBar";
import StockSearchInput from "./StockSearchInput";

interface ButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

export interface ControlPanelProps {
    buttons?: ButtonProps[];
    actionInputBar?: ActionInputBarProps;
    onStockSelect?: (symbol: string) => void;
    children: React.ReactNode;
    info?: string;
    extra?: React.ReactNode;
}

/**
 * ControlPanel Component
 *
 * A versatile layout component designed to sit above lists, tables, or complex visualizations.
 * It can render a live stock search, an `ActionInputBar`, a row of customizable buttons,
 * and an optional `info` text block.
 */
const ControlPanel = (props: ControlPanelProps) => {
    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 w-full p-2.5 rounded-xl bg-black/5 dark:bg-black/30 shadow-inner border border-[var(--tg-hairline)]">
                <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
                    {props.onStockSelect ? (
                        <div className="w-full md:w-[300px]">
                            <StockSearchInput onStockSelect={props.onStockSelect} />
                        </div>
                    ) : props.actionInputBar && (
                        <div className="w-full md:w-[300px]">
                            <ActionInputBar
                                {...props.actionInputBar}
                            />
                        </div>
                    )}
                    {props.buttons && props.buttons.map(button => (
                        <button
                            key={button.label}
                            onClick={button.onClick}
                            disabled={button.disabled}
                            className="tg-btn tg-btn-primary shrink-0"
                        >
                            {button.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3 md:ml-auto">
                    {props.info && (
                        <div className="text-xs font-mono text-text-main/60 px-2 text-right whitespace-nowrap">
                            {props.info}
                        </div>
                    )}
                    {props.extra}
                </div>
            </div>

            {props.children}
        </div>
    );
}

export default ControlPanel;
