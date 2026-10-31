import { createRoot } from 'react-dom/client';
import WhatsAppScheduleMessageModal from '../../../src/features/communication/whatsapp/components/WhatsAppScheduleMessageModal';
import '../../../src/index.css';

const requestedTheme = new URLSearchParams(window.location.search).get('theme');
const themeClass = requestedTheme === 'dark' ? 'theme-dark' : 'theme-light';
document.documentElement.className = themeClass;
document.body.className = `painel-theme kifer-ds comm-terracotta ${themeClass}`;

function InboxSchedulePreview() {
  return (
    <main className="min-h-screen p-6 text-[var(--text-primary)]">
      <header className="mb-6 flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">WhatsApp Inbox</p>
          <h1 className="mt-1 text-xl font-semibold">Conversa de demonstração</h1>
        </div>
        <span className="text-sm text-[var(--text-secondary)]">Dados sintéticos · sem envio</span>
      </header>
      <section className="mx-auto max-w-3xl rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <p className="text-sm text-[var(--text-secondary)]">A mensagem agendada aparecerá nesta conversa.</p>
      </section>
      <WhatsAppScheduleMessageModal
        isOpen
        onClose={() => undefined}
        channelId="preview-channel"
        chatId="preview-chat"
        phoneDigits="5521999999999"
        contactDisplayName="Contato de demonstração"
        initialText="Olá! Podemos conversar amanhã?"
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<InboxSchedulePreview />);
