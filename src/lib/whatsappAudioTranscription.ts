type UnknownRecord = Record<string, unknown>;

export type WhatsAppAudioTranscription = {
  text: string;
  provider?: string;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
};

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const extractTranscriptionRecord = (payload: unknown): UnknownRecord | null => {
  const payloadRecord = asRecord(payload);
  if (!payloadRecord) return null;

  const candidates = [
    payloadRecord.transcription,
    payloadRecord.audioTranscription,
    payloadRecord.audio_transcription,
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return record;
    }
  }

  return null;
};

export const getWhatsAppAudioTranscription = (payload: unknown): WhatsAppAudioTranscription | null => {
  const transcriptionRecord = extractTranscriptionRecord(payload);
  if (!transcriptionRecord) return null;

  const text =
    readTrimmedString(transcriptionRecord.text) ||
    readTrimmedString(transcriptionRecord.transcript) ||
    readTrimmedString(transcriptionRecord.body);

  if (!text) return null;

  return {
    text,
    provider: readTrimmedString(transcriptionRecord.provider) || undefined,
    model: readTrimmedString(transcriptionRecord.model) || undefined,
    createdAt:
      readTrimmedString(transcriptionRecord.createdAt) ||
      readTrimmedString(transcriptionRecord.created_at) ||
      undefined,
    updatedAt:
      readTrimmedString(transcriptionRecord.updatedAt) ||
      readTrimmedString(transcriptionRecord.updated_at) ||
      undefined,
  };
};

export const formatWhatsAppAudioTranscriptionLabel = (payload: unknown): string | null => {
  const transcription = getWhatsAppAudioTranscription(payload);
  if (!transcription) return null;

  return `[Audio transcrito] ${transcription.text}`;
};
