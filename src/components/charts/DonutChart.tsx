import { useMemo } from 'react';

type DonutChartProps = {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  size?: number;
  strokeWidth?: number;
  onSegmentClick?: (label: string) => void;
};

export default function DonutChart({ data, size = 200, strokeWidth = 30, onSegmentClick }: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let currentAngle = -90;

  const segments = useMemo(() => {
    if (total === 0) return [];

    return data.map((item) => {
      const percentage = (item.value / total) * 100;
      const segmentLength = (percentage / 100) * circumference;
      const dashArray = `${segmentLength} ${circumference - segmentLength}`;

      const angle = currentAngle;
      currentAngle += (percentage / 100) * 360;

      return {
        ...item,
        percentage,
        dashArray,
        rotation: angle,
      };
    });
  }, [data, total, circumference]);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 text-sm"
        style={{ width: size, height: size }}
      >
        Sem dados
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {segments.map((segment, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.dashArray}
            strokeLinecap="round"
            style={{
              transform: `rotate(${segment.rotation}deg)`,
              transformOrigin: 'center',
              transition: 'stroke-dasharray 0.3s ease',
              cursor: onSegmentClick ? 'pointer' : 'default',
            }}
            onClick={() => onSegmentClick?.(segment.label)}
          />
        ))}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-bold fill-slate-900"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          {data.length}
        </text>
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-3 w-full">
        {segments.map((segment, index) => (
          <button
            key={index}
            type="button"
            className="flex items-center space-x-2 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 rounded"
            onClick={() => onSegmentClick?.(segment.label)}
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-600 truncate">{segment.label}</div>
              <div className="text-sm font-semibold text-slate-900">
                {segment.value} ({segment.percentage.toFixed(0)}%)
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
