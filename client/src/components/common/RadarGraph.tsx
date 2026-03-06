import { useContext, useMemo } from 'react';
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ThemeContext } from '../../ThemeContext';
import { ChartData } from '../../types';


interface RadarGraphProps {
    data: ChartData;
}

interface RechartsDataRow {
    subject: string;
    [key: string]: string | number;
}

/**
 * RadarGraph Component
 * 
 * Recharts wrapper designed for multivariate stock comparisons.
 * Hooks into the global `ThemeContext` to dynamically flip text colors, grid lines, and 
 * radial angle lines to maintain high contrast whether the user is in dark or light mode.
 */
export const RadarGraph = ({ data }: RadarGraphProps) => {
    const { theme } = useContext(ThemeContext);
    
    // Determine Chart Colors based on Theme
    const textColor = theme === 'light' ? '#666' : '#e0e0e0';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)';

    // Transform Chart.js data format to Recharts format
    const rechartsData = useMemo(() => {
        if (!data || !data.labels || !data.datasets) return [];
        return data.labels.map((label, index) => {
            const row: RechartsDataRow = { subject: label };
            data.datasets.forEach(dataset => {
                row[dataset.label] = dataset.data[index] || 0;
            });
            return row;
        });
    }, [data]);

    if (!data || !data.datasets || data.datasets.length === 0) {
        return <div className="text-center text-text-main p-4">No data available</div>;
    }

    // Custom Legend to force solid colors and match Doughnut chart
    interface CustomLegendPayload {
        value?: string;
        color?: string;
        payload?: {
            stroke?: string;
            fill?: string;
            strokeDasharray?: string | number;
            value?: unknown;
            [key: string]: unknown;
        };
    }
    interface CustomLegendProps {
        payload?: readonly CustomLegendPayload[];
    }

    const renderLegend = (props: CustomLegendProps) => {
        const { payload } = props;
        if (!payload) return null;
        return (
            <ul className="flex flex-row flex-wrap justify-center gap-6 text-sm mt-4">
                {payload.map((entry: CustomLegendPayload, index: number) => {
                    const color = entry.payload?.stroke || entry.color;
                    return (
                        <li key={`item-${index}`} className="flex items-center gap-2" style={{ color: textColor }}>
                            <div 
                                className="w-3 h-3 rounded-lg" 
                                style={{ 
                                    backgroundColor: color,
                                    boxShadow: `0 0 10px ${color}`,
                                    border: `1px solid ${color}`
                                }}
                            />
                            {entry.value}
                        </li>
                    );
                })}
            </ul>
        );
    };
    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={rechartsData}>
                    <PolarGrid stroke={gridColor} />
                    <PolarAngleAxis 
                        dataKey="subject" 
                        tick={{ fill: textColor, fontSize: 12 }} 
                    />
                    <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: textColor }}
                        axisLine={false}
                        fontSize={10}
                    />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                            backdropFilter: 'blur(8px)',
                            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            borderRadius: '12px',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                            color: textColor,
                            padding: '12px 16px'
                        }}
                    />
                    <Legend content={renderLegend} />
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    {data.datasets.map((dataset) => (
                        <Radar
                            key={dataset.label}
                            name={dataset.label}
                            dataKey={dataset.label}
                            stroke={dataset.borderColor as string}
                            strokeWidth={3}
                            fill={dataset.backgroundColor as string}
                            fillOpacity={0.25}
                            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                            filter="url(#glow)"
                        />
                    ))}
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RadarGraph;