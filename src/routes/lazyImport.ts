import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_RELOAD_STATE_KEY = 'kifer:chunk-reload-state';
const CHUNK_RELOAD_WINDOW_MS = 30_000;
const MAX_CHUNK_RELOADS = 2;

type LazyModule<Props> = {
  default: ComponentType<Props>;
};

export function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : String(error ?? '');

  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed/i.test(message);
}

function readReloadState(): { count: number; startedAt: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawState = window.sessionStorage.getItem(CHUNK_RELOAD_STATE_KEY);
    if (!rawState) return null;

    const parsed = JSON.parse(rawState) as { count?: unknown; startedAt?: unknown };
    if (typeof parsed.count !== 'number' || typeof parsed.startedAt !== 'number') {
      return null;
    }

    return { count: parsed.count, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

function shouldReloadForChunkError(): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  const previous = readReloadState();
  const state = previous && now - previous.startedAt < CHUNK_RELOAD_WINDOW_MS
    ? previous
    : { count: 0, startedAt: now };

  if (state.count >= MAX_CHUNK_RELOADS) return false;

  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_STATE_KEY, JSON.stringify({
      count: state.count + 1,
      startedAt: state.startedAt,
    }));
    const url = new URL(window.location.href);
    url.searchParams.set('kifer_chunk_reload', String(now));
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

function clearReloadQuery(): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('kifer_chunk_reload')) return;

    url.searchParams.delete('kifer_chunk_reload');
    window.history.replaceState(window.history.state, document.title, url.toString());
  } catch {
    // The reload marker is cosmetic; a browser may restrict history updates.
  }
}

export function lazyWithChunkRecovery<Props>(
  loader: () => Promise<LazyModule<Props>>,
): LazyExoticComponent<ComponentType<Props>> {
  return lazy(async () => {
    try {
      const module = await loader();
      clearReloadQuery();
      return module;
    } catch (error) {
      if (isDynamicImportError(error) && shouldReloadForChunkError()) {
        await new Promise<never>(() => undefined);
      }

      throw error;
    }
  });
}
