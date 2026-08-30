export type WhapiWebhookMessagePatch = {
  trigger: Record<string, unknown> | null;
  beforeUpdate: Record<string, unknown> | null;
  afterUpdate: Record<string, unknown>;
  changes: string[];
};

export type WhapiWebhookMessageItem = {
  message: Record<string, unknown>;
  receipt: Record<string, unknown>;
  patch: WhapiWebhookMessagePatch | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asRecords = (value: unknown): Array<Record<string, unknown>> => (
  Array.isArray(value) ? value.filter(isRecord) : []
);

const looksLikeMessage = (value: Record<string, unknown>): boolean => Boolean(
  toTrimmedString(value.id)
  && (
    toTrimmedString(value.chat_id)
    || toTrimmedString(value.from)
    || toTrimmedString(value.to)
    || isRecord(value.chat)
  )
);

const extractRegularMessages = (payload: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(payload)) {
    return asRecords(payload);
  }

  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.messages)) {
    return asRecords(payload.messages);
  }

  if (isRecord(payload.message)) {
    return [payload.message];
  }

  if (Array.isArray(payload.data)) {
    return asRecords(payload.data);
  }

  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data.messages)) {
      return asRecords(payload.data.messages);
    }

    if (isRecord(payload.data.message)) {
      return [payload.data.message];
    }

    // A Whapi permite configurar o body do webhook. Em alguns formatos o
    // objeto da mensagem vem diretamente em `data`, sem `data.message`.
    if (looksLikeMessage(payload.data)) {
      return [payload.data];
    }
  }

  // Também tolera o corpo customizado contendo diretamente a mensagem. O
  // endpoint ainda exige os campos mínimos acima para não confundir eventos
  // de status/canal com mensagens.
  if (looksLikeMessage(payload)) {
    return [payload];
  }

  return [];
};

const extractPatchMessages = (payload: unknown): WhapiWebhookMessageItem[] => {
  if (!isRecord(payload) || !Array.isArray(payload.messages_updates)) {
    return [];
  }

  return payload.messages_updates.flatMap((rawUpdate) => {
    if (!isRecord(rawUpdate) || !isRecord(rawUpdate.after_update)) {
      return [];
    }

    const trigger = isRecord(rawUpdate.trigger) ? rawUpdate.trigger : null;
    const beforeUpdate = isRecord(rawUpdate.before_update) ? rawUpdate.before_update : null;
    const changes = Array.isArray(rawUpdate.changes)
      ? rawUpdate.changes.map(toTrimmedString).filter(Boolean)
      : [];

    return [{
      message: rawUpdate.after_update,
      receipt: trigger ?? rawUpdate,
      patch: {
        trigger,
        beforeUpdate,
        afterUpdate: rawUpdate.after_update,
        changes,
      },
    }];
  });
};

export const extractWhapiWebhookMessageItems = (payload: unknown): WhapiWebhookMessageItem[] => {
  const regularMessages = extractRegularMessages(payload).map((message) => ({
    message,
    receipt: message,
    patch: null,
  }));

  return [...regularMessages, ...extractPatchMessages(payload)];
};

const getMessageIdentifier = (value: Record<string, unknown>): string => (
  toTrimmedString(value.id) || toTrimmedString(value.message_id)
);

const getMessageTimestamp = (value: Record<string, unknown>): string => toTrimmedString(value.timestamp);

export const buildWhapiWebhookMessageReceiptKey = (
  eventAction: string,
  item: WhapiWebhookMessageItem,
): string => {
  const receiptId = getMessageIdentifier(item.receipt);
  const targetMessageId = getMessageIdentifier(item.message);
  const receiptTimestamp = getMessageTimestamp(item.receipt);
  const targetTimestamp = getMessageTimestamp(item.message);

  return `message:${eventAction}:${receiptId || targetMessageId || 'no-id'}:${receiptTimestamp || targetTimestamp || 'no-ts'}`;
};

export const hasWhapiPatchTextChange = (patch: WhapiWebhookMessagePatch | null): boolean => {
  if (!patch) {
    return false;
  }

  return patch.changes.some((rawChange) => {
    const change = rawChange.toLowerCase();
    return ['text', 'body', 'caption', 'content', 'message', 'media_caption'].some((field) => (
      change === field || change.startsWith(`${field}.`) || change.endsWith(`.${field}`)
    ));
  });
};
