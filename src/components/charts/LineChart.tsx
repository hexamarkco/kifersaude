import { useMemo } from 'react';

type DataPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  data: DataPoint[];
  color?: string;
  height?: number;
  showGrid?: boolean;
  showDots?: boolean;
};

export default function LineChart({
  data,
  color = '#14b8a6',
  height = 200,
  showGrid = true,
  showDots = true,
}: LineChartProps) {
  const { points, pathD } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], pathD: '' };
    }

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const width = 100;
    const padding = 10;
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;

    const points = data.map((d, i) => {
      const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
      const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, value: d.value, label: d.label };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return { points, pathD };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Sem dados
      </div>
    );
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" className="w-full" style={{ height }}>
        {showGrid && (
          <g className="grid">
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="10"
                y1={y}
                x2="90"
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.2"
              />
            ))}
          </g>
        )}

        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={`${pathD} L ${points[points.length - 1].x} 90 L ${points[0].x} 90 Z`}
          fill="url(#lineGradient)"
          className="transition-all duration-300"
        />

        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300"
        />

        {showDots && points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="1.5"
              fill="white"
              stroke={color}
              strokeWidth="0.5"
              className="transition-all duration-300 hover:r-2"
            />
            <title>
              {`${point.label}: ${point.value.toLocaleString('pt-BR')}`}
            </title>
          </g>
        ))}
      </svg>

      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{data[0]?.label || ''}</span>
        <span>{data[data.length - 1]?.label || ''}</span>
      </div>
    </div>
  );
}
