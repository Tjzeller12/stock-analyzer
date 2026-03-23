import React, { useContext, useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeries, Time } from 'lightweight-charts';
import { ThemeContext } from '../../ThemeContext';
import { authPost } from '../../utils/api';
import { ALPHA_BOT_ENDPOINTS } from '../../constants/api';
import StyledMarkdown from '../common/StyledMarkdown';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';
export const timeFrames: TimeFrame[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export interface EventPulseChartProps {
    symbol: string;
    data: any[];
    activeTimeFrame: TimeFrame;
    onTimeFrameChange: (tf: TimeFrame) => void;
}

interface ClickedPoint {
    time: number;
    price: number;
    rawDateStr: string;
}

type SelectionPhase = 'idle' | 'selecting' | 'selected';

const EventPulseChart: React.FC<EventPulseChartProps> = ({ symbol, data, activeTimeFrame, onTimeFrameChange }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const windowOverlayRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const { theme } = useContext(ThemeContext);

    // Event Pulse Selection State
    const [selectionPhase, setSelectionPhase] = useState<SelectionPhase>('idle');
    const selectionPhaseRef = useRef<SelectionPhase>('idle');
    const [anchorStart, setAnchorStart] = useState<ClickedPoint | null>(null);
    const anchorStartRef = useRef<ClickedPoint | null>(null);
    const [anchorEnd, setAnchorEnd] = useState<ClickedPoint | null>(null);
    const anchorEndRef = useRef<ClickedPoint | null>(null);
    const hoverTimeRef = useRef<number | null>(null);
    
    // Status / Error / AI State
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);

    // Update tracking Refs immediately
    useEffect(() => { selectionPhaseRef.current = selectionPhase; }, [selectionPhase]);
    useEffect(() => { anchorStartRef.current = anchorStart; }, [anchorStart]);
    useEffect(() => { anchorEndRef.current = anchorEnd; }, [anchorEnd]);

    // Fetch forensic analysis when the range is firmly selected
    useEffect(() => {
        if (selectionPhase === 'selected' && anchorStart && anchorEnd && symbol) {
            const fetchAnalysis = async () => {
                setIsAnalyzing(true);
                setAnalysisResult(null); 
                setSelectionError(null);
                
                // Dynamically deduce if it was a rally or crash
                const swingType = anchorEnd.price > anchorStart.price ? 'Massive Rally' : 'Major Sell-off';

                try {
                    const response = await authPost<{ response: string }>(ALPHA_BOT_ENDPOINTS.EVENT_PULSE, {
                        stock_symbol: symbol,
                        start_date_str: anchorStart.rawDateStr,
                        start_price: anchorStart.price,
                        date_str: anchorEnd.rawDateStr,
                        price: anchorEnd.price,
                        swing_type: swingType,
                        timestamp: anchorEnd.time // Legacy pass-through
                    });
                    if (response.response) {
                        setAnalysisResult(response.response);
                    }
                } catch (err) {
                    console.error("Forensic analysis failed", err);
                    setAnalysisResult("System Error: Failed to analyze this highlighted range. Please try again.");
                } finally {
                    setIsAnalyzing(false);
                }
            };

            void fetchAnalysis();
        }
    }, [selectionPhase, anchorStart, anchorEnd, symbol]);

    // Handle clearing the UI selection
    const clearPulse = () => {
        setSelectionPhase('idle');
        setAnchorStart(null);
        setAnchorEnd(null);
        setAnalysisResult(null);
        setIsAnalyzing(false);
        setSelectionError(null);
        if (windowOverlayRef.current) {
            windowOverlayRef.current.style.display = 'none';
        }
    };

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const container = chartContainerRef.current;
        const isDark = theme === 'dark';

        const isUp = data && data.length > 0 ? data[data.length - 1].value >= data[0].value : true;
        const mainColor = isUp ? '#06a84d' : '#ef4444'; 
        const topColor = isUp ? 'rgba(6, 168, 77, 0.4)' : 'rgba(239, 68, 68, 0.4)';

        chartRef.current = createChart(container, {
            width: container.clientWidth,
            height: 350,
            layout: {
                background: { color: 'transparent' },
                textColor: isDark ? '#e0e0e0' : '#333333',
            },
            grid: {
                vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
            },
            crosshair: {
                vertLine: { 
                    color: mainColor,
                    width: 2,
                    style: 3,
                    labelBackgroundColor: mainColor,
                },
                horzLine: { 
                    color: mainColor,
                    width: 2,
                    style: 3, 
                    labelBackgroundColor: mainColor,
                },
            },
            rightPriceScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            },
            timeScale: {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        seriesRef.current = chartRef.current.addSeries(AreaSeries, {
            lineColor: mainColor,
            topColor: topColor,
            bottomColor: 'rgba(0,0,0,0)',
            lineWidth: 2,
            crosshairMarkerRadius: 6,
        });

        if (data && data.length > 0) {
            seriesRef.current.setData(data);
        }

        chartRef.current.timeScale().fitContent();

        // --------------------------------------------------------------------------
        // Range Highlighter UI Positioning
        // --------------------------------------------------------------------------
        const updateWindowPosition = () => {
            if (!chartRef.current || !windowOverlayRef.current) return;
            
            const phase = selectionPhaseRef.current;
            const start = anchorStartRef.current;
            
            if (phase === 'idle' || !start) {
                windowOverlayRef.current.style.display = 'none';
                return;
            }
            
            const t1 = start.time;
            const t2 = phase === 'selected' ? anchorEndRef.current?.time : hoverTimeRef.current;
            
            if (!t2) return;
            
            const x1 = chartRef.current.timeScale().timeToCoordinate(t1 as Time);
            const x2 = chartRef.current.timeScale().timeToCoordinate(t2 as Time);
            
            if (x1 === null || x2 === null) {
                windowOverlayRef.current.style.display = 'none';
                return;
            }
            
            const left = Math.min(x1, x2);
            const width = Math.abs(x2 - x1);
            
            windowOverlayRef.current.style.display = 'block';
            windowOverlayRef.current.style.left = `${left}px`;
            windowOverlayRef.current.style.width = `${width}px`;

            // Adjust styles based on dragging vs locked
            if (phase === 'selecting') {
                windowOverlayRef.current.className = "absolute top-0 h-[320px] pointer-events-none bg-blue-500/20 border-x-2 border-blue-500/80 transition-none z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
            } else {
                const swingType = (anchorEndRef.current?.price ?? 0) > start.price ? 'green' : 'red';
                const bgClass = swingType === 'green' ? 'bg-green-500/20 border-green-500/80' : 'bg-red-500/20 border-red-500/80';
                windowOverlayRef.current.className = `absolute top-0 h-[320px] pointer-events-none ${bgClass} border-x-2 transition-all duration-300 z-20 backdrop-blur-[1px] shadow-[0_0_20px_rgba(0,0,0,0.1)]`;
            }
        };

        // Standard Hover Tooltip Logic + Crosshair Tracker
        chartRef.current.subscribeCrosshairMove((param) => {
            if (selectionPhaseRef.current === 'selecting' && param.time) {
                hoverTimeRef.current = param.time as number;
                updateWindowPosition();
            }

            if (!tooltipRef.current || !container) return;
            
            const tooltip = tooltipRef.current;
            
            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > container.clientWidth ||
                param.point.y < 0 ||
                param.point.y > container.clientHeight
            ) {
                tooltip.style.display = 'none';
                return;
            }

            const dataPoint = param.seriesData.get(seriesRef.current!);
            if (!dataPoint) {
                tooltip.style.display = 'none';
                return;
            }

            const price = (dataPoint as any).value;
            tooltip.style.display = 'block';
            
            const timestampStr = typeof param.time === 'number' 
                ? new Date(param.time * 1000).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: activeTimeFrame === '1D' || activeTimeFrame === '1W' ? 'numeric' : undefined, 
                    minute: activeTimeFrame === '1D' || activeTimeFrame === '1W' ? '2-digit' : undefined,
                }) 
                : param.time;

            const isSelecting = selectionPhaseRef.current === 'selecting';

            tooltip.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 4px; color: ${isDark ? '#e0e0e0' : '#444'}">${timestampStr}</div>
                <div style="font-size: 18px; font-weight: bold; color: #06a84d">$${price.toFixed(2)}</div>
                <div style="font-size: 11px; margin-top: 6px; color: ${isDark ? '#888' : '#aaa'}; font-style: italic;">
                    ${isSelecting ? 'Click again to analyze bounded area' : 'Click to trace Macro event'}
                </div>
            `;

            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const y = param.point.y;
            let x = param.point.x + 15;
            
            if (x > container.clientWidth - tooltipWidth) {
                x = param.point.x - tooltipWidth - 15;
            }

            tooltip.style.left = x + 'px';
            tooltip.style.top = Math.max(0, y - tooltipHeight / 2) + 'px';
        });

        // Interactive Selection Logic
        chartRef.current.subscribeClick((param) => {
            if (!param.point || !param.time || !seriesRef.current) return;
            
            const time = param.time as number;
            const dataPoint = param.seriesData.get(seriesRef.current);
            if (!dataPoint) return;
            
            const price = (dataPoint as any).value;
            const rawDateStr = new Date(time * 1000).toISOString();
            const phase = selectionPhaseRef.current;
            
            if (phase === 'idle' || phase === 'selected') {
                // Drop Anchor 1
                setSelectionPhase('selecting');
                setAnchorStart({ time, price, rawDateStr });
                setAnchorEnd(null);
                setAnalysisResult(null);
                setSelectionError(null);
                hoverTimeRef.current = time;
                selectionPhaseRef.current = 'selecting';
                anchorStartRef.current = { time, price, rawDateStr };
                anchorEndRef.current = null;
                updateWindowPosition(); 
            } else if (phase === 'selecting') {
                const start = anchorStartRef.current;
                if (!start) return;
                
                // Enforce minimum gap to strictly ensure real analysis (Prevent double-clicks)
                const isShortTimeframe = ['1D', '1W'].includes(activeTimeFrame);
                const minDaysRequirement = isShortTimeframe ? 0 : 7; // Require 7 days for macro, 0 for intraday
                const minSeconds = minDaysRequirement * 86400;

                const diffSeconds = Math.abs(time - start.time);
                
                // Block double-clicking the same timestamp exactly
                if (diffSeconds < 1) { 
                     setSelectionPhase('idle');
                     setAnchorStart(null);
                     if(windowOverlayRef.current) windowOverlayRef.current.style.display = 'none';
                     return;
                }

                if (diffSeconds < minSeconds) {
                    setSelectionError(`Please highlight a window of at least ${minDaysRequirement} days across structural timeframes.`);
                    setSelectionPhase('idle');
                    setAnchorStart(null);
                    if(windowOverlayRef.current) windowOverlayRef.current.style.display = 'none';
                    return;
                }
                
                // Finalize Bounds Chronologically
                setSelectionError(null);
                setSelectionPhase('selected');
                
                const endPoint = { time, price, rawDateStr };
                const finalStart = start.time < endPoint.time ? start : endPoint;
                const finalEnd = start.time > endPoint.time ? start : endPoint;
                
                setAnchorStart(finalStart);
                setAnchorEnd(finalEnd);
                
                selectionPhaseRef.current = 'selected';
                anchorStartRef.current = finalStart;
                anchorEndRef.current = finalEnd;
                updateWindowPosition();
            }
        });
        
        // Ensure Highlight Window faithfully tracks native Panning Dynamics
        chartRef.current.timeScale().subscribeVisibleTimeRangeChange(updateWindowPosition);
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updateWindowPosition);
        chartRef.current.timeScale().subscribeSizeChange(updateWindowPosition);

        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !chartRef.current) return;
            const newRect = entries[0].contentRect;
            chartRef.current.applyOptions({ width: newRect.width });
            clearPulse(); // Reset overlay coordinates on layout breaking constraints
        });

        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chartRef.current?.remove();
            chartRef.current = null;
        };
    }, [theme, data, activeTimeFrame]);

    const handleTimeFrameChange = (tf: TimeFrame) => {
        clearPulse();
        onTimeFrameChange(tf);
    };

    return (
        <div className="w-full bg-transparent rounded-xl py-4 flex flex-col items-center">
            <div className="w-full flex items-center px-4 pb-3 justify-between relative z-10">
                <div className="flex flex-col">
                    <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-blue-600">
                        {symbol} {activeTimeFrame === '1D' || activeTimeFrame === '1W' ? 'Intraday' : 'Historical'} Data
                    </span>
                    <span className="text-xs text-text-main/50 font-medium">Click to draw a Macro Analysis Window, click again to finalize</span>
                </div>
            </div>
            
            {/* Context Error Toast */}
            {selectionError && (
                <div className="w-[95%] mx-auto bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold px-4 py-2 rounded-lg mb-2 text-center animate-in fade-in slide-in-from-top-2">
                    {selectionError}
                </div>
            )}

            <div className="w-full relative px-2">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                
                <div className="flex justify-center w-full mb-4 z-20 relative">
                  <div className="flex space-x-1 bg-form-bg/80 backdrop-blur-md border border-border-main/20 p-1 rounded-full shadow-sm">
                    {timeFrames.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleTimeFrameChange(tf)}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-300 ${
                          activeTimeFrame === tf
                            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                            : 'text-text-main/70 hover:text-text-main hover:bg-border-main/10'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full overflow-hidden">
                    <div ref={chartContainerRef} className="w-full h-[350px] relative z-10" />
                    
                    {/* Floating Hover Tooltip Div */}
                    <div 
                        ref={tooltipRef}
                        className="absolute z-60 pointer-events-none bg-form-bg/90 backdrop-blur-md border border-border-main/20 p-3 rounded-lg shadow-xl"
                        style={{ display: 'none', transition: 'opacity 0.1s ease' }}
                    />

                    {/* Interactive Selection Blue Window Overlay (Bound completely natively to the Time scale matrix) */}
                    <div 
                        ref={windowOverlayRef}
                        className="absolute top-0 h-[320px] pointer-events-none z-20"
                        style={{ display: 'none' }}
                    >
                    </div>
                </div>

                {/* Event Pulse: Forensic Case File Dropdown */}
                {selectionPhase === 'selected' && anchorStart && anchorEnd && (
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
                                {isAnalyzing ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 h-full py-4">
                                        <div className="flex justify-center space-x-2 w-full">
                                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                                        </div>
                                        <span className="text-sm font-semibold text-blue-500 animate-pulse">Running Bounded Sector Context Queries...</span>
                                    </div>
                                ) : analysisResult ? (
                                    <div className="text-sm prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-text-main prose-a:text-blue-400">
                                        <StyledMarkdown>{analysisResult}</StyledMarkdown>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventPulseChart;
