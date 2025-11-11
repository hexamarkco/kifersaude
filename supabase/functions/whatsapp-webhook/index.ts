import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const READ_STATUSES = new Set(['READ', 'PLAYED']);

type SupabaseTypedClient = SupabaseClient<any, any, any>;

type EventProcessingResult = {
  messageId: string;
  status: 'inserted' | 'updated' | 'skipped';
  reason?: string;
};

type MediaDetails = {
  url?: string;
  type?: string;
  mimeType?: string;
  durationSeconds?: number | null;
  thumbnailUrl?: string;
  caption?: string;
  viewOnce?: boolean | null;
};

function respond(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizePhoneNumber(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('-group') || trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function pickFirstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function extractSenderName(payload: any): string | null {
  return pickFirstString(
    payload?.contact?.displayName,
    payload?.contact?.name,
    payload?.contact?.formattedName,
    payload?.contact?.shortName,
    payload?.senderName,
    payload?.sender?.name,
    payload?.sender?.shortName,
    payload?.pushName,
    payload?.participantName,
    payload?.participantPushName
  );
}

function detectGroupChat(payload: any, normalizedPhone?: string | null): boolean {
  if (typeof payload?.isGroup === 'boolean') {
    return payload.isGroup;
  }

  if (typeof payload?.chat?.isGroup === 'boolean') {
    return payload.chat.isGroup;
  }

  if (payload?.groupId || payload?.groupName || payload?.groupSubject) {
    return true;
  }

  const phoneCandidates = [normalizedPhone, payload?.phone, payload?.senderPhone, payload?.chat?.id, payload?.chat?.jid];
  for (const candidate of phoneCandidates) {
    if (typeof candidate === 'string') {
      const lowerCandidate = candidate.toLowerCase();
      if (lowerCandidate.includes('@g.us') || lowerCandidate.includes('-group')) {
        return true;
      }
    }
  }

  if (typeof payload?.remoteJid === 'string' && payload.remoteJid.toLowerCase().includes('@g.us')) {
    return true;
  }

  return false;
}

function extractChatName(payload: any, senderName?: string | null, isGroupChat?: boolean): string | null {
  if (isGroupChat) {
    const explicitGroupName = pickFirstString(payload?.chatName);
    if (explicitGroupName) {
      return explicitGroupName;
    }
  }

  return pickFirstString(
    payload?.chatName,
    payload?.chat?.name,
    payload?.chat?.displayName,
    payload?.groupName,
    payload?.groupSubject,
    payload?.contact?.displayName,
    senderName ?? null
  );
}

function extractSenderPhoto(payload: any): string | null {
  return pickFirstString(
    payload?.photo,
    payload?.profilePicUrl,
    payload?.profilePicThumb,
    payload?.contact?.photoUrl,
    payload?.sender?.photo
  );
}

function describePayload(payload: any): { text: string; media?: MediaDetails } {
  const textSources: (string | null)[] = [
    pickFirstString(payload?.text?.message, payload?.text?.body, payload?.text?.text),
    pickFirstString(payload?.message, payload?.body, payload?.content),
    pickFirstString(payload?.image?.caption, payload?.video?.caption, payload?.document?.title),
    pickFirstString(payload?.buttonsResponseMessage?.message, payload?.listResponseMessage?.message),
    pickFirstString(payload?.hydratedTemplate?.message),
    pickFirstString(payload?.pixKeyMessage?.message),
  ];

  let text = textSources.find((value) => typeof value === 'string' && value.trim()) ?? '';

  let media: MediaDetails | undefined;
  const ensureMedia = () => {
    if (!media) {
      media = {};
    }
    return media!;
  };

  if (payload?.image) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'image';
    ref.url = ref.url ?? pickFirstString(payload.image?.imageUrl, payload.image?.url, payload.image?.thumbnailUrl);
    ref.thumbnailUrl = ref.thumbnailUrl ?? pickFirstString(payload.image?.thumbnailUrl, payload.image?.previewUrl);
    ref.mimeType = ref.mimeType ?? pickFirstString(payload.image?.mimeType, payload.image?.mimetype);
    ref.caption = ref.caption ?? pickFirstString(payload.image?.caption, payload?.caption);
    if (typeof payload.image?.viewOnce === 'boolean') {
      ref.viewOnce = payload.image.viewOnce;
    }
  }

  if (payload?.video) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'video';
    ref.url = ref.url ?? pickFirstString(payload.video?.videoUrl, payload.video?.url);
    ref.thumbnailUrl =
      ref.thumbnailUrl ?? pickFirstString(payload.video?.thumbnailUrl, payload.video?.previewUrl, payload?.thumbnailUrl);
    ref.mimeType = ref.mimeType ?? pickFirstString(payload.video?.mimeType, payload.video?.mimetype);
    ref.caption = ref.caption ?? pickFirstString(payload.video?.caption, payload?.caption);
    const seconds =
      typeof payload.video?.seconds === 'number'
        ? payload.video.seconds
        : typeof payload.video?.duration === 'number'
        ? payload.video.duration
        : undefined;
    if (typeof seconds === 'number') {
      ref.durationSeconds = seconds;
    }
    if (typeof payload.video?.viewOnce === 'boolean') {
      ref.viewOnce = payload.video.viewOnce;
    }
  }

  if (payload?.audio) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'audio';
    ref.url = ref.url ?? pickFirstString(payload.audio?.audioUrl, payload.audio?.url);
    ref.mimeType = ref.mimeType ?? pickFirstString(payload.audio?.mimeType, payload.audio?.mimetype);
    const seconds =
      typeof payload.audio?.seconds === 'number'
        ? payload.audio.seconds
        : typeof payload.audio?.duration === 'number'
        ? payload.audio.duration
        : typeof payload.audio?.length === 'number'
        ? payload.audio.length
        : undefined;
    if (typeof seconds === 'number') {
      ref.durationSeconds = seconds;
    }
    ref.caption = ref.caption ?? pickFirstString(payload.audio?.caption, payload?.caption);
    if (typeof payload.audio?.viewOnce === 'boolean') {
      ref.viewOnce = payload.audio.viewOnce;
    }
  }

  if (payload?.document) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'document';
    ref.url = ref.url ?? pickFirstString(payload.document?.documentUrl, payload.document?.url);
    ref.mimeType = ref.mimeType ?? pickFirstString(payload.document?.mimeType, payload.document?.mimetype);
    ref.caption =
      ref.caption ?? pickFirstString(payload.document?.title, payload.document?.fileName, payload?.caption);
  }

  if (payload?.sticker) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'sticker';
    ref.url = ref.url ?? pickFirstString(payload.sticker?.stickerUrl, payload.sticker?.url);
    ref.mimeType = ref.mimeType ?? pickFirstString(payload.sticker?.mimeType, payload.sticker?.mimetype);
  }

  if (payload?.location?.thumbnailUrl) {
    const ref = ensureMedia();
    ref.type = ref.type ?? 'location';
    ref.url = ref.url ?? payload.location.thumbnailUrl;
  }

  const fallbackMediaUrl = pickFirstString(
    payload?.image?.imageUrl,
    payload?.image?.thumbnailUrl,
    payload?.video?.videoUrl,
    payload?.audio?.audioUrl,
    payload?.document?.documentUrl,
    payload?.sticker?.stickerUrl,
    payload?.buttonsMessage?.imageUrl,
    payload?.buttonsMessage?.videoUrl,
    payload?.location?.thumbnailUrl,
    payload?.statusImage?.imageUrl
  );

  if (fallbackMediaUrl) {
    const ref = ensureMedia();
    ref.url = ref.url ?? fallbackMediaUrl;
  }

  if (!text) {
    if (payload?.reaction?.value) {
      text = `Reação: ${payload.reaction.value}`;
    } else if (payload?.notification) {
      const notificationType = normalizeNotificationType(payload.notification);
      ensureMetadata().notificationType = notificationType;
      text = describeNotificationMessage(notificationType) ?? 'Notificação recebida';
    } else if (payload?.poll?.question) {
      const options = Array.isArray(payload?.poll?.options)
        ? payload.poll.options.map((opt: any) => opt?.name).filter(Boolean).join(', ')
        : undefined;
      text = options ? `Enquete: ${payload.poll.question} (opções: ${options})` : `Enquete: ${payload.poll.question}`;
    } else if (payload?.pollVote?.options) {
      const votes = Array.isArray(payload.pollVote.options)
        ? payload.pollVote.options.map((opt: any) => opt?.name).filter(Boolean).join(', ')
        : undefined;
      text = votes ? `Voto em enquete: ${votes}` : 'Voto em enquete';
    } else if (payload?.contact?.displayName) {
      text = `Contato compartilhado: ${payload.contact.displayName}`;
    } else if (payload?.location?.name || payload?.location?.address) {
      const name = payload.location?.name ? `${payload.location.name}` : 'Localização';
      const address = payload.location?.address ? ` - ${payload.location.address}` : '';
      text = `${name}${address}`;
    } else if (media?.type === 'audio' || payload?.audio) {
      const duration =
        typeof media?.durationSeconds === 'number'
          ? `${Math.round(media.durationSeconds)}s`
          : typeof payload?.audio?.seconds === 'number'
          ? `${payload.audio.seconds}s`
          : '';
      text = duration ? `Áudio recebido (${duration})` : 'Áudio recebido';
    } else if (media?.type === 'video' || payload?.video) {
      const duration =
        typeof media?.durationSeconds === 'number'
          ? `${Math.round(media.durationSeconds)}s`
          : typeof payload?.video?.seconds === 'number'
          ? `${payload.video.seconds}s`
          : '';
      text = duration ? `Vídeo recebido (${duration})` : 'Vídeo recebido';
    } else if (media?.type === 'image' || payload?.image) {
      text = 'Imagem recebida';
    } else if (payload?.document?.fileName || payload?.document?.title) {
      const name = payload.document?.fileName || payload.document?.title;
      text = name ? `Documento recebido: ${name}` : 'Documento recebido';
    } else if (payload?.sticker) {
      text = 'Sticker recebido';
    } else if (payload?.order?.orderTitle) {
      text = `Pedido recebido: ${payload.order.orderTitle}`;
    } else if (payload?.reviewAndPay?.referenceId) {
      text = `Pedido enviado (${payload.reviewAndPay.referenceId})`;
    } else if (payload?.carouselMessage?.text) {
      text = payload.carouselMessage.text;
    } else if (payload?.statusImage) {
      text = 'Resposta de status';
      ensureMetadata().isStatusReply = true;
    } else {
      text = 'Mensagem recebida';
    }
  }

  const normalizedText = text || 'Mensagem recebida';
  const normalizedMedia = media && (media.url || media.type || media.caption || typeof media.durationSeconds === 'number') ? media : undefined;

  return { text: normalizedText, media: normalizedMedia };
}

