/* eslint-disable @typescript-eslint/no-explicit-any */

type MessagePayload = Record<string, any>;

const cleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toRecord = (value: unknown): MessagePayload | null =>
  value && typeof value === 'object' ? (value as MessagePayload) : null;

const isPlaceholderBody = (body: string, type: string): boolean => {
  const normalized = body.trim().toLowerCase();
  if (!normalized) return false;

  if (
    normalized === '[hsm]' ||
    normalized === '[interactive]' ||
    normalized === '[reply]' ||
    normalized === '[system]' ||
    normalized === '[unknown]' ||
    normalized === '[story]' ||
    normalized === '[link_preview]' ||
    normalized === '[call]'
  ) {
    return true;
  }

  return Boolean(type) && normalized === `[${type}]`;
};

const extractContentBody = (content: unknown): string | null => {
  const payload = toRecord(content);
  if (!payload) return null;

  const bodyText = cleanText(payload.body);
  if (bodyText) return bodyText;

  const captionText = cleanText(payload.caption);
  if (captionText) return captionText;

  const textValue = cleanText(payload.text);
  if (textValue) return textValue;

  const titleText = cleanText(payload.title);
  if (titleText) return titleText;

  const descriptionText = cleanText(payload.description);
  if (descriptionText) return descriptionText;

  const urlText = cleanText(payload.url);
  if (urlText) return urlText;

  return null;
};

const extractReplyBody = (payload: MessagePayload): string | null => {
  const buttonsReplyTitle = cleanText(payload?.reply?.buttons_reply?.title);
  if (buttonsReplyTitle) {
    return `Resposta: ${buttonsReplyTitle}`;
  }

  const listReplyTitle = cleanText(payload?.reply?.list_reply?.title);
  const listReplyDescription = cleanText(payload?.reply?.list_reply?.description);

  if (listReplyTitle && listReplyDescription) {
    return `Resposta: ${listReplyTitle} - ${listReplyDescription}`;
  }

  if (listReplyTitle) {
    return `Resposta: ${listReplyTitle}`;
  }

  return null;
};

const extractInteractiveBody = (payload: MessagePayload): string | null => {
  const interactive =
    payload?.interactive && typeof payload.interactive === 'object'
      ? payload.interactive
      : payload?.type === 'interactive'
        ? payload
        : null;

  if (!interactive) return null;

  const bodyText = cleanText(interactive?.body?.text ?? interactive?.body);
  if (bodyText) return bodyText;

  const headerText = cleanText(interactive?.header?.text ?? interactive?.header);
  const footerText = cleanText(interactive?.footer?.text ?? interactive?.footer);

  const buttonTitles = (Array.isArray(interactive?.action?.buttons) ? interactive.action.buttons : [])
    .map((button: unknown) => {
      const buttonRecord = toRecord(button);
      return cleanText(buttonRecord?.title ?? buttonRecord?.text);
    })
    .filter(Boolean);

  const listLabel = cleanText(interactive?.action?.list?.label ?? interactive?.action?.list?.button);
  const listRows = (Array.isArray(interactive?.action?.list?.sections) ? interactive.action.list.sections : [])
    .flatMap((section: unknown) => {
      const sectionRecord = toRecord(section);
      return Array.isArray(sectionRecord?.rows) ? sectionRecord.rows : [];
    })
    .map((row: unknown) => {
      const rowRecord = toRecord(row);
      return cleanText(rowRecord?.title);
    })
    .filter(Boolean);

  const summaryParts = [headerText, footerText, listLabel, ...buttonTitles.slice(0, 2), ...listRows.slice(0, 2)]
    .filter(Boolean);

  if (summaryParts.length > 0) {
    return `Interativo: ${summaryParts.join(' - ')}`;
  }

  return null;
};

