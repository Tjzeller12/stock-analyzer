import React, { useContext, useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeries, Time } from 'lightweight-charts';
import { ThemeContext } from '../../ThemeContext';
import ForensicAnalysisPanel from './ForensicAnalysisPanel';

import {
    useEventPulseManager,
    TimeFrame,
    timeFrames
} from '../../hooks/useEventPulseManager';

export interface EventPulseChartProps {
    symbol: string;
    data: any[];
    activeTimeFrame: TimeFrame;
    onTimeFrameChange: (tf: TimeFrame) => void;
}

const EventPulseChart: React.FC<EventPulseChartProps> = ({ symbol, data, activeTimeFrame, onTimeFrameChange }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const windowOverlayRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const { theme } = useContext(ThemeContext);

    const {
        selectionPhase, setSelectionPhase, selectionPhaseRef,
        anchorStart, setAnchorStart, anchorStartRef,
        anchorEnd, setAnchorEnd, anchorEndRef, hoverTimeRef,
        selectionError, setSelectionError, isAnalyzing, analysisResult, setAnalysisResult, clearPulse
    } = useEventPulseManager(symbol, windowOverlayRef);

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
                vertLine: {  color: mainColor, width: 2, style: 3, labelBackgroundColor: mainColor },
                horzLine: {  color: mainColor, width: 2, style: 3, labelBackgroundColor: mainColor },
            },
            rightPriceScale: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
            timeScale: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', timeVisible: true, secondsVisible: false },
        });

        seriesRef.current = chartRef.current.addSeries(AreaSeries, {
            lineColor: mainColor, topColor: topColor, bottomColor: 'rgba(0,0,0,0)', lineWidth: 2, crosshairMarkerRadius: 6,
        });

        if (data && data.length > 0) seriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();

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

            if (phase === 'selecting') {
                windowOverlayRef.current.className = "absolute top-0 h-[320px] pointer-events-none bg-blue-500/20 border-x-2 border-blue-500/80 transition-none z-20 shadow-[0_0_15px_rgba(59,130,246,0.3)]";
            } else {
                const swingType = (anchorEndRef.current?.price ?? 0) > start.price ? 'green' : 'red';
                const bgClass = swingType === 'green' ? 'bg-green-500/20 border-green-500/80' : 'bg-red-500/20 border-red-500/80';
                windowOverlayRef.current.className = `absolute top-0 h-[320px] pointer-events-none ${bgClass} border-x-2 transition-all duration-300 z-20 backdrop-blur-[1px] shadow-[0_0_20px_rgba(0,0,0,0.1)]`;
            }
        };

        chartRef.current.subscribeCrosshairMove((param: any) => {
            if (selectionPhaseRef.current === 'selecting' && param.time) {
                hoverTimeRef.current = param.time as number;
                updateWindowPosition();
            }

            if (!tooltipRef.current || !container) return;
            const tooltip = tooltipRef.current;
            
            if (param.point === undefined || !param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
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
            const isShortTimeframe = ['1D', '1W'].includes(activeTimeFrame);

            tooltip.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 4px; color: ${isDark ? '#e0e0e0' : '#444'}">${timestampStr}</div>
                <div style="font-size: 18px; font-weight: bold; color: #06a84d">$${price.toFixed(2)}</div>
                ${!isShortTimeframe ? `<div style="font-size: 11px; margin-top: 6px; color: ${isDark ? '#888' : '#aaa'}; font-style: italic;">
                    ${isSelecting ? 'Click again to analyze bounded area' : 'Click to trace Macro event'}
                </div>` : ''}
            `;

            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const y = param.point.y;
            let x = param.point.x + 15;
            if (x > container.clientWidth - tooltipWidth) x = param.point.x - tooltipWidth - 15;

            tooltip.style.left = x + 'px';
            tooltip.style.top = Math.max(0, y - tooltipHeight / 2) + 'px';
        });

        chartRef.current.subscribeClick((param: any) => {
            const isShortTimeframe = ['1D', '1W'].includes(activeTimeFrame);
            if (isShortTimeframe) {
                setSelectionError('Please highlight a window of at least 7 days across structural timeframes.');
                return;
            }

            if (!param.point || !param.time || !seriesRef.current) return;
            const time = param.time as number;
            const dataPoint = param.seriesData.get(seriesRef.current);
            if (!dataPoint) return;
            
            const price = (dataPoint as any).value;
            const rawDateStr = new Date(time * 1000).toISOString();
            const phase = selectionPhaseRef.current;
            
            if (phase === 'idle' || phase === 'selected') {
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
                
                const minSeconds = 7 * 86400; // 7 days for macro

                const diffSeconds = Math.abs(time - start.time);
                if (diffSeconds < 1) { 
                     setSelectionPhase('idle');
                     setAnchorStart(null);
                     selectionPhaseRef.current = 'idle';
                     anchorStartRef.current = null;
                     if (windowOverlayRef.current) windowOverlayRef.current.style.display = 'none';
                     return;
                }

                if (diffSeconds < minSeconds) {
                    setSelectionError(`Please highlight a window of at least 7 days across structural timeframes.`);
                    setSelectionPhase('idle');
                    setAnchorStart(null);
                    selectionPhaseRef.current = 'idle';
                    anchorStartRef.current = null;
                    if (windowOverlayRef.current) windowOverlayRef.current.style.display = 'none';
                    return;
                }
                
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
        
        chartRef.current.timeScale().subscribeVisibleTimeRangeChange(updateWindowPosition);
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(updateWindowPosition);
        chartRef.current.timeScale().subscribeSizeChange(updateWindowPosition);

        let lastWidth = container.clientWidth;
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !chartRef.current) return;
            const newRect = entries[0].contentRect;
            if (newRect.width !== lastWidth) {
                lastWidth = newRect.width;
                chartRef.current.applyOptions({ width: newRect.width });
                clearPulse();
            }
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
                    <span className="text-xs text-text-main/50 font-medium">
                        {['1D', '1W'].includes(activeTimeFrame) 
                            ? 'Intraday charts are currently un-analyzable due to market noise.' 
                            : 'Click to draw a Macro Analysis Window, click again to finalize'}
                    </span>
                </div>
            </div>
            
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
                    
                    <div 
                        ref={tooltipRef}
                        className="absolute z-60 pointer-events-none bg-form-bg/90 backdrop-blur-md border border-border-main/20 p-3 rounded-lg shadow-xl"
                        style={{ display: 'none', transition: 'opacity 0.1s ease' }}
                    />

                    <div 
                        ref={windowOverlayRef}
                        className="absolute top-0 h-[320px] pointer-events-none z-20"
                        style={{ display: 'none' }}
                    ></div>
                </div>

                <ForensicAnalysisPanel 
                    selectionPhase={selectionPhase}
                    anchorStart={anchorStart}
                    anchorEnd={anchorEnd}
                    isAnalyzing={isAnalyzing}
                    analysisResult={analysisResult}
                    clearPulse={clearPulse}
                />
            </div>
        </div>
    );
};

export default EventPulseChart;
