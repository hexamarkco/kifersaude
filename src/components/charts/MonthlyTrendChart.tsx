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

const CHART_WIDTH = 100;
const CHART_HEIGHT = 100;
const LEFT_AXIS_WIDTH = 12;
const RIGHT_PADDING = 4;
const TOP_PADDING = 10;
const BOTTOM_PADDING = 18;
const TICK_COUNT = 4;

export default function MonthlyTrendChart({
  data,
  color = '#14b8a6',
  height = 220,
  formatValue = (value) => value.toLocaleString('pt-BR'),
}: MonthlyTrendChartProps) {
  const chartModel = useMemo(() => {
    if (data.length === 0) {
      return null;
    }

    const maxValue = Math.max(...data.map((item) => item.value), 0);
    const chartInnerWidth = CHART_WIDTH - LEFT_AXIS_WIDTH - RIGHT_PADDING;
    const chartInnerHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const stepX = chartInnerWidth / data.length;
    const safeMaxValue = maxValue || 1;

    const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => {
      const ratio = index / TICK_COUNT;
      const value = safeMaxValue * (1 - ratio);
      const y = TOP_PADDING + chartInnerHeight * ratio;

      return {
        y,
        label: formatValue(Math.round(value)),
      };
    });

    const bars = data.map((point, index) => {
      const barWidth = Math.max(stepX * 0.56, 3.2);
      const barHeight = (point.value / safeMaxValue) * chartInnerHeight;
      const x = LEFT_AXIS_WIDTH + stepX * index + (stepX - barWidth) / 2;
      const y = TOP_PADDING + chartInnerHeight - barHeight;

      return {
        ...point,
        x,
        y,
        barWidth,
        barHeight,
        isLast: index === data.length - 1,
        shortLabel: point.label.replace('.', '').slice(0, 3),
      };
    });

    return { ticks, bars };
  }, [data, formatValue]);

  if (!chartModel) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed text-sm"
        style={{
          height,
          borderColor: 'var(--panel-border)',
          background: 'var(--panel-surface-muted)',
          color: 'var(--panel-text-muted)',
        }}
      >
        Sem dados para o periodo
      </div>
    );
  }

  const recentPoints = data.slice(-3);

  return (
    <div
      className="w-full rounded-2xl border p-4"
      style={{
        borderColor: 'var(--panel-border-subtle)',
        background: 'linear-gradient(180deg, var(--panel-surface-muted) 0%, var(--panel-surface) 100%)',
      }}
    >
      <div
        className="rounded-[20px] border px-3 py-2"
        style={{
          borderColor: 'var(--panel-border-subtle)',
          background: 'var(--panel-surface)',
        }}
      >
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="block w-full" style={{ height }}>
        <defs>
          <linearGradient id="monthlyTrendBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {chartModel.ticks.map((tick, index) => (
          <g key={`${tick.y}-${index}`}>
            <line
              x1={LEFT_AXIS_WIDTH}
              y1={tick.y}
              x2={CHART_WIDTH - RIGHT_PADDING}
              y2={tick.y}
              stroke="var(--panel-chart-grid)"
              strokeDasharray={index === TICK_COUNT ? '0' : '1.5 2'}
              strokeWidth="0.35"
            />
            <text
              x={LEFT_AXIS_WIDTH - 1.5}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="2.8"
              fill="var(--panel-text-muted)"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {chartModel.bars.map((bar) => (
          <g key={bar.label}>
            {bar.isLast && (
              <rect
                x={bar.x - 1.4}
                y={TOP_PADDING - 2}
                width={bar.barWidth + 2.8}
                height={CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING + 4}
                rx="3"
                fill={color}
                opacity="0.08"
              />
            )}
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.barWidth}
              height={Math.max(bar.barHeight, 0.8)}
              rx="2"
              fill={bar.isLast ? 'url(#monthlyTrendBarGradient)' : color}
              opacity={bar.isLast ? 1 : 0.28}
            />
            <text
              x={bar.x + bar.barWidth / 2}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fontSize="2.8"
              fill={bar.isLast ? 'var(--panel-text)' : 'var(--panel-text-muted)'}
            >
              {bar.shortLabel}
            </text>
            <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
          </g>
        ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {recentPoints.map((point, index) => {
          const isLatest = index === recentPoints.length - 1;

          return (
            <div
              key={point.label}
              className="rounded-xl border px-3 py-2 text-sm"
              style={
                isLatest
                  ? {
                      borderColor: color,
                      background: `linear-gradient(180deg, ${color}22 0%, var(--panel-surface) 100%)`,
                      boxShadow: `inset 0 0 0 1px ${color}22`,
                      color: 'var(--panel-text)',
                    }
                  : {
                      borderColor: 'var(--panel-border-subtle)',
                      background: 'var(--panel-surface)',
                      color: 'var(--panel-text-soft)',
                    }
              }
            >
              <p
                className="text-xs"
                style={{ color: isLatest ? 'var(--panel-text-soft)' : 'var(--panel-text-muted)' }}
              >
                {point.label}
              </p>
              <p className="mt-1 font-semibold" style={{ color: 'var(--panel-text)' }}>
                {formatValue(point.value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
