import type { ReactNode } from 'react';

import { cx } from '../../../../lib/cx';

export type WhatsAppTextFormat = 'bold' | 'italic' | 'strike';

type WhatsAppFormatMatch = {
  start: number;
  end: number;
  marker: string;
  format: WhatsAppTextFormat;
};

type WhatsAppFormattedTextProps = {
  text: string;
  className?: string;
  linkClassName?: string;
};

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const WHATSAPP_TEXT_FORMAT_MARKERS: Array<{ marker: string; format: WhatsAppTextFormat }> = [
  { marker: '**', format: 'bold' },
  { marker: '__', format: 'italic' },
  { marker: '*', format: 'bold' },
  { marker: '_', format: 'italic' },
  { marker: '~', format: 'strike' },
];

const normalizeRenderableUrl = (value: string) => value.replace(/[),.;!?]+$/g, '');
const extractRenderableUrls = (value: string) => Array.from(value.matchAll(URL_PATTERN))
  .map((match) => {
    const raw = match[0] ?? '';
    const url = normalizeRenderableUrl(raw);
    const index = match.index ?? 0;
    return url ? { index, raw, url } : null;
  })
  .filter((item): item is { index: number; raw: string; url: string } => Boolean(item));

const isWhitespace = (value: string | undefined) => !value || /\s/.test(value);

const findWhatsAppFormatMatch = (text: string, startIndex: number = 0): WhatsAppFormatMatch | null => {
  let bestMatch: WhatsAppFormatMatch | null = null;

  for (let index = startIndex; index < text.length; index += 1) {
    for (const candidate of WHATSAPP_TEXT_FORMAT_MARKERS) {
      const { marker, format } = candidate;
      if (!text.startsWith(marker, index) || isWhitespace(text[index + marker.length])) continue;

      let closingIndex = text.indexOf(marker, index + marker.length);
      while (closingIndex !== -1) {
        const content = text.slice(index + marker.length, closingIndex);
        if (content.trim() && !isWhitespace(text[closingIndex - 1])) {
          const match = { start: index, end: closingIndex, marker, format };
          if (
            !bestMatch
            || match.start < bestMatch.start
            || (match.start === bestMatch.start && marker.length > bestMatch.marker.length)
          ) {
            bestMatch = match;
          }
          break;
        }

        closingIndex = text.indexOf(marker, closingIndex + marker.length);
      }
    }

    if (bestMatch?.start === index) return bestMatch;
  }

  return bestMatch;
};

const renderWhatsAppFormattedText = (text: string, keyPrefix: string, depth: number = 0): ReactNode[] => {
  if (!text || depth > 8) return text ? [text] : [];

  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = 0;

  while (cursor < text.length) {
    const match = findWhatsAppFormatMatch(text, cursor);
    if (!match) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (match.start > cursor) nodes.push(text.slice(cursor, match.start));

    const contentStart = match.start + match.marker.length;
    const content = text.slice(contentStart, match.end);
    const children = renderWhatsAppFormattedText(content, `${keyPrefix}-${matchIndex}`, depth + 1);
    const key = `${keyPrefix}-${match.format}-${match.start}-${matchIndex}`;

    if (match.format === 'bold') nodes.push(<strong key={key}>{children}</strong>);
    else if (match.format === 'italic') nodes.push(<em key={key}>{children}</em>);
    else nodes.push(<s key={key}>{children}</s>);

    cursor = match.end + match.marker.length;
    matchIndex += 1;
  }

  return nodes;
};

export default function WhatsAppFormattedText({
  text,
  className,
  linkClassName,
}: WhatsAppFormattedTextProps) {
  const matches = extractRenderableUrls(text);

  if (matches.length === 0) {
    return <p className={className}>{renderWhatsAppFormattedText(text, 'text')}</p>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.index > cursor) {
      parts.push(...renderWhatsAppFormattedText(text.slice(cursor, match.index), `text-${index}`));
    }

    parts.push(
      <a
        key={`${match.url}-${index}`}
        href={match.url}
        target="_blank"
        rel="noreferrer"
        className={cx('underline underline-offset-2 decoration-current/40 hover:decoration-current break-all', linkClassName)}
      >
        {match.url}
      </a>,
    );
    cursor = match.index + match.raw.length;
  });

  if (cursor < text.length) {
    parts.push(...renderWhatsAppFormattedText(text.slice(cursor), 'text-tail'));
  }

  return <p className={className}>{parts}</p>;
}
