import { supabase } from '../supabase';
import type {
  ComposeEmailPayload,
  EmailAccount,
  EmailFolder,
  EmailMessage,
  EmailProviderId,
  EmailThread,
} from './types';

interface EmailAccountRow {
  id: string;
  provider_id: EmailProviderId;
  email_address: string;
  display_name: string;
  connected_at: string | null;
  status: 'connected' | 'syncing' | 'error' | null;
  is_primary: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
}

interface EmailThreadRow {
  id: string;
  account_id: string;
  subject: string | null;
  preview: string | null;
  updated_at: string | null;
  created_at: string | null;
  unread: boolean | null;
  starred: boolean | null;
  folder: EmailFolder | null;
  participants: EmailParticipantRow[] | null;
  email_messages?: EmailMessageRow[] | null;
}

interface EmailParticipantRow {
  name: string;
  email: string;
}

interface EmailMessageRow {
  id: string;
  thread_id: string;
  account_id: string;
  direction: 'inbound' | 'outbound' | null;
  from_participant: EmailParticipantRow | null;
  to_participants: EmailParticipantRow[] | null;
  cc_participants: EmailParticipantRow[] | null;
  bcc_participants: EmailParticipantRow[] | null;
  subject: string | null;
  body: string | null;
  folder: EmailFolder | null;
  unread: boolean | null;
  sent_at: string | null;
  created_at: string | null;
}

const mapParticipant = (participant: EmailParticipantRow | null | undefined) => {
  if (!participant) {
    return { name: '', email: '' };
  }
  return {
    name: participant.name ?? '',
    email: participant.email ?? '',
  };
};

const mapMessage = (message: EmailMessageRow): EmailMessage => ({
  id: message.id,
  threadId: message.thread_id,
  accountId: message.account_id,
  sentAt: message.sent_at ?? message.created_at ?? new Date().toISOString(),
  from: mapParticipant(message.from_participant),
  to: (message.to_participants ?? []).map(mapParticipant),
  cc: (message.cc_participants ?? undefined)?.map(mapParticipant),
  bcc: (message.bcc_participants ?? undefined)?.map(mapParticipant),
  subject: message.subject ?? '(sem assunto)',
  body: message.body ?? '',
  folder: message.folder ?? 'inbox',
  unread: message.unread ?? false,
  direction: message.direction ?? 'outbound',
});

const mapThread = (thread: EmailThreadRow): EmailThread => ({
  id: thread.id,
  accountId: thread.account_id,
  subject: thread.subject ?? '(sem assunto)',
  preview: thread.preview ?? '',
  updatedAt: thread.updated_at ?? thread.created_at ?? new Date().toISOString(),
  createdAt: thread.created_at ?? new Date().toISOString(),
  unread: thread.unread ?? false,
  starred: thread.starred ?? false,
  folder: thread.folder ?? 'inbox',
  participants: (thread.participants ?? []).map(mapParticipant),
  messages: (thread.email_messages ?? [])
    .map(mapMessage)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()),
});

const mapAccount = (account: EmailAccountRow): EmailAccount => ({
  id: account.id,
  providerId: account.provider_id,
  emailAddress: account.email_address,
  displayName: account.display_name,
  connectedAt: account.connected_at ?? account.created_at,
  status: account.status ?? 'connected',
  isPrimary: Boolean(account.is_primary ?? false),
  lastSyncAt: account.last_sync_at ?? undefined,
});

export const listEmailAccounts = async (): Promise<EmailAccount[]> => {
  const { data, error } = await supabase
    .from('email_accounts')
    .select(
      `id, provider_id, email_address, display_name, connected_at, status, is_primary, metadata, created_at, updated_at, last_sync_at`
    )
    .order('display_name');

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAccount);
};

