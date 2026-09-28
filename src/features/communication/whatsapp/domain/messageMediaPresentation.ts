import type { CommWhatsAppMessage } from './types';

export const isPdfDocumentMessage = (message: CommWhatsAppMessage) => {
  const kind = message.message_type.trim().toLowerCase();
  if (kind !== 'document') return false;

  const mimeType = message.media_mime_type?.split(';', 1)[0]?.trim().toLowerCase();
  const fileName = message.media_file_name?.trim().toLowerCase() || '';
  return mimeType === 'application/pdf' || fileName.endsWith('.pdf');
};

export const getVisualMediaBubbleWidth = (message: CommWhatsAppMessage) => (
  isPdfDocumentMessage(message) ? 'w-[18rem]' : 'w-[13.75rem]'
);

export const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return '';

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
};

export const formatDurationLabel = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');

  return `${mins}:${secs}`;
};
