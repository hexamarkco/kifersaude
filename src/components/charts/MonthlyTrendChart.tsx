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
  height = 300,
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
        className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400"
        style={{ height }}
      >
        Sem dados para o periodo
      </div>
    );
  }

  const recentPoints = data.slice(-3);

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" style={{ height }}>
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
              stroke="#e2e8f0"
              strokeDasharray={index === TICK_COUNT ? '0' : '1.5 2'}
              strokeWidth="0.35"
            />
            <text
              x={LEFT_AXIS_WIDTH - 1.5}
              y={tick.y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="2.8"
              fill="#64748b"
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
              fill={bar.isLast ? '#0f172a' : '#64748b'}
            >
              {bar.shortLabel}
            </text>
            <title>{`${bar.label}: ${formatValue(bar.value)}`}</title>
          </g>
        ))}
      </svg>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {recentPoints.map((point, index) => {
          const isLatest = index === recentPoints.length - 1;

          return (
            <div
              key={point.label}
              className={`rounded-xl border px-3 py-2 text-sm ${
                isLatest ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <p className={`text-xs ${isLatest ? 'text-slate-300' : 'text-slate-500'}`}>{point.label}</p>
              <p className="mt-1 font-semibold">{formatValue(point.value)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
