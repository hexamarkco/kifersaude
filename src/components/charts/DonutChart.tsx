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
  compact?: boolean;
};

export default function DonutChart({
  data,
  size = 200,
  strokeWidth = 30,
  onSegmentClick,
  compact = false,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const innerRadius = Math.max(radius - strokeWidth / 2 - 2, 0);

  const segments = useMemo(() => {
    if (total === 0) return [];

    let currentAngle = -90;

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
  }, [circumference, data, total]);

  if (total === 0) {
    return (
      <div
        className="kds-donut-empty flex items-center justify-center rounded-[var(--radius-2xl)] border text-sm"
        style={{
          width: size,
          height: size,
        }}
      >
        Sem dados
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="kds-donut-svg shrink-0">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--bg-hover)"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment, index) => (
            <circle
              key={`${segment.label}-${index}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.dashArray}
              strokeLinecap="butt"
              className={onSegmentClick ? 'kds-donut-segment is-interactive' : 'kds-donut-segment'}
              style={{ transform: `rotate(${segment.rotation}deg)` }}
              onClick={() => onSegmentClick?.(segment.label)}
            />
          ))}
          <circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="var(--bg-inset)"
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
          <text
            x={center}
            y={center - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="34"
            fontWeight="700"
            fontFamily="var(--font-sans)"
            fill="var(--text-primary)"
            className="kds-donut-text"
          >
            {total.toLocaleString('pt-BR')}
          </text>
          <text
            x={center}
            y={center + 24}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily="var(--font-sans)"
            letterSpacing="0.18em"
            fill="var(--text-muted)"
            className="kds-donut-text kds-donut-text-muted"
          >
            TOTAL
          </text>
      </svg>

      {!compact && (
        <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {segments.map((segment, index) => (
          <button
            key={`${segment.label}-${index}`}
            type="button"
            className="kds-donut-legend-item flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-strong)]"
            onClick={() => onSegmentClick?.(segment.label)}
          >
            <div
              className="kds-donut-legend-dot h-3.5 w-3.5 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: segment.color,
                boxShadow: `0 0 0 7px color-mix(in srgb, ${segment.color} 14%, transparent)`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div
                className="kds-donut-label-muted truncate text-[11px] font-semibold uppercase tracking-[0.16em]"
              >
                {segment.label}
              </div>
              <div className="kds-donut-value mt-1 text-base font-semibold">
                {segment.value.toLocaleString('pt-BR')} ({segment.percentage.toFixed(0)}%)
              </div>
            </div>
          </button>
        ))}
        </div>
      )}
    </div>
  );
}
