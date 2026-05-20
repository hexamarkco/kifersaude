import { useCallback, useEffect, useRef, useState } from 'react';

import { toast } from '../../../../lib/toast';

export type VoiceRecordingState = 'idle' | 'requesting' | 'recording';

type PendingAttachment = {
  id: string;
  file: File;
  kind: string;
  durationSeconds?: number;
  previewUrl?: string | null;
  waveform?: number[];
  waveformPayload?: string | null;
};

const DEFAULT_WAVEFORM = [4, 6, 8, 6, 4, 6, 8, 6, 4, 6, 8, 6, 4];

const getSupportedVoiceMimeType = (): string | undefined => {
  const types = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
};

const buildWaveformBars = (data: Uint8Array): number[] => {
  const bars: number[] = [];
  const step = Math.max(1, Math.floor(data.length / 13));
  for (let i = 0; i < 13; i++) {
    const slice = data.slice(i * step, (i + 1) * step);
    const avg = slice.reduce((sum, v) => sum + Math.abs(v - 128), 0) / slice.length;
    bars.push(Math.round((avg / 128) * 10));
  }
  return bars;
};

const buildVoiceWaveformPayload = (data: Uint8Array): string => {
  return Array.from(data).slice(0, 64).join(',');
};

const createPendingAttachmentId = (): string => {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const useVoiceRecording = ({
  sendDisabledReason,
  onAttachmentChange,
}: {
  sendDisabledReason: string | null;
  onAttachmentChange: (updater: (current: PendingAttachment[]) => PendingAttachment[]) => void;
}) => {
  const [voiceRecordingState, setVoiceRecordingState] = useState<VoiceRecordingState>('idle');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [voiceRecordingWaveform, setVoiceRecordingWaveform] = useState<number[]>(DEFAULT_WAVEFORM);
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState(false);
  const [voicePreviewDuration, setVoicePreviewDuration] = useState<number | null>(null);
  const [voicePreviewCurrentTime, setVoicePreviewCurrentTime] = useState(0);

  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceWaveformTimerRef = useRef<number | null>(null);
  const voiceMimeTypeRef = useRef('');
  const discardVoiceRecordingRef = useRef(false);
  const voiceRecordingSecondsRef = useRef(0);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const voiceAnalyserRef = useRef<AnalyserNode | null>(null);
  const voiceSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceWaveformDataRef = useRef<Uint8Array | null>(null);
  const voiceWaveformSnapshotRef = useRef<number[]>(DEFAULT_WAVEFORM);
  const voiceWaveformPayloadRef = useRef('');
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const autoSendVoiceRef = useRef(false);

  const clearVoiceTimer = useCallback(() => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
  }, []);

  const clearVoiceWaveformTimer = useCallback(() => {
    if (voiceWaveformTimerRef.current !== null) {
      window.clearInterval(voiceWaveformTimerRef.current);
      voiceWaveformTimerRef.current = null;
    }
  }, []);

  const teardownVoiceAnalyser = useCallback(() => {
    clearVoiceWaveformTimer();
    voiceSourceNodeRef.current?.disconnect();
    voiceSourceNodeRef.current = null;
    voiceAnalyserRef.current?.disconnect();
    voiceAnalyserRef.current = null;
    voiceWaveformDataRef.current = null;
    if (voiceAudioContextRef.current) {
      void voiceAudioContextRef.current.close().catch(() => undefined);
      voiceAudioContextRef.current = null;
    }
  }, [clearVoiceWaveformTimer]);

  const stopVoiceStream = useCallback(() => {
    if (voiceStreamRef.current) {
      for (const track of voiceStreamRef.current.getTracks()) {
        track.stop();
      }
      voiceStreamRef.current = null;
    }
    teardownVoiceAnalyser();
  }, [teardownVoiceAnalyser]);

  const finalizeVoiceRecording = useCallback(() => {
    const chunks = [...voiceChunksRef.current];
    voiceChunksRef.current = [];

    if (discardVoiceRecordingRef.current) {
      discardVoiceRecordingRef.current = false;
      onAttachmentChange(() => []);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      voiceWaveformPayloadRef.current = '';
      return;
    }

    if (chunks.length === 0) {
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      voiceWaveformPayloadRef.current = '';
      return;
    }

    const mimeType = voiceMimeTypeRef.current || 'audio/webm';
    const blob = new Blob(chunks, { type: mimeType });
    const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `nota-voz-${Date.now()}.${extension}`, { type: mimeType });
    const durationSeconds = voiceRecordingSecondsRef.current;
    const previewUrl = URL.createObjectURL(blob);

    onAttachmentChange((current) => {
      const preserved = current.filter((a) => a.kind !== 'voice');
      return [
        ...preserved,
        {
          id: createPendingAttachmentId(),
          file,
          kind: 'voice',
          durationSeconds,
          previewUrl,
          waveform: voiceWaveformSnapshotRef.current,
          waveformPayload: voiceWaveformPayloadRef.current || null,
        },
      ];
    });

    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
    voiceWaveformPayloadRef.current = '';
  }, [onAttachmentChange]);

  const handleStopVoiceRecording = useCallback((autoSend: boolean = false) => {
    if (voiceRecordingState !== 'recording') {
      return;
    }
    autoSendVoiceRef.current = autoSend;
    setVoiceRecordingState('idle');
    clearVoiceTimer();
    voiceRecorderRef.current?.stop();
  }, [clearVoiceTimer, voiceRecordingState]);

  const handleCancelVoiceRecording = useCallback(() => {
    if (voiceRecordingState === 'idle' && !voiceRecorderRef.current) {
      return;
    }
    discardVoiceRecordingRef.current = true;
    autoSendVoiceRef.current = false;
    setVoiceRecordingState('idle');
    setVoiceRecordingSeconds(0);
    voiceRecordingSecondsRef.current = 0;
    setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
    voiceWaveformPayloadRef.current = '';
    clearVoiceTimer();
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    } else {
      voiceChunksRef.current = [];
      stopVoiceStream();
    }
  }, [clearVoiceTimer, stopVoiceStream, voiceRecordingState]);

  const handleStartVoiceRecording = useCallback(async () => {
    if (voiceRecordingState !== 'idle') {
      return;
    }
    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Seu navegador não suporta gravação de áudio neste inbox.');
      return;
    }

    try {
      setVoiceRecordingState('requesting');
      onAttachmentChange(() => []);
      setVoicePreviewPlaying(false);
      setVoicePreviewCurrentTime(0);
      setVoicePreviewDuration(null);
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
      discardVoiceRecordingRef.current = false;
      voiceWaveformPayloadRef.current = '';

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (discardVoiceRecordingRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setVoiceRecordingState('idle');
        return;
      }

      const supportedMimeType = getSupportedVoiceMimeType();
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        const sourceNode = audioContext.createMediaStreamSource(stream);
        sourceNode.connect(analyser);

        voiceAudioContextRef.current = audioContext;
        voiceAnalyserRef.current = analyser;
        voiceSourceNodeRef.current = sourceNode;
        voiceWaveformDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
        voiceWaveformSnapshotRef.current = DEFAULT_WAVEFORM;

        voiceWaveformTimerRef.current = window.setInterval(() => {
          if (!voiceAnalyserRef.current || !voiceWaveformDataRef.current) {
            return;
          }
          voiceAnalyserRef.current.getByteTimeDomainData(voiceWaveformDataRef.current);
          const nextBars = buildWaveformBars(voiceWaveformDataRef.current);
          const nextWaveformPayload = buildVoiceWaveformPayload(voiceWaveformDataRef.current);
          voiceWaveformSnapshotRef.current = nextBars;
          voiceWaveformPayloadRef.current = nextWaveformPayload;
          setVoiceRecordingWaveform(nextBars);
        }, 120);
      }

      voiceMimeTypeRef.current = supportedMimeType || recorder.mimeType || 'audio/webm';
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopVoiceStream();
        voiceRecorderRef.current = null;
        clearVoiceTimer();
        finalizeVoiceRecording();
      };

      recorder.onerror = () => {
        stopVoiceStream();
        voiceRecorderRef.current = null;
        clearVoiceTimer();
        setVoiceRecordingState('idle');
        setVoiceRecordingSeconds(0);
        discardVoiceRecordingRef.current = true;
        voiceChunksRef.current = [];
        toast.error('Não foi possível continuar a gravação de áudio.');
      };

      recorder.start(250);
      setVoiceRecordingState('recording');
      voiceTimerRef.current = window.setInterval(() => {
        setVoiceRecordingSeconds((current) => {
          const next = current + 1;
          voiceRecordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (error) {
      stopVoiceStream();
      voiceRecorderRef.current = null;
      clearVoiceTimer();
      setVoiceRecordingState('idle');
      setVoiceRecordingSeconds(0);
      voiceRecordingSecondsRef.current = 0;
      setVoiceRecordingWaveform(DEFAULT_WAVEFORM);
      voiceWaveformPayloadRef.current = '';

      const message =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Permita o microfone no navegador para gravar nota de voz.'
          : 'Não foi possível iniciar a gravação de áudio.';
      toast.error(message);
    }
  }, [clearVoiceTimer, finalizeVoiceRecording, onAttachmentChange, sendDisabledReason, stopVoiceStream, voiceRecordingState]);

  const handleToggleVoicePreviewPlayback = useCallback(() => {
    const audio = voicePreviewAudioRef.current;
    if (!audio) {
      return;
    }
    if (voicePreviewPlaying) {
      audio.pause();
      setVoicePreviewPlaying(false);
      return;
    }
    void audio.play().then(() => {
      setVoicePreviewPlaying(true);
    }).catch(() => {
      toast.error('Não foi possível reproduzir a nota de voz agora.');
    });
  }, [voicePreviewPlaying]);

  const handleClearVoiceAttachment = useCallback(() => {
    voicePreviewAudioRef.current?.pause();
    if (voicePreviewAudioRef.current) {
      voicePreviewAudioRef.current.currentTime = 0;
    }
    setVoicePreviewPlaying(false);
    setVoicePreviewCurrentTime(0);
    setVoicePreviewDuration(null);
    onAttachmentChange((current) => current.filter((a) => a.kind !== 'voice'));
  }, [onAttachmentChange]);

  const cleanup = useCallback(() => {
    clearVoiceTimer();
    stopVoiceStream();
    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];
  }, [clearVoiceTimer, stopVoiceStream]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    voiceRecordingState,
    voiceRecordingSeconds,
    voiceRecordingWaveform,
    voicePreviewPlaying,
    voicePreviewDuration,
    voicePreviewCurrentTime,
    voicePreviewAudioRef,
    autoSendVoiceRef,
    handleStartVoiceRecording,
    handleStopVoiceRecording,
    handleCancelVoiceRecording,
    handleToggleVoicePreviewPlayback,
    handleClearVoiceAttachment,
    setVoicePreviewPlaying,
    setVoicePreviewCurrentTime,
    setVoicePreviewDuration,
  };
};
