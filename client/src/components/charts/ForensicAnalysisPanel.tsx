import React from 'react';
import StyledMarkdown from '../common/StyledMarkdown';
import { ClickedPoint, SelectionPhase } from '../../hooks/useEventPulseManager';

interface ForensicAnalysisPanelProps {
    selectionPhase: SelectionPhase;
    anchorStart: ClickedPoint | null;
    anchorEnd: ClickedPoint | null;
    isAnalyzing: boolean;
    analysisResult: string | null;
    isStreaming?: boolean;
    toolsRunning?: number;
    toolMessage?: string;
    clearPulse: () => void;
}

const ForensicAnalysisPanel: React.FC<ForensicAnalysisPanelProps> = ({
    selectionPhase,
    anchorStart,
    anchorEnd,
    isAnalyzing,
    analysisResult,
    isStreaming = false,
    toolsRunning = 0,
    toolMessage = '',
    clearPulse,
}) => {
    if (selectionPhase !== 'selected' || !anchorStart || !anchorEnd) return null;
    
    return (
        <div className="w-full relative z-40 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="w-[95%] mx-auto bg-list-bg border border-border-main/20 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 relative overflow-hidden backdrop-blur-xl">
                {/* Accent line purely derived by UI bounding momentum */}
                <div className={`absolute top-0 left-0 w-full h-1 bg-linear-to-r ${(anchorEnd.price > anchorStart.price) ? 'from-green-500 via-emerald-500 to-green-400' : 'from-red-500 via-rose-500 to-red-400'}`}></div>
                
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center space-x-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${(anchorEnd.price > anchorStart.price) ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-main">
                                Analyzing {Math.abs(((anchorEnd.price - anchorStart.price) / anchorStart.price) * 100).toFixed(1)}% {anchorEnd.price > anchorStart.price ? 'Rally' : 'Sell-Off'}
                            </h3>
                            <p className="text-xs text-text-main/60 font-medium">
                                from {new Date(anchorStart.time * 1000).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(anchorEnd.time * 1000).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={clearPulse}
                        className="p-2 rounded-full hover:bg-border-main/10 text-text-main/50 hover:text-text-main transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="bg-form-bg rounded-xl p-5 border border-border-main/10 shadow-inner min-h-[120px]">
                    {/* Tool-fetching / initialising phase */}
                    {isAnalyzing && !analysisResult && (
                        <div className="flex flex-col items-center justify-center space-y-3 h-full py-4">
                            <div className="flex justify-center space-x-2 w-full">
                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
                            </div>
                            <span className="text-sm font-semibold text-blue-500 animate-pulse">
                                {toolMessage || (toolsRunning > 0
                                    ? `Fetching ${toolsRunning} data source${toolsRunning !== 1 ? 's' : ''}…`
                                    : 'Initialising analysis…'
                                )}
                            </span>
                        </div>
                    )}

                    {/* Streaming / final result */}
                    {analysisResult && (
                        <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-text-main prose-a:text-blue-400">
                            <StyledMarkdown>{analysisResult}</StyledMarkdown>
                            {/* Blinking cursor while streaming */}
                            {isStreaming && (
                                <span className="inline-block w-0.5 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForensicAnalysisPanel;
