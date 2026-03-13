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

export default function DonutChart({
  data,
  size = 200,
  strokeWidth = 30,
  onSegmentClick,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

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
        className="flex items-center justify-center rounded-[1.75rem] border text-sm"
        style={{
          width: size,
          height: size,
          borderColor: 'var(--panel-border-subtle,#e4d5c0)',
          background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)',
          color: 'var(--panel-text-muted,#876f5c)',
        }}
      >
        Sem dados
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-center justify-center rounded-[2rem] border p-4"
        style={{
          borderColor: 'var(--panel-border-subtle,#e4d5c0)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, white 6%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 88%, var(--panel-surface-soft,#efe6d8) 12%) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--panel-chart-grid, #e4d5c0)"
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
            y={center - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="34"
            fontWeight="800"
            fill="var(--panel-text,#1c1917)"
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
            letterSpacing="0.18em"
            fill="var(--panel-text-muted,#876f5c)"
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
          >
            TOTAL
          </text>
        </svg>
      </div>

      <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        {segments.map((segment, index) => (
          <button
            key={`${segment.label}-${index}`}
            type="button"
            className="flex items-center gap-3 rounded-[1.2rem] border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-bg,#f8f5ef)]"
            style={{
              borderColor: 'var(--panel-border-subtle,#e4d5c0)',
              background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, transparent)',
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
                style={{ color: 'var(--panel-text-muted,#876f5c)' }}
              >
                {segment.label}
              </div>
              <div className="mt-1 text-base font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                {segment.value.toLocaleString('pt-BR')} ({segment.percentage.toFixed(0)}%)
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
