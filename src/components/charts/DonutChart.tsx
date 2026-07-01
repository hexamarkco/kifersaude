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
        className="flex items-center justify-center rounded-[var(--radius-2xl)] border text-sm"
        style={{
          width: size,
          height: size,
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-inset)',
          color: 'var(--text-muted)',
        }}
      >
        Sem dados
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-[var(--radius-2xl)] border p-4"
        style={{
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-inset)',
          boxShadow: 'var(--control-inset-shadow)',
        }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
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
              style={{
                transform: `rotate(${segment.rotation}deg)`,
                transformOrigin: 'center',
                transition: 'stroke-dasharray 0.3s ease',
                cursor: onSegmentClick ? 'pointer' : 'default',
              }}
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
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
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
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
          >
            TOTAL
          </text>
        </svg>
      </div>

      {!compact && (
        <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {segments.map((segment, index) => (
          <button
            key={`${segment.label}-${index}`}
            type="button"
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-strong)]"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--bg-inset)',
            }}
            onClick={() => onSegmentClick?.(segment.label)}
          >
            <div
              className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
              style={{
                backgroundColor: segment.color,
                boxShadow: `0 0 0 7px color-mix(in srgb, ${segment.color} 14%, transparent)`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: 'var(--text-muted)' }}
              >
                {segment.label}
              </div>
              <div className="mt-1 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
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
