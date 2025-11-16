import { Pause, Play, Scissors, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const WAVEFORM_BAR_COUNT = 64;

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

const formatTime = (value: number) => {
  const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
  const minutes = Math.floor(safeValue / 60);
  const seconds = Math.floor(safeValue % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const fetchArrayBufferFromDataUrl = async (dataUrl: string) => {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error('Não foi possível carregar o áudio para edição.');
  }
  return response.arrayBuffer();
};

const getAudioContext = () => {
  const AudioContextConstructor =
    typeof window !== 'undefined'
      ? window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : null;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
};

const createWaveformValues = (buffer: AudioBuffer, barCount = WAVEFORM_BAR_COUNT): number[] => {
  const length = buffer.length;
  if (length === 0) {
    return new Array(barCount).fill(0);
  }

  const channelCount = buffer.numberOfChannels;
  const samplesPerBar = Math.max(1, Math.floor(length / barCount));
  const values: number[] = [];

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    const startSample = barIndex * samplesPerBar;
    const endSample = Math.min(startSample + samplesPerBar, length);
    let sum = 0;
    let count = 0;

    for (let channel = 0; channel < channelCount; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      for (let sample = startSample; sample < endSample; sample += 1) {
        sum += Math.abs(channelData[sample] ?? 0);
        count += 1;
      }
    }

    const average = count > 0 ? sum / count : 0;
    values.push(clamp01(average * 4));
  }

  return values;
};

const applyFadesAndNormalization = (buffer: AudioBuffer) => {
  const fadeDurationSeconds = Math.min(0.05, buffer.duration / 4);
  const fadeSamples = Math.max(1, Math.floor(buffer.sampleRate * fadeDurationSeconds));

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel);

    for (let i = 0; i < fadeSamples && i < channelData.length; i += 1) {
      const multiplier = i / fadeSamples;
      channelData[i] *= multiplier;
    }

    for (let i = 0; i < fadeSamples && i < channelData.length; i += 1) {
      const multiplier = 1 - i / fadeSamples;
      const index = channelData.length - 1 - i;
      if (index >= 0) {
        channelData[index] *= multiplier;
      }
    }
  }

  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i += 1) {
      peak = Math.max(peak, Math.abs(channelData[i] ?? 0));
    }
  }

  if (peak > 0 && peak < 0.95) {
    const gain = 0.98 / peak;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i += 1) {
        channelData[i] *= gain;
      }
    }
  }
};

const encodeWavBuffer = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const bufferLength = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  const writeString = (text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
    offset += text.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const interleaved = new Float32Array(buffer.length * numChannels);
  let interleavedOffset = 0;
  for (let sample = 0; sample < buffer.length; sample += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const channelData = buffer.getChannelData(channel);
      interleaved[interleavedOffset] = channelData[sample] ?? 0;
      interleavedOffset += 1;
    }
  }

  for (let i = 0; i < interleaved.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, interleaved[i] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return arrayBuffer;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Não foi possível converter o áudio.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível converter o áudio.'));
    reader.readAsDataURL(blob);
  });

export type AudioEditorModalProps = {
  dataUrl: string;
  durationSeconds: number | null;
  mimeType: string;
  onSave: (result: { dataUrl: string; durationSeconds: number; mimeType: string }) => void;
  onCancel: () => void;
};

