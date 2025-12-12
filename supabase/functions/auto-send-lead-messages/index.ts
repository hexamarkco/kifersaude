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

    if (!settings.apiKey) {
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

    for (const step of steps) {
      if (step.delaySeconds > 0) {
        await waitSeconds(step.delaySeconds);
      }

      const finalMessage = applyTemplateVariables(step.message, lead);

      try {
        const response = await sendWhatsAppMessage(chatId, finalMessage, settings.apiKey);
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