import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  normalizePhoneNumber,
  extractNormalizedPhoneNumber,
  extractNormalizedTargetPhone,
} from './phoneNumbers.ts';
import { ensurePeerAssociation, type PeerResolution } from './peers.ts';

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

function pickFirstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function joinNonEmptyParts(parts: (string | null | undefined)[], separator: string = ' • '): string | null {
  const filtered = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part): part is string => Boolean(part));

  return filtered.length > 0 ? filtered.join(separator) : null;
}

function formatCurrencyValue(value: unknown, currencyCode?: string | null): string | null {
  let amount: number | null = null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    amount = value;
  } else if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(',', '.'));
    if (Number.isFinite(normalized)) {
      amount = normalized;
    }
  }

  if (amount === null) {
    return null;
  }

  const normalizedCurrency = typeof currencyCode === 'string' && currencyCode.trim() ? currencyCode.trim().toUpperCase() : null;

  try {
    if (normalizedCurrency) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: normalizedCurrency }).format(amount);
    }
  } catch (error) {
    console.warn('Não foi possível formatar valor monetário:', error);
  }

  return normalizedCurrency ? `${normalizedCurrency} ${amount}` : String(amount);
}

function formatTimestamp(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const milliseconds = value > 1e12 ? value : value * 1000;

  try {
    return new Date(milliseconds).toLocaleString('pt-BR');
  } catch {
    return new Date(milliseconds).toISOString();
  }
}

