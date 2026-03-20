import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const MAX_URL_LENGTH = 2048;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

type LinkPreviewRequest = {
  url?: string;
};

type LinkPreviewResponse = {
  url: string;
  canonical: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
};

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized === '0.0.0.0' || normalized === '::1') return true;
  if (normalized.endsWith('.local')) return true;
  if (/^127\./.test(normalized)) return true;
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;

  const match172 = normalized.match(/^172\.(\d{1,3})\./);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  return false;
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error('URL excede o limite permitido.');
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL invalida. Use http ou https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URL com credenciais nao e permitida.');
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new Error('URL nao permitida para preview.');
  }
  return parsed.toString();
}

function absoluteUrl(value: string | null, baseUrl: string): string {
  if (!value) return '';
  const cleaned = value.trim();
  if (!cleaned) return '';
  try {
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return '';
  }
}

function pickMeta(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    const value = element?.getAttribute('content')?.trim() || element?.textContent?.trim() || '';
    if (value) return value;
  }
  return '';
}

function extractMetadata(html: string, finalUrl: string): LinkPreviewResponse {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const fallbackHost = (() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./i, '');
    } catch {
      return finalUrl;
    }
  })();

  if (!doc) {
    return {
      url: finalUrl,
      canonical: finalUrl,
      title: fallbackHost,
      description: '',
      image: '',
      siteName: '',
    };
  }

  const canonical =
    absoluteUrl(pickMeta(doc, ['link[rel="canonical"]']), finalUrl) ||
    absoluteUrl(pickMeta(doc, ['meta[property="og:url"]', 'meta[name="twitter:url"]']), finalUrl) ||
    finalUrl;

  const title =
    pickMeta(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    doc.querySelector('title')?.textContent?.trim() ||
    fallbackHost;

  const description =
    pickMeta(doc, ['meta[property="og:description"]', 'meta[name="twitter:description"]', 'meta[name="description"]']) ||
    '';

  const image =
    absoluteUrl(pickMeta(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']), canonical) ||
    '';

  const siteName = pickMeta(doc, ['meta[property="og:site_name"]', 'meta[name="application-name"]']) || fallbackHost;

  return {
    url: finalUrl,
    canonical,
    title,
    description,
    image,
    siteName,
  };
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

    const payload = (await req.json().catch(() => null)) as LinkPreviewRequest | null;
    const normalizedUrl = normalizeUrl(payload?.url || '');

    if (!normalizedUrl) {
      return jsonResponse({ error: 'URL obrigatoria.' }, 400);
    }

    const response = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return jsonResponse({ error: `Falha ao buscar URL (status ${response.status})` }, 502);
    }

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url || normalizedUrl;

    if (!contentType.includes('text/html')) {
      const host = new URL(finalUrl).hostname.replace(/^www\./i, '');
      return jsonResponse({
          url: finalUrl,
          canonical: finalUrl,
          title: host,
          description: '',
          image: '',
          siteName: host,
        }, 200);
    }

    const html = await response.text();
    const metadata = extractMetadata(html, finalUrl);

    return jsonResponse(metadata, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao gerar preview do link.';
    const status = message.startsWith('URL ') ? 400 : 500;
    if (status === 500) {
      console.error('[link-preview-metadata] unexpected error', error);
    }
    return jsonResponse({ error: message }, status);
  }
});
