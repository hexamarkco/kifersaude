import type { RefObject } from 'react';
import { Mic, Pause, Play, SendHorizontal, Trash2 } from 'lucide-react';

import type { InboxPendingAttachment } from '../domain/inboxPresentation';
import type { VoiceRecordingState } from '../hooks/useVoiceRecording';
import { formatDurationLabel } from '../domain/messageMediaPresentation';

function VoiceComposerTimeline({ progress = 0, recording = false }: { progress?: number; recording?: boolean }) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      className={`whatsapp-inbox-voice-timeline ${recording ? 'is-recording' : ''}`}
      role="progressbar"
      aria-label={recording ? 'Gravação em andamento' : 'Progresso da nota de voz'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={recording ? undefined : Math.round(normalizedProgress)}
    >
      <span
        className="whatsapp-inbox-voice-timeline-fill"
        style={recording ? undefined : { width: `${normalizedProgress}%` }}
      />
    </div>
  );
}
export function WhatsAppVoiceComposer({
  voiceAttachment,
  voiceRecordingState,
  voiceRecordingSeconds,
  voicePreviewPlaying,
  voicePreviewDuration,
  voicePreviewCurrentTime,
  voicePreviewAudioRef,
  sendDisabledReason,
  handleClearAttachment,
  handleToggleVoicePreviewPlayback,
  handleStartVoiceRecording,
  handleSendCurrentVoiceRecording,
  handleCancelVoiceRecording,
  handleStopVoiceRecording,
}: {
  voiceAttachment: InboxPendingAttachment | null;
  voiceRecordingState: VoiceRecordingState;
  voiceRecordingSeconds: number;
  voicePreviewPlaying: boolean;
  voicePreviewDuration: number | null;
  voicePreviewCurrentTime: number;
  voicePreviewAudioRef: RefObject<HTMLAudioElement>;
  sendDisabledReason: string | null;
  handleClearAttachment: (attachmentId?: string) => void;
  handleToggleVoicePreviewPlayback: () => void;
  handleStartVoiceRecording: () => void | Promise<void>;
  handleSendCurrentVoiceRecording: () => void;
  handleCancelVoiceRecording: () => void;
  handleStopVoiceRecording: () => void;
}) {
  return (
    <>
                  {voiceAttachment ? (
                    <>
                      <audio ref={voicePreviewAudioRef} src={voiceAttachment.previewUrl ?? undefined} preload="metadata" className="hidden" />
                      <div className="whatsapp-inbox-voice-composer flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => handleClearAttachment()}
                          className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                          aria-label="Descartar nota de voz"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>

                          <button
                            type="button"
                            onClick={handleToggleVoicePreviewPlayback}
                            className="whatsapp-inbox-voice-play inline-flex items-center justify-center rounded-full transition"
                            aria-label={voicePreviewPlaying ? 'Pausar nota de voz' : 'Ouvir nota de voz'}
                          >
                            {voicePreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                          </button>

                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <span className="whatsapp-inbox-voice-label">Nota de voz</span>
                            <span className="whatsapp-inbox-voice-time">
                              {formatDurationLabel(Math.max(0, Math.round(voicePreviewPlaying ? voicePreviewCurrentTime : 0)))} / {formatDurationLabel(Math.max(0, Math.round(voicePreviewDuration ?? voiceAttachment.durationSeconds ?? 0)))}
                            </span>
                          </div>
                          <VoiceComposerTimeline
                            progress={
                              (voicePreviewDuration ?? voiceAttachment.durationSeconds ?? 0) > 0
                                ? (voicePreviewCurrentTime / (voicePreviewDuration ?? voiceAttachment.durationSeconds ?? 1)) * 100
                                : 0
                            }
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleClearAttachment();
                            void handleStartVoiceRecording();
                          }}
                          className="whatsapp-inbox-voice-side-action is-accent inline-flex items-center justify-center rounded-full transition"
                          aria-label="Regravar nota de voz"
                        >
                          <Mic className="h-4 w-4" />
                        </button>

                          <button
                            type="button"
                            onClick={handleSendCurrentVoiceRecording}
                            disabled={Boolean(sendDisabledReason)}
                            className="whatsapp-inbox-voice-send inline-flex items-center justify-center rounded-full transition"
                            aria-label="Enviar nota de voz"
                          >
                            <SendHorizontal className="h-5 w-5" />
                          </button>
                      </div>
                    </>
                  ) : voiceRecordingState === 'recording' ? (
                    <div className="whatsapp-inbox-voice-composer is-recording flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={handleCancelVoiceRecording}
                        className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                        aria-label="Descartar gravação"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                          <span className="whatsapp-inbox-voice-label is-recording">
                            <span className="whatsapp-inbox-voice-recording-dot" />
                            Gravando
                          </span>
                          <span className="whatsapp-inbox-voice-time">{formatDurationLabel(voiceRecordingSeconds)}</span>
                        </div>
                        <VoiceComposerTimeline recording />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStopVoiceRecording()}
                        className="whatsapp-inbox-voice-side-action inline-flex items-center justify-center rounded-full transition"
                        aria-label="Parar gravação"
                      >
                        <Pause className="h-4 w-4 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={handleSendCurrentVoiceRecording}
                        disabled={Boolean(sendDisabledReason)}
                        className="whatsapp-inbox-voice-send inline-flex items-center justify-center rounded-full transition"
                        aria-label="Parar e enviar nota de voz"
                      >
                        <SendHorizontal className="h-5 w-5" />
                      </button>
                    </div>
                  ) : null}
    </>
  );
}
