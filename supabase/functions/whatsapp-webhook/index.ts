import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const READ_STATUSES = new Set(['READ', 'PLAYED']);

type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'received'
  | 'read'
  | 'read_by_me'
  | 'played'
  | 'failed';

const DELIVERY_STATUS_PRECEDENCE: Record<DeliveryStatus, number> = {
  pending: 0,
  sent: 1,
  received: 2,
  read: 3,
  played: 4,
  read_by_me: 1,
  failed: 5,
};

function normalizeDeliveryStatus(value: unknown): DeliveryStatus | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    switch (normalized.replace(/\s+/g, '_')) {
      case 'pending':
      case 'waiting':
      case 'sending':
        return 'pending';
      case 'sent':
        return 'sent';
      case 'delivered':
      case 'delivery':
      case 'received':
        return 'received';
      case 'read':
      case 'seen':
      case 'viewed':
        return 'read';
      case 'played':
        return 'played';
      case 'read_by_me':
        return 'read_by_me';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return null;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    if (normalized <= -1) {
      return 'failed';
    }
    switch (normalized) {
      case 0:
        return 'pending';
      case 1:
        return 'sent';
      case 2:
        return 'received';
      case 3:
        return 'read';
      case 4:
        return 'played';
      default:
        return null;
    }
  }

  return null;
}

function normalizeStatusTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Math.trunc(value);
    const millis = normalized > 1_000_000_000_000 ? normalized : normalized * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

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

  const lowerTrimmed = trimmed.toLowerCase();
  if (/@lid\b|\blid@|:lid\b|\blid:/.test(lowerTrimmed)) {
    return null;
  }
  if (lowerTrimmed.includes('-group') || lowerTrimmed.includes('@g.us')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return trimmed.includes('@') ? trimmed : null;
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function extractNormalizedPhoneNumber(payload: any): string | null {
  const candidatePhones: string[] = [];
  const seenCandidates = new Set<string>();

  const pushNormalized = (value: unknown) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    if (typeof candidate !== 'string') {
      return;
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized && !seenCandidates.has(normalized)) {
      candidatePhones.push(normalized);
      seenCandidates.add(normalized);
    }
  };

  const addCandidate = (value: unknown) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => addCandidate(entry));
      return;
    }

    pushNormalized(value);
  };

  const candidateValues: unknown[] = [
    payload?.senderPhone,
    payload?.sender?.phone,
    payload?.sender?.jid,
    payload?.participantPhone,
    payload?.participant?.phone,
    payload?.participant?.jid,
    payload?.contact?.phone,
    payload?.contact?.waid,
    payload?.contact?.jid,
    payload?.contact?.id,
    payload?.message?.participant,
    payload?.message?.key?.participant,
    payload?.contextInfo?.participant,
    payload?.phone,
    payload?.phoneNumber,
    payload?.chatPhone,
    payload?.remotePhone,
    payload?.receiverPhone,
    payload?.recipientPhone,
    payload?.targetPhone,
    payload?.to,
    payload?.from,
    payload?.whatsapp,
    payload?.contactPhone,
    payload?.chatId,
    payload?.remoteJid,
    payload?.jid,
    payload?.participant,
    payload?.groupId,
    payload?.groupJid,
    payload?.conversationId,
    payload?.chat?.id,
    payload?.chat?.jid,
    payload?.chat?.phone,
    payload?.message?.phone,
    payload?.message?.chatId,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.to,
    payload?.message?.from,
    payload?.message?.key?.remoteJid,
    payload?.contextInfo?.remoteJid,
  ];

  candidateValues.forEach((value) => addCandidate(value));

  const connectedValues: unknown[] = [
    payload?.connectedPhone,
    payload?.instancePhone,
    payload?.sessionPhone,
    payload?.connected?.phone,
    payload?.instance?.phone,
    payload?.session?.phone,
    payload?.me,
    payload?.me?.id,
    payload?.me?.jid,
    payload?.me?.phone,
    payload?.user?.id,
    payload?.user?.jid,
    payload?.owner?.id,
    payload?.account?.phone,
    payload?.account?.jid,
    payload?.profile?.jid,
  ];

  if (payload?.fromMe) {
    connectedValues.push(payload?.senderPhone, payload?.from, payload?.message?.from);
  }

  const connectedNumbers = new Set<string>();
  connectedValues.forEach((value) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized) {
      connectedNumbers.add(normalized);
    }
  });

  if (payload?.fromMe && connectedNumbers.size > 0) {
    for (const candidate of candidatePhones) {
      if (!connectedNumbers.has(candidate)) {
        return candidate;
      }
    }
  }

  if (candidatePhones.length > 0) {
    return candidatePhones[0];
  }

  if (!payload?.fromMe && connectedNumbers.size > 0) {
    return Array.from(connectedNumbers)[0] ?? null;
  }

  return null;
}

