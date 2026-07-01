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
  color = '#c55a3d',
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
        className="flex items-center justify-center rounded-[var(--radius-2xl)] border border-dashed text-sm"
        style={{
          height,
          borderColor: 'var(--border-subtle)',
          background: 'var(--bg-inset)',
          color: 'var(--text-muted)',
        }}
      >
        Sem dados para o periodo
      </div>
    );
  }

  const recentPoints = data.slice(-3);
  const latestPoint = chart.points[chart.points.length - 1];

  return (
    <div className="relative h-full overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-4 sm:p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 82% 0%, color-mix(in srgb, ${color} 18%, transparent) 0%, transparent 38%), radial-gradient(circle at 10% 100%, color-mix(in srgb, var(--accent-gold) 8%, transparent) 0%, transparent 34%)`,
        }}
      />

      <div className="relative rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
              Série temporal
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
              Tendência suavizada do indicador selecionado
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            Série atual
          </div>
        </div>

        <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className="block w-full" style={{ height }}>
          <defs>
            <linearGradient id="monthlyTrendAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="monthlyTrendLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.72" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>

          {chart.points.map((point, index) => (
            <line
              key={`x-grid-${point.label}-${index}`}
              x1={point.x}
              y1={PADDING.top}
              x2={point.x}
              y2={chart.baselineY}
              stroke="var(--panel-chart-grid)"
              strokeWidth="1"
              opacity="0.55"
            />
          ))}

          {chart.ticks.map((tick, index) => (
            <g key={`${tick.y}-${index}`}>
              <line
                x1={PADDING.left}
                y1={tick.y}
                x2={VIEWBOX_WIDTH - PADDING.right}
                y2={tick.y}
                stroke="var(--panel-chart-grid)"
                strokeWidth="1"
                strokeDasharray={index === TICK_COUNT ? '0' : '4 10'}
              />
              <text
                x={PADDING.left - 12}
                y={tick.y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fontFamily="var(--font-sans)"
                fill="var(--text-muted)"
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
            strokeWidth="3.5"
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
                  fill="var(--bg-surface)"
                  stroke={color}
                  strokeWidth={isLatest ? 3.5 : 2.5}
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
                      fontFamily="var(--font-sans)"
                      fill="var(--text-primary)"
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
                  fontFamily="var(--font-sans)"
                  fill={isLatest ? 'var(--text-primary)' : 'var(--text-muted)'}
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
            stroke="var(--border-subtle)"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      <div className="relative mt-4 grid gap-3 md:grid-cols-3">
        {recentPoints.map((point) => {
          const isLatest = point.label === latestPoint.label;

          return (
            <div
              key={point.label}
              className="rounded-[var(--radius-xl)] border px-4 py-3"
              style={{
                borderColor: isLatest ? `color-mix(in srgb, ${color} 56%, var(--border-subtle))` : 'var(--border-subtle)',
                background: isLatest
                  ? `linear-gradient(180deg, color-mix(in srgb, ${color} 16%, var(--bg-surface)) 0%, var(--bg-surface) 100%)`
                  : 'var(--bg-inset)',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                {point.label}
              </p>
              <p className="mt-2 font-[var(--font-sans)] text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {formatValue(point.value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
