import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser, isServiceRoleRequest } from '../_shared/dashboard-auth.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type MediaRequest = {
  mediaId?: string;
};

type CachedMediaPayload = {
  mimeType: string;
  fileName: string | null;
  data?: string;
  url?: string;
};

const MEDIA_CACHE_TTL_MS = 5 * 60 * 1000;
const mediaResponseCache = new Map<string, { expiresAt: number; payload: CachedMediaPayload }>();

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const extractFileNameFromDisposition = (contentDisposition: string) => {
  const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return fileNameMatch ? decodeURIComponent(fileNameMatch[1].replace(/"/g, '')) : null;
};

const extractFileNameFromUrl = (resourceUrl: string) => {
  try {
    const url = new URL(resourceUrl);
    const candidate = url.pathname.split('/').pop() || '';
    return candidate ? decodeURIComponent(candidate) : null;
  } catch {
    return null;
  }
};

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

const probePublicMediaUrl = async (resourceUrl: string): Promise<CachedMediaPayload | null> => {
  try {
    const response = await fetch(resourceUrl, {
      method: 'HEAD',
      headers: {
        Accept: '*/*',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (contentType.includes('application/json')) {
      return null;
    }

    return {
      url: resourceUrl,
      mimeType: contentType,
      fileName: extractFileNameFromDisposition(response.headers.get('content-disposition') || '') || extractFileNameFromUrl(resourceUrl),
    };
  } catch {
    return null;
  }
};

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

    const payload = (await req.json().catch(() => null)) as MediaRequest | null;
    const mediaId = readTrimmedString(payload?.mediaId);

    if (!mediaId) {
      return jsonResponse({ error: 'mediaId obrigatorio.' }, 400);
    }

    const cachedPayload = getCachedMediaPayload(mediaId);
    if (cachedPayload) {
      return jsonResponse(cachedPayload, 200);
    }

    const whapiToken = await loadWhapiToken(supabaseAdmin);

    const mediaResponse = await fetch(`${WHAPI_BASE_URL}/media/${encodeURIComponent(mediaId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${whapiToken}`,
        Accept: 'application/json, */*',
      },
    });

    if (!mediaResponse.ok) {
      return jsonResponse({ error: 'Falha ao buscar midia na Whapi.', provider_status: mediaResponse.status }, mediaResponse.status);
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
        return jsonResponse({ error: 'Whapi nao retornou uma URL de midia valida.' }, 502);
      }

      const publicPayload = await probePublicMediaUrl(resourceUrl);
      if (publicPayload?.url) {
        setCachedMediaPayload(mediaId, publicPayload);
        return jsonResponse(publicPayload, 200);
      }

      binaryResponse = await fetchBinaryMedia(resourceUrl, whapiToken);

      if (!binaryResponse.ok) {
        return jsonResponse({ error: 'Falha ao baixar binario da midia.', provider_status: binaryResponse.status }, binaryResponse.status);
      }
    }

    const mediaBuffer = await binaryResponse.arrayBuffer();
    const binaryContentType = binaryResponse.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = binaryResponse.headers.get('content-disposition') || '';
    const fileName = extractFileNameFromDisposition(contentDisposition);

    const responsePayload = {
      mimeType: binaryContentType,
      fileName,
      data: encodeBase64(mediaBuffer),
    };

    setCachedMediaPayload(mediaId, responsePayload);

    return jsonResponse(responsePayload, 200);
  } catch (error) {
    console.error('[whatsapp-media] Erro inesperado:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erro interno ao carregar midia.' }, 500);
  }
});