async function upsertConversation(
  supabase: SupabaseTypedClient,
  payload: any,
  messageId: string,
  overrides: Partial<{
    messageType: 'sent' | 'received';
    readStatus: boolean;
    timestamp: string;
    phoneNumber: string | null;
    media?: MediaDetails;
    text?: string;
  }> = {}
): Promise<EventProcessingResult> {
  const normalizedPhone =
    overrides.phoneNumber ?? normalizePhoneNumber(payload?.phone || payload?.senderPhone || payload?.connectedPhone);

  const { text: derivedText, media: derivedMedia } = describePayload(payload);
  const chosenMedia = overrides.media ?? derivedMedia;
  const chosenText = overrides.text ?? derivedText ?? 'Mensagem recebida';
  const messageType: 'sent' | 'received' = overrides.messageType ?? (payload?.fromMe ? 'sent' : 'received');
  const readStatus =
    typeof overrides.readStatus === 'boolean'
      ? overrides.readStatus
      : READ_STATUSES.has(String(payload?.status ?? '').toUpperCase()) || messageType === 'sent';
  const timestamp =
    overrides.timestamp ??
    (typeof payload?.momment === 'number' ? new Date(payload.momment).toISOString() : new Date().toISOString());

  const senderName = extractSenderName(payload);
  const isGroupChat = detectGroupChat(payload, normalizedPhone);
  const chatName = extractChatName(payload, senderName, isGroupChat);
  const senderPhoto = extractSenderPhoto(payload);

  const baseRecord = {
    phone_number: normalizedPhone ?? 'unknown',
    message_id: messageId,
    message_text: chosenText || 'Mensagem recebida',
    message_type: messageType,
    timestamp,
    read_status: readStatus,
    media_url: chosenMedia?.url ?? null,
    media_type: chosenMedia?.type ?? null,
    media_mime_type: chosenMedia?.mimeType ?? null,
    media_duration_seconds:
      typeof chosenMedia?.durationSeconds === 'number' ? Math.round(chosenMedia.durationSeconds) : null,
    media_thumbnail_url: chosenMedia?.thumbnailUrl ?? null,
    media_caption: chosenMedia?.caption ?? null,
    media_view_once: typeof chosenMedia?.viewOnce === 'boolean' ? chosenMedia.viewOnce : null,
  };

  const insertRecord = {
    ...baseRecord,
    sender_name: senderName ?? null,
    chat_name: chatName ?? null,
    sender_photo: senderPhoto ?? null,
  };

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) {
      const updateRecord: Record<string, any> = {
        phone_number: baseRecord.phone_number,
        message_text: baseRecord.message_text,
        message_type: baseRecord.message_type,
        timestamp: baseRecord.timestamp,
        read_status: baseRecord.read_status,
        media_url: baseRecord.media_url,
        media_type: baseRecord.media_type,
        media_mime_type: baseRecord.media_mime_type,
        media_duration_seconds: baseRecord.media_duration_seconds,
        media_thumbnail_url: baseRecord.media_thumbnail_url,
        media_caption: baseRecord.media_caption,
        media_view_once: baseRecord.media_view_once,
      };

      if (senderName) {
        updateRecord.sender_name = senderName;
      }
      if (chatName) {
        updateRecord.chat_name = chatName;
      }
      if (senderPhoto) {
        updateRecord.sender_photo = senderPhoto;
      }

      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update(updateRecord)
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      return { messageId, status: 'updated' };
    }

    const { error: insertError } = await supabase.from('whatsapp_conversations').insert(insertRecord);
    if (insertError) {
      throw insertError;
    }

    return { messageId, status: 'inserted' };
  } catch (error: any) {
    console.error('Erro ao processar mensagem do WhatsApp:', error);
    return { messageId, status: 'skipped', reason: error?.message ?? 'Erro desconhecido' };
  }
}