export function AudioEditorModal({ dataUrl, durationSeconds, mimeType, onSave, onCancel }: AudioEditorModalProps) {
  const [waveformValues, setWaveformValues] = useState<number[]>([]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(durationSeconds ?? 0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);

  useEffect(() => {
    const context = getAudioContext();
    if (!context) {
      setError('Seu navegador não suporta a edição de áudio.');
      setIsLoading(false);
      return () => undefined;
    }

    audioContextRef.current = context;
    return () => {
      const audioElement = audioElementRef.current;
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      context.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const loadAudio = async () => {
      const context = audioContextRef.current;
      if (!context) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const arrayBuffer = await fetchArrayBufferFromDataUrl(dataUrl);
        const decoded = await context.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        setWaveformValues(createWaveformValues(decoded));
        setStartTime(0);
        setEndTime(decoded.duration);
      } catch (loadError) {
        console.error('Erro ao carregar áudio para edição', loadError);
        setError('Não foi possível carregar o áudio para edição.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [dataUrl]);

  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  useEffect(() => {
    const audioElement = new Audio(dataUrl);
    audioElement.preload = 'auto';
    audioElementRef.current = audioElement;

    const handleEnded = () => setIsPreviewPlaying(false);
    const handlePause = () => setIsPreviewPlaying(false);
    const handleTimeUpdate = () => {
      if (audioElement.currentTime >= endTimeRef.current) {
        audioElement.pause();
      }
    };

    audioElement.addEventListener('ended', handleEnded);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audioElement.pause();
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElementRef.current = null;
    };
  }, [dataUrl]);

  const derivedDuration = useMemo(() => {
    if (audioBuffer) {
      return audioBuffer.duration;
    }
    if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
      return durationSeconds;
    }
    return 0;
  }, [audioBuffer, durationSeconds]);

  useEffect(() => {
    if (derivedDuration > 0 && endTime === 0) {
      setEndTime(derivedDuration);
    }
  }, [derivedDuration, endTime]);

  const minSelectionDuration = 0.3;

  const handleStartChange = useCallback(
    (value: number) => {
      const safeValue = Math.max(0, Math.min(value, endTime - minSelectionDuration));
      setStartTime(safeValue);
    },
    [endTime],
  );

  const handleEndChange = useCallback(
    (value: number) => {
      const safeValue = Math.min(derivedDuration, Math.max(value, startTime + minSelectionDuration));
      setEndTime(safeValue);
    },
    [derivedDuration, startTime],
  );

  const togglePreview = useCallback(async () => {
    const audioElement = audioElementRef.current;
    if (!audioElement) {
      return;
    }

    if (isPreviewPlaying) {
      audioElement.pause();
      setIsPreviewPlaying(false);
      return;
    }

    try {
      audioElement.currentTime = startTimeRef.current;
      setIsPreviewPlaying(true);
      await audioElement.play();
    } catch (playError) {
      console.error('Erro ao reproduzir áudio editado', playError);
      setIsPreviewPlaying(false);
    }
  }, [isPreviewPlaying]);

  const handleSave = useCallback(async () => {
    if (!audioBuffer || !audioContextRef.current) {
      return;
    }

    const selectionDuration = endTime - startTime;
    if (!(selectionDuration > 0)) {
      setError('Selecione um trecho válido do áudio.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.max(0, Math.floor(startTime * sampleRate));
      const endSample = Math.min(audioBuffer.length, Math.floor(endTime * sampleRate));
      const frameCount = Math.max(1, endSample - startSample);
      const channelCount = audioBuffer.numberOfChannels;

      const offlineContext = new OfflineAudioContext(channelCount, frameCount, sampleRate);
      const trimmedBuffer = offlineContext.createBuffer(channelCount, frameCount, sampleRate);

      for (let channel = 0; channel < channelCount; channel += 1) {
        const channelData = audioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);
        trimmedData.set(channelData.subarray(startSample, endSample));
      }

      applyFadesAndNormalization(trimmedBuffer);

      const source = offlineContext.createBufferSource();
      source.buffer = trimmedBuffer;
      source.connect(offlineContext.destination);
      source.start();

      const renderedBuffer = await offlineContext.startRendering();
      const wavArrayBuffer = encodeWavBuffer(renderedBuffer);
      const blob = new Blob([wavArrayBuffer], { type: 'audio/wav' });
      const editedDataUrl = await blobToDataUrl(blob);

      onSave({ dataUrl: editedDataUrl, durationSeconds: renderedBuffer.duration, mimeType: 'audio/wav' });
    } catch (saveError) {
      console.error('Erro ao salvar áudio editado', saveError);
      setError('Não foi possível salvar o áudio editado.');
    } finally {
      setIsSaving(false);
    }
  }, [audioBuffer, endTime, onSave, startTime]);

  const selectionLabel = `${formatTime(startTime)} - ${formatTime(endTime)}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Editar áudio</p>
            <p className="text-xs text-slate-500">Ajuste o trecho antes de enviar no WhatsApp.</p>
            <p className="text-[11px] text-slate-400">Formato original: {mimeType || 'desconhecido'}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Fechar editor de áudio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-slate-600">Carregando áudio para edição...</p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                  <span>Trecho selecionado</span>
                  <span>{selectionLabel}</span>
                </div>
                <div className="mt-4 flex items-end gap-1 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-4">
                  {waveformValues.length > 0
                    ? waveformValues.map((value, index) => {
                        const height = 12 + Math.round(clamp01(value) * 80);
                        const opacity = 0.4 + clamp01(value) * 0.5;
                        return (
                          <span
                            key={`wave-${index}`}
                            className="inline-flex w-1 flex-1 rounded-full bg-emerald-500"
                            style={{ height: `${height}px`, opacity }}
                          />
                        );
                      })
                    : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Início</p>
                  <p className="text-xs text-slate-500">Defina onde o áudio deve começar.</p>
                  <input
                    type="range"
                    min={0}
                    max={derivedDuration}
                    step={0.1}
                    value={startTime}
                    onChange={(event) => handleStartChange(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatTime(startTime)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Fim</p>
                  <p className="text-xs text-slate-500">Defina onde o áudio deve terminar.</p>
                  <input
                    type="range"
                    min={0}
                    max={derivedDuration}
                    step={0.1}
                    value={endTime}
                    onChange={(event) => handleEndChange(Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatTime(endTime)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Scissors className="h-4 w-4 text-emerald-500" />
                  <span>Aperte play para ouvir apenas o trecho selecionado.</span>
                </div>
                <button
                  type="button"
                  onClick={togglePreview}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {isPreviewPlaying ? 'Pausar prévia' : 'Reproduzir prévia'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || !audioBuffer}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Salvando...' : 'Aplicar ajustes'}
          </button>
        </div>
      </div>
    </div>
  );
}
