export type EmailProviderId = 'gmail' | 'custom-domain';

export type EmailFolder = 'inbox' | 'sent' | 'archived' | 'drafts';

export interface EmailProviderMetadata {
  id: EmailProviderId;
  name: string;
  description: string;
  connectionType: 'oauth' | 'imap-smtp';
  docsUrl?: string;
  badgeClassName: string;
}

export interface EmailAccount {
  id: string;
  providerId: EmailProviderId;
  emailAddress: string;
  displayName: string;
  connectedAt: string;
  status: 'connected' | 'syncing' | 'error';
  isPrimary?: boolean;
  lastSyncAt?: string;
}

export interface EmailParticipant {
  name: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  sentAt: string;
  from: EmailParticipant;
  to: EmailParticipant[];
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  subject: string;
  body: string;
  folder: EmailFolder;
  unread: boolean;
  direction?: 'inbound' | 'outbound';
}

export interface EmailThread {
  id: string;
  accountId: string;
  subject: string;
  preview: string;
  updatedAt: string;
  createdAt: string;
  unread: boolean;
  starred: boolean;
  participants: EmailParticipant[];
  folder: EmailFolder;
  messages: EmailMessage[];
}

export interface ComposeEmailPayload {
  accountId: string;
  to: string;
  subject: string;
  body: string;
  sendAt?: string | null;
}
