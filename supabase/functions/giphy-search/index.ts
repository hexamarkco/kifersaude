export {};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type GiphySearchRequest = {
  query?: string;
  limit?: number;
};

type ParsedGifItem = {
  id: string;
  title: string;
  pageUrl: string;
  gifUrl: string;
  previewUrl: string;
  stillUrl: string;
  mp4Url: string;
};

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 40;

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function normalizeLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function buildGiphyPageUrl(query: string): string {
  const normalizedQuery = normalizeText(query).replace(/\s+/g, '-');
  return normalizedQuery ? `https://giphy.com/search/${encodeURIComponent(normalizedQuery)}` : 'https://giphy.com/explore/trending-gifs';
}

function sanitizeAssetUrl(value: string): string {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/[\\]+$/g, '')
    .trim();
}

function humanizeSlug(slug: string): string {
  const normalized = slug.replace(/[-_]+/g, ' ').trim();
  if (!normalized) return 'GIF do Giphy';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function extractSlugById(html: string): Map<string, string> {
  const slugById = new Map<string, string>();
  const slugPattern = /\/gifs\/([a-z0-9-]+)-([A-Za-z0-9]+)(?=[/?"'])/gi;

  let match: RegExpExecArray | null = null;
  while ((match = slugPattern.exec(html)) !== null) {
    const slug = normalizeText(match[1]);
    const id = normalizeText(match[2]);
    if (!slug || !id || slugById.has(id)) continue;
    slugById.set(id, slug);
  }

  return slugById;
}

function parseGiphyHtml(html: string, limit: number, searchUrl: string): ParsedGifItem[] {
  const slugById = extractSlugById(html);
  const itemsById = new Map<string, ParsedGifItem>();
  const orderedIds: string[] = [];
  const assetPattern = /(https:\/\/media\d+\.giphy\.com\/media\/(?:[^/]+\/)?([A-Za-z0-9]+)\/([^"'\s<]+))/g;

  let match: RegExpExecArray | null = null;
  while ((match = assetPattern.exec(html)) !== null) {
    const rawUrl = normalizeText(match[1]);
    const id = normalizeText(match[2]);
    const assetName = normalizeText(match[3]).toLowerCase();
    if (!rawUrl || !id || !assetName) continue;

    const url = sanitizeAssetUrl(rawUrl);
    if (!url) continue;

    const slug = slugById.get(id) || '';
    const current =
      itemsById.get(id) || {
        id,
        title: slug ? humanizeSlug(slug) : 'GIF do Giphy',
        pageUrl: slug ? `https://giphy.com/gifs/${slug}-${id}` : searchUrl,
        gifUrl: '',
        previewUrl: '',
        stillUrl: '',
        mp4Url: '',
      };

    if (!itemsById.has(id)) {
      itemsById.set(id, current);
      orderedIds.push(id);
    }

    if (assetName.endsWith('.mp4') && !current.mp4Url) {
      current.mp4Url = url;
      continue;
    }

    if ((assetName.includes('_s.gif') || assetName.includes('downsized_s.gif')) && !current.stillUrl) {
      current.stillUrl = url;
      continue;
    }

    if ((assetName.endsWith('.webp') || assetName.startsWith('200.')) && !current.previewUrl) {
      current.previewUrl = url;
    }

    if (
      assetName.endsWith('.gif') &&
      !assetName.includes('_s.gif') &&
      !assetName.includes('downsized_s.gif') &&
      !current.gifUrl
    ) {
      current.gifUrl = url;
    }
  }

  return orderedIds
    .map((id) => itemsById.get(id))
    .filter((item): item is ParsedGifItem => Boolean(item))
    .map((item) => ({
      ...item,
      gifUrl: item.gifUrl || item.previewUrl || item.stillUrl || item.mp4Url,
      previewUrl: item.previewUrl || item.stillUrl || item.gifUrl || item.mp4Url,
      stillUrl: item.stillUrl || item.previewUrl || item.gifUrl || item.mp4Url,
    }))
    .filter((item) => Boolean(item.mp4Url && (item.gifUrl || item.previewUrl || item.stillUrl)))
    .slice(0, limit);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as GiphySearchRequest;
    const query = normalizeText(payload.query);
    const limit = normalizeLimit(payload.limit);
    const searchUrl = buildGiphyPageUrl(query);

    const response = await fetch(searchUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Falha ao consultar o Giphy (status ${response.status})` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();
    const items = parseGiphyHtml(html, limit, response.url || searchUrl);

    return new Response(
      JSON.stringify({
        query,
        items,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[giphy-search] unexpected error', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao carregar GIFs do Giphy.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
