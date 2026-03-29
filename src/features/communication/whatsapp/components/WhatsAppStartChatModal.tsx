import { useMemo, useState } from 'react';
import { Loader2, MessageSquarePlus, Phone, Search, UserCircle2, UserRound } from 'lucide-react';

import ModalShell from '../../../../components/ui/ModalShell';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { CommWhatsAppLeadSearchResult } from '../../../../lib/commWhatsAppService';
import type { CommWhatsAppPhoneContact } from '../../../../lib/supabase';

type StartChatSource = 'saved' | 'crm' | 'manual';

type WhatsAppStartChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  contacts: CommWhatsAppPhoneContact[];
  contactsLoading: boolean;
  crmLeads: CommWhatsAppLeadSearchResult[];
  crmLoading: boolean;
  onStartFromSavedContact: (contact: CommWhatsAppPhoneContact) => void;
  onStartFromLead: (lead: CommWhatsAppLeadSearchResult) => void;
  manualPhone: string;
  onManualPhoneChange: (value: string) => void;
  onStartFromManual: () => void;
  startingKey: string | null;
};

export default function WhatsAppStartChatModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  contacts,
  contactsLoading,
  crmLeads,
  crmLoading,
  onStartFromSavedContact,
  onStartFromLead,
  manualPhone,
  onManualPhoneChange,
  onStartFromManual,
  startingKey,
}: WhatsAppStartChatModalProps) {
  const [source, setSource] = useState<StartChatSource>('saved');

  const sourceTitle = useMemo(() => {
    switch (source) {
      case 'crm':
        return 'Leads do CRM';
      case 'manual':
        return 'Numero manual';
      default:
        return 'Contatos salvos';
    }
  }, [source]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Novo chat"
      description="Inicie uma conversa a partir dos contatos salvos do celular, do CRM ou digitando um numero manualmente."
      size="lg"
      panelClassName="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSource('saved')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${source === 'saved' ? 'bg-[var(--panel-accent-strong,#c86f1d)] text-white' : 'bg-[var(--panel-surface-soft,#f4ede3)] text-[var(--panel-text-soft,#5b4635)]'}`}
          >
            Contatos salvos
          </button>
          <button
            type="button"
            onClick={() => setSource('crm')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${source === 'crm' ? 'bg-[var(--panel-accent-strong,#c86f1d)] text-white' : 'bg-[var(--panel-surface-soft,#f4ede3)] text-[var(--panel-text-soft,#5b4635)]'}`}
          >
            CRM
          </button>
          <button
            type="button"
            onClick={() => setSource('manual')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${source === 'manual' ? 'bg-[var(--panel-accent-strong,#c86f1d)] text-white' : 'bg-[var(--panel-surface-soft,#f4ede3)] text-[var(--panel-text-soft,#5b4635)]'}`}
          >
            Numero
          </button>
        </div>

        {source === 'manual' ? (
          <div className="space-y-4 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--panel-text,#1c1917)]">Iniciar por numero</p>
              <p className="mt-1 text-sm text-[var(--panel-text-muted,#8a735f)]">Digite um numero com DDD. O inbox valida se ele existe no WhatsApp antes de abrir a conversa.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input value={manualPhone} onChange={(event) => onManualPhoneChange(event.target.value)} placeholder="Ex.: 21999999999" leftIcon={Phone} />
              <Button onClick={onStartFromManual} loading={startingKey === 'manual'}>
                {!startingKey && <MessageSquarePlus className="h-4 w-4" />}
                Iniciar chat
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Buscar em ${sourceTitle.toLowerCase()}`} leftIcon={Search} />
            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
              {(source === 'saved' ? contactsLoading : crmLoading) ? (
                <div className="flex min-h-[180px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando {source === 'saved' ? 'contatos salvos' : 'leads do CRM'}...
                </div>
              ) : source === 'saved' ? (
                contacts.length === 0 ? (
                  <div className="flex min-h-[180px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    Nenhum contato salvo encontrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => onStartFromSavedContact(contact)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-white px-4 py-3 text-left transition hover:border-[var(--panel-accent-border,#d2ab85)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">{contact.display_name}</p>
                          <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{contact.phone_number}</p>
                        </div>
                        {startingKey === `saved:${contact.phone_digits}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4 text-[var(--panel-accent-strong,#c86f1d)]" />}
                      </button>
                    ))}
                  </div>
                )
              ) : crmLeads.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                  Nenhum lead encontrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {crmLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => onStartFromLead(lead)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-white px-4 py-3 text-left transition hover:border-[var(--panel-accent-border,#d2ab85)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">{lead.nome_completo || 'Lead sem nome'}</p>
                        <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{lead.telefone}</p>
                        <p className="mt-1 truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                          {lead.status_nome || 'Sem status'}
                          {lead.responsavel_label ? ` • ${lead.responsavel_label}` : ''}
                        </p>
                      </div>
                      {startingKey === `crm:${lead.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCircle2 className="h-4 w-4 text-[var(--panel-accent-strong,#c86f1d)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
