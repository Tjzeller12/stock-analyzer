import { useContext, useMemo } from 'react';
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip
} from 'recharts';
import { ThemeContext } from '../../ThemeContext';
import { ChartData } from '../../types';

interface DoughnutChartProps {
    data: ChartData;
}

/**
 * DoughnutChart Component
 * 
 * A wrapper around the `recharts` Pie chart (functioning as a doughnut).
 * This component specifically hooks into the global `ThemeContext` to dynamically 
 * update the Legend text color and Tooltip styling to match the user's active light/dark mode preference.
 */
export const DoughnutChart = ({ data }: DoughnutChartProps) => {
    const { theme } = useContext(ThemeContext);
    
    // Determine Chart Colors based on Theme
    const textColor = theme === 'light' ? '#666' : '#e0e0e0';

    // Helper to extract solid color from rgba string if present
    const getSolidColor = (colorStr: string | undefined): string | undefined => {
        if (typeof colorStr === 'string' && colorStr.startsWith('rgba')) {
            // Replace the alpha channel with 1
            return colorStr.replace(/[\d.]+\)$/g, '1)');
        }
        return colorStr;
    };

    // Transform Chart.js format into Recharts format
    const rechartsData = useMemo(() => {
        if (!data || !data.labels || !data.datasets || data.datasets.length === 0) return [];
        const dataset = data.datasets[0]; // Doughnuts usually use the first dataset only
        return data.labels.map((label, index) => {
            const bgColors = dataset.backgroundColor;
            const bdColors = dataset.borderColor;
            
            return {
                name: label,
                value: dataset.data[index] || 0,
                fill: Array.isArray(bgColors) ? bgColors[index] : bgColors,
                stroke: Array.isArray(bdColors) ? bdColors[index] : bdColors
            };
        });
    }, [data]);

    if (rechartsData.length === 0) {
        return <div className="text-center text-text-main p-4">No data available</div>;
    }

    // Custom Legend to force solid colors instead of the pie slice's transparent fill
    // Custom Legend to force solid colors instead of the pie slice's transparent fill
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
    const renderLegend = (props: any) => {
        const { payload } = props;
        if (!payload) return null;
        return (
            <ul className="flex flex-row flex-wrap justify-center gap-6 text-sm mt-4">
                {payload.map((entry: any, index: number) => {
                    const color = getSolidColor(entry.payload?.stroke) || getSolidColor(entry.color);
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
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <defs>
                        <filter id="pieGlow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    <Pie
                        data={rechartsData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={4}
                        dataKey="value"
                        filter="url(#pieGlow)"
                    >
                        {rechartsData.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={getSolidColor(entry.fill)} 
                                stroke="none"
                            />
                        ))}
                    </Pie>
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
                        itemStyle={{ color: textColor, fontWeight: 500 }}
                    />
                    <Legend content={renderLegend} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default DoughnutChart;