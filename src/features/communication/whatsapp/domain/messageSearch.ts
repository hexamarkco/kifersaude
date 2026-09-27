export const MIN_MESSAGE_SEARCH_LENGTH = 2;

export const canSearchWhatsAppMessages = (value: string | null | undefined) => (
  String(value ?? '').trim().length >= MIN_MESSAGE_SEARCH_LENGTH
);
