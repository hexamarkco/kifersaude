import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { whatsappCampaignService } from '../../../src/server/whatsappCampaignService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
  'Content-Type': 'application/json',
};

const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set');
}

const runAndLogProcess = async () => {
  try {
    const results = await whatsappCampaignService.processPendingTargets();
    console.log('[process-whatsapp-campaigns] processed targets', results.length);
  } catch (error) {
    console.error('[process-whatsapp-campaigns] failed to process targets', error);
  }
};

if (typeof Deno !== 'undefined' && typeof Deno.cron === 'function') {
  Deno.cron('process-whatsapp-campaigns', '*/1 * * * *', runAndLogProcess);
} else {
  console.warn('Deno.cron not available; campaigns must be triggered manually.');
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
    const results = await whatsappCampaignService.processPendingTargets();
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: corsHeaders,
      status: 200,
    });
  } catch (error) {
    console.error('Erro ao processar campanhas do WhatsApp:', error);
    return new Response(JSON.stringify({ error: 'Falha ao processar campanhas' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
});
