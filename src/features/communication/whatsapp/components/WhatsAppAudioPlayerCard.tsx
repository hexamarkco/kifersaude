import { memo, useState, useEffect, useRef } from 'react';
import { Headphones, Mic, Pause, Play } from 'lucide-react';
import { DEFAULT_WAVEFORM, formatDurationLabel } from './InboxComponentsShared';

function WhatsAppAudioPlayerCardBase({
  kind, mediaUrl, mediaMimeType, fileName, durationSeconds, loading, error,
}: {
  kind: 'audio' | 'voice'; mediaUrl: string | null; mediaMimeType?: string | null; fileName?: string | null;
  durationSeconds?: number | null; loading: boolean; error: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedDuration, setResolvedDuration] = useState(durationSeconds ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => { if (Number.isFinite(audio.duration) && audio.duration > 0) setResolvedDuration(audio.duration); };
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); audio.currentTime = 0; };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    return () => { audio.pause(); audio.removeEventListener('timeupdate', handleTimeUpdate); audio.removeEventListener('loadedmetadata', handleLoadedMetadata); audio.removeEventListener('ended', handleEnded); };
  }, [mediaUrl]);

  const handleTogglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); return; }
    void audio.play().then(() => setIsPlaying(true)).catch(() => undefined);
  };

  const duration = Math.max(resolvedDuration || 0, durationSeconds || 0);
  const waveformBars = kind === 'voice' ? DEFAULT_WAVEFORM : DEFAULT_WAVEFORM.map((value, index) => (index % 3 === 0 ? value * 0.62 : value * 0.92));
  const playedBars = duration > 0 ? Math.min(waveformBars.length, Math.ceil((currentTime / duration) * waveformBars.length)) : 0;

  if (!mediaUrl) {
    return (
      <div className={`whatsapp-inbox-audio-native-card ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
        <div className={`whatsapp-inbox-audio-native-badge ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
          {kind === 'voice' ? <Mic className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {kind !== 'voice' ? <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de áudio'}</p> : null}
          <p className="text-xs opacity-75">{loading ? 'Carregando áudio...' : error || 'Áudio indisponível'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`whatsapp-inbox-audio-native-card ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
      <audio ref={audioRef} preload="metadata"><source src={mediaUrl} type={mediaMimeType || undefined} /></audio>
      <div className={`whatsapp-inbox-audio-native-badge ${kind === 'voice' ? 'is-voice' : 'is-audio'}`}>
        {kind === 'voice' ? <Mic className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleTogglePlayback} className="whatsapp-inbox-audio-native-play" aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <div className={`min-w-0 flex-1 ${kind === 'voice' ? 'space-y-1.5' : 'space-y-2'}`}>
            {kind !== 'voice' ? (
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">{fileName || 'Arquivo de áudio'}</p>
                <span className="text-[11px] font-medium opacity-70">Áudio enviado</span>
              </div>
            ) : null}
            <div className="whatsapp-inbox-audio-native-waveform">
              {waveformBars.map((bar, index) => (
                <span key={`${kind}-${index}-${bar}`} className={`whatsapp-inbox-audio-native-waveform-bar ${index < playedBars ? 'is-played' : ''} ${isPlaying ? 'is-active' : ''}`} style={{ height: `${Math.max(10, Math.round(bar * 22))}px` }} />
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs opacity-80">
              <span>{formatDurationLabel(Math.round(currentTime))}</span>
              <span>{formatDurationLabel(Math.round(duration))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const WhatsAppAudioPlayerCard = memo(WhatsAppAudioPlayerCardBase);
