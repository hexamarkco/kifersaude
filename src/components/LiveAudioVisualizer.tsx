type LiveAudioVisualizerProps = {
  values: number[];
  barCount?: number;
  className?: string;
};

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const padValues = (values: number[], barCount: number): number[] => {
  if (values.length === barCount) {
    return values;
  }

  if (values.length > barCount) {
    return values.slice(values.length - barCount);
  }

  const padded = [...values];
  while (padded.length < barCount) {
    padded.unshift(0);
  }

  return padded;
};

export function LiveAudioVisualizer({
  values,
  barCount = 128,
  className = '',
}: LiveAudioVisualizerProps) {
  const safeBarCount = Math.max(4, barCount);
  const resolvedValues = padValues(values.length > 0 ? values : new Array(safeBarCount).fill(0), safeBarCount);

  return (
    <div
      className={`flex h-20 items-end gap-1 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 ${className}`}
      aria-hidden="true"
    >
      {resolvedValues.map((rawValue, index) => {
        const value = clamp01(rawValue);
        const height = 8 + Math.round(value * 64);
        const opacity = 0.25 + value * 0.6;
        return (
          <span
            key={`audio-bar-${index}`}
            className="inline-flex w-1 flex-1 rounded-full bg-emerald-400 transition-[height,opacity] duration-150 ease-out"
            style={{ height: `${height}px`, opacity }}
          />
        );
      })}
    </div>
  );
}
