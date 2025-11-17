import type { ApiRequest, ApiResponse } from '../types';
import {
  upsertChatRecord,
  insertWhatsappMessage,
  updateWhatsappMessageStatuses,
} from '../../../server/whatsappStorage';
import { resolveOutgoingMessagePhone } from '../../../server/zapiMessageRegistry';

const UNSUPPORTED_MESSAGE_PLACEHOLDER = '[tipo de mensagem não suportado ainda]';

type TextPayload = {
  message?: string | null;
  description?: string | null;
  title?: string | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

type HydratedTemplatePayload = {
  message?: string | null;
  footer?: string | null;
  title?: string | null;
  templateId?: string | null;
  hydratedButtons?: unknown[] | null;
  header?: Record<string, unknown> | null;
};

type ReactionPayload = {
  value?: string | null;
  time?: number | string | null;
  reactionBy?: string | null;
  referencedMessage?: Record<string, unknown> | null;
};

type ButtonsResponseMessagePayload = {
  buttonId?: string | null;
  message?: string | null;
};

type ButtonsMessagePayload = {
  imageUrl?: string | null;
  videoUrl?: string | null;
  message?: string | null;
  buttons?: unknown[] | null;
};

type PixKeyMessagePayload = {
  currency?: string | null;
  referenceId?: string | null;
  key?: string | null;
  keyType?: string | null;
  merchantName?: string | null;
};

type ListResponseMessagePayload = {
  message?: string | null;
  title?: string | null;
  selectedRowId?: string | null;
};

type CarouselCardPayload = {
  header?: Record<string, unknown> | null;
  message?: string | null;
  footer?: string | null;
  title?: string | null;
  hydratedButtons?: unknown[] | null;
};

type CarouselMessagePayload = {
  text?: string | null;
  cards?: CarouselCardPayload[] | null;
};

type ExternalAdReplyPayload = {
  title?: string | null;
  body?: string | null;
  mediaType?: number | string | null;
  thumbnailUrl?: string | null;
  sourceType?: string | null;
};

type ImagePayload = {
  mimeType?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  viewOnce?: boolean | null;
};

type AudioPayload = {
  ptt?: boolean | null;
  seconds?: number | null;
  audioUrl?: string | null;
  mimeType?: string | null;
  viewOnce?: boolean | null;
};

type VideoPayload = {
  videoUrl?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  seconds?: number | null;
  viewOnce?: boolean | null;
};

type ContactPayload = {
  displayName?: string | null;
  vCard?: string | null;
  phones?: string[] | null;
};

type DocumentPayload = {
  documentUrl?: string | null;
  mimeType?: string | null;
  title?: string | null;
  pageCount?: number | null;
  fileName?: string | null;
  caption?: string | null;
};

type LocationPayload = {
  longitude?: number | null;
  latitude?: number | null;
  address?: string | null;
  name?: string | null;
  url?: string | null;
};

type StickerPayload = {
  stickerUrl?: string | null;
  mimeType?: string | null;
};

type RequestPaymentPayload = {
  value?: number | string | null;
  currencyCode?: string | null;
  expiration?: number | string | null;
  requestPhone?: string | null;
  paymentInfo?: {
    receiverPhone?: string | null;
    value?: number | string | null;
    currencyCode?: string | null;
    status?: string | null;
    transactionStatus?: string | null;
  } | null;
};

type SendPaymentPayload = {
  paymentInfo?: {
    receiverPhone?: string | null;
    value?: number | string | null;
    currencyCode?: string | null;
    status?: string | null;
    transactionStatus?: string | null;
  } | null;
};

type OrderPayload = {
  itemCount?: number | null;
  orderId?: string | null;
  message?: string | null;
  orderTitle?: string | null;
  sellerJid?: string | null;
  thumbnailUrl?: string | null;
  token?: string | null;
  currency?: string | null;
  total?: number | null;
  subTotal?: number | null;
  products?: Array<Record<string, unknown>> | null;
};

type ProductPayload = {
  productImage?: string | null;
  currencyCode?: string | null;
  productId?: string | null;
  description?: string | null;
  title?: string | null;
};

type PollPayload = {
  question?: string | null;
  pollMaxOptions?: number | null;
  options?: Array<{ name?: string | null }> | null;
};

type PollVotePayload = {
  pollMessageId?: string | null;
  options?: Array<{ name?: string | null }> | null;
};

type ReviewAndPayPayload = {
  type?: string | null;
  currency?: string | null;
  referenceId?: string | null;
  orderRequestId?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  total?: number | null;
  subTotal?: number | null;
  discount?: number | null;
  shipping?: number | null;
  tax?: number | null;
  products?: Array<Record<string, unknown>> | null;
};

type ReviewOrderPayload = {
  currency?: string | null;
  referenceId?: string | null;
  orderRequestId?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  total?: number | null;
  subTotal?: number | null;
  discount?: number | null;
  shipping?: number | null;
  tax?: number | null;
  products?: Array<Record<string, unknown>> | null;
};

type NewsletterAdminInvitePayload = {
  newsletterId?: string | null;
  newsletterName?: string | null;
  text?: string | null;
  inviteExpiration?: number | string | null;
};

type PinMessagePayload = {
  action?: string | null;
  pinDurationInSecs?: number | null;
  referencedMessage?: Record<string, unknown> | null;
};

type EventPayload = {
  name?: string | null;
  description?: string | null;
  canceled?: boolean | null;
  joinLink?: string | null;
  scheduleTime?: number | string | null;
  location?: Record<string, unknown> | null;
};

type EventResponsePayload = {
  response?: string | null;
  responseFrom?: string | null;
  time?: number | string | null;
  referencedMessage?: Record<string, unknown> | null;
};

type NewsletterNotificationPayload =
  | 'NEWSLETTER_ADMIN_PROMOTE'
  | 'NEWSLETTER_ADMIN_DEMOTE'
  | string;

type ZapiPayload = {
  type?: string;
  phone?: string;
  ids?: (string | number | null | undefined)[] | null;
  id?: string | number | null;
  fromMe?: boolean;
  momment?: number | string | null;
  status?: string | null;
  chatName?: string | null;
  senderName?: string | null;
  senderPhoto?: string | null;
  messageId?: string | null;
  text?: TextPayload | null;
  hydratedTemplate?: HydratedTemplatePayload | null;
  reaction?: ReactionPayload | null;
  buttonsResponseMessage?: ButtonsResponseMessagePayload | null;
  buttonsMessage?: ButtonsMessagePayload | null;
  pixKeyMessage?: PixKeyMessagePayload | null;
  listResponseMessage?: ListResponseMessagePayload | null;
  carouselMessage?: CarouselMessagePayload | null;
  externalAdReply?: ExternalAdReplyPayload | null;
  image?: ImagePayload | null;
  audio?: AudioPayload | null;
  video?: VideoPayload | null;
  contact?: ContactPayload | null;
  document?: DocumentPayload | null;
  location?: LocationPayload | null;
  sticker?: StickerPayload | null;
  requestPayment?: RequestPaymentPayload | null;
  sendPayment?: SendPaymentPayload | null;
  order?: OrderPayload | null;
  product?: ProductPayload | null;
  poll?: PollPayload | null;
  pollVote?: PollVotePayload | null;
  reviewAndPay?: ReviewAndPayPayload | null;
  reviewOrder?: ReviewOrderPayload | null;
  newsletterAdminInvite?: NewsletterAdminInvitePayload | null;
  pinMessage?: PinMessagePayload | null;
  event?: EventPayload | null;
  eventResponse?: EventResponsePayload | null;
  notification?: NewsletterNotificationPayload | null;
  notificationParameters?: unknown;
  requestMethod?: string | null;
  isGroup?: boolean;
  waitingMessage?: boolean;
  profileName?: string | null;
  updatedPhoto?: string | null;
  productMessage?: Record<string, unknown> | null;
  [key: string]: any;
};

const ensureJson = (rawBody: unknown): ZapiPayload => {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody) as ZapiPayload;
    } catch (_error) {
      return {};
    }
  }

  if (typeof rawBody === 'object') {
    return rawBody as ZapiPayload;
  }

  return {};
};

