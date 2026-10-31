import { createRoot } from 'react-dom/client';
import { useState } from 'react';

import { Button, Text } from '../../../src/design-system';
import '../../../src/index.css';
import WhatsAppQuickRepliesModal from '../../../src/features/communication/whatsapp/components/WhatsAppQuickRepliesModal';
import type { WhatsAppQuickReply } from '../../../src/features/communication/whatsapp/domain/quickReplies';

const initialQuickReplies: WhatsAppQuickReply[] = [
  {
    id: 'preview-welcome',
    name: 'Boas-vindas',
    shortcut: 'boas-vindas',
    text: 'Olá, {{nome}}! Como posso ajudar você hoje?',
    created_at: null,
    updated_at: null,
  },
  {
    id: 'preview-follow-up',
    name: 'Retorno comercial',
    shortcut: 'retorno',
    text: 'Oi, {{nome}}! Passando para saber se conseguiu avaliar as opções que conversamos.',
    created_at: null,
    updated_at: null,
  },
  {
    id: 'preview-documents',
    name: 'Documentos necessários',
    shortcut: 'documentos',
    text: 'Para continuar, envie por favor o nome completo e os documentos dos beneficiários.',
    created_at: null,
    updated_at: null,
  },
];

function QuickRepliesPreview() {
  const [open, setOpen] = useState(true);
  const [quickReplies, setQuickReplies] = useState(initialQuickReplies);
  const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'theme-dark' : 'theme-light';
  const empty = new URLSearchParams(window.location.search).get('empty') === '1';
  const partial = new URLSearchParams(window.location.search).get('validation') === '1';

  const visibleQuickReplies = empty
    ? []
    : partial
      ? [{ ...initialQuickReplies[0]!, name: '', text: '' }]
      : quickReplies;

  return (
    <div className={`painel-theme kifer-ds comm-terracotta ${theme}`}>
      <main className="whatsapp-inbox-shell flex min-h-dvh flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <header className="whatsapp-inbox-page-header flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="min-w-0">
            <Text size="xs" tone="brand" weight="semibold" className="uppercase tracking-[0.14em]">Kifer Saúde · Comunicação</Text>
            <h1 className="kds-page-title mt-1">WhatsApp Inbox</h1>
          </div>
          <Button type="button" variant="primary">Nova conversa</Button>
        </header>
        <section className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-[18rem_minmax(0,1fr)] gap-4 p-6">
          <aside className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <h2 className="text-sm font-semibold">Conversas</h2>
            <div className="mt-4 rounded-lg bg-[var(--bg-hover)] p-3">
              <strong className="text-sm">Mariana Costa</strong>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Estou analisando a proposta.</p>
            </div>
            <div className="mt-2 p-3 text-sm text-[var(--text-secondary)]">Eduardo Martins</div>
          </aside>
          <section className="flex min-w-0 flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <header className="border-b border-[var(--border-subtle)] px-5 py-4">
              <strong>Mariana Costa</strong>
              <p className="text-xs text-[var(--text-muted)]">Em atendimento · WhatsApp</p>
            </header>
            <div className="flex-1 space-y-4 bg-[var(--bg-inset)] p-5">
              <div className="max-w-[72%] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm">Olá! Quero comparar os planos para minha família.</div>
              <div className="ml-auto max-w-[72%] rounded-lg border border-[var(--brand-primary-border)] bg-[var(--brand-primary-muted)] p-3 text-sm">Claro. Quantas pessoas precisam de cobertura?</div>
            </div>
            <div className="border-t border-[var(--border-subtle)] p-4 text-sm text-[var(--text-muted)]">Digite uma mensagem</div>
          </section>
        </section>
      </main>
      <Button
        className="fixed bottom-4 right-4 z-10"
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Abrir mensagens rápidas
      </Button>
      <WhatsAppQuickRepliesModal
        isOpen={open}
        quickReplies={visibleQuickReplies}
        saving={false}
        onClose={() => setOpen(false)}
        onSave={(nextQuickReplies) => {
          setQuickReplies(nextQuickReplies);
          setOpen(false);
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<QuickRepliesPreview />);