function normalizeNotificationType(notification: unknown): string | null {
  const normalizeString = (value: string | null | undefined): string | null => {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : null;
  };

  if (typeof notification === 'string') {
    return normalizeString(notification);
  }

  if (typeof notification === 'number' && Number.isFinite(notification)) {
    return String(notification);
  }

  if (Array.isArray(notification)) {
    for (const item of notification) {
      const normalized = normalizeNotificationType(item);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (notification && typeof notification === 'object') {
    const candidateKeys = ['type', 'notificationType', 'notification', 'name', 'code', 'event'];
    for (const key of candidateKeys) {
      const candidate = (notification as Record<string, unknown>)[key];
      const normalized = normalizeNotificationType(candidate);
      if (normalized) {
        return normalized;
      }
    }

    if (typeof (notification as { toString?: () => string }).toString === 'function') {
      const representation = (notification as { toString: () => string }).toString();
      const normalized = normalizeString(representation);
      if (normalized && normalized !== '[OBJECT OBJECT]') {
        return normalized;
      }
    }
  }

  return null;
}

const NOTIFICATION_DESCRIPTIONS: Record<string, string> = {
  MEMBERSHIP_APPROVAL_REQUEST: 'Solicitação de entrada no grupo recebida',
  REVOKED_MEMBERSHIP_REQUESTS: 'Solicitação de entrada cancelada pelo participante',
  GROUP_PARTICIPANT_ADD: 'Participante adicionado ao grupo',
  GROUP_PARTICIPANT_REMOVE: 'Participante removido do grupo',
  GROUP_PARTICIPANT_LEAVE: 'Participante saiu do grupo',
  GROUP_CREATE: 'Grupo criado',
  GROUP_PARTICIPANT_INVITE: 'Convite de grupo enviado',
  CALL_VOICE: 'Chamada de voz recebida',
  CALL_MISSED_VOICE: 'Chamada de voz perdida',
  CALL_MISSED_VIDEO: 'Chamada de vídeo perdida',
  E2E_ENCRYPTED: 'Mensagens protegidas com criptografia de ponta a ponta',
  CIPHERTEXT: 'Mensagens protegidas com criptografia de ponta a ponta',
  BLUE_MSG_SELF_PREMISE_UNVERIFIED: 'Conta comercial não verificada pelo WhatsApp',
  BLUE_MSG_SELF_PREMISE_VERIFIED: 'Conta comercial verificada pelo WhatsApp',
  BIZ_MOVE_TO_CONSUMER_APP: 'Conta comercial convertida em conta pessoal',
  REVOKE: 'Uma mensagem foi apagada',
  NEWSLETTER_ADMIN_PROMOTE: 'Administrador promovido no canal',
  NEWSLETTER_ADMIN_DEMOTE: 'Administrador removido do canal',
  PROFILE_NAME_UPDATED: 'Nome do perfil atualizado',
  PROFILE_PICTURE_UPDATED: 'Foto do perfil atualizada',
  CHAT_LABEL_ASSOCIATION: 'Etiquetas do chat foram atualizadas',
  PAYMENT_ACTION_REQUEST_DECLINED: 'Pedido de pagamento recusado',
};

function describeNotificationMessage(type: string | null): string | null {
  if (!type) {
    return null;
  }

  const normalized = type.toUpperCase();

  if (NOTIFICATION_DESCRIPTIONS[normalized]) {
    return NOTIFICATION_DESCRIPTIONS[normalized];
  }

  const formatted = normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');

  return formatted || normalized;
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
    pickFirstString(
      payload?.buttonsResponseMessage?.message,
      payload?.listResponseMessage?.message,
      payload?.buttonsMessage?.message
    ),
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
    payload?.statusImage?.imageUrl,
    payload?.product?.productImage,
    payload?.order?.thumbnailUrl,
    payload?.externalAdReply?.thumbnailUrl,
    payload?.hydratedTemplate?.header?.image?.imageUrl,
    payload?.hydratedTemplate?.header?.image?.thumbnailUrl
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
    } else if (payload?.waitingMessage === true) {
      text = 'Mensagem aguardando confirmação do WhatsApp';
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
    } else if (payload?.buttonsMessage) {
      const buttonCount = Array.isArray(payload.buttonsMessage?.buttons) ? payload.buttonsMessage.buttons.length : 0;
      const summary = joinNonEmptyParts([
        'Mensagem com botões',
        pickFirstString(payload.buttonsMessage?.message),
        buttonCount > 0 ? `${buttonCount} botão${buttonCount > 1 ? 'es' : ''}` : null,
      ]);
      text = summary ?? 'Mensagem com botões';
    } else if (payload?.listResponseMessage) {
      const response = payload.listResponseMessage;
      const summary = joinNonEmptyParts([
        'Resposta de lista',
        pickFirstString(response?.title) ? `Lista: ${pickFirstString(response?.title)}` : null,
        pickFirstString(response?.message),
        pickFirstString(response?.selectedRowId) ? `Opção ID: ${pickFirstString(response?.selectedRowId)}` : null,
      ]);
      text = summary ?? 'Resposta de lista recebida';
    } else if (payload?.hydratedTemplate) {
      const template = payload.hydratedTemplate;
      const buttonCount = Array.isArray(template?.hydratedButtons) ? template.hydratedButtons.length : 0;
      const headerLocation = template?.header?.location
        ? joinNonEmptyParts([
            pickFirstString(template.header.location?.name),
            pickFirstString(template.header.location?.address),
          ])
        : null;
      const summary = joinNonEmptyParts([
        'Template recebido',
        headerLocation ? `Local: ${headerLocation}` : null,
        pickFirstString(template?.header?.text, template?.header?.title, template?.header?.subtitle),
        pickFirstString(template?.title),
        pickFirstString(template?.message),
        pickFirstString(template?.footer),
        buttonCount > 0 ? `${buttonCount} botão${buttonCount > 1 ? 'es' : ''}` : null,
      ]);
      text = summary ?? 'Template recebido';
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
    } else if (payload?.pixKeyMessage) {
      const pix = payload.pixKeyMessage;
      const summary = joinNonEmptyParts([
        'Chave PIX recebida',
        pix?.key ? `Chave: ${pix.key}` : null,
        pix?.keyType ? `Tipo: ${pix.keyType}` : null,
        pix?.referenceId ? `Referência: ${pix.referenceId}` : null,
        pix?.merchantName ? `Nome: ${pix.merchantName}` : null,
        pix?.currency ? `Moeda: ${pix.currency}` : null,
      ]);
      text = summary ?? 'Chave PIX recebida';
    } else if (payload?.product) {
      const product = payload.product;
      const summary = joinNonEmptyParts([
        'Produto recebido',
        pickFirstString(product?.title, product?.description),
        product?.price ? `Preço: ${formatCurrencyValue(product.price, product.currencyCode)}` : null,
        product?.url ? `Link: ${product.url}` : null,
      ]);
      text = summary ?? 'Produto recebido';
    } else if (payload?.order?.orderTitle) {
      const order = payload.order;
      const summary = joinNonEmptyParts([
        'Pedido recebido',
        order?.orderTitle,
        typeof order?.itemCount === 'number' ? `${order.itemCount} item(s)` : null,
        order?.total ? `Total: ${formatCurrencyValue(order.total, order.currency)}` : null,
      ]);
      text = summary ?? `Pedido recebido: ${payload.order.orderTitle}`;
    } else if (payload?.reviewAndPay?.referenceId) {
      const review = payload.reviewAndPay;
      const summary = joinNonEmptyParts([
        'Pedido enviado',
        review?.referenceId ? `Referência: ${review.referenceId}` : null,
        review?.orderStatus ? `Status: ${review.orderStatus}` : null,
        review?.paymentStatus ? `Pagamento: ${review.paymentStatus}` : null,
        review?.total ? `Total: ${formatCurrencyValue(review.total, review.currency)}` : null,
      ]);
      text = summary ?? `Pedido enviado (${payload.reviewAndPay.referenceId})`;
    } else if (payload?.reviewOrder?.referenceId || payload?.reviewOrder?.orderStatus) {
      const review = payload.reviewOrder;
      const summary = joinNonEmptyParts([
        'Atualização de pedido',
        review?.referenceId ? `Referência: ${review.referenceId}` : null,
        review?.orderStatus ? `Status: ${review.orderStatus}` : null,
        review?.paymentStatus ? `Pagamento: ${review.paymentStatus}` : null,
        review?.total ? `Total: ${formatCurrencyValue(review.total, review.currency)}` : null,
      ]);
      text = summary ?? 'Atualização de pedido';
    } else if (payload?.requestPayment) {
      const request = payload.requestPayment;
      const expiration = formatTimestamp(request?.expiration);
      const summary = joinNonEmptyParts([
        'Solicitação de pagamento',
        request?.value ? `Valor: ${formatCurrencyValue(request.value, request.currencyCode)}` : null,
        request?.requestPhone ? `Solicitante: ${request.requestPhone}` : null,
        expiration ? `Expira em: ${expiration}` : null,
        request?.paymentInfo?.status ? `Status: ${request.paymentInfo.status}` : null,
      ]);
      text = summary ?? 'Solicitação de pagamento';
    } else if (payload?.sendPayment?.paymentInfo) {
      const info = payload.sendPayment?.paymentInfo;
      const summary = joinNonEmptyParts([
        'Pagamento recebido',
        info?.value ? `Valor: ${formatCurrencyValue(info.value, info.currencyCode)}` : null,
        info?.transactionStatus ? `Status: ${info.transactionStatus}` : null,
        info?.receiverPhone ? `Destinatário: ${info.receiverPhone}` : null,
      ]);
      text = summary ?? 'Pagamento recebido';
    } else if (payload?.carouselMessage?.text) {
      const carousel = payload.carouselMessage;
      const cardCount = Array.isArray(carousel?.cards) ? carousel.cards.length : 0;
      const summary = joinNonEmptyParts([
        'Mensagem em carrossel',
        pickFirstString(carousel?.text),
        cardCount > 0 ? `${cardCount} cartão${cardCount > 1 ? 's' : ''}` : null,
      ]);
      text = summary ?? payload.carouselMessage.text;
    } else if (payload?.externalAdReply) {
      const ad = payload.externalAdReply;
      const summary = joinNonEmptyParts([
        'Mensagem de anúncio',
        pickFirstString(ad?.title),
        pickFirstString(ad?.body),
        pickFirstString(ad?.sourceUrl),
      ]);
      text = summary ?? 'Mensagem de anúncio recebida';
    } else if (payload?.event?.name || payload?.event?.description) {
      const event = payload.event;
      const schedule = formatTimestamp(event?.scheduleTime);
      const summary = joinNonEmptyParts([
        'Evento no grupo',
        pickFirstString(event?.name),
        event?.description,
        schedule ? `Agendado para: ${schedule}` : null,
        event?.joinLink ? `Link: ${event.joinLink}` : null,
      ]);
      text = summary ?? 'Evento recebido';
    } else if (payload?.eventResponse?.response) {
      const response = payload.eventResponse;
      const summary = joinNonEmptyParts([
        'Resposta ao evento',
        response?.response,
        response?.responseFrom ? `De: ${response.responseFrom}` : null,
      ]);
      text = summary ?? 'Resposta ao evento';
    } else if (payload?.newsletterAdminInvite) {
      const invite = payload.newsletterAdminInvite;
      const summary = joinNonEmptyParts([
        'Convite para administrador de canal',
        invite?.newsletterName,
        invite?.text,
      ]);
      text = summary ?? 'Convite para administrador de canal';
    } else if (payload?.pinMessage) {
      const pin = payload.pinMessage;
      const action = pin?.action === 'unpin' ? 'Mensagem desafixada' : 'Mensagem fixada';
      const summary = joinNonEmptyParts([
        action,
        typeof pin?.pinDurationInSecs === 'number' ? `Duração: ${pin.pinDurationInSecs}s` : null,
      ]);
      text = summary ?? action;
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

  if (typeof targetPhoneOverrideRaw === 'string' && targetPhoneOverrideRaw.trim()) {
    normalizedTargetPhone = normalizePhoneNumber(targetPhoneOverrideRaw) ?? targetPhoneOverrideRaw.trim();
  }

  let normalizedPhone =
    overrides.phoneNumber !== undefined
      ? overrides.phoneNumber
      : extractNormalizedPhoneNumber(payload) ?? normalizePhoneNumber(payload?.connectedPhone);

  const messageType: 'sent' | 'received' = overrides.messageType ?? (payload?.fromMe ? 'sent' : 'received');

  if (!normalizedTargetPhone && messageType === 'sent') {
    const extractedTarget = extractNormalizedTargetPhone(payload);
    if (extractedTarget) {
      normalizedTargetPhone = extractedTarget;
    }
  }

  const basePhoneCandidate =
    messageType === 'sent' && normalizedTargetPhone ? normalizedTargetPhone : normalizedPhone;

  const isGroupChat = detectGroupChat(payload, basePhoneCandidate ?? normalizedPhone);

  let peerResolution: PeerResolution | null = null;

  if (!isGroupChat) {
    try {
      peerResolution = await ensurePeerAssociation({
        supabase,
        payload,
        normalizedPhone: normalizedPhone ?? null,
        normalizedTargetPhone: normalizedTargetPhone ?? null,
        isGroupChat,
      });
    } catch (peerError) {
      console.warn('Não foi possível garantir vínculo de peer para conversa do WhatsApp:', peerError);
    }

    if (peerResolution?.canonicalPhone) {
      normalizedPhone = peerResolution.canonicalPhone;
      if (messageType === 'sent' || !normalizedTargetPhone) {
        normalizedTargetPhone = peerResolution.canonicalPhone;
      }
    }

    if (!normalizedTargetPhone && peerResolution?.normalizedChatLid) {
      normalizedTargetPhone = peerResolution.normalizedChatLid;
    }
  }

  const { text: derivedText, media: derivedMedia } = describePayload(payload);
  const chosenMedia = overrides.media ?? derivedMedia;
  const overrideText = typeof overrides.text === 'string' ? overrides.text : undefined;
  const derivedTextValue = typeof derivedText === 'string' ? derivedText : undefined;
  const rawChosenText = overrideText ?? derivedTextValue;
  const normalizedChosenText = rawChosenText?.trim();
  const hasMeaningfulText = Boolean(normalizedChosenText);
  const chosenText = hasMeaningfulText ? rawChosenText! : null;
  const fallbackText = chosenText ?? 'Mensagem recebida';
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
  const chatName = extractChatName(payload, senderName, isGroupChat);
  const senderPhoto = extractSenderPhoto(payload);

  const baseRecord = {
    phone_number: basePhoneNumber ?? 'unknown',
    message_id: messageId,
    message_text: fallbackText,
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
      .select('id, delivery_status, delivery_status_updated_at, read_status, target_phone, message_text')
      .eq('message_id', messageId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    if (existing) {
      const updateRecord: Record<string, any> = {
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

      if (hasMeaningfulText || !existing.message_text) {
        updateRecord.message_text = baseRecord.message_text;
      }

      const chosenTargetPhone = normalizedTargetPhone ?? existing.target_phone ?? null;
      if (baseRecord.message_type === 'sent' && chosenTargetPhone) {
        updateRecord.phone_number = chosenTargetPhone;
      } else {
        updateRecord.phone_number = baseRecord.phone_number;
      }

      if (normalizedTargetPhone && normalizedTargetPhone !== existing.target_phone) {
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
  const basePayload = { ...payload };

  return upsertConversation(supabase, basePayload, messageId);
}

async function handleDeliveryCallback(
  supabase: SupabaseTypedClient,
  payload: any,
  messageId: string
): Promise<EventProcessingResult> {
  const targetPhone = extractNormalizedTargetPhone(payload);
  const basePayload = payload?.fromMe ? { ...payload } : { ...payload, fromMe: true };
  const normalizedCandidate = extractNormalizedPhoneNumber(basePayload);
  const normalizedPhone = targetPhone ?? normalizedCandidate ?? null;

  const overrides: NonNullable<Parameters<typeof upsertConversation>[3]> = {
    messageType: 'sent',
    phoneNumber: normalizedPhone,
  };

  if (targetPhone) {
    overrides.targetPhone = targetPhone;
  }

  if (normalizedPhone === null) {
    delete basePayload.connectedPhone;
  }

  return upsertConversation(supabase, basePayload, messageId, overrides);
}

export { normalizePhoneNumber, extractNormalizedPhoneNumber, extractNormalizedTargetPhone };

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function') {
  Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === 'GET' && path.endsWith('/health')) {
      return respond({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'whatsapp-webhook',
      });
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

    try {
      console.log('Webhook do WhatsApp recebido:', {
        method: req.method,
        path,
        payload,
      });
    } catch (logError) {
      console.error('Erro ao registrar payload do webhook:', logError);
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

    let eventIndex = 0;
    for (const event of events) {
      const currentIndex = eventIndex++;
      console.log('Processando webhook event:', {
        index: currentIndex,
        type: event?.type,
        fromMe: event?.fromMe,
        payload: event,
      });
      const messageId =
        pickFirstString(event?.messageId, event?.id, event?.zaapId, crypto.randomUUID()) ??
        crypto.randomUUID();
      const eventType = String(event?.type ?? '').toUpperCase();

      if (!messageId) {
        results.push({ messageId: 'unknown', status: 'skipped', reason: 'messageId ausente' });
        continue;
      }

      if (eventType === 'DELIVERYCALLBACK' || path.includes('on-message-send')) {
        console.log('on-message-send payload:', JSON.stringify(event, null, 2));
        const result = await handleDeliveryCallback(supabase, event, messageId);
        results.push(result);
        continue;
      }

      if (eventType === 'RECEIVEDCALLBACK' || path.includes('on-message-received')) {
        console.log('on-message-received payload:', JSON.stringify(event, null, 2));
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
}
