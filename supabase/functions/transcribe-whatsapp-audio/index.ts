import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { transcribeAudioWithRouting } from '../_shared/ai-router.ts';
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

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type TranscribeRequest = {
  messageId?: string;
  mediaId?: string;
  audioDataUrl?: string;
  mimeType?: string;
  fileName?: string;
  prompt?: string;
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
const DEFAULT_TRANSCRIPTION_PROMPT = 'Transcreva em PT-BR e preserve nomes, numeros, datas e valores.';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const decodeBase64ToBytes = (value: string) => {
  const normalized = value.replace(/\s+/g, '');
  if (!normalized) {
    throw new Error('Audio do composer invalido.');
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error('Audio do composer em base64 invalido.');
  }
};

type DirectAudioSource = {
  audioBlob: Blob;
  mimeType: string;
  fileName: string;
};

const extractDirectAudioSource = (payload: TranscribeRequest | null): DirectAudioSource | null => {
  const rawAudioDataUrl = readTrimmedString(payload?.audioDataUrl);
  if (!rawAudioDataUrl) return null;

  const dataUrlMatch = rawAudioDataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/i);
  const mimeTypeFromDataUrl = readTrimmedString(dataUrlMatch?.[1]);
  const base64Payload = dataUrlMatch?.[2] || rawAudioDataUrl;
  const mimeType = readTrimmedString(payload?.mimeType) || mimeTypeFromDataUrl || 'audio/ogg';
  const fileName =
    readTrimmedString(payload?.fileName) ||
    `whatsapp-composer-audio.${getExtensionFromMimeType(mimeType)}`;

  return {
    audioBlob: new Blob([decodeBase64ToBytes(base64Payload)], { type: mimeType }),
    mimeType,
    fileName,
  };
};

const extractPersistedTranscription = (payload: unknown, fallbackText?: string) => {
  const payloadRecord = asRecord(payload);
  const transcriptionRecord = asRecord(payloadRecord?.transcription);
  const text =
    readTrimmedString(fallbackText) ||
    readTrimmedString(transcriptionRecord?.text) ||
    readTrimmedString(transcriptionRecord?.transcript) ||
    readTrimmedString(transcriptionRecord?.body);

  if (!text) return null;

  return {
    text,
    provider: readTrimmedString(transcriptionRecord?.provider),
    model: readTrimmedString(transcriptionRecord?.model),
    createdAt: readTrimmedString(transcriptionRecord?.createdAt) || readTrimmedString(transcriptionRecord?.created_at),
    updatedAt: readTrimmedString(transcriptionRecord?.updatedAt) || readTrimmedString(transcriptionRecord?.updated_at),
  };
};

const extractMediaPayload = (payload: unknown): Record<string, unknown> | null => {
  const payloadRecord = asRecord(payload);
  if (!payloadRecord) return null;

  const candidates = [payloadRecord.audio, payloadRecord.voice, payloadRecord.media, payloadRecord];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return record;
    }
  }

  return null;
};

const resolveMediaIdFromPayload = (payload: unknown): string => {
  const mediaPayload = extractMediaPayload(payload);
  if (!mediaPayload) return '';

  return (
    readTrimmedString(mediaPayload.id) ||
    readTrimmedString(mediaPayload.media_id) ||
    readTrimmedString(mediaPayload.mediaId)
  );
};

const getExtensionFromMimeType = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('webm')) return 'webm';
  return 'ogg';
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

