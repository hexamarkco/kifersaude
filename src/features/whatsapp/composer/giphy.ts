import { supabase } from '../../../lib/supabase';
import type { GiphyGifItem } from './types';

type GiphySearchResponse = {
  items?: unknown;
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeGifItem = (value: unknown): GiphyGifItem | null => {
  if (!value || typeof value !== 'object') return null;

  const item = value as Record<string, unknown>;
  const id = normalizeText(item.id);
  const gifUrl = normalizeText(item.gifUrl);
  const previewUrl = normalizeText(item.previewUrl);
  const stillUrl = normalizeText(item.stillUrl);
  const mp4Url = normalizeText(item.mp4Url);

  if (!id || (!gifUrl && !mp4Url && !previewUrl && !stillUrl)) {
    return null;
  }

  return {
    id,
    title: normalizeText(item.title) || 'GIF do Giphy',
    pageUrl: normalizeText(item.pageUrl),
    gifUrl,
    previewUrl,
    stillUrl,
    mp4Url,
  };
};

export async function searchGiphyLibrary(query: string, limit: number = 24): Promise<GiphyGifItem[]> {
  const { data, error } = await supabase.functions.invoke('giphy-search', {
    body: {
      query,
      limit,
    },
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel carregar GIFs do Giphy.');
  }

  const payload = (data || {}) as GiphySearchResponse;
  if (!Array.isArray(payload.items)) {
    return [];
  }

  return payload.items
    .map(normalizeGifItem)
    .filter((item): item is GiphyGifItem => Boolean(item));
}
