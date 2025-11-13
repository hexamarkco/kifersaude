import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { pathname } = new URL(req.url);

  const eventType = pathname.includes('on-message-send')
    ? 'on-message-send'
    : pathname.includes('on-message-received')
      ? 'on-message-received'
      : null;

  if (!eventType) {
    return new Response(
      JSON.stringify({ success: false, error: 'Endpoint não encontrado' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payload inválido' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    console.log(`whatsapp-webhook ${eventType} payload:`, JSON.stringify(payload));
  } catch (_error) {
    console.error('Não foi possível registrar o payload do webhook');
  }

  return new Response(
    JSON.stringify({ success: true, event: eventType }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