const fetchWhapiAudioBlob = async (mediaId: string, whapiToken: string) => {
  const mediaResponse = await fetch(`${WHAPI_BASE_URL}/media/${encodeURIComponent(mediaId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${whapiToken}`,
      Accept: 'application/json, */*',
    },
  });

  if (!mediaResponse.ok) {
    const errorText = await mediaResponse.text();
    throw new Error(`Falha ao buscar audio na Whapi: ${mediaResponse.status} ${errorText}`);
  }

  const contentType = mediaResponse.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return mediaResponse.blob();
  }

  const descriptor = asRecord(await mediaResponse.json()) ?? {};
  const resourceUrl =
    readTrimmedString(descriptor.url) ||
    readTrimmedString(descriptor.link) ||
    readTrimmedString(descriptor.media);

  if (!resourceUrl) {
    throw new Error('Whapi nao retornou uma URL de audio valida.');
  }

  let binaryResponse = await fetch(resourceUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${whapiToken}`,
      Accept: 'application/octet-stream, */*',
    },
  });

  if (!binaryResponse.ok) {
    binaryResponse = await fetch(resourceUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream, */*',
      },
    });
  }

  if (!binaryResponse.ok) {
    const errorText = await binaryResponse.text();
    throw new Error(`Falha ao baixar audio binario da Whapi: ${binaryResponse.status} ${errorText}`);
  }

  return binaryResponse.blob();
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
      console.error('[transcribe-whatsapp-audio] Missing Supabase environment variables');
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

    const payload = (await req.json().catch(() => null)) as TranscribeRequest | null;
    const messageId = readTrimmedString(payload?.messageId);
    const transcriptionPrompt = readTrimmedString(payload?.prompt) || DEFAULT_TRANSCRIPTION_PROMPT;

    let directAudioSource: DirectAudioSource | null = null;
    try {
      directAudioSource = extractDirectAudioSource(payload);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Audio do composer invalido.' }, 400);
    }

    if (!messageId && !directAudioSource) {
      return jsonResponse({ error: 'messageId ou audioDataUrl obrigatorio.' }, 400);
    }

    if (!messageId && directAudioSource) {
      const transcriptionResult = await transcribeAudioWithRouting({
        supabaseAdmin,
        audioBlob: directAudioSource.audioBlob,
        fileName: directAudioSource.fileName,
        mimeType: directAudioSource.mimeType,
        prompt: transcriptionPrompt,
      });

      return jsonResponse({
        transcript: transcriptionResult.text,
        provider: transcriptionResult.provider,
        model: transcriptionResult.model,
      }, 200);
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, type, payload, transcription_text')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(`Falha ao buscar mensagem: ${messageError.message}`);
    }

    if (!message) {
      return jsonResponse({ error: 'Mensagem nao encontrada.' }, 404);
    }

    const normalizedType = readTrimmedString(message.type).toLowerCase();
    if (!['audio', 'voice', 'ptt'].includes(normalizedType)) {
      return jsonResponse({ error: 'A mensagem informada nao e um audio.' }, 400);
    }

    const currentPayload = asRecord(message.payload) ?? {};
    const persistedTranscription = extractPersistedTranscription(message.payload, message.transcription_text);
    if (persistedTranscription) {
      const existingPayload = {
        ...currentPayload,
        transcription: {
          text: persistedTranscription.text,
          provider: persistedTranscription.provider || undefined,
          model: persistedTranscription.model || undefined,
          createdAt: persistedTranscription.createdAt || undefined,
          updatedAt: persistedTranscription.updatedAt || persistedTranscription.createdAt || undefined,
        },
      };

      return jsonResponse({
          transcript: persistedTranscription.text,
          provider: persistedTranscription.provider || null,
          model: persistedTranscription.model || null,
          payload: existingPayload,
        }, 200);
    }

    const mediaPayload = extractMediaPayload(currentPayload);
    const mediaId = readTrimmedString(payload?.mediaId) || resolveMediaIdFromPayload(currentPayload);

    if (!mediaId) {
      return jsonResponse({ error: 'Media ID do audio nao encontrado.' }, 400);
    }

    const whapiToken = await loadWhapiToken(supabaseAdmin);
    const mediaBlob = await fetchWhapiAudioBlob(mediaId, whapiToken);
    const mimeType =
      mediaBlob.type ||
      readTrimmedString(mediaPayload?.mime_type) ||
      readTrimmedString(mediaPayload?.mimetype) ||
      'audio/ogg';
    const fileName = `whatsapp-audio-${messageId}.${getExtensionFromMimeType(mimeType)}`;

    const transcriptionResult = await transcribeAudioWithRouting({
      supabaseAdmin,
      audioBlob: mediaBlob,
      fileName,
      mimeType,
      prompt: transcriptionPrompt,
    });

    const now = new Date().toISOString();
    const existingTranscription = extractPersistedTranscription(currentPayload);
    const nextPayload = {
      ...currentPayload,
      transcription: {
        text: transcriptionResult.text,
        provider: transcriptionResult.provider,
        model: transcriptionResult.model,
        createdAt: existingTranscription?.createdAt || now,
        updatedAt: now,
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from('whatsapp_messages')
      .update({
        payload: nextPayload,
        transcription_text: transcriptionResult.text,
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Falha ao salvar transcricao: ${updateError.message}`);
    }

    return jsonResponse({
        transcript: transcriptionResult.text,
        provider: transcriptionResult.provider,
        model: transcriptionResult.model,
        payload: nextPayload,
      }, 200);
  } catch (error) {
    console.error('[transcribe-whatsapp-audio] Erro inesperado:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erro interno ao transcrever audio.' }, 500);
  }
});
