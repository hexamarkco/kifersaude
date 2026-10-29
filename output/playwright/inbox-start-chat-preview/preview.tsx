import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystemProvider } from '../../../src/design-system';
import WhatsAppStartChatModal from '../../../src/features/communication/whatsapp/components/WhatsAppStartChatModal';
import type { CommWhatsAppLeadSearchResult } from '../../../src/features/communication/whatsapp/data';
import type { CommWhatsAppPhoneContact } from '../../../src/features/communication/whatsapp/domain/types';
import type { LeadStatusConfig } from '../../../src/features/leads';
import '../../../src/index.css';

const now = '2026-10-29T12:00:00.000Z';
const contact: CommWhatsAppPhoneContact = {
  id: 'contact-demo-1',
  channel_id: 'channel-demo',
  contact_id: 'provider-contact-demo-1',
  phone_number: '+55 (21) 99999-1234',
  phone_digits: '5521999991234',
  display_name: 'Camila Demonstração',
  saved: true,
  last_synced_at: now,
  created_at: now,
  updated_at: now,
};
const lead: CommWhatsAppLeadSearchResult = {
  id: 'lead-demo-1',
  nome_completo: 'Mateus Demonstração',
  telefone: '+55 (21) 98888-5678',
  status_nome: 'Contato inicial',
  responsavel_label: 'Equipe comercial',
  favorito: true,
};
const status: LeadStatusConfig = {
  id: 'status-demo-1',
  nome: 'Contato inicial',
  cor: '#c5501f',
  ordem: 0,
  ativo: true,
  padrao: true,
  created_at: now,
  updated_at: now,
};

function Preview() {
  const [query, setQuery] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const state = new URLSearchParams(window.location.search).get('state');
  const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';

  return (
    <DesignSystemProvider theme={theme} className="comm-terracotta min-h-screen">
      <WhatsAppStartChatModal
        isOpen
        onClose={() => undefined}
        query={query}
        onQueryChange={setQuery}
        contacts={state === 'contacts' ? [contact] : []}
        contactsTotal={state === 'contacts' ? 1 : 0}
        contactsHasMore={false}
        contactsLoading={state === 'loading'}
        contactsLoadingMore={false}
        onLoadMoreContacts={() => undefined}
        loadError={state === 'error' ? 'Falha de demonstração controlada.' : null}
        onRetry={() => undefined}
        crmLeads={[lead]}
        crmLoading={false}
        statusOptions={[status]}
        onStartFromSavedContact={() => undefined}
        onStartFromLead={() => undefined}
        manualPhone={manualPhone}
        onManualPhoneChange={setManualPhone}
        onStartFromManual={() => undefined}
        startingKey={null}
      />
    </DesignSystemProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Preview />);

