// @ts-ignore Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';
import { transcribeAudioWithRouting } from '../_shared/ai-router.ts';
import { COMM_WHATSAPP_MODULE, corsHeaders, ensureCommWhatsAppSettings, fetchWhapiMediaBlob, toTrimmedString } from '../_shared/comm-whatsapp.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type TranscribeBody = {
  messageId?: string;
  force?: boolean;
};

type MessageRow = {
  id: string;
  message_type: string;
  media_id: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  transcription_text: string | null;
  transcription_status: string | null;
  transcription_error: string | null;
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const updateTranscriptionState = async (
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  messageId: string,
  patch: Record<string, unknown>,
) => {
  const { error } = await supabaseAdmin.from('comm_whatsapp_messages').update(patch).eq('id', messageId);
  if (error) {
    throw new Error(`Erro ao atualizar estado da transcricao: ${error.message}`);
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: COMM_WHATSAPP_MODULE,
      requiredPermission: 'view',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: jsonHeaders,
      });
    }

    const body = (await req.json().catch(() => ({}))) as TranscribeBody;
    const messageId = toTrimmedString(body.messageId);
    const force = body.force === true;

    if (!messageId) {
      return new Response(JSON.stringify({ error: 'Mensagem obrigatoria para transcricao.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('comm_whatsapp_messages')
      .select('id, message_type, media_id, media_url, media_mime_type, media_file_name, transcription_text, transcription_status, transcription_error')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      throw new Error(`Erro ao localizar mensagem do WhatsApp: ${messageError.message}`);
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem do WhatsApp nao encontrada.' }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const targetMessage = message as MessageRow;
    if (!['audio', 'voice'].includes(targetMessage.message_type)) {
      return new Response(JSON.stringify({ error: 'Transcricao disponivel apenas para audio e nota de voz.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (!force && targetMessage.transcription_text?.trim()) {
      return new Response(
        JSON.stringify({
          success: true,
          transcription_text: targetMessage.transcription_text,
          transcription_status: targetMessage.transcription_status || 'completed',
          transcription_error: targetMessage.transcription_error,
        }),
        {
          status: 200,
          headers: jsonHeaders,
        },
      );
    }

    const settings = await ensureCommWhatsAppSettings(supabaseAdmin);
    if (!settings.token) {
      return new Response(JSON.stringify({ error: 'Token da Whapi nao configurado.' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    await updateTranscriptionState(supabaseAdmin, messageId, {
      transcription_status: 'processing',
      transcription_error: null,
      transcription_requested_by: authResult.user.profileId,
      transcription_updated_at: new Date().toISOString(),
    });

    try {
      const media = await fetchWhapiMediaBlob({
        token: settings.token,
        mediaId: targetMessage.media_id,
        mediaUrl: targetMessage.media_url,
        fallbackFileName: targetMessage.media_file_name,
        fallbackMimeType: targetMessage.media_mime_type,
      });

      const transcription = await transcribeAudioWithRouting({
        supabaseAdmin,
        audioBlob: media.blob,
        fileName: media.fileName,
        mimeType: media.mimeType,
        prompt: 'Transcreva o audio do WhatsApp em portugues do Brasil, preservando nomes, numeros e contexto comercial.',
      });

      await updateTranscriptionState(supabaseAdmin, messageId, {
        transcription_text: transcription.text,
        transcription_status: 'completed',
        transcription_provider: transcription.provider,
        transcription_model: transcription.model,
        transcription_error: null,
        transcription_requested_by: authResult.user.profileId,
        transcription_updated_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          transcription_text: transcription.text,
          transcription_status: 'completed',
          transcription_provider: transcription.provider,
          transcription_model: transcription.model,
          fallback_used: transcription.fallbackUsed,
        }),
        {
          status: 200,
          headers: jsonHeaders,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro interno ao transcrever audio.';

      await updateTranscriptionState(supabaseAdmin, messageId, {
        transcription_status: 'failed',
        transcription_error: message,
        transcription_requested_by: authResult.user.profileId,
        transcription_updated_at: new Date().toISOString(),
      });

      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: jsonHeaders,
      });
    }
  } catch (error) {
    console.error('[comm-whatsapp-transcribe] erro inesperado', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno na transcricao do WhatsApp.' }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }
});