async function handleReceivedCallback(
  supabase: SupabaseTypedClient,
  payload: any,
  messageId: string
): Promise<EventProcessingResult> {
  return upsertConversation(supabase, payload, messageId, {
    messageType: payload?.fromMe ? 'sent' : 'received',
  });
}

async function handleDeliveryCallback(
  supabase: SupabaseTypedClient,
  payload: any,
  messageId: string
): Promise<EventProcessingResult> {
  return { messageId, status: 'skipped', reason: 'Delivery callbacks ignored' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'GET' && path.endsWith('/health')) {
    return respond({ status: 'ok', timestamp: new Date().toISOString(), service: 'whatsapp-webhook' });
  }

  if (req.method !== 'POST') {
    return respond({ success: false, error: 'Método não permitido' }, { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (error) {
    console.error('Erro ao ler payload do webhook:', error);
    return respond({ success: false, error: 'Payload inválido' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Variáveis de ambiente do Supabase ausentes');
    return respond({ success: false, error: 'Configuração do Supabase ausente' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const events = Array.isArray(payload) ? payload : [payload];
  const results: EventProcessingResult[] = [];

  for (const event of events) {
    const messageId =
      pickFirstString(event?.messageId, event?.id, event?.zaapId, crypto.randomUUID()) ?? crypto.randomUUID();
    const eventType = String(event?.type ?? '').toUpperCase();

    if (!messageId) {
      results.push({ messageId: 'unknown', status: 'skipped', reason: 'messageId ausente' });
      continue;
    }

    if (eventType === 'DELIVERYCALLBACK' || path.includes('on-message-send')) {
      const result = await handleDeliveryCallback(supabase, event, messageId);
      results.push(result);
      continue;
    }

    if (eventType === 'RECEIVEDCALLBACK' || path.includes('on-message-received')) {
      const result = await handleReceivedCallback(supabase, event, messageId);
      results.push(result);
      continue;
    }

    // Se não conseguimos identificar o tipo, tentar tratar como mensagem recebida por padrão
    const fallbackResult = await handleReceivedCallback(supabase, event, messageId);
    results.push({ ...fallbackResult, reason: fallbackResult.reason ?? undefined });
  }

  const processed = results.filter((result) => result.status !== 'skipped').length;
  const skipped = results.length - processed;

  return respond({ success: true, processed, skipped, results });
});
