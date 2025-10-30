import { useMemo } from 'react';

type BarChartProps = {
  data: Array<{
    label: string;
    value: number;
    color?: string;
  }>;
  height?: number;
  showValues?: boolean;
};

export default function BarChart({ data, height = 300, showValues = true }: BarChartProps) {
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map(d => d.value));
    return max || 1;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-slate-400 text-sm" style={{ height }}>
        Sem dados
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * 100;
          const color = item.color || '#14b8a6';

          return (
            <div key={index} className="flex-1 flex flex-col items-center justify-end">
              <div className="w-full relative group">
                {showValues && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.value}
                  </div>
                )}
                <div
                  className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    minHeight: item.value > 0 ? '4px' : '0',
                  }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-600 text-center truncate w-full px-1">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
