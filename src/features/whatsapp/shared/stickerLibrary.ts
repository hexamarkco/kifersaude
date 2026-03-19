import type { StickerLibraryItem } from '../composer/types';

export const STICKER_RECENTS_STORAGE_KEY = 'whatsapp.composer.recent-stickers';
export const STICKER_LIBRARY_STORAGE_KEY = 'whatsapp.composer.saved-stickers';
export const STICKER_LIBRARY_SYNC_EVENT = 'whatsapp-sticker-library-updated';
export const MAX_RECENT_STICKERS = 24;
export const MAX_SAVED_STICKERS = 120;

const isBrowser = () => typeof window !== 'undefined';

const dispatchStickerLibraryUpdate = (scope: 'recent' | 'saved') => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(STICKER_LIBRARY_SYNC_EVENT, { detail: { scope } }));
};

const normalizeStickerItem = (value: unknown): StickerLibraryItem | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const mimeType = typeof candidate.mimeType === 'string' ? candidate.mimeType.trim() : '';
  const previewUrl = typeof candidate.previewUrl === 'string' ? candidate.previewUrl.trim() : '';
  const dataUrl = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : '';
  const lastUsedAt = typeof candidate.lastUsedAt === 'number' && Number.isFinite(candidate.lastUsedAt)
    ? candidate.lastUsedAt
    : Date.now();

  if (!id || !name || !mimeType || !previewUrl || !dataUrl) {
    return null;
  }

  return {
    id,
    name,
    mimeType,
    previewUrl,
    dataUrl,
    lastUsedAt,
  };
};

const readStickerCollection = (key: string, limit: number): StickerLibraryItem[] => {
  if (!isBrowser()) return [];

  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeStickerItem)
      .filter((item): item is StickerLibraryItem => Boolean(item))
      .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
      .slice(0, limit);
  } catch (error) {
    console.warn('Erro ao carregar colecao de figurinhas:', error);
    return [];
  }
};

const writeStickerCollection = (key: string, items: StickerLibraryItem[], scope: 'recent' | 'saved') => {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(items));
  dispatchStickerLibraryUpdate(scope);
};

export const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Nao foi possivel ler a figurinha selecionada.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao carregar figurinha.'));
    reader.readAsDataURL(file);
  });

export const dataUrlToFile = async (dataUrl: string, fileName: string, mimeType: string) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: mimeType || blob.type || 'image/webp',
    lastModified: Date.now(),
  });
};

const buildStickerItemFromFile = async (file: File, nameOverride?: string): Promise<StickerLibraryItem> => {
  const dataUrl = await fileToDataUrl(file);
  const mimeType = file.type || 'image/webp';
  const name = (nameOverride || file.name || 'Figurinha').trim() || 'Figurinha';
  const signature = `${mimeType}-${dataUrl.length}-${dataUrl.slice(0, 48)}`;

  return {
    id: signature,
    name,
    mimeType,
    previewUrl: dataUrl,
    dataUrl,
    lastUsedAt: Date.now(),
  };
};

const upsertStickerItem = (current: StickerLibraryItem[], nextItem: StickerLibraryItem, limit: number) => {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id && item.dataUrl !== nextItem.dataUrl)]
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, limit);
};

export const loadRecentStickerItems = () => readStickerCollection(STICKER_RECENTS_STORAGE_KEY, MAX_RECENT_STICKERS);

export const loadSavedStickerItems = () => readStickerCollection(STICKER_LIBRARY_STORAGE_KEY, MAX_SAVED_STICKERS);

export async function rememberRecentSticker(file: File, nameOverride?: string) {
  const nextItem = await buildStickerItemFromFile(file, nameOverride);
  const nextItems = upsertStickerItem(loadRecentStickerItems(), nextItem, MAX_RECENT_STICKERS);
  writeStickerCollection(STICKER_RECENTS_STORAGE_KEY, nextItems, 'recent');
  return nextItems;
}

export async function saveStickerToLibrary(file: File, nameOverride?: string) {
  const nextItem = await buildStickerItemFromFile(file, nameOverride);
  const current = loadSavedStickerItems();
  const alreadySaved = current.some((item) => item.id === nextItem.id || item.dataUrl === nextItem.dataUrl);
  const nextItems = upsertStickerItem(current, nextItem, MAX_SAVED_STICKERS);
  writeStickerCollection(STICKER_LIBRARY_STORAGE_KEY, nextItems, 'saved');
  return { item: nextItem, items: nextItems, alreadySaved };
}
