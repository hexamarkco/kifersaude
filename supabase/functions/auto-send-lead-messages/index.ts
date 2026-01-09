import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@^2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

const sanitizeWhapiToken = (token: string): string => token?.replace(/^Bearer\s+/i, '').trim();

interface AutoContactStep {
  id: string;
  message: string;
  delaySeconds: number;
  active: boolean;
}

interface AutoContactSettings {
  enabled: boolean;
  autoSend?: boolean;
  apiKey: string;
  statusOnSend: string;
  messageFlow: AutoContactStep[];
  dailySendLimit?: number;
  scheduling?: {
    dailySendLimit?: number;
  };
}

interface Lead {
  id: string;
  nome_completo?: string;
  telefone?: string;
  origem?: string;
  cidade?: string;
  responsavel?: string;
  status?: string;
  blackout_dates?: string[] | null;
  daily_send_limit?: number | null;
}

function applyTemplateVariables(template: string, lead: Lead): string {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';

  return template
    .replace(/{{\s*nome\s*}}/gi, lead.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*origem\s*}}/gi, lead.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead.responsavel || '');
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function sendWhatsAppMessage(
  chatId: string,
  message: string,
  token: string
): Promise<any> {
  const response = await fetch(`${WHAPI_BASE_URL}/messages/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      to: chatId,
      body: message,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(`Erro ao enviar mensagem: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function waitSeconds(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));
}

function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseBlackoutDates(dates?: string[] | null): Set<string> {
  if (!Array.isArray(dates)) return new Set();
  return new Set(
    dates
      .map((value) => value?.slice(0, 10))
      .filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))),
  );
}

function getDailyWindow(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
  return { start, end };
}

async function getDailyMessageCount({
  supabase,
  start,
  end,
  toNumber,
}: {
  supabase: ReturnType<typeof createClient>;
  start: Date;
  end: Date;
  toNumber?: string;
}): Promise<number> {
  let query = supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', start.toISOString())
    .lt('timestamp', end.toISOString())
    .eq('direction', 'outbound');

  if (toNumber) {
    query = query.eq('to_number', toNumber);
  }

  const { count, error } = await query;

  if (error) {
    console.error('[AutoSend] Erro ao consultar limite diário:', error);
    return 0;
  }

  return count ?? 0;
}

