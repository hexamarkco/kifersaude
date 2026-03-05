const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
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

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL invalida. Use http ou https.');
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
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as LinkPreviewRequest;
    const normalizedUrl = normalizeUrl(payload.url || '');

    if (!normalizedUrl) {
      return new Response(JSON.stringify({ error: 'URL obrigatoria.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({ error: `Falha ao buscar URL (status ${response.status})` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const finalUrl = response.url || normalizedUrl;

    if (!contentType.includes('text/html')) {
      const host = new URL(finalUrl).hostname.replace(/^www\./i, '');
      return new Response(
        JSON.stringify({
          url: finalUrl,
          canonical: finalUrl,
          title: host,
          description: '',
          image: '',
          siteName: host,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const html = await response.text();
    const metadata = extractMetadata(html, finalUrl);

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[link-preview-metadata] unexpected error', error);
    return new Response(JSON.stringify({ error: 'Erro interno ao gerar preview do link.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
