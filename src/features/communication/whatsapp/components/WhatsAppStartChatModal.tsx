import { useMemo, useState } from 'react';
import { Loader2, MessageSquarePlus, Phone, Search, UserCircle2, UserRound } from 'lucide-react';

import { ActionSurface, Badge, Button, Input, Surface, Tabs, type TabItem } from '../../../../design-system';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { getBadgeStyle } from '../../../../lib/colorUtils';
import type { CommWhatsAppLeadSearchResult } from '../../../../lib/commWhatsAppService';
import type { CommWhatsAppPhoneContact, LeadStatusConfig } from '../../../../lib/supabase';
import WhatsAppDialog from './WhatsAppDialog';

type StartChatSource = 'saved' | 'crm' | 'manual';

const SOURCE_TABS: TabItem<StartChatSource>[] = [
  { id: 'saved', label: 'Contatos salvos' },
  { id: 'crm', label: 'CRM' },
  { id: 'manual', label: 'Número' },
];

type WhatsAppStartChatModalProps = {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  contacts: CommWhatsAppPhoneContact[];
  contactsTotal: number;
  contactsHasMore: boolean;
  contactsLoading: boolean;
  contactsLoadingMore: boolean;
  onLoadMoreContacts: () => void;
  crmLeads: CommWhatsAppLeadSearchResult[];
  crmLoading: boolean;
  statusOptions: LeadStatusConfig[];
  onStartFromSavedContact: (contact: CommWhatsAppPhoneContact) => void;
  onStartFromLead: (lead: CommWhatsAppLeadSearchResult) => void;
  manualPhone: string;
  onManualPhoneChange: (value: string) => void;
  onStartFromManual: () => void;
  startingKey: string | null;
};

const getInitial = (value: string) => value.trim().charAt(0).toUpperCase() || '#';

function ContactAvatar({ label, tone = 'brand' }: { label: string; tone?: 'brand' | 'gold' }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        tone === 'gold' ? 'bg-[var(--accent-gold-soft)] text-[var(--accent-gold-hover)]' : 'bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]'
      }`}
    >
      {getInitial(label)}
    </div>
  );
}

export default function WhatsAppStartChatModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  contacts,
  contactsTotal,
  contactsHasMore,
  contactsLoading,
  contactsLoadingMore,
  onLoadMoreContacts,
  crmLeads,
  crmLoading,
  statusOptions,
  onStartFromSavedContact,
  onStartFromLead,
  manualPhone,
  onManualPhoneChange,
  onStartFromManual,
  startingKey,
}: WhatsAppStartChatModalProps) {
  const [source, setSource] = useState<StartChatSource>('saved');
  const starting = Boolean(startingKey);

  const getStatusColor = (statusName: string | null | undefined) => {
    if (!statusName) return null;
    return statusOptions.find((option) => option.nome === statusName)?.cor ?? null;
  };

  const sourceTitle = useMemo(() => {
    switch (source) {
      case 'crm':
        return 'Leads do CRM';
      case 'manual':
        return 'Número manual';
      default:
        return 'Contatos salvos';
    }
  }, [source]);

  return (
    <WhatsAppDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Novo chat"
      description="Inicie uma conversa a partir dos contatos salvos do celular, do CRM ou digitando um número manualmente."
      size="lg"
      panelClassName="max-w-3xl"
      bodyScrollable={false}
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <Tabs items={SOURCE_TABS} value={source} onChange={setSource} variant="pill" />

        {source === 'manual' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <Surface variant="muted" padding="lg" className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                  <Phone className="h-6 w-6" />
                </div>
                <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">Iniciar por número</p>
                <p className="mt-1 max-w-xs text-sm leading-6 text-[var(--text-muted)]">
                  Digite um número com DDD. O inbox valida se ele existe no WhatsApp antes de abrir a conversa.
                </p>
                <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                  <Input value={manualPhone} onChange={(event) => onManualPhoneChange(event.target.value)} placeholder="Ex.: 21999999999" leftIcon={Phone} disabled={starting} />
                  <Button onClick={onStartFromManual} loading={startingKey === 'manual'} disabled={starting} className="w-full sm:w-auto sm:shrink-0">
                    {!startingKey && <MessageSquarePlus className="h-4 w-4" />}
                    Iniciar chat
                  </Button>
                </div>
              </div>
            </Surface>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Buscar em ${sourceTitle.toLowerCase()}`} leftIcon={Search} disabled={starting} />
            {source === 'saved' && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Contatos salvos</span>
                <Badge tone="neutral" size="xs">{contactsTotal}</Badge>
              </div>
            )}
            <Surface variant="muted" padding="sm" className="min-h-[320px] flex-1 overflow-y-auto">
              {(source === 'saved' ? contactsLoading : crmLoading) ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-[var(--text-muted)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando {source === 'saved' ? 'contatos salvos' : 'leads do CRM'}...
                </div>
              ) : source === 'saved' ? (
                contacts.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-[var(--text-muted)]">
                    Nenhum contato salvo encontrado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <ActionSurface
                        key={contact.id}
                        type="button"
                        onClick={() => onStartFromSavedContact(contact)}
                        disabled={starting}
                        variant="default" padding="sm" className="flex w-full items-center gap-3 text-left"
                      >
                        <ContactAvatar label={contact.display_name || contact.phone_number || contact.phone_digits || 'Contato'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{contact.display_name || contact.phone_number || contact.phone_digits || 'Contato'}</p>
                          <p className="truncate text-xs text-[var(--text-muted)]">{contact.phone_number}</p>
                        </div>
                        {startingKey === `saved:${contact.phone_digits}` ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <UserRound className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />}
                      </ActionSurface>
                    ))}

                    {contactsHasMore && (
                      <div className="pt-2">
                        <Button variant="secondary" className="w-full" onClick={onLoadMoreContacts} loading={contactsLoadingMore} disabled={starting}>
                          Carregar mais contatos
                        </Button>
                      </div>
                    )}
                  </div>
                )
              ) : crmLeads.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-sm text-[var(--text-muted)]">
                  Nenhum lead encontrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {crmLeads.map((lead) => (
                    <ActionSurface
                      key={lead.id}
                      type="button"
                      onClick={() => onStartFromLead(lead)}
                      disabled={starting}
                      variant="default" padding="sm" className="flex w-full items-center gap-3 text-left"
                    >
                      <ContactAvatar label={lead.nome_completo || lead.telefone || '?'} tone="gold" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-primary)]">
                          <LeadFavoriteBadge favorito={lead.favorito} />
                          {lead.nome_completo || 'Lead sem nome'}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{lead.telefone}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge
                            tone="neutral"
                            size="xs"
                            style={getStatusColor(lead.status_nome) ? getBadgeStyle(getStatusColor(lead.status_nome)!) : undefined}
                          >
                            {lead.status_nome || 'Sem status'}
                          </Badge>
                          {lead.responsavel_label ? <Badge tone="neutral" size="xs">{lead.responsavel_label}</Badge> : null}
                        </div>
                      </div>
                      {startingKey === `crm:${lead.id}` ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <UserCircle2 className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" />}
                    </ActionSurface>
                  ))}
                </div>
              )}
            </Surface>
          </div>
        )}
      </div>
    </WhatsAppDialog>
  );
}
