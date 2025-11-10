import { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  Inbox,
  Loader2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  Star,
} from 'lucide-react';
import { emailProviders, providerOptions } from '../lib/email/providerRegistry';
import type { EmailAccount, EmailFolder, EmailThread } from '../lib/email/types';
import { seedAccounts, seedThreads } from '../lib/email/mockData';

interface AccountFormState {
  providerId: EmailAccount['providerId'];
  emailAddress: string;
  displayName: string;
}

const folderConfig: { id: EmailFolder; label: string; icon: typeof Inbox }[] = [
  { id: 'inbox', label: 'Entrada', icon: Inbox },
  { id: 'sent', label: 'Enviados', icon: Send },
  { id: 'archived', label: 'Arquivados', icon: Archive },
  { id: 'drafts', label: 'Rascunhos', icon: Mail },
];

const threadMatchesFolder = (thread: EmailThread, folder: EmailFolder) => {
  if (folder === 'archived') {
    return thread.folder === 'archived';
  }
  if (folder === 'drafts') {
    return thread.folder === 'drafts';
  }
  if (folder === 'sent') {
    return thread.folder === 'sent';
  }
  return thread.folder === 'inbox';
};

const cn = (
  ...classes: Array<string | undefined | null | false>
) => classes.filter(Boolean).join(' ');

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', {
  numeric: 'auto',
});

