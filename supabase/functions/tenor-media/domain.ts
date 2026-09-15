export type TenorMediaMode = 'gif' | 'sticker';

export type TenorMediaItem = {
  id: string;
  title: string;
  previewUrl: string;
  sendUrl: string;
  mimeType: string;
  sendKind: 'image' | 'video';
};

type TenorMediaFormat = { url?: unknown };
type TenorResult = Record<string, unknown> & {
  id?: unknown;
  h1_title?: unknown;
  content_description?: unknown;
  title?: unknown;
  media_formats?: Record<string, TenorMediaFormat>;
};

const readText = (value: unknown, fallback: string, maxLength: number): string =>
  typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;

export const isTrustedTenorMediaUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'tenor.com' || url.hostname.endsWith('.tenor.com'));
  } catch {
    return false;
  }
};

const readTrustedUrl = (...values: unknown[]): string | null => {
  for (const value of values) {
    const url = typeof value === 'string' ? value.trim() : '';
    if (isTrustedTenorMediaUrl(url)) return url;
  }
  return null;
};

export const mapTenorResult = (raw: TenorResult, mode: TenorMediaMode): TenorMediaItem | null => {
  const formats = raw.media_formats;
  if (!formats || typeof formats !== 'object') return null;

  if (mode === 'gif') {
    const previewUrl = readTrustedUrl(formats.tinygifpreview?.url, formats.gifpreview?.url);
    const sendUrl = readTrustedUrl(formats.mp4?.url, formats.loopedmp4?.url);
    if (!previewUrl || !sendUrl) return null;
    return {
      id: readText(raw.id, sendUrl, 200),
      title: readText(raw.h1_title ?? raw.content_description ?? raw.title, 'GIF', 180),
      previewUrl,
      sendUrl,
      mimeType: 'video/mp4',
      sendKind: 'video',
    };
  }

  const previewUrl = readTrustedUrl(
    formats.tinywebppreview_transparent?.url,
    formats.webppreview_transparent?.url,
    formats.tinygifpreview?.url,
    formats.gifpreview?.url,
  );
  const sendUrl = readTrustedUrl(
    formats.webp_transparent?.url,
    formats.webp?.url,
    formats.gif_transparent?.url,
    formats.gif?.url,
  );
  if (!previewUrl || !sendUrl) return null;

  return {
    id: readText(raw.id, sendUrl, 200),
    title: readText(raw.h1_title ?? raw.content_description ?? raw.title, 'Figurinha', 180),
    previewUrl,
    sendUrl,
    mimeType: sendUrl.toLowerCase().split(/[?#]/, 1)[0].endsWith('.webp') ? 'image/webp' : 'image/gif',
    sendKind: 'image',
  };
};

export const mapTenorResults = (value: unknown, mode: TenorMediaMode): TenorMediaItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is TenorResult => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((item) => mapTenorResult(item, mode))
    .filter((item): item is TenorMediaItem => item !== null)
    .slice(0, 24);
};