const parseMoment = (value: number | string | null | undefined): Date | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const numericValue = typeof value === 'string' ? Number(value) : value;

  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) {
    return null;
  }

  return new Date(numericValue);
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toNonEmptyStringLike = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return toNonEmptyString(value);
};

const toNonEmptyStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => toNonEmptyStringLike(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const normalizeStatusValue = (value: unknown): string | null => {
  const status = toNonEmptyString(value);
  return status ? status.toUpperCase() : null;
};

const resolveStatusWebhookIds = (payload: ZapiPayload): string[] => {
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  const combined = [...ids, payload.id].filter((entry) => entry !== null && entry !== undefined);
  const uniqueIds = new Set<string>();

  for (const entry of combined) {
    if (typeof entry === 'string') {
      const normalized = entry.trim();
      if (normalized) {
        uniqueIds.add(normalized);
      }
    } else if (typeof entry === 'number' && Number.isFinite(entry)) {
      uniqueIds.add(entry.toString());
    }
  }

  return Array.from(uniqueIds);
};

const formatWithCurrency = (value: number | string | null | undefined, currency: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const valueString = typeof value === 'number' ? value.toString() : toNonEmptyString(value)?.toString();

  if (!valueString) {
    return null;
  }

  const currencyString = toNonEmptyString(currency);
  return currencyString ? `${valueString} ${currencyString}` : valueString;
};

const resolveCallNotificationText = (payload: ZapiPayload): string | null => {
  const notification = toNonEmptyString(payload?.notification);

  if (!notification) {
    return null;
  }

  switch (notification) {
    case 'CALL_VOICE':
      return 'Chamada recebida';
    case 'CALL_MISSED_VOICE':
      return 'Chamada perdida';
    default:
      return null;
  }
};

const resolveMembershipRequestMethodText = (method: string | null): string | null => {
  if (!method) {
    return null;
  }

  switch (method) {
    case 'invite_link':
      return 'via link de convite';
    case 'non_admin_add':
      return 'adicionado por participante';
    default:
      return method;
  }
};

const resolveNotificationText = (payload: ZapiPayload): string | null => {
  const notification = toNonEmptyString(payload?.notification);

  if (!notification) {
    return null;
  }

  const parameters = toNonEmptyStringArray(payload?.notificationParameters);
  const participantsText = parameters.length ? parameters.join(', ') : null;

  if (notification === 'MEMBERSHIP_APPROVAL_REQUEST') {
    const requestMethod = resolveMembershipRequestMethodText(toNonEmptyString(payload.requestMethod));
    const details = [requestMethod, participantsText ? `participante(s): ${participantsText}` : null]
      .filter(Boolean)
      .join(' - ');
    return details
      ? `Solicitação de aprovação para novo membro - ${details}`
      : 'Solicitação de aprovação para novo membro';
  }

  if (notification === 'REVOKED_MEMBERSHIP_REQUESTS') {
    return participantsText
      ? `Solicitação de participação revogada: ${participantsText}`
      : 'Solicitações de participação revogadas';
  }

  if (notification === 'NEWSLETTER_ADMIN_PROMOTE' || notification === 'NEWSLETTER_ADMIN_DEMOTE') {
    const [targetParticipant, role] = parameters;
    const participantText = targetParticipant ?? 'Participante do canal';
    const roleText = role ?? (notification === 'NEWSLETTER_ADMIN_PROMOTE' ? 'ADMIN' : 'SUBSCRIBER');
    const actionText = notification === 'NEWSLETTER_ADMIN_PROMOTE' ? 'promovido' : 'rebaixado';

    return `${participantText} ${actionText}${roleText ? ` para ${roleText}` : ''} no canal`;
  }

  if (notification.startsWith('GROUP_PARTICIPANT_')) {
    switch (notification) {
      case 'GROUP_PARTICIPANT_INVITE':
        return participantsText
          ? `Convite enviado para participar do grupo: ${participantsText}`
          : 'Convite enviado para participar do grupo';
      case 'GROUP_PARTICIPANT_ADD':
        return participantsText
          ? `Novo participante adicionado ao grupo: ${participantsText}`
          : 'Novo participante adicionado ao grupo';
      case 'GROUP_PARTICIPANT_LINK_JOIN':
        return participantsText
          ? `Entrada no grupo via link de convite: ${participantsText}`
          : 'Entrada no grupo via link de convite';
      case 'GROUP_PARTICIPANT_LEAVE':
        return participantsText
          ? `Participante saiu do grupo: ${participantsText}`
          : 'Participante saiu do grupo';
      case 'GROUP_PARTICIPANT_REMOVE':
        return participantsText
          ? `Participante removido do grupo: ${participantsText}`
          : 'Participante removido do grupo';
      case 'GROUP_PARTICIPANT_PROMOTE':
        return participantsText
          ? `Participante promovido a admin do grupo: ${participantsText}`
          : 'Participante promovido a admin do grupo';
      case 'GROUP_PARTICIPANT_DEMOTE':
        return participantsText
          ? `Participante rebaixado para membro do grupo: ${participantsText}`
          : 'Participante rebaixado para membro do grupo';
      default:
        return participantsText
          ? `Atualização de participantes do grupo: ${participantsText}`
          : 'Atualização de participantes do grupo';
    }
  }

  return `Notificação: ${notification}`;
};

const resolveMessageText = (payload: ZapiPayload): string => {
  const resolvers: Array<() => string | null> = [
    () => toNonEmptyString(payload?.text?.message),
    () => toNonEmptyString(payload?.hydratedTemplate?.message),
    () => {
      const value = toNonEmptyString(payload?.reaction?.value);
      return value ? `Reação: ${value}` : null;
    },
    () => {
      const message = toNonEmptyString(payload?.buttonsResponseMessage?.message);
      const buttonId = toNonEmptyString(payload?.buttonsResponseMessage?.buttonId);
      if (message || buttonId) {
        return `Resposta de botão: ${message ?? buttonId}`;
      }
      return null;
    },
    () => {
      const pixKey = toNonEmptyString(payload?.pixKeyMessage?.key);
      if (pixKey) {
        const keyType = toNonEmptyString(payload?.pixKeyMessage?.keyType);
        return `Chave Pix recebida${keyType ? ` (${keyType})` : ''}: ${pixKey}`;
      }
      return null;
    },
    () => {
      const message = toNonEmptyString(payload?.buttonsMessage?.message);
      if (message) {
        return `Mensagem com botões: ${message}`;
      }
      const hasButtons = Array.isArray(payload?.buttonsMessage?.buttons) && payload?.buttonsMessage?.buttons?.length > 0;
      if (hasButtons) {
        return 'Mensagem com botões recebida';
      }
      return null;
    },
    () => {
      const message = toNonEmptyString(payload?.listResponseMessage?.message);
      const title = toNonEmptyString(payload?.listResponseMessage?.title);
      const selectedRowId = toNonEmptyString(payload?.listResponseMessage?.selectedRowId);
      if (message || title || selectedRowId) {
        return `Resposta de lista: ${message ?? title ?? selectedRowId}`;
      }
      return null;
    },
    () => {
      const carouselText = toNonEmptyString(payload?.carouselMessage?.text);
      if (carouselText) {
        return `Mensagem carrossel: ${carouselText}`;
      }
      const firstCard = payload?.carouselMessage?.cards?.[0];
      const cardMessage = toNonEmptyString(firstCard?.message) ?? toNonEmptyString(firstCard?.title);
      return cardMessage ? `Mensagem carrossel: ${cardMessage}` : null;
    },
    () => {
      const adBody = toNonEmptyString(payload?.externalAdReply?.body);
      const adTitle = toNonEmptyString(payload?.externalAdReply?.title);
      if (adBody || adTitle) {
        return `Mensagem de anúncio: ${adBody ?? adTitle}`;
      }
      return null;
    },
    () => {
      if (!payload?.image) {
        return null;
      }
      const caption = toNonEmptyString(payload.image.caption);
      return `Imagem recebida${caption ? ` - ${caption}` : ''}`;
    },
    () => {
      const seconds = payload?.audio?.seconds ?? payload?.audio?.duration;
      const secondsText = typeof seconds === 'number' && Number.isFinite(seconds) ? ` (${seconds}s)` : '';
      return payload?.audio ? `Áudio recebido${secondsText}` : null;
    },
    () => {
      if (!payload?.video) {
        return null;
      }
      const caption = toNonEmptyString(payload.video.caption);
      return `Vídeo recebido${caption ? ` - ${caption}` : ''}`;
    },
    () => {
      const displayName = toNonEmptyString(payload?.contact?.displayName);
      return payload?.contact ? `Contato recebido${displayName ? `: ${displayName}` : ''}` : null;
    },
    () => {
      if (!payload?.document) {
        return null;
      }
      const title = toNonEmptyString(payload.document.title);
      const fileName = toNonEmptyString(payload.document.fileName);
      return `Documento recebido${title || fileName ? `: ${title ?? fileName}` : ''}`;
    },
    () => {
      if (!payload?.location) {
        return null;
      }
      const name = toNonEmptyString(payload.location.name);
      const address = toNonEmptyString(payload.location.address);
      const description = name ?? address;
      return `Localização recebida${description ? `: ${description}` : ''}`;
    },
    () => (payload?.sticker ? 'Figurinha recebida' : null),
    () => {
      if (!payload?.requestPayment) {
        return null;
      }
      const formatted =
        formatWithCurrency(payload.requestPayment.value, payload.requestPayment.currencyCode) ??
        formatWithCurrency(
          payload.requestPayment.paymentInfo?.value ?? null,
          payload.requestPayment.paymentInfo?.currencyCode ?? null,
        );
      return formatted ? `Solicitação de pagamento: ${formatted}` : 'Solicitação de pagamento recebida';
    },
    () => {
      if (!payload?.sendPayment?.paymentInfo) {
        return null;
      }
      const paymentInfo = payload.sendPayment.paymentInfo;
      const formatted = formatWithCurrency(paymentInfo.value ?? null, paymentInfo.currencyCode ?? null);
      const status = toNonEmptyString(paymentInfo.status) ?? toNonEmptyString(paymentInfo.transactionStatus);
      const details = [formatted, status].filter(Boolean).join(' - ');
      return details ? `Pagamento recebido: ${details}` : 'Pagamento recebido';
    },
    () => {
      if (!payload?.order) {
        return null;
      }
      const title = toNonEmptyString(payload.order.orderTitle);
      const itemCount = typeof payload.order.itemCount === 'number' ? payload.order.itemCount : null;
      const countText = itemCount !== null ? ` (${itemCount} itens)` : '';
      return `Carrinho recebido${title ? `: ${title}` : ''}${countText}`;
    },
    () => {
      const productTitle = toNonEmptyString(payload?.product?.title);
      return productTitle ? `Produto recebido: ${productTitle}` : payload?.product ? 'Produto recebido' : null;
    },
    () => {
      if (!payload?.poll) {
        return null;
      }
      const question = toNonEmptyString(payload.poll.question);
      return `Enquete${question ? `: ${question}` : ''}`;
    },
    () => {
      if (!payload?.pollVote || !Array.isArray(payload.pollVote.options)) {
        return null;
      }
      const optionNames = payload.pollVote.options
        .map((option) => toNonEmptyString(option?.name))
        .filter((name): name is string => Boolean(name));
      const optionsText = optionNames.length ? optionNames.join(', ') : null;
      return optionsText ? `Resposta de enquete: ${optionsText}` : 'Resposta de enquete recebida';
    },
    () => {
      if (!payload?.reviewAndPay) {
        return null;
      }
      const referenceId = toNonEmptyString(payload.reviewAndPay.referenceId);
      const status = toNonEmptyString(payload.reviewAndPay.orderStatus) ?? toNonEmptyString(payload.reviewAndPay.paymentStatus);
      const pieces = [referenceId, status].filter(Boolean);
      return pieces.length ? `Pedido enviado: ${pieces.join(' - ')}` : 'Pedido enviado';
    },
    () => {
      if (!payload?.reviewOrder) {
        return null;
      }
      const referenceId = toNonEmptyString(payload.reviewOrder.referenceId);
      const status = toNonEmptyString(payload.reviewOrder.orderStatus) ?? toNonEmptyString(payload.reviewOrder.paymentStatus);
      const pieces = [referenceId, status].filter(Boolean);
      return pieces.length ? `Atualização de pedido: ${pieces.join(' - ')}` : 'Atualização de pedido';
    },
    () => {
      if (!payload?.newsletterAdminInvite) {
        return null;
      }
      const newsletterName = toNonEmptyString(payload.newsletterAdminInvite.newsletterName);
      return `Convite para administrador de canal${newsletterName ? `: ${newsletterName}` : ''}`;
    },
    () => {
      if (!payload?.pinMessage) {
        return null;
      }
      const action = toNonEmptyString(payload.pinMessage.action);
      if (action === 'unpin') {
        return 'Mensagem desafixada';
      }
      return 'Mensagem fixada';
    },
    () => {
      if (!payload?.event) {
        return null;
      }
      const name = toNonEmptyString(payload.event.name);
      return `Evento${name ? `: ${name}` : ''}`;
    },
    () => {
      if (!payload?.eventResponse) {
        return null;
      }
      const response = toNonEmptyString(payload.eventResponse.response);
      return `Resposta de evento${response ? `: ${response}` : ''}`;
    },
    () => (payload.waitingMessage ? 'Aguardando mensagem' : null),
    () => {
      const profileName = toNonEmptyString(payload.profileName);
      return profileName ? `Nome do WhatsApp atualizado: ${profileName}` : null;
    },
    () => (payload.updatedPhoto ? 'Foto do WhatsApp atualizada' : null),
    () => resolveCallNotificationText(payload),
    () => resolveNotificationText(payload),
  ];

  for (const resolver of resolvers) {
    const result = resolver();
    if (result && result.trim().length > 0) {
      return result;
    }
  }

  return UNSUPPORTED_MESSAGE_PLACEHOLDER;
};

const handleMessageStatusCallback = async (
  payload: ZapiPayload,
  res: ApiResponse,
  options?: { statusIds?: string[]; normalizedStatus?: string | null },
) => {
  const messageIds = options?.statusIds ?? resolveStatusWebhookIds(payload);
  const normalizedStatus = options?.normalizedStatus ?? normalizeStatusValue(payload.status);
  const isStatusPayload = payload.type === 'MessageStatusCallback' || messageIds.length > 0;

  if (!isStatusPayload) {
    return res.status(200).json({ success: true, ignored: true });
  }

  if (!normalizedStatus || messageIds.length === 0) {
    return res.status(400).json({ error: 'Campos status e ids são obrigatórios' });
  }

  try {
    const { updated, missingIds } = await updateWhatsappMessageStatuses(messageIds, normalizedStatus);
    return res.status(200).json({ success: true, status: normalizedStatus, updated, missingIds });
  } catch (error: any) {
    console.error('Erro ao atualizar status de mensagens da Z-API:', error);
    return res.status(500).json({ error: 'Falha ao processar status da mensagem' });
  }
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const payload = ensureJson(req.body);

  console.info('Z-API received webhook payload:', payload);

  const statusIds = resolveStatusWebhookIds(payload);
  const normalizedStatus = normalizeStatusValue(payload.status);

  if (payload.type === 'MessageStatusCallback' || statusIds.length > 0) {
    return handleMessageStatusCallback(payload, res, {
      statusIds,
      normalizedStatus,
    });
  }

  if (payload.type !== 'ReceivedCallback') {
    return res.status(200).json({ success: true, ignored: true });
  }

  let phone = typeof payload.phone === 'string' ? payload.phone : undefined;
  const messageId = typeof payload.messageId === 'string' ? payload.messageId : undefined;
  const isFromMe = payload.fromMe === true;

  if (isFromMe && messageId) {
    const resolvedPhone = resolveOutgoingMessagePhone(messageId);

    if (resolvedPhone) {
      console.info('Resolved WhatsApp phone from send payload', {
        messageId,
        originalPhone: phone,
        resolvedPhone,
      });
      phone = resolvedPhone;
    } else {
      console.warn('Received fromMe webhook without matching send payload', {
        messageId,
        originalPhone: phone,
      });
    }
  }

  if (!phone) {
    return res.status(400).json({ error: 'Campo phone é obrigatório' });
  }

  const messageText = resolveMessageText(payload);
  const momentDate = parseMoment(payload.momment) ?? new Date();
  const isGroup = payload.isGroup === true || phone.endsWith('-group');
  const chatName = payload.chatName ?? payload.senderName ?? phone;
  const senderPhoto = payload.senderPhoto ?? null;
  const resolvedSenderPhoto = isGroup ? undefined : senderPhoto;

  try {
    const chat = await upsertChatRecord({
      phone,
      chatName,
      isGroup,
      senderPhoto: resolvedSenderPhoto,
      lastMessageAt: momentDate,
      lastMessagePreview: messageText,
    });

    const message = await insertWhatsappMessage({
      chatId: chat.id,
      messageId: messageId ?? null,
      fromMe: isFromMe,
      status: typeof payload.status === 'string' ? payload.status : null,
      text: messageText,
      moment: momentDate,
      rawPayload: payload as Record<string, any>,
    });

    return res.status(200).json({ success: true, chat, message });
  } catch (error: any) {
    console.error('Erro ao processar webhook da Z-API:', error);
    return res.status(500).json({ error: 'Falha ao processar webhook' });
  }
}
