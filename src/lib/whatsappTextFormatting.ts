export type WhatsAppInlineTokenType = 'text' | 'bold' | 'italic' | 'strike' | 'code';

export type WhatsAppInlineToken = {
  type: WhatsAppInlineTokenType;
  value: string;
};

export type WhatsAppBlock =
  | {
      type: 'paragraph' | 'quote';
      lines: WhatsAppInlineToken[][];
    }
  | {
      type: 'list';
      items: WhatsAppInlineToken[][];
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
  parseWhatsAppBlocks(source).some((block) => {
    if (block.type === 'list' || block.type === 'quote') {
      return true;
    }

    return block.lines.some((line) => line.some((token) => token.type !== 'text'));
  });

const normalizeQuoteLine = (line: string): string | null => {
  const trimmedStart = line.trimStart();
  if (!trimmedStart.startsWith('>')) return null;

  const content = trimmedStart.slice(1).replace(/^ /, '');
  if (!content.trim()) return null;
  return content;
};

const normalizeListLine = (line: string): string | null => {
  const trimmedStart = line.trimStart();
  if (!trimmedStart.startsWith('- ')) return null;

  const content = trimmedStart.slice(2);
  if (!content.trim()) return null;
  return content;
};

export const parseWhatsAppBlocks = (source: string): WhatsAppBlock[] => {
  if (!source) {
    return [
      {
        type: 'paragraph',
        lines: [[{ type: 'text', value: '' }]],
      },
    ];
  }

  const lines = source.split('\n');
  const blocks: WhatsAppBlock[] = [];

  const pushParagraph = (line: string) => {
    blocks.push({
      type: 'paragraph',
      lines: [parseWhatsAppInlineTokens(line)],
    });
  };

  let index = 0;
  while (index < lines.length) {
    const currentLine = lines[index];
    const quoteContent = normalizeQuoteLine(currentLine);
    if (quoteContent !== null) {
      const quoteLines: WhatsAppInlineToken[][] = [];
      while (index < lines.length) {
        const nextQuote = normalizeQuoteLine(lines[index]);
        if (nextQuote === null) break;
        quoteLines.push(parseWhatsAppInlineTokens(nextQuote));
        index += 1;
      }
      blocks.push({ type: 'quote', lines: quoteLines });
      continue;
    }

    const listContent = normalizeListLine(currentLine);
    if (listContent !== null) {
      const items: WhatsAppInlineToken[][] = [];
      while (index < lines.length) {
        const nextItem = normalizeListLine(lines[index]);
        if (nextItem === null) break;
        items.push(parseWhatsAppInlineTokens(nextItem));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    pushParagraph(currentLine);
    index += 1;
  }

  return blocks;
};
