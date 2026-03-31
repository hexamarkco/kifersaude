export const WHATSAPP_MESSAGE_BREAK_DELIMITER = '---';

export const splitWhatsAppMessageSegments = (value: string): string[] => {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n\s*---\s*\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
};
