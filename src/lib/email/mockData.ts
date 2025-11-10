import type { EmailAccount, EmailMessage, EmailThread } from './types';

const now = Date.now();

const isoHoursAgo = (hours: number) =>
  new Date(now - hours * 60 * 60 * 1000).toISOString();

export const seedAccounts: EmailAccount[] = [
  {
    id: 'acct-gmail',
    providerId: 'gmail',
    emailAddress: 'kifer.saude@gmail.com',
    displayName: 'Kifer Saúde',
    connectedAt: isoHoursAgo(72),
    status: 'connected',
    isPrimary: true,
  },
  {
    id: 'acct-domain',
    providerId: 'custom-domain',
    emailAddress: 'contato@kifersaude.com.br',
    displayName: 'Equipe Kifer Saúde',
    connectedAt: isoHoursAgo(14),
    status: 'connected',
  },
];

const threadMessages = (
  threadId: string,
  accountId: string,
  baseSubject: string,
  folder: EmailMessage['folder'],
  participant: { name: string; email: string },
  hoursAgo: number,
  unread = false
): EmailMessage[] => {
  const sentAt = isoHoursAgo(hoursAgo);
  return [
    {
      id: `${threadId}-1`,
      threadId,
      accountId,
      sentAt,
      from: participant,
      to: [
        {
          name: 'Kifer Saúde',
          email: accountId === 'acct-gmail' ? 'kifer.saude@gmail.com' : 'contato@kifersaude.com.br',
        },
      ],
      subject: baseSubject,
      body:
        'Olá! Este é um exemplo de mensagem sincronizada com o painel Kifer Saúde. Você poderá responder, arquivar e automatizar envios a partir daqui.',
      folder,
      unread,
    },
  ];
};

export const seedThreads: EmailThread[] = [
  {
    id: 'thread-1',
    accountId: 'acct-gmail',
    subject: 'Resultado do exame de sangue',
    preview: 'Envio os resultados atualizados do paciente João.',
    createdAt: isoHoursAgo(7),
    updatedAt: isoHoursAgo(5),
    unread: true,
    starred: false,
    participants: [
      { name: 'João Ferreira', email: 'joao.ferreira@gmail.com' },
      { name: 'Kifer Saúde', email: 'kifer.saude@gmail.com' },
    ],
    folder: 'inbox',
    messages: threadMessages(
      'thread-1',
      'acct-gmail',
      'Resultado do exame de sangue',
      'inbox',
      { name: 'João Ferreira', email: 'joao.ferreira@gmail.com' },
      5,
      true
    ),
  },
  {
    id: 'thread-2',
    accountId: 'acct-domain',
    subject: 'Proposta de parceria com laboratório Vida+',
    preview: 'Seguimos com interesse na parceria e gostaríamos de alinhar detalhes.',
    createdAt: isoHoursAgo(24),
    updatedAt: isoHoursAgo(10),
    unread: false,
    starred: true,
    participants: [
      { name: 'Laboratório Vida+', email: 'comercial@vidaplus.com.br' },
      { name: 'Equipe Kifer Saúde', email: 'contato@kifersaude.com.br' },
    ],
    folder: 'inbox',
    messages: threadMessages(
      'thread-2',
      'acct-domain',
      'Proposta de parceria com laboratório Vida+',
      'inbox',
      { name: 'Fernanda - Vida+', email: 'fernanda@vidaplus.com.br' },
      10
    ),
  },
  {
    id: 'thread-3',
    accountId: 'acct-domain',
    subject: 'Campanha de check-up anual',
    preview: 'Sua campanha foi enviada para 524 pacientes.',
    createdAt: isoHoursAgo(30),
    updatedAt: isoHoursAgo(28),
    unread: false,
    starred: false,
    participants: [
      { name: 'Equipe Kifer Saúde', email: 'contato@kifersaude.com.br' },
    ],
    folder: 'sent',
    messages: threadMessages(
      'thread-3',
      'acct-domain',
      'Campanha de check-up anual',
      'sent',
      { name: 'Equipe Kifer Saúde', email: 'contato@kifersaude.com.br' },
      28
    ),
  },
];
