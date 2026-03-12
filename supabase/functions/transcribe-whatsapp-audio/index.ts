import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { transcribeAudioWithRouting } from '../_shared/ai-router.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type TranscribeRequest = {
  messageId?: string;
  mediaId?: string;
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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
    const payload = (await req.json()) as TranscribeRequest;
    const messageId = readTrimmedString(payload.messageId);

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'messageId obrigatorio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[transcribe-whatsapp-audio] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Configuracao do servidor incompleta.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: message, error: messageError } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id, type, payload, transcription_text')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(`Falha ao buscar mensagem: ${messageError.message}`);
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem nao encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedType = readTrimmedString(message.type).toLowerCase();
    if (!['audio', 'voice', 'ptt'].includes(normalizedType)) {
      return new Response(JSON.stringify({ error: 'A mensagem informada nao e um audio.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

      return new Response(
        JSON.stringify({
          transcript: persistedTranscription.text,
          provider: persistedTranscription.provider || null,
          model: persistedTranscription.model || null,
          payload: existingPayload,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const mediaPayload = extractMediaPayload(currentPayload);
    const mediaId = readTrimmedString(payload.mediaId) || resolveMediaIdFromPayload(currentPayload);

    if (!mediaId) {
      return new Response(JSON.stringify({ error: 'Media ID do audio nao encontrado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      const errorText = await mediaResponse.text();
      throw new Error(`Falha ao buscar audio na Whapi: ${mediaResponse.status} ${errorText}`);
    }

    const mediaBlob = await mediaResponse.blob();
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
      prompt: 'Transcreva em PT-BR e preserve nomes, numeros, datas e valores.',
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

    return new Response(
      JSON.stringify({
        transcript: transcriptionResult.text,
        provider: transcriptionResult.provider,
        model: transcriptionResult.model,
        payload: nextPayload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[transcribe-whatsapp-audio] Erro inesperado:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno ao transcrever audio.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