async function calculateScheduledAt({
  baseDate,
  delaySeconds,
  lead,
  settings,
  supabase,
  normalizedPhone,
}: {
  baseDate: Date;
  delaySeconds: number;
  lead: Lead;
  settings: AutoContactSettings;
  supabase: ReturnType<typeof createClient>;
  normalizedPhone: string;
}): Promise<Date> {
  const blackoutDates = parseBlackoutDates(lead.blackout_dates);
  const tenantLimit =
    Number.isFinite(settings.scheduling?.dailySendLimit) && Number(settings.scheduling?.dailySendLimit) > 0
      ? Number(settings.scheduling?.dailySendLimit)
      : Number.isFinite(settings.dailySendLimit) && Number(settings.dailySendLimit) > 0
        ? Number(settings.dailySendLimit)
        : null;
  const leadLimit =
    Number.isFinite(lead.daily_send_limit) && Number(lead.daily_send_limit) > 0
      ? Number(lead.daily_send_limit)
      : null;

  let scheduledAt = new Date(baseDate.getTime() + Math.max(0, delaySeconds) * 1000);

  for (let guard = 0; guard < 366; guard += 1) {
    const dateKey = getDateKey(scheduledAt);
    if (blackoutDates.has(dateKey)) {
      scheduledAt = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    if (!tenantLimit && !leadLimit) {
      break;
    }

    const { start, end } = getDailyWindow(scheduledAt);
    const [tenantCount, leadCount] = await Promise.all([
      tenantLimit ? getDailyMessageCount({ supabase, start, end }) : Promise.resolve(0),
      leadLimit ? getDailyMessageCount({ supabase, start, end, toNumber: normalizedPhone }) : Promise.resolve(0),
    ]);

    if ((tenantLimit && tenantCount >= tenantLimit) || (leadLimit && leadCount >= leadLimit)) {
      scheduledAt = new Date(scheduledAt.getTime() + 24 * 60 * 60 * 1000);
      continue;
    }

    break;
  }

  return scheduledAt;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('[AutoSend] Recebido webhook:', payload);

    const lead = payload.record as Lead;

    if (!lead || !lead.id) {
      throw new Error('Lead inválido no payload');
    }

    const { data: integrationData, error: integrationError } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle();

    if (integrationError || !integrationData) {
      console.log('[AutoSend] Integração não configurada');
      return new Response(
        JSON.stringify({ message: 'Integração não configurada' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const settings = integrationData.settings as AutoContactSettings;
    const whapiToken = sanitizeWhapiToken(settings.apiKey);

    if (!settings.enabled) {
      console.log('[AutoSend] Automação desativada');
      return new Response(
        JSON.stringify({ message: 'Automação desativada' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!settings.autoSend) {
      console.log('[AutoSend] Envio automático desativado');
      return new Response(
        JSON.stringify({ message: 'Envio automático desativado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!whapiToken) {
      console.log('[AutoSend] Token não configurado');
      return new Response(
        JSON.stringify({ message: 'Token não configurado' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!lead.telefone) {
      console.log('[AutoSend] Lead sem telefone');
      return new Response(
        JSON.stringify({ message: 'Lead sem telefone' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const normalizedPhone = normalizePhone(lead.telefone);
    if (!normalizedPhone) {
      console.log('[AutoSend] Telefone inválido');
      return new Response(
        JSON.stringify({ message: 'Telefone inválido' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingLeads, error: duplicateCheckError } = await supabase
      .from('leads')
      .select('id')
      .eq('telefone', lead.telefone)
      .neq('id', lead.id)
      .limit(1);

    if (duplicateCheckError) {
      console.error('[AutoSend] Erro ao verificar duplicados:', duplicateCheckError);
    }

    if (existingLeads && existingLeads.length > 0) {
      console.log('[AutoSend] Telefone duplicado detectado, marcando lead como Duplicado');

      await supabase
        .from('leads')
        .update({ status: 'Duplicado' })
        .eq('id', lead.id);

      return new Response(
        JSON.stringify({
          message: 'Lead duplicado - telefone já existe no sistema',
          action: 'status_updated_to_duplicado'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const chatId = `55${normalizedPhone}@s.whatsapp.net`;

    const steps = settings.messageFlow
      .filter((step) => step.active && step.message.trim())
      .sort((a, b) => a.delaySeconds - b.delaySeconds);

    if (steps.length === 0) {
      console.log('[AutoSend] Nenhum passo ativo no fluxo');
      return new Response(
        JSON.stringify({ message: 'Nenhum passo ativo no fluxo' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[AutoSend] Iniciando envio para lead ${lead.id}`);

    const timestamp = new Date().toISOString();
    let firstMessageSent = false;

    await supabase.from('whatsapp_chats').upsert(
      {
        id: chatId,
        name: lead.nome_completo || lead.telefone || 'Sem nome',
        is_group: false,
        last_message_at: timestamp,
      },
      { onConflict: 'id' }
    );

    let baseDate = new Date();

    for (const step of steps) {
      const scheduledAt = await calculateScheduledAt({
        baseDate,
        delaySeconds: step.delaySeconds,
        lead,
        settings,
        supabase,
        normalizedPhone,
      });
      const waitMs = scheduledAt.getTime() - Date.now();
      if (waitMs > 0) {
        await waitSeconds(waitMs / 1000);
      }

      const finalMessage = applyTemplateVariables(step.message, lead);

      try {
        const response = await sendWhatsAppMessage(chatId, finalMessage, whapiToken);
        console.log(`[AutoSend] Mensagem enviada: ${step.id}`, response);

        await supabase.from('whatsapp_messages').insert({
          id: response.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          chat_id: chatId,
          from_number: null,
          to_number: normalizedPhone,
          type: 'text',
          body: finalMessage,
          has_media: false,
          timestamp: new Date().toISOString(),
          direction: 'outbound',
          payload: response,
        });

        if (!firstMessageSent) {
          firstMessageSent = true;

          await supabase
            .from('leads')
            .update({
              status: settings.statusOnSend || lead.status,
              ultimo_contato: timestamp,
            })
            .eq('id', lead.id);

          await supabase.from('interactions').insert({
            lead_id: lead.id,
            tipo: 'Mensagem Automática',
            descricao: 'Contato via Mensagem Automática',
            responsavel: lead.responsavel || 'Sistema',
          });

          console.log(`[AutoSend] Status atualizado e interação registrada`);
        }

        baseDate = scheduledAt;
      } catch (error) {
        console.error(`[AutoSend] Erro ao enviar mensagem ${step.id}:`, error);
        throw error;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${steps.length} mensagem(ns) enviada(s) com sucesso`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[AutoSend] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
