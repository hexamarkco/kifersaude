import type { CommWhatsAppMediaSendKind } from '../data';

export type PendingAttachment = {
  id: string;
  file: File;
  kind: CommWhatsAppMediaSendKind;
  durationSeconds?: number;
  previewUrl?: string | null;
  waveform?: number[];
  waveformPayload?: string | null;
};

export type LocalOutgoingRetryPayload =
  | { kind: 'text'; text: string; clientRequestId?: string }
  | {
      kind: 'media';
      mediaKind: CommWhatsAppMediaSendKind;
      file: File;
      caption?: string;
      durationSeconds?: number;
      waveform?: string;
      fileName?: string;
      previewUrl?: string | null;
      clientRequestId?: string;
    }
  | {
      kind: 'remote_media';
      mediaKind: 'image' | 'video' | 'document';
      remoteUrl: string;
      mimeType?: string;
      fileName?: string;
      caption?: string;
      previewUrl?: string | null;
      clientRequestId?: string;
    };
