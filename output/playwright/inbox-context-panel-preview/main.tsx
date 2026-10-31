import { createRoot } from 'react-dom/client';
import type { ComponentProps } from 'react';

import { Button, Text } from '../../../src/design-system';
import '../../../src/index.css';
import WhatsAppLeadDrawer from '../../../src/features/communication/whatsapp/components/WhatsAppLeadDrawer';

type InboxContextProps = ComponentProps<typeof WhatsAppLeadDrawer>;

const noop = () => undefined;

const props: InboxContextProps = {
  isOpen: true,
  presentation: 'sidebar',
  onClose: noop,
  chat: {
    saved_contact_name: 'Contato de demonstração',
    presence_status: null,
    presence_last_seen_at: null,
    presence_updated_at: null,
    autonomous_attendance_status: 'inactive',
  },
  chatId: 'synthetic-chat-1',
  chatDisplayName: 'Contato de demonstração',
  chatPhoneNumber: '5511999999999',
  linkedLead: null,
  leadPanelError: null,
  autoLinked: false,
  loading: false,
  contracts: [],
  contractsLoading: false,
  contractsError: null,
  statusOptions: [],
  responsavelOptions: [],
  leadMutationLoading: false,
  onStatusChange: async () => undefined,
  onResponsavelChange: async () => undefined,
  onRefreshContracts: noop,
  onViewLead: undefined,
  onUnlinkLead: undefined,
  searchQuery: '',
  onSearchQueryChange: noop,
  searchResults: [],
  searchError: null,
  suggestedLead: null,
  searchLoading: false,
  onRetryLeadPanel: noop,
  onRetrySearch: noop,
  onCreateLead: async () => undefined,
  onLinkLead: async () => undefined,
  linkLoadingLeadId: null,
  canViewAgenda: false,
  canEditAgenda: false,
  onSaveContact: noop,
};

function InboxContextPanelPreview() {
  const isDark = new URLSearchParams(window.location.search).get('theme') === 'dark';

  return (
    <div className={`painel-theme kifer-ds comm-terracotta ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <main className="whatsapp-inbox-shell is-conversation-open flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <header className="whatsapp-inbox-page-header flex shrink-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <Text size="xs" tone="brand" weight="semibold" className="uppercase tracking-[0.14em]">Kifer Saúde · Comunicação</Text>
            <h1 className="kds-page-title mt-1">WhatsApp Inbox</h1>
          </div>
          <Button type="button" variant="primary">＋ Nova conversa</Button>
        </header>
        <section className="kds-inbox-workspace-grid is-contact-panel-open grid min-h-0 flex-1 gap-0">
          <aside className="whatsapp-inbox-sidebar min-w-0 overflow-hidden border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="whatsapp-inbox-sidebar-header border-b border-[var(--border-subtle)] p-4 font-semibold">Conversas</div>
            <div className="border-b border-[var(--border-subtle)] p-4"><strong>Contato de demonstração</strong><br /><small>Última mensagem · 10:20</small></div>
            <div className="p-4">Contato de demonstração 02</div>
          </aside>
          <section className="whatsapp-inbox-thread flex min-w-0 min-h-0 flex-col overflow-hidden bg-[var(--bg-inset)]" aria-label="Conversa de demonstração">
            <header className="whatsapp-inbox-thread-header flex min-h-16 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
              <strong>Contato de demonstração</strong>
              <Button type="button" variant="secondary" aria-label="Informações do contato">ⓘ</Button>
            </header>
            <div className="whatsapp-inbox-messages min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="message-bubble message-bubble-inbound max-w-[68%] rounded-xl border px-3 py-2">Olá! Gostaria de conhecer as opções de planos para minha família. Esta mensagem de demonstração permite conferir se o painel lateral cobre ou corta o histórico em larguras diferentes.</div>
              <div className="message-bubble message-bubble-outbound ml-auto max-w-[68%] rounded-xl border px-3 py-2">Claro, posso ajudar. Quantas pessoas terão cobertura e em qual cidade vocês moram?</div>
              <div className="message-bubble message-bubble-inbound max-w-[68%] rounded-xl border px-3 py-2">Seremos três pessoas. Quero comparar as opções com calma e ver as informações completas antes de decidir.</div>
              <div className="message-bubble message-bubble-outbound ml-auto max-w-[68%] rounded-xl border px-3 py-2">Perfeito. Vou preparar uma comparação para você.</div>
            </div>
            <footer className="whatsapp-inbox-composer-area shrink-0 border-t p-3"><div className="whatsapp-inbox-composer rounded-xl border p-3"><input className="whatsapp-inbox-composer-input w-full" placeholder="Digite uma mensagem" aria-label="Digite uma mensagem" /></div></footer>
          </section>
          <WhatsAppLeadDrawer {...props} />
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<InboxContextPanelPreview />);
