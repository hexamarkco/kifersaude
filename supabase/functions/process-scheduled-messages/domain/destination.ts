export type ScheduledChatIdentity = {
  displayName?: string | null;
  savedContactName?: string | null;
};

export const resolveScheduledDestinationDisplayName = (params: {
  chat: ScheduledChatIdentity | null;
  scheduledDisplayName?: string | null;
  phoneDigits: string;
  isGroup: boolean;
}) => {
  if (params.isGroup) return 'Grupo';

  return [
    params.chat?.savedContactName,
    params.chat?.displayName,
    params.scheduledDisplayName,
    params.phoneDigits,
  ]
    .map((value) => String(value ?? '').trim())
    .find(Boolean) ?? 'Contato';
};
