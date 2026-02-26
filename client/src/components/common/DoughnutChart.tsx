import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { useContext } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { ThemeContext } from '../../ThemeContext';
import { ChartData } from '../../types';

interface DoughnutChartProps {
    data: ChartData
}

ChartJS.register(ArcElement, Tooltip, Legend)

export const DoughnutChart = ({data}: DoughnutChartProps) => {
    const { theme } = useContext(ThemeContext);
    // Determine Chart Colors based on Theme
    const textColor = theme === 'light' ? '#666' : '#e0e0e0';

    const doughnutOptions = {
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: textColor
                }
            }
        },
    };

    return (
        <Doughnut data={data} options={doughnutOptions} />
    )
}