import { Text } from '../../../../design-system';
import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquarePlus, Phone, RefreshCw, Search, UserCircle2, UserRound } from 'lucide-react';

import {
  ActionSurface,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Input,
  LoadingState,
  Surface,
  type TabItem,
  DialogShell,
  SegmentedControl,
} from '../../../../design-system';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { getBadgeStyle } from '../../../../lib/colorUtils';
import type { CommWhatsAppLeadSearchResult } from '../data';
import type { LeadStatusConfig } from '../../../leads';
import type { CommWhatsAppPhoneContact } from '../domain/types';

type StartChatSource = 'saved' | 'crm' | 'manual';

const SOURCE_TABS: TabItem<StartChatSource>[] = [
  { id: 'saved', label: 'Contatos' },
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
  loadError: string | null;
  onRetry: () => void;
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
  loadError,
  onRetry,
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
  const sourceHasResults = source === 'saved' ? contacts.length > 0 : crmLeads.length > 0;

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      title="Novo chat"
      description="Inicie uma conversa a partir dos contatos salvos do celular, do CRM ou digitando um número manualmente."
      size="form"
      initialFocus="first-content"
      bodyScrollable={false}
      bodyClassName="flex min-h-0 flex-col"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <SegmentedControl
          items={SOURCE_TABS}
          value={source}
          onChange={setSource}
          ariaLabel="Origem do novo chat"
          className="whatsapp-start-chat-source-tabs"
          listClassName="whatsapp-start-chat-source-tabs-list"
        />

        {source === 'manual' ? (
          <div className="flex min-w-0 flex-col gap-4">
            <Surface variant="muted" padding="lg" className="overflow-y-auto">
              <div className="flex min-h-[12rem] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                  <Phone className="h-6 w-6" />
                </div>
                <Text className="mt-4 text-base font-semibold text-[var(--text-primary)]">Iniciar por número</Text>
                <Text className="mt-1 max-w-xs text-sm leading-6 text-[var(--text-muted)]">
                  Digite um número com DDD. O sistema confere se ele tem WhatsApp antes de abrir a conversa.
                </Text>
                <div className="mt-5 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                  <Input value={manualPhone} onChange={(event) => onManualPhoneChange(event.target.value)} placeholder="Ex.: 21999999999" leftIcon={Phone} disabled={starting} />
                  <Button onClick={onStartFromManual} loading={startingKey === 'manual'} disabled={starting} className="w-full sm:w-auto sm:shrink-0">
                    {!startingKey && <MessageSquarePlus className="kds-control-icon" />}
                    Iniciar chat
                  </Button>
                </div>
              </div>
            </Surface>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Buscar em ${sourceTitle.toLowerCase()}`} leftIcon={Search} disabled={starting} />
            {source === 'saved' && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Contatos salvos</span>
                <Badge tone="neutral" size="sm">{contactsTotal}</Badge>
              </div>
            )}
            <Surface
              variant="default"
              padding="sm"
              className={`max-h-[20rem] overflow-y-auto ${sourceHasResults ? 'min-h-0' : 'min-h-[12rem]'}`}
            >
              {loadError ? (
                <Surface variant="danger" padding="sm" className="flex items-start gap-3" role="alert">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <Text className="font-semibold text-[var(--text-primary)]">Não foi possível carregar as opções.</Text>
                    <Text className="mt-1 text-sm leading-6">A lista vazia não confirma que não existem contatos ou leads.</Text>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} disabled={starting}>
                      <RefreshCw className="kds-control-icon" aria-hidden="true" />
                      Tentar novamente
                    </Button>
                  </div>
                </Surface>
              ) : (source === 'saved' ? contactsLoading : crmLoading) ? (
                <LoadingState
                  compact
                  className="min-h-[12rem] justify-center"
                  label={`Carregando ${source === 'saved' ? 'contatos salvos' : 'leads do CRM'}...`}
                />
              ) : source === 'saved' ? (
                contacts.length === 0 ? (
                  <EmptyState
                    className="h-full min-h-0 border-0 bg-transparent px-3 py-8"
                    title={<span className="font-sans text-sm font-semibold text-[var(--text-primary)]">{query.trim() ? 'Nenhum contato combina com a busca' : 'Nenhum contato salvo'}</span>}
                    description={query.trim() ? 'Confira o nome ou número digitado, ou tente outra forma de iniciar a conversa.' : 'Você também pode buscar um lead do CRM ou iniciar pelo número.'}
                    action={(
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setSource('crm')}>
                          Buscar no CRM
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setSource('manual')}>
                          Usar número
                        </Button>
                      </div>
                    )}
                  />
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
                        <Avatar
                          size="md"
                          tone="brand"
                          name={contact.display_name || contact.phone_number || contact.phone_digits || 'Contato'}
                        />
                        <div className="min-w-0 flex-1">
                          <Text className="truncate text-sm font-semibold text-[var(--text-primary)]">{contact.display_name || contact.phone_number || contact.phone_digits || 'Contato'}</Text>
                          <Text className="truncate text-xs text-[var(--text-muted)]">{contact.phone_number}</Text>
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
                <EmptyState
                  className="h-full min-h-0 border-0 bg-transparent px-3 py-8"
                  title={<span className="font-sans text-sm font-semibold text-[var(--text-primary)]">{query.trim() ? 'Nenhum lead combina com a busca' : 'Nenhum lead encontrado'}</span>}
                  description={query.trim() ? 'Confira o nome ou número digitado, ou inicie a conversa por um número.' : 'Você pode procurar contatos salvos ou digitar um número.'}
                  action={(
                    <Button variant="secondary" size="sm" onClick={() => setSource('manual')}>
                      Usar número
                    </Button>
                  )}
                />
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
                      <Avatar size="md" name={lead.nome_completo || lead.telefone || '?'} />
                      <div className="min-w-0 flex-1">
                        <Text className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-primary)]">
                          <LeadFavoriteBadge favorito={lead.favorito} />
                          {lead.nome_completo || 'Lead sem nome'}
                        </Text>
                        <Text className="truncate text-xs text-[var(--text-muted)]">{lead.telefone}</Text>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge
                            tone="neutral"
                            size="sm"
                            style={getStatusColor(lead.status_nome) ? getBadgeStyle(getStatusColor(lead.status_nome)!) : undefined}
                          >
                            {lead.status_nome || 'Sem status'}
                          </Badge>
                          {lead.responsavel_label ? <Badge tone="neutral" size="sm">{lead.responsavel_label}</Badge> : null}
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
    </DialogShell>
  );
}
