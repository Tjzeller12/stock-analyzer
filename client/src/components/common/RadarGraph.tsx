/* eslint-disable react-refresh/only-export-components */
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Title,
  Tooltip,
} from 'chart.js';
import { useContext } from 'react';
import { Radar } from 'react-chartjs-2';
import { ThemeContext } from '../../ThemeContext';
import { ChartData } from '../../types';

export interface RadarGraphProps {
    data: ChartData;
}

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

// Chart colors expanded palette
export const CHART_COLORS = [
  { bg: 'rgba(252, 26, 26, 0.1)', border: 'rgba(252, 26, 26, 1)' },
  { bg: 'rgba(8, 137, 16, 0.1)', border: 'rgba(8, 137, 16, 1)' }, 
  { bg: 'rgba(255, 206, 86, 0.1)', border: 'rgba(255, 206, 86, 1)' }, 
  { bg: 'rgba(63, 207, 255, 0.1)', border: 'rgba(63, 207, 255, 1)' }, 
  { bg: 'rgba(153, 102, 255, 0.1)', border: 'rgba(153, 102, 255, 1)' }, 
  { bg: 'rgba(255, 159, 64, 0.1)', border: 'rgba(255, 159, 64, 1)' }, 
  { bg: 'rgba(43, 0, 255, 0.1)', border: 'rgba(43, 0, 255, 1)' }, 
  { bg: 'rgba(255, 99, 255, 0.1)', border: 'rgba(255, 99, 255, 1)' }, 
  { bg: 'rgba(0, 255, 255, 0.1)', border: 'rgba(0, 255, 255, 1)' }, 
  { bg: 'rgba(50, 205, 50, 0.1)', border: 'rgba(50, 205, 50, 1)' }, 
];

/**
 * RadarGraph Component
 * 
 * A wrapper for the `react-chartjs-2` Radar chart designed for multivariate stock comparisons.
 * Hooks into the global `ThemeContext` to dynamically flip text colors, grid lines, and 
 * radial angle lines to maintain high contrast whether the user is in dark or light mode.
 */
export const RadarGraph = ( {data}: RadarGraphProps) => {
    const { theme } = useContext(ThemeContext);
    // Determine Chart Colors based on Theme
    const textColor = theme === 'light' ? '#666' : '#e0e0e0';
    const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)';

    const radarOptions = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
          color: textColor,
        },
        pointLabels: {
          color: textColor,
          font: {
            size: 12
          }
        },
        grid: {
          color: gridColor,
        },
        angleLines: {
            color: gridColor
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: textColor
        }
      }
    }
  };
    return (
        <Radar data={data} options={radarOptions} />
    )
}

export default RadarGraph;