import { createClient } from 'npm:@supabase/supabase-js@^2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type WhapiMessage = {
  id: string;
  type: string;
  chat_id: string;
  chat_name?: string;
  from?: string;
  from_me: boolean;
  from_name?: string;
  source?: string;
  timestamp: number;
  status?: string;
  text?: { body: string };
  image?: { caption?: string };
  video?: { caption?: string };
  audio?: Record<string, unknown>;
  voice?: Record<string, unknown>;
  document?: { filename?: string; caption?: string };
  location?: Record<string, unknown>;
  live_location?: Record<string, unknown>;
  contact?: { name: string };
  contact_list?: { list: Array<{ name: string }> };
  sticker?: Record<string, unknown>;
  action?: { type: string; emoji?: string };
  reply?: { buttons_reply?: { title: string } };
  group_invite?: Record<string, unknown>;
  poll?: { title: string };
  product?: Record<string, unknown>;
  order?: { order_id: string };
};

type WhapiMessageListResponse = {
  messages: WhapiMessage[];
  count: number;
  total: number;
  offset: number;
};

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

const sanitizeWhapiToken = (token: string): string => token?.replace(/^Bearer\s+/i, '').trim();

const mapStatusToAck = (status?: string): number | null => {
  if (!status) return null;
  const statusMap: Record<string, number> = {
    failed: 0,
    pending: 1,
    sent: 2,
    delivered: 3,
    read: 4,
    played: 4,
  };
  return statusMap[status] ?? 1;
};

const buildMessageBody = (message: WhapiMessage): { body: string; hasMedia: boolean } => {
  if (message.text?.body) return { body: message.text.body, hasMedia: false };
  if (message.image) return { body: message.image.caption || '[Imagem]', hasMedia: true };
  if (message.video) return { body: message.video.caption || '[Vídeo]', hasMedia: true };
  if (message.audio) return { body: '[Áudio]', hasMedia: true };
  if (message.voice) return { body: '[Mensagem de voz]', hasMedia: true };
  if (message.document) {
    const fileName = message.document.filename || '';
    const caption = message.document.caption;
    return {
      body: caption ? `${caption} [Documento: ${fileName}]` : `[Documento${fileName ? `: ${fileName}` : ''}]`,
      hasMedia: true,
    };
  }
  if (message.location) return { body: '[Localização]', hasMedia: true };
  if (message.live_location) return { body: '[Localização ao vivo]', hasMedia: true };
  if (message.contact) return { body: `[Contato: ${message.contact.name}]`, hasMedia: false };
  if (message.contact_list) return { body: `[${message.contact_list.list.length} contato(s)]`, hasMedia: false };
  if (message.sticker) return { body: '[Sticker]', hasMedia: true };
  if (message.action?.type === 'reaction') return { body: `Reagiu com ${message.action.emoji || ''}`, hasMedia: false };
  if (message.action?.type === 'delete') return { body: '[Mensagem apagada]', hasMedia: false };
  if (message.action?.type === 'edit') return { body: message.text?.body || '', hasMedia: false };
  if (message.reply?.buttons_reply) return { body: `Resposta: ${message.reply.buttons_reply.title}`, hasMedia: false };
  if (message.group_invite) return { body: '[Convite para grupo]', hasMedia: false };
  if (message.poll) return { body: `[Enquete: ${message.poll.title}]`, hasMedia: false };
  if (message.product) return { body: '[Produto do catálogo]', hasMedia: false };
  if (message.order) return { body: `[Pedido #${message.order.order_id}]`, hasMedia: false };
  return { body: `[${message.type}]`, hasMedia: false };
};

const toIsoString = (timestamp?: number): string | null =>
  timestamp ? new Date(timestamp * 1000).toISOString() : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { chatId, count } = await req.json();
    if (!chatId || typeof chatId !== 'string') {
      return new Response(JSON.stringify({ error: 'chatId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settingsRow, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('slug', 'whatsapp_auto_contact')
      .maybeSingle();

    if (settingsError) {
      throw new Error(settingsError.message);
    }

    const token = sanitizeWhapiToken(settingsRow?.settings?.apiKey || settingsRow?.settings?.token || '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token Whapi não configurado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const queryParams = new URLSearchParams();
    queryParams.append('count', String(typeof count === 'number' ? count : 200));
    queryParams.append('offset', '0');
    queryParams.append('sort', 'desc');

    const response = await fetch(`${WHAPI_BASE_URL}/messages/list/${encodeURIComponent(chatId)}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await response.json()) as WhapiMessageListResponse;
    const messages = payload.messages || [];

    if (messages.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isGroup = chatId.endsWith('@g.us');
    const lastMessageAt = toIsoString(messages[0]?.timestamp) ?? new Date().toISOString();
    const chatName = messages[0]?.chat_name || messages[0]?.from_name || null;

    await supabase.from('whatsapp_chats').upsert(
      {
        id: chatId,
        name: isGroup ? chatName : null,
        is_group: isGroup,
        last_message_at: lastMessageAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    const normalized = messages.map((message) => {
      const direction = message.from_me ? 'outbound' : 'inbound';
      const { body, hasMedia } = buildMessageBody(message);
      return {
        id: message.id,
        chat_id: message.chat_id,
        from_number: direction === 'inbound' ? message.from || message.chat_id : null,
        to_number: direction === 'outbound' ? message.chat_id : null,
        type: message.type,
        body,
        has_media: hasMedia,
        timestamp: toIsoString(message.timestamp),
        payload: message,
        direction,
        ack_status: mapStatusToAck(message.status),
        author: message.from_name ?? null,
        is_deleted: message.action?.type === 'delete' || message.type === 'revoked',
        edit_count: message.edit_history?.length ?? 0,
        edited_at: toIsoString(message.edited_at),
        original_body: message.text?.body ?? body,
      };
    });

    const { error: insertError } = await supabase
      .from('whatsapp_messages')
      .upsert(normalized, { onConflict: 'id' });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return new Response(JSON.stringify({ success: true, count: normalized.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
