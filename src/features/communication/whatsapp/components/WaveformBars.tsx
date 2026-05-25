import { memo } from 'react';
import { DEFAULT_WAVEFORM } from './InboxComponentsShared';

function WaveformBarsBase({ bars, active = false }: { bars?: number[]; active?: boolean }) {
  const resolvedBars = bars && bars.length > 0 ? bars : DEFAULT_WAVEFORM;

  return (
    <div className={`whatsapp-inbox-waveform ${active ? 'is-active' : ''}`} aria-hidden="true">
      {resolvedBars.map((bar, index) => (
        <span
          key={`${index}-${bar}`}
          className="whatsapp-inbox-waveform-bar"
          style={{ height: `${Math.max(16, Math.round(bar * 34))}px`, animationDelay: `${index * 24}ms` }}
        />
      ))}
    </div>
  );
}

export const WaveformBars = memo(WaveformBarsBase);
