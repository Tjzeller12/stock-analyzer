import { useContext, useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";
import { ThemeContext } from "../../ThemeContext";
import { usePositiveBox } from "../../hooks/usePositiveBox";
import { ChartData } from "../../types";

interface RadarGraphProps {
  data: ChartData;
  hideLegend?: boolean;
  hideAxes?: boolean;
  hideToolTip?: boolean;
  height?: number;
  /** When set, render at this pixel width (table sparklines). */
  width?: number;
  outerRadius?: string | number;
  cy?: string | number;
}

interface RechartsDataRow {
  subject: string;
  [key: string]: string | number;
}

function splitAxisLabel(label: string): string[] {
  if (label.length <= 10 || !label.includes(" ")) return [label];
  const idx = label.lastIndexOf(" ");
  return [label.slice(0, idx), label.slice(idx + 1)];
}

function RadarAxisTick({
  x = 0,
  y = 0,
  textAnchor = "middle",
  payload,
  fill,
}: {
  x?: number;
  y?: number;
  textAnchor?: string;
  payload?: { value?: string };
  fill?: string;
}) {
  const lines = splitAxisLabel(String(payload?.value ?? ""));
  const startDy = lines.length > 1 ? -6 : 0;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill={fill} fontSize={11}>
      {lines.map((line, i) => (
        <tspan key={`${line}-${i}`} x={x} dy={i === 0 ? startDy : 13}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * RadarGraph Component
 *
 * Recharts wrapper designed for multivariate stock comparisons.
 * Hooks into the global `ThemeContext` to dynamically flip text colors, grid lines, and
 * radial angle lines to maintain high contrast whether the user is in dark or light mode.
 */
export const RadarGraph = ({
  data,
  hideLegend = false,
  hideAxes = false,
  hideToolTip = false,
  height = 400,
  width,
  outerRadius = "",
  cy = "50%",
}: RadarGraphProps) => {
  const { theme } = useContext(ThemeContext);
  const { ref: boxRef, width: boxWidth, height: boxHeight } = usePositiveBox();

  // Determine Chart Colors based on Theme
  const textColor = theme === "light" ? "#666" : "#e0e0e0";
  const gridColor =
    theme === "light" ? "rgba(0, 0, 0, 0.1)" : "rgba(255, 255, 255, 0.2)";

  const appliedRadius = outerRadius || (hideAxes ? "90%" : "90%");

  // Transform Chart.js data format to Recharts format
  const rechartsData = useMemo(() => {
    if (!data || !data.labels || !data.datasets) return [];
    return data.labels.map((label, index) => {
      const row: RechartsDataRow = { subject: label };
      data.datasets.forEach((dataset) => {
        const n = Number(dataset.data[index]);
        row[dataset.label] = Number.isFinite(n) ? Math.round(n) : 0;
      });
      return row;
    });
  }, [data]);

  if (!data || !data.datasets || data.datasets.length === 0) {
    return (
      <div className="text-center text-text-main p-4">No data available</div>
    );
  }

  const legend = hideLegend ? null : (
    <ul className="flex flex-row flex-wrap justify-center gap-x-6 gap-y-2 text-sm mt-3">
      {data.datasets.map((dataset) => {
        const color = dataset.borderColor as string;
        return (
          <li
            key={dataset.label}
            className="flex items-center gap-2"
            style={{ color: textColor }}
          >
            <div
              className="w-3 h-3 rounded-lg"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}`,
                border: `1px solid ${color}`,
              }}
            />
            {dataset.label}
          </li>
        );
      })}
    </ul>
  );

  const chartWidth = width ?? boxWidth;
  const chartHeight = width != null ? height : boxHeight;

  const chart =
    chartWidth > 0 && chartHeight > 0 ? (
      <RadarChart
        width={chartWidth}
        height={chartHeight}
        cx="50%"
        cy={cy}
        outerRadius={appliedRadius}
        data={rechartsData}
        margin={
          hideAxes
            ? { top: 0, right: 0, bottom: 0, left: 0 }
            : { top: 36, right: 40, bottom: 36, left: 40 }
        }
      >
        <PolarGrid stroke={gridColor} />
        {!hideAxes && (
          <>
            <PolarAngleAxis
              dataKey="subject"
              tick={(props) => (
                <RadarAxisTick
                  x={props.x}
                  y={props.y}
                  textAnchor={props.textAnchor}
                  payload={props.payload}
                  fill={textColor}
                />
              )}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: textColor }}
              axisLine={false}
              fontSize={10}
            />
          </>
        )}
        {!hideToolTip && (
          <Tooltip
            formatter={(value) => Math.round(Number(value))}
            contentStyle={{
              backgroundColor:
                theme === "dark"
                  ? "rgba(31, 41, 55, 0.85)"
                  : "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(8px)",
              border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
              color: textColor,
              padding: "12px 16px",
            }}
          />
        )}
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
            isAnimationActive={width == null}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
            filter="url(#glow)"
          />
        ))}
      </RadarChart>
    ) : null;

  if (width != null) {
    return (
      <div style={{ width, height, minWidth: width, minHeight: height }}>
        {chart}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div
        ref={boxRef}
        className="w-full min-w-0"
        style={{ height: `${height}px`, minHeight: `${height}px` }}
      >
        {chart}
      </div>
      {legend}
    </div>
  );
};

export default RadarGraph;
