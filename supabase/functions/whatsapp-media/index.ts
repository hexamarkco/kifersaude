import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

type MediaRequest = {
  mediaId?: string;
};

type CachedMediaPayload = {
  mimeType: string;
  fileName: string | null;
  data: string;
};

const MEDIA_CACHE_TTL_MS = 5 * 60 * 1000;
const mediaResponseCache = new Map<string, { expiresAt: number; payload: CachedMediaPayload }>();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const encodeBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const getCachedMediaPayload = (mediaId: string): CachedMediaPayload | null => {
  const cached = mediaResponseCache.get(mediaId);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    mediaResponseCache.delete(mediaId);
    return null;
  }

  return cached.payload;
};

const setCachedMediaPayload = (mediaId: string, payload: CachedMediaPayload) => {
  mediaResponseCache.set(mediaId, {
    expiresAt: Date.now() + MEDIA_CACHE_TTL_MS,
    payload,
  });
};

const loadWhapiToken = async (supabaseAdmin: ReturnType<typeof createClient>) => {
  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar integracao do WhatsApp: ${error.message}`);
  }

  const settings = asRecord(data?.settings) ?? {};
  const token =
    readTrimmedString(settings.apiKey).replace(/^Bearer\s+/i, '') ||
    readTrimmedString(settings.token).replace(/^Bearer\s+/i, '');

  if (!token) {
    throw new Error('Token da Whapi Cloud nao configurado.');
  }

  return token;
};

const fetchBinaryMedia = async (resourceUrl: string, token: string): Promise<Response> => {
  const attempts: Array<HeadersInit> = [
    { Accept: '*/*' },
    {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  ];

  let lastErrorResponse: Response | null = null;

  for (const headers of attempts) {
    const response = await fetch(resourceUrl, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      return response;
    }

    lastErrorResponse = response;
  }

  if (lastErrorResponse) {
    return lastErrorResponse;
  }

  throw new Error('Falha ao baixar midia.');
};

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
    const payload = (await req.json()) as MediaRequest;
    const mediaId = readTrimmedString(payload.mediaId);

    if (!mediaId) {
      return new Response(JSON.stringify({ error: 'mediaId obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cachedPayload = getCachedMediaPayload(mediaId);
    if (cachedPayload) {
      return new Response(JSON.stringify(cachedPayload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Configuracao do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const whapiToken = await loadWhapiToken(supabaseAdmin);

    const mediaResponse = await fetch(`${WHAPI_BASE_URL}/media/${encodeURIComponent(mediaId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${whapiToken}`,
        Accept: 'application/json, */*',
      },
    });

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      return new Response(JSON.stringify({ error: `Falha ao buscar midia na Whapi: ${mediaResponse.status} ${errorText}` }), {
        status: mediaResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = mediaResponse.headers.get('content-type') || '';

    let binaryResponse = mediaResponse;
    if (contentType.includes('application/json')) {
      const descriptor = asRecord(await mediaResponse.json()) ?? {};
      const resourceUrl =
        readTrimmedString(descriptor.url) ||
        readTrimmedString(descriptor.link) ||
        readTrimmedString(descriptor.media);

      if (!resourceUrl) {
        return new Response(JSON.stringify({ error: 'Whapi nao retornou uma URL de midia valida.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      binaryResponse = await fetchBinaryMedia(resourceUrl, whapiToken);

      if (!binaryResponse.ok) {
        const errorText = await binaryResponse.text();
        return new Response(JSON.stringify({ error: `Falha ao baixar binario da midia: ${binaryResponse.status} ${errorText}` }), {
          status: binaryResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const mediaBuffer = await binaryResponse.arrayBuffer();
    const binaryContentType = binaryResponse.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = binaryResponse.headers.get('content-disposition') || '';
    const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
    const fileName = fileNameMatch ? decodeURIComponent(fileNameMatch[1].replace(/"/g, '')) : null;

    const responsePayload = {
      mimeType: binaryContentType,
      fileName,
      data: encodeBase64(mediaBuffer),
    };

    setCachedMediaPayload(mediaId, responsePayload);

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[whatsapp-media] Erro inesperado:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao carregar midia.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
