export type WhatsAppInlineTokenType = 'text' | 'bold' | 'italic' | 'strike' | 'code';

export type WhatsAppInlineToken = {
  type: WhatsAppInlineTokenType;
  value: string;
};

const INLINE_PATTERN = /(`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

const DELIMITER_TYPES: Record<string, Exclude<WhatsAppInlineTokenType, 'text'>> = {
  '*': 'bold',
  _: 'italic',
  '~': 'strike',
  '`': 'code',
};

const isBoundaryChar = (char: string | undefined): boolean => {
  if (!char) return true;
  return /[\s.,!?;:()[\]{}"'\-/\\]/.test(char);
};

const canApplyDelimiter = (source: string, match: string, index: number): boolean => {
  const innerText = match.slice(1, -1);
  if (!innerText.trim()) return false;
  if (/^\s|\s$/.test(innerText)) return false;

  const beforeChar = index > 0 ? source[index - 1] : undefined;
  const afterIndex = index + match.length;
  const afterChar = afterIndex < source.length ? source[afterIndex] : undefined;
  return isBoundaryChar(beforeChar) && isBoundaryChar(afterChar);
};

export const parseWhatsAppInlineTokens = (source: string): WhatsAppInlineToken[] => {
  if (!source) return [{ type: 'text', value: '' }];

  const tokens: WhatsAppInlineToken[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;

  while ((match = INLINE_PATTERN.exec(source)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (!canApplyDelimiter(source, raw, start)) {
      continue;
    }

    if (start > cursor) {
      tokens.push({ type: 'text', value: source.slice(cursor, start) });
    }

    const delimiter = raw[0];
    const tokenType = DELIMITER_TYPES[delimiter] ?? 'text';
    tokens.push({ type: tokenType, value: raw.slice(1, -1) });

    cursor = end;
  }

  if (cursor < source.length) {
    tokens.push({ type: 'text', value: source.slice(cursor) });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', value: source }];
};

export const hasWhatsAppFormatting = (source: string): boolean =>
  parseWhatsAppInlineTokens(source).some((token) => token.type !== 'text');
