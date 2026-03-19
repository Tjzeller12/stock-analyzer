import React, { useContext, useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, AreaSeries } from 'lightweight-charts';
import { ThemeContext } from '../../ThemeContext';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX';
export const timeFrames: TimeFrame[] = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];

export interface EventPulseChartProps {
    symbol: string;
    data: any[];
    activeTimeFrame: TimeFrame;
    onTimeFrameChange: (tf: TimeFrame) => void;
}

const EventPulseChart: React.FC<EventPulseChartProps> = ({ symbol, data, activeTimeFrame, onTimeFrameChange }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const { theme } = useContext(ThemeContext);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const container = chartContainerRef.current;
        const isDark = theme === 'dark';

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
                    color: '#06a94d',
                    width: 2,
                    style: 3, // dashed
                    labelBackgroundColor: '#06a94d',
                },
                horzLine: { 
                    color: '#06a94d',
                    width: 2,
                    style: 3, // dashed
                    labelBackgroundColor: '#06a94d',
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
            lineColor: '#06a84d',
            topColor: 'rgba(6, 168, 77, 0.4)',
            bottomColor: 'rgba(6, 168, 77, 0.0)',
            lineWidth: 2,
            crosshairMarkerRadius: 6,
        });

        if (data && data.length > 0) {
            seriesRef.current.setData(data);
        }

        chartRef.current.timeScale().fitContent();

        // Custom Tooltip Logic
        chartRef.current.subscribeCrosshairMove((param) => {
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
            
            // Format time
            const timestampStr = typeof param.time === 'number' 
                ? new Date(param.time * 1000).toLocaleString(undefined, {
                    month: 'short', day: 'numeric',
                    hour: activeTimeFrame === '1D' || activeTimeFrame === '1W' ? 'numeric' : undefined, 
                    minute: activeTimeFrame === '1D' || activeTimeFrame === '1W' ? '2-digit' : undefined,
                }) 
                : param.time;

            tooltip.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 4px; color: ${isDark ? '#e0e0e0' : '#444'}">${timestampStr}</div>
                <div style="font-size: 18px; font-weight: bold; color: #06a84d">$${price.toFixed(2)}</div>
            `;

            // Position tooltip
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const y = param.point.y;
            let x = param.point.x + 15; // Offset to the right
            
            // Prevent going off screen
            if (x > container.clientWidth - tooltipWidth) {
                x = param.point.x - tooltipWidth - 15;
            }

            tooltip.style.left = x + 'px';
            tooltip.style.top = Math.max(0, y - tooltipHeight / 2) + 'px';
        });

        // Responsive resize
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !chartRef.current) return;
            const newRect = entries[0].contentRect;
            chartRef.current.applyOptions({ width: newRect.width });
        });

        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chartRef.current?.remove();
            chartRef.current = null;
        };
    }, [theme, data, activeTimeFrame]); // Dependency on data and timeframe

    return (
        <div className="w-full bg-transparent rounded-xl py-4 flex flex-col items-center">
            <div className="w-full flex items-center px-4 pb-3 justify-between relative z-10">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-green-400 to-green-600">
                    {symbol} {activeTimeFrame === '1D' || activeTimeFrame === '1W' ? 'Intraday' : 'Historical'} Data
                </span>
            </div>
            <div className="w-full relative">
                {/* Custom glowing background element behind chart */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-green-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                
                {/* Timeframe selector header */}
                <div className="flex justify-center w-full mb-4 z-20 relative">
                  <div className="flex space-x-1 bg-form-bg/80 backdrop-blur-md border border-border-main/20 p-1 rounded-full shadow-sm">
                    {timeFrames.map((tf) => (
                      <button
                        key={tf}
                        onClick={() => onTimeFrameChange(tf)}
                        className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-300 ${
                          activeTimeFrame === tf
                            ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                            : 'text-text-main/70 hover:text-text-main hover:bg-border-main/10'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div ref={chartContainerRef} className="w-full h-[350px] relative z-10" />
                
                {/* Floating Tooltip Div */}
                <div 
                    ref={tooltipRef}
                    className="absolute z-50 pointer-events-none bg-form-bg/90 backdrop-blur-md border border-border-main/20 p-3 rounded-lg shadow-xl"
                    style={{
                        display: 'none',
                        transition: 'opacity 0.1s ease',
                    }}
                />
            </div>
        </div>
    );
};

export default EventPulseChart;