const extractHsmBody = (payload: MessagePayload): string | null => {
  const hsm =
    payload?.hsm && typeof payload.hsm === 'object'
      ? payload.hsm
      : payload?.context?.quoted_type === 'hsm' && payload?.context?.quoted_content
        ? payload.context.quoted_content
        : null;

  if (!hsm) return null;

  const bodyText = cleanText(hsm?.body ?? hsm?.description);
  if (bodyText) return bodyText;

  const headerText = cleanText(hsm?.header?.text ?? hsm?.header ?? hsm?.title);
  const footerText = cleanText(hsm?.footer);
  const buttonTexts = (Array.isArray(hsm?.buttons) ? hsm.buttons : [])
    .map((button: unknown) => {
      const buttonRecord = toRecord(button);
      return cleanText(buttonRecord?.text ?? buttonRecord?.title);
    })
    .filter(Boolean);

  const summaryParts = [headerText, footerText, ...buttonTexts.slice(0, 2)].filter(Boolean);
  if (summaryParts.length > 0) {
    return `Template: ${summaryParts.join(' - ')}`;
  }

  return null;
};

const extractLinkPreviewBody = (payload: MessagePayload): string | null => {
  const linkPreview =
    payload?.link_preview && typeof payload.link_preview === 'object'
      ? payload.link_preview
      : payload?.type === 'link_preview'
        ? payload
        : null;

  if (!linkPreview) return null;

  const bodyText = cleanText(linkPreview.body);
  if (bodyText && bodyText !== '[link_preview]') return bodyText;

  const titleText = cleanText(linkPreview.title);
  if (titleText) return titleText;

  const descriptionText = cleanText(linkPreview.description);
  if (descriptionText) return descriptionText;

  const urlText = cleanText(linkPreview.url || linkPreview.link || linkPreview.canonical);
  if (urlText) return urlText;

  return '[Link]';
};

const extractEditedActionBody = (payload: MessagePayload): string | null => {
  const actionType = cleanText(payload?.action?.type).toLowerCase();
  if (actionType !== 'edit' && actionType !== 'edited') {
    return null;
  }

  const editedType = cleanText(payload?.action?.edited_type).toLowerCase();
  const editedContentBody = extractContentBody(payload?.action?.edited_content);
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

const extractSystemBody = (payload: MessagePayload): string | null => {
  const directBody = cleanText(payload?.system?.body);
  if (directBody) {
    return directBody;
  }

  const subtype = cleanText(payload?.subtype).toLowerCase();
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

const extractStoryBody = (payload: MessagePayload): string | null => {
  if (cleanText(payload?.type).toLowerCase() !== 'story') {
    return null;
  }

  const textBody = cleanText(payload?.text?.body);
  if (textBody) return textBody;

  const linkPreviewBody = extractLinkPreviewBody(payload);
  if (linkPreviewBody) return linkPreviewBody;

  if (payload?.action?.type === 'delete') {
    return '[Status apagado]';
  }

  return '[Status]';
};

export const resolveWhatsAppMessageBody = (message: {
  body?: string | null;
  type?: string | null;
  payload?: unknown;
}): string | null => {
  const body = cleanText(message.body);
  const type = cleanText(message.type).toLowerCase();
  const shouldExtract = !body || isPlaceholderBody(body, type) || /^reagiu com\s*$/i.test(body);

  if (!shouldExtract) {
    return body;
  }

  const payload = message.payload && typeof message.payload === 'object' ? (message.payload as MessagePayload) : {};

  const replyBody = extractReplyBody(payload);
  if (replyBody) return replyBody;

  const interactiveBody = extractInteractiveBody(payload);
  if (interactiveBody) return interactiveBody;

  const hsmBody = extractHsmBody(payload);
  if (hsmBody) return hsmBody;

  const editedActionBody = extractEditedActionBody(payload);
  if (editedActionBody) return editedActionBody;

  const linkPreviewBody = extractLinkPreviewBody(payload);
  if (linkPreviewBody) return linkPreviewBody;

  const systemBody = extractSystemBody(payload);
  if (type === 'system' || systemBody !== '[Evento do WhatsApp]') {
    return systemBody;
  }

  const storyBody = extractStoryBody(payload);
  if (storyBody) return storyBody;

  const actionType = cleanText(payload?.action?.type).toLowerCase();
  if (actionType === 'reaction' && !cleanText(payload?.action?.emoji)) {
    return '[Reação removida]';
  }

  if (type === 'call') return '[Ligação do WhatsApp]';
  if (type === 'revoked') return '[Mensagem apagada]';
  if (type === 'unknown') return '[Mensagem não suportada]';
  if (type === 'story') return '[Status]';
  if (type === 'link_preview') return '[Link]';

  return body || null;
};