const formatRelativeToNow = (isoDate: string) => {
  const targetDate = new Date(isoDate);
  const diffInSeconds = Math.round((targetDate.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);

  if (absoluteSeconds < 60) {
    return relativeTimeFormatter.format(diffInSeconds, 'second');
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return relativeTimeFormatter.format(diffInMinutes, 'minute');
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return relativeTimeFormatter.format(diffInHours, 'hour');
  }

  const diffInDays = Math.round(diffInHours / 24);
  if (Math.abs(diffInDays) < 7) {
    return relativeTimeFormatter.format(diffInDays, 'day');
  }

  const diffInWeeks = Math.round(diffInDays / 7);
  if (Math.abs(diffInWeeks) < 5) {
    return relativeTimeFormatter.format(diffInWeeks, 'week');
  }

  const diffInMonths = Math.round(diffInDays / 30);
  if (Math.abs(diffInMonths) < 12) {
    return relativeTimeFormatter.format(diffInMonths, 'month');
  }

  const diffInYears = Math.round(diffInDays / 365);
  return relativeTimeFormatter.format(diffInYears, 'year');
};

const formatDateTime = (isoDate: string) => {
  const date = new Date(isoDate);
  const datePart = date.toLocaleDateString('pt-BR');
  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} às ${timePart}`;
};

export default function EmailManager() {
  const [accounts, setAccounts] = useState<EmailAccount[]>(seedAccounts);
  const [threads, setThreads] = useState<EmailThread[]>(seedThreads);
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>(
    'acct-gmail'
  );
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    seedThreads[0]?.id ?? null
  );
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [isConnectingAccount, setIsConnectingAccount] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountFormState>({
    providerId: providerOptions[0]?.value ?? 'gmail',
    emailAddress: '',
    displayName: '',
  });
  const accountFormProvider =
    emailProviders[accountForm.providerId] ?? emailProviders.gmail;

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);

  const visibleThreads = useMemo(() => {
    const filteredByAccount =
      selectedAccountId === 'all'
        ? threads
        : threads.filter((thread) => thread.accountId === selectedAccountId);

    return filteredByAccount.filter((thread) => threadMatchesFolder(thread, activeFolder));
  }, [threads, selectedAccountId, activeFolder]);

  const folderCounters = useMemo(() => {
    return folderConfig.reduce(
      (acc, folder) => {
        const total = threads.filter((thread) => threadMatchesFolder(thread, folder.id)).length;
        const unread = threads.filter(
          (thread) => threadMatchesFolder(thread, folder.id) && thread.unread
        ).length;
        acc[folder.id] = { total, unread };
        return acc;
      },
      {} as Record<EmailFolder, { total: number; unread: number }>
    );
  }, [threads]);

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, unread: false } : thread
      )
    );
  };

  const toggleStar = (threadId: string) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, starred: !thread.starred } : thread
      )
    );
  };

  const markAsArchived = (threadId: string) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, folder: 'archived', unread: false } : thread
      )
    );
  };

  const handleAddAccount = async () => {
    if (!accountForm.emailAddress || !accountForm.displayName) return;
    setIsConnectingAccount(true);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const newAccount: EmailAccount = {
      id: `acct-${Math.random().toString(36).slice(2, 10)}`,
      providerId: accountForm.providerId,
      emailAddress: accountForm.emailAddress,
      displayName: accountForm.displayName,
      connectedAt: new Date().toISOString(),
      status: 'connected',
    };

    setAccounts((current) => [...current, newAccount]);
    setIsConnectingAccount(false);
    setIsAddingAccount(false);
    setAccountForm({ providerId: providerOptions[0]?.value ?? 'gmail', emailAddress: '', displayName: '' });
    setSelectedAccountId(newAccount.id);
    setSelectedThreadId(null);
  };

  const handleCompose = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const accountId = String(
      formData.get('account') ??
        (selectedAccountId === 'all' ? accounts[0]?.id ?? '' : selectedAccountId ?? '')
    );
    const to = String(formData.get('to') ?? '');
    const subject = String(formData.get('subject') ?? '');
    const body = String(formData.get('body') ?? '');

    if (!accountId || !to || !subject || !body) {
      return;
    }

    const senderAccount =
      accounts.find((account) => account.id === accountId) ?? accounts[0] ?? seedAccounts[0];
    const timestamp = Date.now();
    const threadId = `draft-${timestamp}`;
    const messageId = `message-${timestamp}`;

    const draftThread: EmailThread = {
      id: threadId,
      accountId,
      subject,
      preview: body.slice(0, 120),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unread: false,
      starred: false,
      participants: [
        {
          name: senderAccount.displayName,
          email: senderAccount.emailAddress,
        },
        { name: to, email: to },
      ],
      folder: 'sent',
      messages: [
        {
          id: messageId,
          threadId,
          accountId,
          sentAt: new Date().toISOString(),
          from: {
            name: senderAccount.displayName,
            email: senderAccount.emailAddress,
          },
          to: [{ name: to, email: to }],
          subject,
          body,
          folder: 'sent',
          unread: false,
        },
      ],
    };
    setThreads((current) => [draftThread, ...current]);
    setSelectedThreadId(threadId);
    setSelectedAccountId(accountId);
    event.currentTarget.reset();
    setIsComposeOpen(false);
  };

  const selectedAccount =
    selectedAccountId === 'all'
      ? null
      : accounts.find((account) => account.id === selectedAccountId) ?? null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Central de Emails</h1>
        <p className="text-slate-600">
          Conecte sua conta Gmail pessoal e o email profissional do domínio kifersaude.com.br para gerenciar tudo em um só lugar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Contas conectadas</h2>
                <p className="text-sm text-slate-500">Sincronize suas caixas de email</p>
              </div>
              <button
                onClick={() => setIsAddingAccount(true)}
                className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedAccountId('all')}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border transition text-left',
                  selectedAccountId === 'all'
                    ? 'border-orange-300 bg-orange-50/80 text-orange-700 shadow-sm'
                    : 'border-slate-200 hover:border-orange-200 hover:bg-orange-50/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-sm font-semibold">Todas as contas</span>
                    <span className="text-xs text-slate-500">Combine Gmail e domínio próprio</span>
                  </div>
                  <Mail className="w-5 h-5 text-orange-500" />
                </div>
              </button>

              {accounts.map((account) => {
                const provider = emailProviders[account.providerId];
                const isSelected = selectedAccountId === account.id;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border transition text-left',
                      isSelected
                        ? 'border-orange-300 bg-orange-50/80 text-orange-700 shadow-sm'
                        : 'border-slate-200 hover:border-orange-200 hover:bg-orange-50/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-semibold">{account.displayName}</span>
                        <span className="text-xs text-slate-500">{account.emailAddress}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {account.status === 'connected'
                            ? `Conectado ${formatRelativeToNow(account.connectedAt)}`
                            : 'Sincronizando...'}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 px-2 py-1 rounded-full border text-xs font-medium',
                          provider.badgeClassName
                        )}
                      >
                        {provider.name}
                      </span>
                      {account.isPrimary && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Padrão
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-100 border border-orange-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Sincronização unificada</h3>
            <p className="text-sm text-slate-700">
              Conecte seu Gmail pessoal e o email profissional do domínio <strong>kifersaude.com.br</strong> para acompanhar leads,
              campanhas e automações num único painel. Tokens OAuth e credenciais IMAP são armazenados com segurança via Supabase Vault.
            </p>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por assunto, contato ou etiqueta"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <button className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800">
                <Filter className="w-4 h-4" />
                Filtros
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsComposeOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                Novo email
              </button>
              <button className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-orange-200">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-2">
                  {folderConfig.map((folder) => {
                    const Icon = folder.icon;
                    const counter = folderCounters[folder.id];
                    const isActive = activeFolder === folder.id;
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setActiveFolder(folder.id)}
                        className={cn(
                          'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition',
                          isActive
                            ? 'bg-orange-100 border-orange-300 text-orange-700'
                            : 'border-transparent text-slate-500 hover:bg-slate-100'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {folder.label}
                        {counter && counter.unread > 0 && (
                          <span className="ml-1 text-[11px] font-semibold">{counter.unread}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  Ordenar
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 overflow-auto" style={{ maxHeight: '540px' }}>
                {visibleThreads.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-500">
                    Nenhum email nesta pasta ainda. Conecte suas contas para começar a receber mensagens.
                  </div>
                )}
                {visibleThreads.map((thread) => {
                  const account = accounts.find((item) => item.id === thread.accountId);
                  const provider = account ? emailProviders[account.providerId] : null;
                  return (
                    <button
                      key={thread.id}
                      onClick={() => handleSelectThread(thread.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 transition flex flex-col gap-2',
                        selectedThreadId === thread.id ? 'bg-orange-50/80' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium',
                              provider?.badgeClassName ?? 'bg-slate-100 text-slate-600 border-slate-200'
                            )}
                          >
                            {provider?.name ?? 'Conta' }
                          </span>
                          {thread.unread ? (
                            <Circle className="w-2.5 h-2.5 text-orange-500" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {formatRelativeToNow(thread.updatedAt)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className={cn('text-sm font-semibold text-slate-900', thread.unread && 'text-orange-700')}>
                            {thread.subject}
                          </h4>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleStar(thread.id);
                            }}
                            className="text-slate-400 hover:text-orange-500"
                          >
                            <Star className={cn('w-4 h-4', thread.starred && 'fill-orange-500 text-orange-500')} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{thread.preview}</p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {thread.participants
                            .filter((participant) => participant.email !== account?.emailAddress)
                            .map((participant) => participant.name)
                            .join(', ') || 'Você'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsArchived(thread.id);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            <Archive className="w-3 h-3" /> Arquivar
                          </button>
                          <MoreHorizontal className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-6">
              {selectedThread ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{selectedThread.subject}</h3>
                      <div className="text-sm text-slate-500">
                        {selectedThread.participants
                          .map((participant) => `${participant.name} <${participant.email}>`)
                          .join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 text-xs border border-slate-200 rounded-full text-slate-500 hover:border-orange-200 hover:text-orange-600">
                        Responder
                      </button>
                      <button className="px-3 py-1.5 text-xs border border-slate-200 rounded-full text-slate-500 hover:border-orange-200 hover:text-orange-600">
                        Encaminhar
                      </button>
                      <button className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-200">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {selectedThread.messages.map((message) => (
                      <article key={message.id} className="border border-slate-100 rounded-lg p-4 bg-slate-50">
                        <header className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">{message.from.name}</h4>
                            <p className="text-xs text-slate-500">
                              Para: {message.to.map((participant) => participant.email).join(', ')}
                            </p>
                          </div>
                          <time className="text-xs text-slate-400">{formatDateTime(message.sentAt)}</time>
                        </header>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{message.body}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-24 text-slate-500">
                  <Mail className="w-12 h-12 text-orange-400 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">Selecione uma conversa</h3>
                  <p className="text-sm max-w-md">
                    Aqui você verá o conteúdo da conversa escolhida. Conecte múltiplas contas, automatize respostas e mantenha o histórico de todos os seus atendimentos.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {isAddingAccount && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Conectar nova conta</h3>
                <p className="text-sm text-slate-500">
                  Escolha o provedor para sincronizar e siga os passos de autenticação. Tokens são armazenados com segurança no Supabase.
                </p>
              </div>
              <button onClick={() => setIsAddingAccount(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Provedor
                <select
                  className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  value={accountForm.providerId}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      providerId: event.target.value as EmailAccount['providerId'],
                    }))
                  }
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">{accountFormProvider.name}</p>
                <p>{accountFormProvider.description}</p>
                <p className="text-slate-500">
                  Método de conexão: {accountFormProvider.connectionType === 'oauth' ? 'OAuth 2.0 (Google PKCE)' : 'IMAP + SMTP com senha de aplicativo'}
                </p>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Endereço de email
                <input
                  type="email"
                  className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="ex: atendimento@kifersaude.com.br"
                  value={accountForm.emailAddress}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      emailAddress: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Nome de exibição
                <input
                  type="text"
                  className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Equipe Kifer Saúde"
                  value={accountForm.displayName}
                  onChange={(event) =>
                    setAccountForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-2">
              <p className="font-semibold text-slate-600">Passos de autenticação</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Gmail: abrir janela OAuth com escopos de leitura, envio e rótulos.</li>
                <li>Domínio próprio: inserir host IMAP/SMTP, porta, usuário e senha de aplicativo.</li>
                  <li>Todos os tokens ficam cifrados e podem ser revogados a qualquer momento.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsAddingAccount(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAccount}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
                disabled={isConnectingAccount}
              >
                {isConnectingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheckIcon />}
                Conectar conta
              </button>
            </div>
          </div>
        </div>
      )}

      {isComposeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
          <form
            onSubmit={handleCompose}
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Novo email</h3>
                <p className="text-sm text-slate-500">Selecione a conta de envio e escreva a mensagem.</p>
              </div>
              <button onClick={() => setIsComposeOpen(false)} type="button" className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-slate-700">
                Enviar por
                <select
                  name="account"
                  defaultValue={selectedAccount?.id ?? accounts[0]?.id}
                  className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName} ({account.emailAddress})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Para
                <input
                  name="to"
                  type="email"
                  className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="paciente@exemplo.com"
                  required
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Assunto
              <input
                name="subject"
                type="text"
                className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Atualização sobre seu atendimento"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Mensagem
              <textarea
                name="body"
                rows={6}
                className="mt-1 block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="Olá, aqui está a atualização do seu atendimento..."
                required
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
              >
                <Send className="w-4 h-4" />
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ShieldCheckIcon() {
  return <ShieldCheck className="w-4 h-4" />;
}

function ShieldCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 3l7 4v5c0 5.25-3.438 10.313-7 11-3.562-.687-7-5.75-7-11V7l7-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12l1.5 1.5L15 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
