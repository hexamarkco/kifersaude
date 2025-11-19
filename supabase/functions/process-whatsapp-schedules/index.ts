import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type WhatsappScheduledMessage = {
  id: string;
  chat_id: string;
  phone: string;
  message: string;
  scheduled_send_at: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  created_at: string | null;
  updated_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  last_error: string | null;
};

type ProcessResult = {
  id: string;
  status: 'sent' | 'failed';
  error?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Content-Type': 'application/json',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const functionsUrl = (Deno.env.get('SUPABASE_FUNCTIONS_URL') ?? '').trim();

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL must be set');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set');
}

const functionsBaseUrl = functionsUrl || `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const shouldProcessRecord = (record: WhatsappScheduledMessage, reference: Date) => {
  if (record.status !== 'pending') {
    return false;
  }

  const scheduledAt = new Date(record.scheduled_send_at);
  if (Number.isNaN(scheduledAt.getTime())) {
    return false;
  }

  return scheduledAt.getTime() <= reference.getTime();
};

const sendWhatsappMessage = async (record: WhatsappScheduledMessage) => {
  const response = await fetch(`${functionsBaseUrl}/whatsapp-webhook/send-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
    body: JSON.stringify({ phone: record.phone, message: record.message }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Falha ao enviar mensagem agendada');
  }
};

const markSchedule = async (id: string, payload: Record<string, string | null>) => {
  const { error } = await supabaseAdmin
    .from('whatsapp_scheduled_messages')
    .update(payload)
    .eq('id', id);

  if (error) {
    throw error;
  }
};

const processSchedules = async (): Promise<ProcessResult[]> => {
  const reference = new Date();
  const { data, error } = await supabaseAdmin
    .from('whatsapp_scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_send_at', reference.toISOString())
    .order('scheduled_send_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const records = (data ?? []).filter(record => shouldProcessRecord(record, reference));

  if (records.length === 0) {
    return [];
  }

  const results: ProcessResult[] = [];

  for (const record of records) {
    try {
      const { data: processingData, error: processingError } = await supabaseAdmin
        .from('whatsapp_scheduled_messages')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', record.id)
        .eq('status', 'pending')
        .select('id');

      if (processingError) {
        throw processingError;
      }

      if (!processingData || processingData.length === 0) {
        continue;
      }

      await sendWhatsappMessage(record);

      await markSchedule(record.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      });

      results.push({ id: record.id, status: 'sent' });
    } catch (scheduleError) {
      const errorMessage = scheduleError instanceof Error ? scheduleError.message : String(scheduleError);

      try {
        await markSchedule(record.id, {
          status: 'failed',
          updated_at: new Date().toISOString(),
          last_error: errorMessage,
        });
      } catch (updateError) {
        console.error('Erro ao atualizar agendamento após falha:', updateError);
      }

      results.push({ id: record.id, status: 'failed', error: errorMessage });
    }
  }

  return results;
};

const runAndLogProcess = async () => {
  try {
    await processSchedules();
  } catch (error) {
    console.error('[process-whatsapp-schedules] erro ao processar agendamentos', error);
  }
};

if (typeof Deno !== 'undefined' && typeof Deno.cron === 'function') {
  Deno.cron('process-whatsapp-schedules', '*/1 * * * *', runAndLogProcess);
} else {
  console.warn(
    'Deno.cron não está disponível; os agendamentos do WhatsApp precisam ser acionados manualmente.',
  );
}

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      headers: corsHeaders,
      status: 405,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${supabaseServiceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      headers: corsHeaders,
      status: 401,
    });
  }

  try {
    const results = await processSchedules();
    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: corsHeaders, status: 200 },
    );
  } catch (error) {
    console.error('Erro ao processar mensagens agendadas:', error);
    return new Response(JSON.stringify({ error: 'Falha ao processar agendamentos' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
