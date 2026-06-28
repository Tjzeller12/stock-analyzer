import React from 'react';
import Card from './Card';

export interface AlphaBotResponseCardProps {
    isLoading: boolean;
    title?: string;
    children: React.ReactNode;
    className?: string;
    /** True while text chunks are actively arriving (shows blinking cursor). */
    isStreaming?: boolean;
    /** Number of tool calls in-flight; shown in the loading state. */
    toolsRunning?: number;
}

/**
 * AlphaBotResponseCard Component
 *
 * Wrapper around ``Card`` for AlphaBot LLM outputs.
 *
 * Loading states
 * --------------
 * toolsRunning > 0  — Shows "Fetching N data sources…" (tool phase)
 * isLoading only    — Shows generic spinner (finalising prompt / no tools)
 * isStreaming       — Appends a blinking cursor after ``children``
 */
export const AlphaBotResponseCard: React.FC<AlphaBotResponseCardProps> = ({
    isLoading,
    title,
    children,
    className,
    isStreaming = false,
    toolsRunning = 0,
}) => {
    const showLoader = isLoading && !React.Children.count(children);

    return (
        <Card
            variant="inner"
            title={title}
            className={`${className ?? ''} overflow-y-auto [scrollbar-color:var(--scrollbar-color)] flex flex-col h-full w-full`}
        >
            {showLoader ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <span className="alpha-bot-spinner" />
                    {toolsRunning > 0 ? (
                        <p className="text-sm font-semibold text-primary animate-pulse">
                            Fetching {toolsRunning} market data source{toolsRunning !== 1 ? 's' : ''}…
                        </p>
                    ) : (
                        <p className="text-sm text-text-main/60">
                            AlphaBot is analysing current market conditions…
                            <br />
                            May take up to two minutes.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    {children}
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />
                    )}
                </>
            )}
        </Card>
    );
};