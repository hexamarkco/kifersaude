import { createClient } from 'npm:@supabase/supabase-js@^2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type WhapiMessage = {
  id: string;
  type: string;
  subtype?: string;
  chat_id: string;
  chat_name?: string;
  from?: string;
  from_me: boolean;
  from_name?: string;
  source?: string;
  timestamp: number;
  status?: string;
  edited_at?: number;
  edit_history?: Array<{ body?: string; timestamp?: number }>;
  text?: { body: string };
  image?: { caption?: string };
  video?: { caption?: string };
  audio?: Record<string, unknown>;
  voice?: Record<string, unknown>;
  document?: { filename?: string; caption?: string };
  link_preview?: { body?: string; title?: string; description?: string; url?: string };
  location?: Record<string, unknown>;
  live_location?: Record<string, unknown>;
  contact?: { name: string };
  contact_list?: { list: Array<{ name: string }> };
  sticker?: Record<string, unknown>;
  action?: {
    type: string;
    emoji?: string;
    target?: string;
    edited_type?: string;
    edited_content?: Record<string, unknown>;
    ephemeral?: number;
  };
  reply?: {
    buttons_reply?: { title?: string };
    list_reply?: { title?: string; description?: string };
  };
  interactive?: {
    body?: { text?: string } | string;
    footer?: { text?: string } | string;
    header?: { text?: string } | string;
    action?: {
      buttons?: Array<{ title?: string; text?: string; id?: string; type?: string }>;
      list?: {
        label?: string;
        button?: string;
        sections?: Array<{ title?: string; rows?: Array<{ title?: string; description?: string; id?: string }> }>;
      };
    };
  };
  hsm?: {
    body?: string;
    footer?: string;
    header?: { text?: string } | string;
    buttons?: Array<{ text?: string; title?: string; type?: string; id?: string; url?: string; phone_number?: string }>;
  };
  system?: {
    body?: string;
  };
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

type ChatIdKind = 'group' | 'direct' | 'newsletter' | 'broadcast' | 'status' | 'unknown';

type WhapiNewsletter = {
  id: string;
  name?: string;
};

type WhapiGroup = {
  id: string;
  name?: string;
};

type WhapiNewsletterListResponse = {
  newsletters?: WhapiNewsletter[];
  count?: number;
  total?: number;
  offset?: number;
};

const getChatIdKind = (chatId: string): ChatIdKind => {
  const normalized = chatId.trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.endsWith('@g.us')) return 'group';
  if (normalized === 'status@broadcast' || normalized === 'stories') return 'status';
  if (normalized.endsWith('@newsletter')) return 'newsletter';
  if (normalized.endsWith('@broadcast')) return 'broadcast';
  if (normalized.endsWith('@c.us') || normalized.endsWith('@s.whatsapp.net') || normalized.endsWith('@lid')) {
    return 'direct';
  }

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'direct';
    }
  }

  return 'unknown';
};