function extractNormalizedTargetPhone(payload: any): string | null {
  const candidateValues: unknown[] = [
    payload?.targetPhone,
    payload?.phone,
    payload?.phoneNumber,
    payload?.remotePhone,
    payload?.receiverPhone,
    payload?.recipientPhone,
    payload?.chatPhone,
    payload?.to,
    payload?.chatId,
    payload?.jid,
    payload?.message?.to,
    payload?.message?.chatId,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.key?.remoteJid,
    payload?.participantPhone,
    payload?.participant?.phone,
    payload?.participant?.jid,
  ];

  const connectedValues: unknown[] = [
    payload?.connectedPhone,
    payload?.instancePhone,
    payload?.sessionPhone,
    payload?.connected?.phone,
    payload?.instance?.phone,
    payload?.session?.phone,
    payload?.me,
    payload?.me?.id,
    payload?.me?.jid,
    payload?.me?.phone,
    payload?.user?.id,
    payload?.user?.jid,
    payload?.owner?.id,
    payload?.account?.phone,
    payload?.account?.jid,
    payload?.profile?.jid,
  ];

  const connectedNumbers = new Set<string>();
  connectedValues.forEach((value) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized) {
      connectedNumbers.add(normalized);
    }
  });

  for (const value of candidateValues) {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    if (typeof candidate !== 'string') {
      continue;
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized && !connectedNumbers.has(normalized)) {
      return normalized;
    }
  }

  const forcedPayload = payload?.fromMe ? payload : { ...payload, fromMe: true };
  const fallback = extractNormalizedPhoneNumber(forcedPayload);
  if (fallback && !connectedNumbers.has(fallback)) {
    return fallback;
  }

  return null;
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
    targetPhone: string | null;
    media?: MediaDetails;
    text?: string;
    deliveryStatus: DeliveryStatus | null;
    deliveryStatusUpdatedAt: string | null;
  }> = {}
): Promise<EventProcessingResult> {
  const targetPhoneOverrideRaw = overrides.targetPhone;
  let normalizedTargetPhone: string | null = null;
  let hasTargetPhoneOverride = false;

  if (typeof targetPhoneOverrideRaw === 'string' && targetPhoneOverrideRaw.trim()) {
    hasTargetPhoneOverride = true;
    normalizedTargetPhone = normalizePhoneNumber(targetPhoneOverrideRaw) ?? targetPhoneOverrideRaw.trim();
  }

  const normalizedPhone =
    overrides.phoneNumber ?? extractNormalizedPhoneNumber(payload) ?? normalizePhoneNumber(payload?.connectedPhone);

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

  const normalizedOverrideStatus =
    overrides.deliveryStatus === null
      ? null
      : overrides.deliveryStatus ?? normalizeDeliveryStatus(payload?.status);
  const normalizedStatus =
    normalizedOverrideStatus ?? (messageType === 'sent' ? 'pending' : messageType === 'received' ? 'received' : null);
  const normalizedStatusTimestamp =
    overrides.deliveryStatusUpdatedAt === null
      ? null
      : overrides.deliveryStatusUpdatedAt ??
        normalizeStatusTimestamp(payload?.statusMomment ?? payload?.momment) ??
        (normalizedStatus ? timestamp : null);

  const senderName = extractSenderName(payload);
  const basePhoneNumber = messageType === 'sent' && normalizedTargetPhone ? normalizedTargetPhone : normalizedPhone;
  const isGroupChat = detectGroupChat(payload, basePhoneNumber ?? normalizedPhone);
  const chatName = extractChatName(payload, senderName, isGroupChat);
  const senderPhoto = extractSenderPhoto(payload);

  const baseRecord = {
    phone_number: basePhoneNumber ?? 'unknown',
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
    delivery_status: normalizedStatus ?? null,
    delivery_status_updated_at: normalizedStatusTimestamp ?? null,
    target_phone: normalizedTargetPhone ?? null,
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
      .select('id, delivery_status, delivery_status_updated_at, read_status, target_phone')
      .eq('message_id', messageId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) {
      const updateRecord: Record<string, any> = {
        message_text: baseRecord.message_text,
        message_type: baseRecord.message_type,
        timestamp: baseRecord.timestamp,
        read_status: baseRecord.read_status || existing.read_status,
        media_url: baseRecord.media_url,
        media_type: baseRecord.media_type,
        media_mime_type: baseRecord.media_mime_type,
        media_duration_seconds: baseRecord.media_duration_seconds,
        media_thumbnail_url: baseRecord.media_thumbnail_url,
        media_caption: baseRecord.media_caption,
        media_view_once: baseRecord.media_view_once,
      };

      const chosenTargetPhone = normalizedTargetPhone ?? existing.target_phone ?? null;
      if (baseRecord.message_type === 'sent' && chosenTargetPhone) {
        updateRecord.phone_number = chosenTargetPhone;
      } else {
        updateRecord.phone_number = baseRecord.phone_number;
      }

      if (hasTargetPhoneOverride && normalizedTargetPhone) {
        updateRecord.target_phone = normalizedTargetPhone;
      }

      if (typeof normalizedStatus === 'string') {
        const existingStatus = normalizeDeliveryStatus(existing.delivery_status);
        const shouldUpdateStatus =
          !existingStatus ||
          overrides.deliveryStatus !== undefined ||
          DELIVERY_STATUS_PRECEDENCE[normalizedStatus] >= DELIVERY_STATUS_PRECEDENCE[existingStatus];

        if (shouldUpdateStatus) {
          updateRecord.delivery_status = normalizedStatus;
          updateRecord.delivery_status_updated_at =
            normalizedStatusTimestamp ?? existing.delivery_status_updated_at ?? new Date().toISOString();
        }
      }

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
  const targetPhone = extractNormalizedTargetPhone(payload);
  const normalizedPhone =
    targetPhone ?? extractNormalizedPhoneNumber(payload?.fromMe ? payload : { ...payload, fromMe: true }) ?? null;

  const overrides: NonNullable<Parameters<typeof upsertConversation>[3]> = {
    messageType: 'sent',
    phoneNumber: normalizedPhone,
  };

  if (targetPhone) {
    overrides.targetPhone = targetPhone;
  }

  return upsertConversation(supabase, payload?.fromMe ? payload : { ...payload, fromMe: true }, messageId, overrides);
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
