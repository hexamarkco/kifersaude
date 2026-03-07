type MessagePayload = Record<string, any>;

const cleanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isPlaceholderBody = (body: string, type: string): boolean => {
  const normalized = body.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized === '[hsm]' || normalized === '[interactive]' || normalized === '[reply]') {
    return true;
  }

  return Boolean(type) && normalized === `[${type}]`;
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
    .map((button: any) => cleanText(button?.title ?? button?.text))
    .filter(Boolean);

  const listLabel = cleanText(interactive?.action?.list?.label ?? interactive?.action?.list?.button);
  const listRows = (Array.isArray(interactive?.action?.list?.sections) ? interactive.action.list.sections : [])
    .flatMap((section: any) => (Array.isArray(section?.rows) ? section.rows : []))
    .map((row: any) => cleanText(row?.title))
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
    .map((button: any) => cleanText(button?.text ?? button?.title))
    .filter(Boolean);

  const summaryParts = [headerText, footerText, ...buttonTexts.slice(0, 2)].filter(Boolean);
  if (summaryParts.length > 0) {
    return `Template: ${summaryParts.join(' - ')}`;
  }

  return null;
};

export const resolveWhatsAppMessageBody = (message: {
  body?: string | null;
  type?: string | null;
  payload?: unknown;
}): string | null => {
  const body = cleanText(message.body);
  const type = cleanText(message.type).toLowerCase();
  const shouldExtract = !body || isPlaceholderBody(body, type);

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

  return body || null;
};
