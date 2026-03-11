import { useMemo } from 'react';

type MonthlyTrendPoint = {
  label: string;
  value: number;
};

type MonthlyTrendChartProps = {
  data: MonthlyTrendPoint[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
};

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 280;
const PADDING = {
  top: 20,
  right: 24,
  bottom: 44,
  left: 58,
};
const TICK_COUNT = 4;

export default function MonthlyTrendChart({
  data,
  color = '#14b8a6',
  height = 280,
  formatValue = (value) => value.toLocaleString('pt-BR'),
}: MonthlyTrendChartProps) {
  const chart = useMemo(() => {
    if (data.length === 0) {
      return null;
    }

    const width = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
    const chartHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom;
    const maxValue = Math.max(...data.map((item) => item.value), 0);
    const minValue = Math.min(...data.map((item) => item.value), 0);
    const range = Math.max(maxValue - minValue, 1);
    const stepX = data.length > 1 ? width / (data.length - 1) : 0;

    const points = data.map((point, index) => {
      const x = PADDING.left + stepX * index;
      const normalized = (point.value - minValue) / range;
      const y = PADDING.top + chartHeight - normalized * chartHeight;

      return {
        ...point,
        x,
        y,
      };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const areaPath = `${linePath} L ${points[points.length - 1].x} ${VIEWBOX_HEIGHT - PADDING.bottom} L ${points[0].x} ${VIEWBOX_HEIGHT - PADDING.bottom} Z`;

    const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / TICK_COUNT;
      const value = maxValue - (maxValue - minValue) * ratio;
      const y = PADDING.top + chartHeight * ratio;

      return {
        y,
        value,
      };
    });

    return {
      points,
      ticks,
      linePath,
      areaPath,
      baselineY: VIEWBOX_HEIGHT - PADDING.bottom,
    };
  }, [data]);

  if (!chart) {
    return (
      <div
        className="flex items-center justify-center rounded-[28px] border text-sm"
        style={{
          height,
          borderColor: 'var(--panel-border)',
          background: 'var(--panel-surface)',
          color: 'var(--panel-text-muted)',
        }}
      >
        Sem dados para o periodo
      </div>
    );
  }

  const recentPoints = data.slice(-3);
  const latestPoint = chart.points[chart.points.length - 1];

  return (
    <div
      className="w-full rounded-[28px] border p-5"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'linear-gradient(180deg, var(--panel-surface-muted) 0%, var(--panel-surface) 100%)',
      }}
    >
      <div
        className="rounded-[24px] border p-4"
        style={{
          borderColor: 'var(--panel-border-subtle)',
          background: 'color-mix(in srgb, var(--panel-surface) 92%, transparent)',
        }}
      >
        <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="block w-full" style={{ height }}>
          <defs>
            <linearGradient id="monthlyTrendAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="monthlyTrendLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.72" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>

          {chart.ticks.map((tick, index) => (
            <g key={`${tick.y}-${index}`}>
              <line
                x1={PADDING.left}
                y1={tick.y}
                x2={VIEWBOX_WIDTH - PADDING.right}
                y2={tick.y}
                stroke="var(--panel-chart-grid)"
                strokeWidth="1"
                strokeDasharray={index === TICK_COUNT ? '0' : '6 8'}
              />
              <text
                x={PADDING.left - 12}
                y={tick.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fill="var(--panel-text-muted)"
              >
                {formatValue(Math.round(tick.value))}
              </text>
            </g>
          ))}

          <path d={chart.areaPath} fill="url(#monthlyTrendAreaGradient)" />
          <path
            d={chart.linePath}
            fill="none"
            stroke="url(#monthlyTrendLineGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chart.points.map((point, index) => {
            const isLatest = index === chart.points.length - 1;

            return (
              <g key={point.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isLatest ? 7 : 5}
                  fill="var(--panel-surface)"
                  stroke={color}
                  strokeWidth={isLatest ? 4 : 3}
                />
                {isLatest && (
                  <>
                    <circle cx={point.x} cy={point.y} r="14" fill={color} opacity="0.14" />
                    <text
                      x={point.x}
                      y={Math.max(point.y - 18, 18)}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="var(--panel-text)"
                    >
                      {formatValue(point.value)}
                    </text>
                  </>
                )}
                <text
                  x={point.x}
                  y={chart.baselineY + 24}
                  textAnchor="middle"
                  fontSize="12"
                  fill={isLatest ? 'var(--panel-text)' : 'var(--panel-text-muted)'}
                >
                  {point.label}
                </text>
                <title>{`${point.label}: ${formatValue(point.value)}`}</title>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            y1={chart.baselineY}
            x2={VIEWBOX_WIDTH - PADDING.right}
            y2={chart.baselineY}
            stroke="var(--panel-border-subtle)"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {recentPoints.map((point) => {
          const isLatest = point.label === latestPoint.label;

          return (
            <div
              key={point.label}
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: isLatest ? color : 'var(--panel-border-subtle)',
                background: isLatest
                  ? `linear-gradient(135deg, ${color}20 0%, var(--panel-surface) 100%)`
                  : 'var(--panel-surface)',
                boxShadow: isLatest ? `inset 0 0 0 1px ${color}33` : 'none',
              }}
            >
              <p className="text-sm" style={{ color: 'var(--panel-text-muted)' }}>
                {point.label}
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--panel-text)' }}>
                {formatValue(point.value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
