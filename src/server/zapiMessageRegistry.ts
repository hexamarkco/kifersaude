const MESSAGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type OutgoingMessageRecord = {
  phone: string;
  storedAt: number;
};

const outgoingMessageRecords = new Map<string, OutgoingMessageRecord>();

const cleanupExpiredEntries = () => {
  const now = Date.now();

  for (const [messageId, record] of outgoingMessageRecords.entries()) {
    if (now - record.storedAt > MESSAGE_TTL_MS) {
      outgoingMessageRecords.delete(messageId);
    }
  }
};

export const rememberOutgoingMessagePhone = (messageId: string, phone: string) => {
  if (!messageId || !phone) {
    return;
  }

  cleanupExpiredEntries();
  outgoingMessageRecords.set(messageId, { phone, storedAt: Date.now() });
};

export const resolveOutgoingMessagePhone = (messageId: string): string | undefined => {
  if (!messageId) {
    return undefined;
  }

  cleanupExpiredEntries();
  const record = outgoingMessageRecords.get(messageId);

  if (!record) {
    return undefined;
  }

  // refresh storedAt to keep the record available for subsequent callbacks
  outgoingMessageRecords.set(messageId, { ...record, storedAt: Date.now() });
  return record.phone;
};
