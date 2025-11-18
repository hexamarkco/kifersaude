import { Pause, Play } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const formatTime = (value: number) => {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PLAYBACK_RATES: readonly number[] = [1, 1.5, 2];

export type AudioMessageBubbleProps = {
  src: string;
  seconds?: number | null;
  className?: string;
  variant?: 'sent' | 'received';
};

export function AudioMessageBubble({ src, seconds, className, variant = 'received' }: AudioMessageBubbleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLInputElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [playbackRateIndex, setPlaybackRateIndex] = useState(0);

  const playbackRate = PLAYBACK_RATES[playbackRateIndex] ?? 1;

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audioRef.current = audio;
    setIsPlaying(false);
    setCurrentTime(0);

    const handleLoadedMetadata = () => {
      const audioDuration = Number.isFinite(audio.duration) ? audio.duration : null;
      setDuration(audioDuration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (progressBarRef.current) {
        progressBarRef.current.value = String(audio.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (progressBarRef.current) {
        progressBarRef.current.value = '0';
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audioRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch (error) {
      console.error('Falha ao reproduzir o áudio', error);
    }
  }, [isPlaying]);

  const handleProgressChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const value = Number(event.target.value);
    if (!Number.isFinite(value)) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }, []);

  const handlePlaybackRateChange = useCallback(() => {
    setPlaybackRateIndex(currentIndex => (currentIndex + 1) % PLAYBACK_RATES.length);
  }, []);

  const derivedDuration = useMemo(() => {
    if (duration && Number.isFinite(duration)) {
      return duration;
    }

    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return seconds;
    }

    return null;
  }, [duration, seconds]);

  const formattedCurrentTime = formatTime(currentTime);
  const formattedDuration = derivedDuration ? formatTime(derivedDuration) : null;

  const sliderMax = derivedDuration && derivedDuration > 0 ? derivedDuration : Math.max(currentTime, 1);

  const palette = variant === 'sent'
    ? {
        text: 'text-emerald-950',
        mutedText: 'text-emerald-900/80',
        controlBg: 'bg-emerald-50/25',
        controlBorder: 'border-emerald-100/80',
        controlText: 'text-emerald-900',
        hoverBg: 'hover:bg-emerald-50/50',
        sliderTrack: 'bg-emerald-200/80',
        sliderThumb: 'bg-emerald-800',
      }
    : {
        text: 'text-slate-800',
        mutedText: 'text-slate-600',
        controlBg: 'bg-slate-100',
        controlBorder: 'border-slate-200',
        controlText: 'text-slate-700',
        hoverBg: 'hover:bg-slate-200/70',
        sliderTrack: 'bg-slate-300',
        sliderThumb: 'bg-slate-500',
      };

  const controlButtonClassName =
    `flex h-10 w-10 items-center justify-center rounded-full border ${palette.controlBorder} ${palette.controlBg} ${palette.controlText} ` +
    'shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400/50';

  const seekButtonClassName =
    `rounded-full px-3 py-1 text-xs font-semibold ${palette.controlText} ${palette.hoverBg} ${palette.controlBg}`;

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const limit = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : derivedDuration;
      const nextTime = (() => {
        if (typeof limit === 'number') {
          return Math.min(Math.max(audio.currentTime + delta, 0), limit);
        }
        return Math.max(audio.currentTime + delta, 0);
      })();

      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      if (progressBarRef.current) {
        progressBarRef.current.value = String(nextTime);
      }
    },
    [derivedDuration],
  );

  return (
    <div
      className={`flex w-[320px] max-w-full flex-col gap-2 rounded-lg bg-transparent p-1 ${palette.text} ${className ?? ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
          className={`${controlButtonClassName} ${isPlaying ? 'bg-emerald-50/70' : ''}`}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="flex flex-1 flex-col gap-1">
          <div className={`flex items-center gap-2 text-xs font-medium ${palette.mutedText}`}>
            <span>{formattedCurrentTime}</span>
            {formattedDuration ? <span>•</span> : null}
            {formattedDuration ? <span>{formattedDuration}</span> : null}
          </div>
          <input
            ref={progressBarRef}
            type="range"
            min={0}
            max={sliderMax}
            step={0.1}
            value={Math.min(currentTime, sliderMax)}
            onChange={handleProgressChange}
            className={`h-1 w-full cursor-pointer appearance-none rounded-full ${palette.sliderTrack} focus:outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:${palette.sliderThumb}`}
          />
        </div>
      </div>
      <div className={`flex items-center justify-between text-xs font-medium ${palette.mutedText}`}>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => seekBy(-5)}
            className={seekButtonClassName}
          >
            -5s
          </button>
          <button
            type="button"
            onClick={() => seekBy(5)}
            className={seekButtonClassName}
          >
            +5s
          </button>
        </div>
        <button
          type="button"
          onClick={handlePlaybackRateChange}
          className={seekButtonClassName}
        >
          {playbackRate.toString().replace('.', ',')}x
        </button>
      </div>
    </div>
  );
}

export default AudioMessageBubble;
