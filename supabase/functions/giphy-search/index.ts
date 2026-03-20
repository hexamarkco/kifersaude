export {};

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
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
const MAX_QUERY_LENGTH = 120;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

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
    return jsonResponse({ error: 'Metodo nao permitido' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: 'Configuracao do servidor incompleta.' }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const serviceRoleCall = isServiceRoleRequest(req, supabaseServiceRoleKey);

    if (!serviceRoleCall) {
      const authResult = await authorizeDashboardUser({
        req,
        supabaseUrl,
        supabaseAnonKey,
        supabaseAdmin,
        module: 'whatsapp',
        requiredPermission: 'view',
      });

      if (!authResult.authorized) {
        return jsonResponse(authResult.body, authResult.status);
      }
    }

    const payload = (await req.json().catch(() => null)) as GiphySearchRequest | null;
    const query = normalizeText(payload?.query);
    const limit = normalizeLimit(payload?.limit);

    if (query.length > MAX_QUERY_LENGTH) {
      return jsonResponse({ error: 'Busca excede o limite permitido.' }, 400);
    }

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
      return jsonResponse({ error: `Falha ao consultar o Giphy (status ${response.status})` }, 502);
    }

    const html = await response.text();
    const items = parseGiphyHtml(html, limit, response.url || searchUrl);

    return jsonResponse({
        query,
        items,
      }, 200);
  } catch (error) {
    console.error('[giphy-search] unexpected error', error);
    return jsonResponse({ error: 'Erro interno ao carregar GIFs do Giphy.' }, 500);
  }
});
