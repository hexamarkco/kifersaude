import type { EmailProviderId, EmailProviderMetadata } from './types';

export const emailProviders: Record<EmailProviderId, EmailProviderMetadata> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Conexão via OAuth 2.0 com sua conta do Google Workspace ou Gmail pessoal.',
    connectionType: 'oauth',
    docsUrl: 'https://developers.google.com/gmail/api',
    badgeClassName: 'bg-red-100 text-red-700 border-red-200',
  },
  'custom-domain': {
    id: 'custom-domain',
    name: 'Domínio Kifer Saúde',
    description: 'Integração por IMAP/SMTP com o provedor contratado para kifersaude.com.br.',
    connectionType: 'imap-smtp',
    docsUrl: 'https://kifersaude.com.br',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
};

export const providerOptions: { value: EmailProviderId; label: string }[] = Object.values(emailProviders).map(
  (provider) => ({
    value: provider.id,
    label: provider.name,
  })
);