export const createEmailAccount = async (
  payload: Pick<EmailAccount, 'providerId' | 'emailAddress' | 'displayName'> & {
    isPrimary?: boolean;
  }
): Promise<EmailAccount> => {
  const { data, error } = await supabase
    .from('email_accounts')
    .insert({
      provider_id: payload.providerId,
      email_address: payload.emailAddress,
      display_name: payload.displayName,
      status: 'connected',
      is_primary: payload.isPrimary ?? false,
    })
    .select(
      `id, provider_id, email_address, display_name, connected_at, status, is_primary, metadata, created_at, updated_at, last_sync_at`
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('Falha ao criar conta de email.');
  }

  return mapAccount(data as EmailAccountRow);
};

export const listEmailThreads = async (
  accountId?: string | null
): Promise<EmailThread[]> => {
  let query = supabase
    .from('email_threads')
    .select(
      `
        id,
        account_id,
        subject,
        preview,
        updated_at,
        created_at,
        unread,
        starred,
        folder,
        participants,
        email_messages (
          id,
          thread_id,
          account_id,
          direction,
          from_participant,
          to_participants,
          cc_participants,
          bcc_participants,
          subject,
          body,
          folder,
          unread,
          sent_at,
          created_at
        )
      `
    )
    .order('updated_at', { ascending: false });

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((thread) => mapThread(thread as EmailThreadRow));
};

const parseEmailAddress = (value: string) => {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/^(.*)<(.+@.+)>$/);
  if (angleMatch) {
    const name = angleMatch[1].trim().replace(/^"|"$/g, '');
    return { name: name || angleMatch[2].trim(), email: angleMatch[2].trim() };
  }
  const parts = trimmed.split('@');
  const inferredName = parts.length > 1 ? parts[0] : trimmed;
  return { name: inferredName, email: trimmed };
};

export const createThreadWithMessage = async (
  payload: ComposeEmailPayload & { sender: EmailAccount }
): Promise<EmailThread> => {
  const participants = [
    { name: payload.sender.displayName, email: payload.sender.emailAddress },
    parseEmailAddress(payload.to),
  ];

  const now = new Date().toISOString();

  const { data: threadData, error: threadError } = await supabase
    .from('email_threads')
    .insert({
      account_id: payload.accountId,
      subject: payload.subject,
      preview: payload.body.slice(0, 160),
      folder: 'sent',
      unread: false,
      starred: false,
      participants,
      updated_at: now,
      created_at: now,
    })
    .select(
      `
        id,
        account_id,
        subject,
        preview,
        updated_at,
        created_at,
        unread,
        starred,
        folder,
        participants
      `
    )
    .single();

  if (threadError || !threadData) {
    throw threadError ?? new Error('Falha ao criar conversa.');
  }

  const { data: messageData, error: messageError } = await supabase
    .from('email_messages')
    .insert({
      thread_id: threadData.id,
      account_id: payload.accountId,
      direction: 'outbound',
      from_participant: {
        name: payload.sender.displayName,
        email: payload.sender.emailAddress,
      },
      to_participants: [parseEmailAddress(payload.to)],
      subject: payload.subject,
      body: payload.body,
      folder: 'sent',
      unread: false,
      sent_at: now,
    })
    .select(
      `
        id,
        thread_id,
        account_id,
        direction,
        from_participant,
        to_participants,
        cc_participants,
        bcc_participants,
        subject,
        body,
        folder,
        unread,
        sent_at,
        created_at
      `
    )
    .single();

  if (messageError || !messageData) {
    throw messageError ?? new Error('Falha ao registrar mensagem.');
  }

  return mapThread({
    ...(threadData as EmailThreadRow),
    email_messages: [messageData as EmailMessageRow],
  });
};

export const updateEmailThread = async (
  threadId: string,
  updates: Partial<{ unread: boolean; starred: boolean; folder: EmailFolder; updatedAt: string }>
): Promise<void> => {
  const payload: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(updates, 'unread')) {
    payload.unread = updates.unread;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'starred')) {
    payload.starred = updates.starred;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'folder')) {
    payload.folder = updates.folder;
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'updatedAt') && updates.updatedAt) {
    payload.updated_at = updates.updatedAt;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase.from('email_threads').update(payload).eq('id', threadId);

  if (error) {
    throw error;
  }
};
