import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@^2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

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
}

interface Lead {
  id: string;
  nome_completo?: string;
  telefone?: string;
  origem?: string;
  cidade?: string;
  responsavel?: string;
  status?: string;
  auto_message_attempts?: number;
}

interface ProcessingCursor {
  id: number;
  last_processed_phone: string;
  is_running: boolean;
  batch_size: number;
  total_processed: number;
  reset_count: number;
}

function applyTemplateVariables(template: string, lead: Lead): string {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';

  return template
    .replace(/{{{\s*nome\s*}}/gi, lead.nome_completo || '')
    .replace(/{{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{{\s*origem\s*}}/gi, lead.origem || '')
    .replace(/{{{\s*cidade\s*}}/gi, lead.cidade || '')
    .replace(/{{{\s*responsavel\s*}}/gi, lead.responsavel || '');
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

async function acquireLock(supabase: any): Promise<ProcessingCursor | null> {
  const { data: cursor, error } = await supabase
    .from('lead_processing_cursor')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !cursor) {
    console.error('[ProcessLeads] Erro ao buscar cursor:', error);
    return null;
  }

  const now = new Date();
  const updatedAt = new Date(cursor.updated_at);
  const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60;

  if (cursor.is_running && minutesSinceUpdate < 5) {
    console.log('[ProcessLeads] Outra instância já está executando');
    return null;
  }

  if (cursor.is_running && minutesSinceUpdate >= 5) {
    console.warn('[ProcessLeads] Lock travado detectado, forçando liberação');
  }

  const { data: updated, error: updateError } = await supabase
    .from('lead_processing_cursor')
    .update({
      is_running: true,
      last_error: null,
    })
    .eq('id', 1)
    .select()
    .single();

  if (updateError) {
    console.error('[ProcessLeads] Erro ao adquirir lock:', updateError);
    return null;
  }

  return updated;
}

async function releaseLock(
  supabase: any,
  lastProcessedPhone: string,
  totalProcessed: number,
  resetCount: number,
  error?: string
): Promise<void> {
  await supabase
    .from('lead_processing_cursor')
    .update({
      is_running: false,
      last_processed_phone: lastProcessedPhone,
      last_processed_at: new Date().toISOString(),
      total_processed: totalProcessed,
      reset_count: resetCount,
      last_error: error || null,
    })
    .eq('id', 1);
}

async function processLead(
  lead: Lead,
  settings: AutoContactSettings,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedPhone = normalizePhone(lead.telefone!);
    if (!normalizedPhone) {
      return { success: false, error: 'Telefone inválido' };
    }

    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('telefone', lead.telefone)
      .neq('id', lead.id)
      .limit(1);

    if (existingLeads && existingLeads.length > 0) {
      console.log(`[ProcessLeads] Lead ${lead.id} - Duplicado detectado`);

      await supabase
        .from('leads')
        .update({
          status: 'Duplicado',
          auto_message_sent_at: new Date().toISOString(),
          processing_notes: 'Telefone duplicado detectado durante processamento automático',
        })
        .eq('id', lead.id);

      return { success: true };
    }

    const chatId = `55${normalizedPhone}@s.whatsapp.net`;

    const steps = settings.messageFlow
      .filter((step) => step.active && step.message.trim())
      .sort((a, b) => a.delaySeconds - b.delaySeconds);

    if (steps.length === 0) {
      return { success: false, error: 'Nenhum passo ativo no fluxo' };
    }

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

    for (const step of steps) {
      if (step.delaySeconds > 0) {
        await waitSeconds(step.delaySeconds);
      }

      const finalMessage = applyTemplateVariables(step.message, lead);

      const response = await sendWhatsAppMessage(chatId, finalMessage, settings.apiKey);
      console.log(`[ProcessLeads] Lead ${lead.id} - Mensagem enviada: ${step.id}`);

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
            auto_message_sent_at: timestamp,
            auto_message_attempts: (lead.auto_message_attempts || 0) + 1,
            processing_notes: 'Mensagens automáticas enviadas com sucesso',
          })
          .eq('id', lead.id);

        await supabase.from('interactions').insert({
          lead_id: lead.id,
          tipo: 'Mensagem Automática',
          descricao: 'Contato via Mensagem Automática (Processamento Agendado)',
          responsavel: lead.responsavel || 'Sistema',
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`[ProcessLeads] Erro ao processar lead ${lead.id}:`, error);

    await supabase
      .from('leads')
      .update({
        auto_message_attempts: (lead.auto_message_attempts || 0) + 1,
        processing_notes: `Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      })
      .eq('id', lead.id);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
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

    console.log('[ProcessLeads] Iniciando execução agendada');

    const cursor = await acquireLock(supabase);
    if (!cursor) {
      return new Response(
        JSON.stringify({ message: 'Sistema ocupado ou lock não disponível' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[ProcessLeads] Lock adquirido. Cursor: ${cursor.last_processed_phone}`);

    const { data: integrationData } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle();

    if (!integrationData) {
      await releaseLock(supabase, cursor.last_processed_phone, cursor.total_processed, cursor.reset_count);
      return new Response(
        JSON.stringify({ message: 'Integração não configurada' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const settings = integrationData.settings as AutoContactSettings;

    if (!settings.enabled || !settings.autoSend) {
      await releaseLock(supabase, cursor.last_processed_phone, cursor.total_processed, cursor.reset_count);
      return new Response(
        JSON.stringify({ message: 'Automação desativada' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'Novo')
      .gt('telefone', cursor.last_processed_phone)
      .is('auto_message_sent_at', null)
      .or(`auto_message_attempts.is.null,auto_message_attempts.lt.3`)
      .not('telefone', 'is', null)
      .order('telefone', { ascending: true })
      .limit(cursor.batch_size);

    if (leadsError) {
      console.error('[ProcessLeads] Erro ao buscar leads:', leadsError);
      await releaseLock(
        supabase,
        cursor.last_processed_phone,
        cursor.total_processed,
        cursor.reset_count,
        leadsError.message
      );
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      console.log('[ProcessLeads] Nenhum lead encontrado, resetando cursor');
      await releaseLock(supabase, '0', cursor.total_processed, cursor.reset_count + 1);
      return new Response(
        JSON.stringify({
          message: 'Fim do ciclo - cursor resetado',
          processed: 0,
          resetCount: cursor.reset_count + 1,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[ProcessLeads] Processando ${leads.length} leads`);

    let processedCount = 0;
    let errorCount = 0;
    let lastPhone = cursor.last_processed_phone;

    for (const lead of leads) {
      const result = await processLead(lead, settings, supabase);

      if (result.success) {
        processedCount++;
      } else {
        errorCount++;
        console.error(`[ProcessLeads] Lead ${lead.id} falhou: ${result.error}`);
      }

      lastPhone = lead.telefone;
    }

    await releaseLock(
      supabase,
      lastPhone,
      cursor.total_processed + processedCount,
      cursor.reset_count
    );

    console.log(
      `[ProcessLeads] Concluído: ${processedCount} sucesso, ${errorCount} erros`
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        lastPhone: lastPhone,
        totalProcessed: cursor.total_processed + processedCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[ProcessLeads] Erro fatal:', error);

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
