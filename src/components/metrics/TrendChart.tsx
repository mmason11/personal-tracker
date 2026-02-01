"use client";

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  color: string;
  unit?: string;
  height?: number;
}

export default function TrendChart({ data, color, unit = "", height = 120 }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-slate-500 text-sm" style={{ height }}>
        Not enough data for trend
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padding = 20;
  const chartWidth = 300;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
    const y = padding + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  // Fill area
  const firstX = padding;
  const lastX = padding + ((data.length - 1) / (data.length - 1)) * (chartWidth - padding * 2);
  const bottomY = padding + chartHeight;
  const fillPoints = `${firstX},${bottomY} ${points} ${lastX},${bottomY}`;

  const colorMap: Record<string, { stroke: string; fill: string }> = {
    emerald: { stroke: "#34d399", fill: "rgba(52, 211, 153, 0.1)" },
    rose: { stroke: "#fb7185", fill: "rgba(251, 113, 133, 0.1)" },
    violet: { stroke: "#a78bfa", fill: "rgba(167, 139, 250, 0.1)" },
    blue: { stroke: "#60a5fa", fill: "rgba(96, 165, 250, 0.1)" },
  };

  const colors = colorMap[color] || colorMap.emerald;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${chartWidth} ${height}`} className="w-full" preserveAspectRatio="none">
        {/* Fill */}
        <polygon points={fillPoints} fill={colors.fill} />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padding + (i / (data.length - 1)) * (chartWidth - padding * 2);
          const y = padding + chartHeight - ((d.value - minVal) / range) * chartHeight;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={colors.stroke}
              opacity="0.8"
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 px-2 -mt-1">
        <span>{data[0]?.label}</span>
        <span className="text-slate-400 font-medium">
          Latest: {data[data.length - 1]?.value.toLocaleString()}{unit}
        </span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