const fetchNewsletterName = async (token: string, chatId: string): Promise<string | null> => {
  const pageSize = 100;
  let offset = 0;

  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(`${WHAPI_BASE_URL}/newsletters?count=${pageSize}&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as WhapiNewsletterListResponse;
    const newsletters = payload.newsletters || [];
    const match = newsletters.find((item) => item.id === chatId);
    const resolvedName = match?.name?.trim();
    if (resolvedName) {
      return resolvedName;
    }

    if (newsletters.length < pageSize) {
      break;
    }

    offset += newsletters.length;
    if (newsletters.length === 0) {
      break;
    }
  }

  return null;
};

const fetchGroupName = async (token: string, chatId: string): Promise<string | null> => {
  const response = await fetch(`${WHAPI_BASE_URL}/groups/${encodeURIComponent(chatId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as WhapiGroup;
  const groupName = payload.name?.trim();
  if (!groupName || groupName === chatId) {
    return null;
  }

  return groupName;
};

const sanitizeWhapiToken = (token: string): string => token?.replace(/^Bearer\s+/i, '').trim();

const mapStatusToAck = (status?: string): number | null => {
  if (!status) return null;
  const normalized = status.trim().toLowerCase();
  const statusMap: Record<string, number> = {
    failed: 0,
    pending: 1,
    sent: 2,
    delivered: 3,
    read: 4,
    played: 4,
  };
  return statusMap[normalized] ?? null;
};

const toCleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toPayloadObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const extractContentBody = (content: unknown): string | null => {
  const payload = toPayloadObject(content);
  if (!payload) return null;

  const bodyText = toCleanText(payload.body);
  if (bodyText) return bodyText;

  const captionText = toCleanText(payload.caption);
  if (captionText) return captionText;

  const textValue = toCleanText(payload.text);
  if (textValue) return textValue;

  const titleText = toCleanText(payload.title);
  if (titleText) return titleText;

  const descriptionText = toCleanText(payload.description);
  if (descriptionText) return descriptionText;

  const urlText = toCleanText(payload.url);
  if (urlText) return urlText;

  return null;
};

const normalizeActionType = (actionType: unknown): string => toCleanText(actionType).toLowerCase();

const extractLinkPreviewBody = (message: WhapiMessage): string | null => {
  const linkPreview = toPayloadObject(message.link_preview);
  if (!linkPreview) return null;

  const bodyText = toCleanText(linkPreview.body);
  if (bodyText && bodyText !== '[link_preview]') return bodyText;

  const titleText = toCleanText(linkPreview.title);
  if (titleText) return titleText;

  const descriptionText = toCleanText(linkPreview.description);
  if (descriptionText) return descriptionText;

  const urlText = toCleanText(linkPreview.url);
  if (urlText) return urlText;

  return '[Link]';
};

const extractSystemBody = (message: WhapiMessage): string | null => {
  const directBody = toCleanText(message.system?.body);
  if (directBody) {
    return directBody;
  }

  const subtype = toCleanText(message.subtype).toLowerCase();
  if (subtype === 'revoke') {
    return '[Mensagem apagada]';
  }
  if (subtype === 'ciphertext') {
    return '[Mensagem criptografada]';
  }
  if (subtype === 'ephemeral') {
    return '[Mensagem temporária]';
  }
  if (subtype) {
    return `[Sistema: ${subtype}]`;
  }

  return '[Evento do WhatsApp]';
};

const extractEditedActionBody = (message: WhapiMessage): string | null => {
  const action = message.action;
  if (!action) return null;

  const actionType = normalizeActionType(action.type);
  if (actionType !== 'edit' && actionType !== 'edited') {
    return null;
  }

  const editedType = normalizeActionType(action.edited_type);
  const editedContentBody = extractContentBody(action.edited_content);
  if (editedContentBody) {
    return editedContentBody;
  }

  const fallbackLabelByType: Record<string, string> = {
    image: '[Imagem editada]',
    video: '[Vídeo editado]',
    short: '[Vídeo editado]',
    gif: '[GIF editado]',
    audio: '[Áudio editado]',
    voice: '[Mensagem de voz editada]',
    document: '[Documento editado]',
    link_preview: '[Link editado]',
    location: '[Localização editada]',
    live_location: '[Localização ao vivo editada]',
    contact: '[Contato editado]',
    contact_list: '[Lista de contatos editada]',
    sticker: '[Sticker editado]',
    hsm: '[Template editado]',
    interactive: '[Mensagem interativa editada]',
    poll: '[Enquete editada]',
    order: '[Pedido editado]',
    product: '[Produto editado]',
    story: '[Status editado]',
    text: '[Mensagem editada]',
  };

  if (editedType && fallbackLabelByType[editedType]) {
    return fallbackLabelByType[editedType];
  }

  return '[Mensagem editada]';
};

const extractInteractiveBody = (message: WhapiMessage): string | null => {
  const interactive = message.interactive;
  if (!interactive) return null;

  const bodyText =
    typeof interactive.body === 'string' ? toCleanText(interactive.body) : toCleanText(interactive.body?.text);
  if (bodyText) return bodyText;

  const headerText =
    typeof interactive.header === 'string' ? toCleanText(interactive.header) : toCleanText(interactive.header?.text);
  const footerText =
    typeof interactive.footer === 'string' ? toCleanText(interactive.footer) : toCleanText(interactive.footer?.text);

  const buttonTitles = (interactive.action?.buttons || [])
    .map((button) => toCleanText(button.title || button.text))
    .filter(Boolean);

  const listLabel = toCleanText(interactive.action?.list?.label || interactive.action?.list?.button);
  const listRows = (interactive.action?.list?.sections || [])
    .flatMap((section) => section.rows || [])
    .map((row) => toCleanText(row.title))
    .filter(Boolean);

  const summaryParts = [headerText, footerText, listLabel, ...buttonTitles.slice(0, 2), ...listRows.slice(0, 2)]
    .filter(Boolean);

  if (summaryParts.length > 0) {
    return `Interativo: ${summaryParts.join(' • ')}`;
  }

  return null;
};

const extractHsmBody = (message: WhapiMessage): string | null => {
  const hsm = message.hsm;
  if (!hsm) return null;

  const bodyText = toCleanText(hsm.body);
  if (bodyText) return bodyText;

  const headerText = typeof hsm.header === 'string' ? toCleanText(hsm.header) : toCleanText(hsm.header?.text);
  const footerText = toCleanText(hsm.footer);
  const buttonTexts = (hsm.buttons || [])
    .map((button) => toCleanText(button.text || button.title))
    .filter(Boolean);

  const summaryParts = [headerText, footerText, ...buttonTexts.slice(0, 2)].filter(Boolean);
  if (summaryParts.length > 0) {
    return `Template: ${summaryParts.join(' • ')}`;
  }

  return null;
};

const extractReplyBody = (message: WhapiMessage): string | null => {
  const buttonReplyTitle = toCleanText(message.reply?.buttons_reply?.title);
  if (buttonReplyTitle) {
    return `Resposta: ${buttonReplyTitle}`;
  }

  const listReplyTitle = toCleanText(message.reply?.list_reply?.title);
  const listReplyDescription = toCleanText(message.reply?.list_reply?.description);
  if (listReplyTitle && listReplyDescription) {
    return `Resposta: ${listReplyTitle} - ${listReplyDescription}`;
  }
  if (listReplyTitle) {
    return `Resposta: ${listReplyTitle}`;
  }

  return null;
};

const buildMessageBody = (message: WhapiMessage): { body: string; hasMedia: boolean } => {
  if (message.text?.body) return { body: message.text.body, hasMedia: false };
  const linkPreviewBody = extractLinkPreviewBody(message);
  if (message.link_preview) return { body: linkPreviewBody || '[Link]', hasMedia: true };
  if (message.image) {
    const fallback = message.type === 'story' ? '[Imagem de status]' : '[Imagem]';
    return { body: message.image.caption || fallback, hasMedia: true };
  }
  if (message.video) {
    const fallback = message.type === 'story' ? '[Vídeo de status]' : '[Vídeo]';
    return { body: message.video.caption || fallback, hasMedia: true };
  }
  if (message.type === 'short' || message.type === 'gif') return { body: '[Vídeo]', hasMedia: true };
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
  if (message.action) {
    const actionType = normalizeActionType(message.action.type);
    if (actionType === 'reaction') {
      const emoji = toCleanText(message.action.emoji);
      if (emoji) return { body: `Reagiu com ${emoji}`, hasMedia: false };
      return { body: '[Reação removida]', hasMedia: false };
    }
    if (actionType === 'delete') return { body: '[Mensagem apagada]', hasMedia: false };
    if (actionType === 'vote') return { body: '[Votou em enquete]', hasMedia: false };
    if (actionType === 'ephemeral') return { body: '[Configuração de mensagens temporárias]', hasMedia: false };

    const editedBody = extractEditedActionBody(message);
    if (editedBody) return { body: editedBody, hasMedia: false };

    return { body: `[Ação: ${message.action.type}]`, hasMedia: false };
  }
  const replyBody = extractReplyBody(message);
  if (replyBody) return { body: replyBody, hasMedia: false };
  const interactiveBody = extractInteractiveBody(message);
  if (interactiveBody) return { body: interactiveBody, hasMedia: false };
  const hsmBody = extractHsmBody(message);
  if (hsmBody) return { body: hsmBody, hasMedia: false };
  if (message.type === 'system') return { body: extractSystemBody(message) || '[Evento do WhatsApp]', hasMedia: false };
  if (message.type === 'interactive') return { body: '[Mensagem interativa]', hasMedia: false };
  if (message.type === 'hsm') return { body: '[Template WhatsApp]', hasMedia: false };
  if (message.type === 'link_preview') return { body: linkPreviewBody || '[Link]', hasMedia: true };
  if (message.type === 'story') return { body: '[Status]', hasMedia: false };
  if (message.type === 'call') return { body: '[Ligação do WhatsApp]', hasMedia: false };
  if (message.type === 'revoked') return { body: '[Mensagem apagada]', hasMedia: false };
  if (message.type === 'unknown') return { body: '[Mensagem não suportada]', hasMedia: false };
  if (message.group_invite) return { body: '[Convite para grupo]', hasMedia: false };
  if (message.poll) return { body: `[Enquete: ${message.poll.title}]`, hasMedia: false };
  if (message.product) return { body: '[Produto do catálogo]', hasMedia: false };
  if (message.order) return { body: `[Pedido #${message.order.order_id}]`, hasMedia: false };
  return { body: `[${message.type}]`, hasMedia: false };
};

const extractChatPhoneNumber = (chatId: string): string | null => {
  const normalized = chatId.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase().endsWith('@lid')) return null;

  const withoutSuffix = normalized.replace(/@c\.us$|@s\.whatsapp\.net$/i, '');
  const digits = withoutSuffix.replace(/\D/g, '');
  return digits || null;
};

const extractChatLid = (chatId: string): string | null => {
  const normalized = chatId.trim();
  if (!normalized) return null;
  return normalized.toLowerCase().endsWith('@lid') ? normalized : null;
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

    const chatKind = getChatIdKind(chatId);
    const isGroup = chatKind === 'group';
    const isChannelChat = chatKind === 'newsletter' || chatKind === 'broadcast' || chatKind === 'status';
    const lastMessageAt = toIsoString(messages[0]?.timestamp) ?? new Date().toISOString();
    const messageChatNameRaw = messages.find((message) => message.chat_name?.trim())?.chat_name?.trim() || null;
    const messageChatName = messageChatNameRaw && messageChatNameRaw !== chatId ? messageChatNameRaw : null;
    const { data: existingChat } = await supabase
      .from('whatsapp_chats')
      .select('name')
      .eq('id', chatId)
      .maybeSingle();

    const existingChatName = existingChat?.name?.trim() || null;

    let chatName = existingChatName;
    if (isGroup) {
      const canonicalGroupName = await fetchGroupName(token, chatId);
      chatName = canonicalGroupName ?? messageChatName ?? existingChatName ?? chatId;
    } else if (isChannelChat) {
      const channelName = messageChatName ?? (await fetchNewsletterName(token, chatId));
      if (chatKind === 'status') {
        chatName = 'Status';
      } else if (channelName) {
        chatName = channelName;
      } else if (chatKind === 'newsletter') {
        chatName = existingChatName ?? 'Canal sem nome';
      } else {
        chatName = existingChatName ?? 'Transmissao sem nome';
      }
    }

    await supabase.from('whatsapp_chats').upsert(
      {
        id: chatId,
        name: chatName,
        is_group: isGroup,
        phone_number: chatKind === 'direct' ? extractChatPhoneNumber(chatId) : null,
        lid: chatKind === 'direct' ? extractChatLid(chatId) : null,
        last_message_at: lastMessageAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (isGroup && chatName) {
      await supabase
        .from('whatsapp_groups')
        .update({ name: chatName, last_updated_at: new Date().toISOString() })
        .eq('id', chatId);
    }

    const normalized = messages
      .filter((message) => {
        if (message.type !== 'action') return true;
        const actionType = normalizeActionType(message.action?.type);
        return actionType !== 'edit' && actionType !== 'edited';
      })
      .map((message) => {
      const direction = message.from_me ? 'outbound' : 'inbound';
      const { body, hasMedia } = buildMessageBody(message);
      const messageChatId =
        message.action?.type === 'reaction' && message.action?.target ? chatId : message.chat_id;
      return {
        id: message.id,
        chat_id: messageChatId,
        from_number: direction === 'inbound' ? message.from || messageChatId : null,
        to_number: direction === 'outbound' ? messageChatId : null,
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
