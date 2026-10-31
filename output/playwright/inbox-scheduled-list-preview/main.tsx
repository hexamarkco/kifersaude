import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { Button } from '../../../src/design-system';
import WhatsAppScheduledMessagesPanel from '../../../src/features/communication/whatsapp/components/WhatsAppScheduledMessagesPanel';
import WhatsAppScheduleMessageModal from '../../../src/features/communication/whatsapp/components/WhatsAppScheduleMessageModal';
import '../../../src/index.css';

const requestedTheme = new URLSearchParams(window.location.search).get('theme');
const themeClass = requestedTheme === 'dark' ? 'theme-dark' : 'theme-light';
document.documentElement.className = themeClass;
document.body.className = `painel-theme kifer-ds comm-terracotta ${themeClass}`;

function ScheduledMessagesPreview() {
  const [isOpen, setIsOpen] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[var(--bg-canvas)] p-6 text-[var(--text-primary)]">
      <Button onClick={() => setIsOpen(true)}>Abrir mensagens agendadas</Button>
      <WhatsAppScheduledMessagesPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onScheduleNew={() => setIsCreateOpen(true)}
      />
      <WhatsAppScheduleMessageModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        channelId="preview-channel"
        chatId="preview-chat"
        phoneDigits="5521999999999"
        contactDisplayName="Mariana Costa"
        onScheduled={() => setIsCreateOpen(false)}
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<ScheduledMessagesPreview />);
