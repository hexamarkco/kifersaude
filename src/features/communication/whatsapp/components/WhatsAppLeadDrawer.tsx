import { Text, Heading } from '../../../../design-system';
import { AlertTriangle, ArrowUpRight, Bell, Bot, CalendarPlus, Check, Clock3, Loader2, MapPin, Pencil, RefreshCw, Sparkles, Unlink, Info, Link2, Plus, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import LeadDetailsPanel from '../../../../components/LeadDetailsPanel';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import {
  Badge,
  Button,
  DateTimePicker,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerHeader,
  EmptyState,
  InfoTooltip,
  OperationalStatusBadge,
  SearchInput,
  Surface,
  Tabs,
  type TabItem,
} from '../../../../design-system';
import { SAO_PAULO_TIMEZONE, formatDateTimeForInput, formatDateTimeFullBR, isOverdue } from '../../../../lib/dateUtils';
import { syncLeadNextReturnFromUpcomingReminder } from '../../../../lib/leadReminderUtils';
import { getBadgeStyle } from '../../../../lib/colorUtils';
import { formatCommWhatsAppPhoneLabel, getCommWhatsAppPhoneRegion } from '../domain/phonePresentation';
import type { CommWhatsAppChat } from '../domain/types';
import {
  listRemindersForLeadContext,
  subscribeToReminderChanges,
  type ReminderContextItem,
  updateReminder,
} from '../../../reminders';
import { toast } from '../../../../lib/toast';
import type {
  CommWhatsAppLeadContractSummary,
  CommWhatsAppLeadPanel,
  CommWhatsAppLeadSearchResult,
} from '../data';
import type { ConfigOption } from '../../../config';
import type { Contract } from '../../../contracts';
import type { LeadStatusConfig } from '../../../leads';
import WhatsAppAttendanceCritiquePanel from './WhatsAppAttendanceCritiquePanel';
import { KeyedActionLock } from './keyedActionLock';
import WhatsAppPresenceIndicator from './WhatsAppPresenceIndicator';

type LeadDrawerTab = 'info' | 'critique';

const LEAD_DRAWER_TABS: TabItem<LeadDrawerTab>[] = [
  { id: 'info', label: 'Dados do lead' },
  { id: 'critique', label: 'Análise do atendimento', icon: Sparkles },
];

type WhatsAppLeadDrawerProps = {
  isOpen: boolean;
  presentation?: 'drawer' | 'sidebar';
  onClose: () => void;
  chat: Pick<CommWhatsAppChat, 'saved_contact_name' | 'presence_status' | 'presence_last_seen_at' | 'presence_updated_at' | 'autonomous_attendance_status'>;
  chatId: string | null;
  chatDisplayName: string;
  chatPhoneNumber: string | null;
  linkedLead: CommWhatsAppLeadPanel | null;
  leadPanelError: string | null;
  autoLinked: boolean;
  loading: boolean;
  contracts: CommWhatsAppLeadContractSummary[];
  contractsLoading: boolean;
  contractsError: string | null;
  statusOptions: LeadStatusConfig[];
  responsavelOptions: ConfigOption[];
  leadMutationLoading: boolean;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onResponsavelChange: (leadId: string, responsavelValue: string) => Promise<void>;
  onRefreshContracts: () => void;
  onViewLead: (() => void) | undefined;
  onUnlinkLead: (() => void) | undefined;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: CommWhatsAppLeadSearchResult[];
  searchError: string | null;
  suggestedLead: CommWhatsAppLeadSearchResult | null;
  searchLoading: boolean;
  onRetryLeadPanel: () => void;
  onRetrySearch: () => void;
  onCreateLead: (() => void) | undefined;
  onLinkLead: (leadId: string) => void;
  linkLoadingLeadId: string | null;
  canViewAgenda: boolean;
  canEditAgenda: boolean;
  onSaveContact: (name: string) => void;
};

const DAY_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getDayKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return DAY_KEY_FORMATTER.format(date);
};

const getInitial = (value: string) => value.trim().charAt(0).toUpperCase() || '#';

function LeadAvatar({ label }: { label: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-gold-soft)] text-sm font-semibold text-[var(--accent-gold-hover)]">
      {getInitial(label)}
    </div>
  );
}

export default function WhatsAppLeadDrawer({
  isOpen,
  presentation = 'drawer',
  onClose,
  chat,
  chatId,
  chatDisplayName,
  chatPhoneNumber,
  linkedLead,
  leadPanelError,
  autoLinked,
  loading,
  contracts,
  contractsLoading,
  contractsError,
  statusOptions,
  responsavelOptions,
  leadMutationLoading,
  onStatusChange,
  onResponsavelChange,
  onRefreshContracts,
  onViewLead,
  onUnlinkLead,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchError,
  suggestedLead,
  searchLoading,
  onRetryLeadPanel,
  onRetrySearch,
  onCreateLead,
  onLinkLead,
  linkLoadingLeadId,
  canViewAgenda,
  canEditAgenda,
  onSaveContact,
}: WhatsAppLeadDrawerProps) {
  const [activeTab, setActiveTab] = useState<LeadDrawerTab>('info');
  const phoneRegion = getCommWhatsAppPhoneRegion(chatPhoneNumber);

  useEffect(() => {
    setActiveTab('info');
  }, [chatId, isOpen]);

  const getStatusColor = useCallback(
    (statusName: string | null | undefined) => {
      if (!statusName) return null;
      return statusOptions.find((option) => option.nome === statusName)?.cor ?? null;
    },
    [statusOptions],
  );

  const agendaRequestIdRef = useRef(0);
  const [agendaReminders, setAgendaReminders] = useState<ReminderContextItem[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [agendaRescheduleTargetId, setAgendaRescheduleTargetId] = useState<string | null>(null);
  const [agendaRescheduleValue, setAgendaRescheduleValue] = useState('');
  const [agendaActionLoading, setAgendaActionLoading] = useState<Record<string, boolean>>({});
  const [agendaRescheduleLoading, setAgendaRescheduleLoading] = useState<Record<string, boolean>>({});
  const agendaMutationLockRef = useRef(new KeyedActionLock());
  const agendaContextKey = [
    isOpen ? 'open' : 'closed',
    chatId ?? '',
    linkedLead?.id ?? '',
    contracts.map((contract) => contract.id).filter(Boolean).sort().join(','),
    canViewAgenda ? 'view' : 'hidden',
  ].join('|');
  const agendaContextKeyRef = useRef(agendaContextKey);
  agendaContextKeyRef.current = agendaContextKey;

  const agendaLead = useMemo(() => {
    if (!linkedLead) {
      return null;
    }

    return {
      id: linkedLead.id,
      nome_completo: linkedLead.nome_completo,
      telefone: linkedLead.telefone,
      responsavel: linkedLead.responsavel_value ?? linkedLead.responsavel_label ?? '',
    };
  }, [linkedLead]);

  const sortedAgendaReminders = useMemo(
    () => [...agendaReminders].sort((left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime()),
    [agendaReminders],
  );
  const pendingAgendaReminders = useMemo(
    () => sortedAgendaReminders.filter((reminder) => !reminder.lido),
    [sortedAgendaReminders],
  );
  const minAgendaRescheduleDateTime = useMemo(
    () => formatDateTimeForInput(new Date().toISOString()),
    [],
  );
  const todayKey = useMemo(() => getDayKey(new Date()), []);
  const overdueAgendaReminders = useMemo(
    () => pendingAgendaReminders.filter((reminder) => isOverdue(reminder.data_lembrete)),
    [pendingAgendaReminders],
  );
  const todayAgendaReminders = useMemo(
    () => pendingAgendaReminders.filter((reminder) => !isOverdue(reminder.data_lembrete) && getDayKey(reminder.data_lembrete) === todayKey),
    [pendingAgendaReminders, todayKey],
  );
  const futureAgendaReminders = useMemo(
    () => pendingAgendaReminders.filter((reminder) => !isOverdue(reminder.data_lembrete) && getDayKey(reminder.data_lembrete) !== todayKey),
    [pendingAgendaReminders, todayKey],
  );

  const loadAgendaReminders = useCallback(async () => {
    if (agendaContextKey !== agendaContextKeyRef.current) {
      return;
    }

    if (!linkedLead || !canViewAgenda) {
      agendaRequestIdRef.current += 1;
      setAgendaLoading(false);
      setAgendaReminders([]);
      setAgendaError(null);
      return;
    }

    const requestId = ++agendaRequestIdRef.current;
    const leadId = linkedLead.id;
    const contractIds = contracts.map((contract) => contract.id).filter(Boolean);

    setAgendaLoading(true);
    setAgendaError(null);

    try {
      const { leadReminders, contractReminders } =
        await listRemindersForLeadContext(leadId, contractIds);

      const next = new Map<string, ReminderContextItem>();
      [...leadReminders, ...contractReminders].forEach((reminder) => {
        next.set(reminder.id, reminder);
      });

      if (requestId !== agendaRequestIdRef.current || agendaContextKey !== agendaContextKeyRef.current) {
        return;
      }

      setAgendaReminders(Array.from(next.values()));
    } catch (error) {
      if (requestId !== agendaRequestIdRef.current || agendaContextKey !== agendaContextKeyRef.current) {
        return;
      }

      console.error('[WhatsAppLeadDrawer] erro ao carregar agenda do chat', error);
      setAgendaError('Não foi possível carregar a agenda deste chat agora.');
    } finally {
      if (requestId === agendaRequestIdRef.current && agendaContextKey === agendaContextKeyRef.current) {
        setAgendaLoading(false);
      }
    }
  }, [agendaContextKey, canViewAgenda, contracts, linkedLead]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadAgendaReminders();
  }, [isOpen, loadAgendaReminders]);

  useEffect(() => {
    if (!isOpen || !linkedLead?.id || !canViewAgenda) return;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToReminderChanges(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadAgendaReminders(), 150);
    });
    return () => {
      clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [canViewAgenda, isOpen, linkedLead?.id, loadAgendaReminders]);

  const handleAgendaToggleRead = useCallback(async (reminderId: string, currentStatus: boolean) => {
    try {
      const completionDate = !currentStatus ? new Date().toISOString() : null;
      await updateReminder(reminderId, {
        lido: !currentStatus,
        concluido_em: completionDate,
      });

      if (linkedLead?.id) {
        await syncLeadNextReturnFromUpcomingReminder(linkedLead.id);
      }

      await loadAgendaReminders();
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao atualizar lembrete do chat', error);
      throw error;
    }
  }, [linkedLead?.id, loadAgendaReminders]);

  const handleAgendaReschedule = useCallback(async (reminderId: string, newDate: string) => {
    try {
      const nextDateIso = new Date(newDate).toISOString();
      await updateReminder(reminderId, { data_lembrete: nextDateIso });

      if (linkedLead?.id) {
        await syncLeadNextReturnFromUpcomingReminder(linkedLead.id);
      }

      await loadAgendaReminders();
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao reagendar lembrete do chat', error);
      throw error;
    }
  }, [linkedLead?.id, loadAgendaReminders]);

  const openAgendaReschedule = (reminder: ReminderContextItem) => {
    setAgendaRescheduleTargetId(reminder.id);
    setAgendaRescheduleValue(formatDateTimeForInput(reminder.data_lembrete));
  };

  const closeAgendaReschedule = () => {
    setAgendaRescheduleTargetId(null);
    setAgendaRescheduleValue('');
  };

  const handleAgendaToggleReadAction = async (reminder: ReminderContextItem) => {
    if (!agendaMutationLockRef.current.tryAcquire(reminder.id)) {
      return;
    }

    setAgendaActionLoading((current) => ({ ...current, [reminder.id]: true }));

    try {
      await handleAgendaToggleRead(reminder.id, reminder.lido);
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao alternar lembrete do chat', error);
      toast.error('Não foi possível atualizar o lembrete.');
    } finally {
      setAgendaActionLoading((current) => {
        const next = { ...current };
        delete next[reminder.id];
        return next;
      });
      agendaMutationLockRef.current.release(reminder.id);
    }
  };

  const handleAgendaRescheduleSubmit = async (reminder: ReminderContextItem) => {
    if (!agendaRescheduleValue) {
      toast.warning('Informe a nova data e hora do lembrete.');
      return;
    }

    if (!agendaMutationLockRef.current.tryAcquire(reminder.id)) {
      return;
    }

    setAgendaRescheduleLoading((current) => ({ ...current, [reminder.id]: true }));

    try {
      await handleAgendaReschedule(reminder.id, agendaRescheduleValue);
      closeAgendaReschedule();
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao salvar reagendamento do chat', error);
      toast.error('Não foi possível reagendar o lembrete.');
    } finally {
      setAgendaRescheduleLoading((current) => {
        const next = { ...current };
        delete next[reminder.id];
        return next;
      });
      agendaMutationLockRef.current.release(reminder.id);
    }
  };

  const renderAgendaReminderItem = (reminder: ReminderContextItem) => {
    const isRescheduling = agendaRescheduleLoading[reminder.id];
    const isToggling = agendaActionLoading[reminder.id];
    const isOpen = agendaRescheduleTargetId === reminder.id;
    const overdue = isOverdue(reminder.data_lembrete);

    return (
      <Surface key={reminder.id} padding="sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Text className="truncate text-sm font-semibold text-[var(--text-primary)]">{reminder.titulo}</Text>
              {overdue ? <Badge tone="danger" size="sm">Atrasado</Badge> : null}
            </div>
            <Text className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTimeFullBR(reminder.data_lembrete)}
            </Text>
            {reminder.descricao ? (
              <Text className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{reminder.descricao}</Text>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <Button
              variant="soft"
              size="sm"
              onClick={() => void handleAgendaToggleReadAction(reminder)}
              loading={isToggling}
              disabled={!canEditAgenda || isRescheduling}
            >
              {!isToggling && <Check className="kds-control-icon" />}
              Concluir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openAgendaReschedule(reminder)}
              disabled={!canEditAgenda || isToggling || isRescheduling}
            >
              <ArrowUpRight className="kds-control-icon" />
              Reagendar
            </Button>
          </div>
        </div>

        {isOpen && canEditAgenda ? (
          <Surface variant="muted" padding="sm" className="mt-3">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Novo horário</Text>
            <DateTimePicker
              type="datetime-local"
              value={agendaRescheduleValue}
              onChange={(event) => setAgendaRescheduleValue(event.target.value)}
              className="mt-2"
              min={minAgendaRescheduleDateTime}
              placeholder="Selecionar nova data"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={closeAgendaReschedule} disabled={isRescheduling}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={() => void handleAgendaRescheduleSubmit(reminder)} loading={isRescheduling}>
                {!isRescheduling && 'Salvar'}
              </Button>
            </div>
          </Surface>
        ) : null}
      </Surface>
    );
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const drawerContent = (
    <>
        <DrawerHeader onClose={onClose} className="comm-whatsapp-lead-drawer-header">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary)]">{presentation === 'sidebar' ? 'Informações do contato' : 'Info do chat'}</Text>
          {presentation === 'sidebar' ? (
            <Heading level={2} className="mt-1 text-base font-semibold text-[var(--text-primary)]">{chatDisplayName}</Heading>
          ) : (
            <DialogTitle className="mt-1">{chatDisplayName}</DialogTitle>
          )}
          {presentation === 'drawer' ? <Text className="mt-1 text-sm text-[var(--text-muted)]">Lead, contratos e próximos acompanhamentos</Text> : null}
          <div className="mt-3 min-w-0 space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-sm text-[var(--text-secondary)]">
              <span className="min-w-0 truncate">{formatCommWhatsAppPhoneLabel(chatPhoneNumber)}</span>
              {phoneRegion ? (
                <Badge tone="neutral" size="sm" icon={MapPin} title={`DDD ${phoneRegion.ddd}: ${phoneRegion.name}. Região do telefone; não indica a localização atual do contato.`} aria-label={`DDD ${phoneRegion.ddd}: ${phoneRegion.name}`}>
                  {phoneRegion.uf} · DDD {phoneRegion.ddd}
                </Badge>
              ) : null}
              <WhatsAppPresenceIndicator chat={chat} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => onSaveContact(chat.saved_contact_name || chatDisplayName)}
              >
                {chat.saved_contact_name ? <Pencil className="kds-control-icon" /> : <UserPlus className="kds-control-icon" />}
                {chat.saved_contact_name ? 'Renomear contato' : 'Salvar contato'}
              </Button>
              {chat.autonomous_attendance_status === 'active' ? (
                <OperationalStatusBadge statusColor="var(--accent-gold)" className="uppercase"><Bot className="h-3 w-3" aria-hidden="true" />IA atendendo</OperationalStatusBadge>
              ) : chat.autonomous_attendance_status === 'handed_off' ? (
                <OperationalStatusBadge statusColor="var(--text-muted)" className="uppercase"><Bot className="h-3 w-3" aria-hidden="true" />IA encerrada</OperationalStatusBadge>
              ) : null}
            </div>
          </div>
        </DrawerHeader>
        <DrawerBody className={presentation === 'sidebar' ? 'comm-whatsapp-lead-drawer-body min-h-0 flex-1 overflow-y-auto' : 'overflow-y-auto'}>
          <Tabs
            items={LEAD_DRAWER_TABS}
            value={activeTab}
            onChange={setActiveTab}
            variant="pill"
            size="sm"
            ariaLabel="Seções de informações do chat"
            className="comm-whatsapp-lead-drawer-tabs mb-5"
          />

          {activeTab === 'critique' ? (
            <WhatsAppAttendanceCritiquePanel chatId={chatId} isActive={activeTab === 'critique'} />
          ) : loading ? (
            <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando informações do chat...
            </div>
          ) : leadPanelError ? (
            <Surface variant="danger" padding="sm" className="flex items-start gap-3" role="alert">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <Text className="font-semibold text-[var(--text-primary)]">Não foi possível carregar o lead.</Text>
                <Text className="mt-1 text-sm leading-6">O lead pode continuar vinculado a esta conversa. Tente novamente antes de criar ou vincular outro lead.</Text>
                <Button variant="secondary" size="sm" className="mt-3" onClick={onRetryLeadPanel}>
                  <RefreshCw className="kds-control-icon" aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            </Surface>
          ) : linkedLead ? (
            <div className="space-y-5">
              <Surface variant="muted" padding="sm" className="comm-whatsapp-lead-link-state flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <Text className="text-sm font-semibold text-[var(--text-primary)]">Lead vinculado</Text>
                    <Text className="text-xs text-[var(--text-muted)]">Informações comerciais desta conversa</Text>
                  </div>
                  {autoLinked && (
                    <Badge tone="accent" size="sm" icon={Sparkles}>Automático</Badge>
                  )}
                </div>
                {onUnlinkLead && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onUnlinkLead}
                    loading={leadMutationLoading}
                    disabled={leadMutationLoading}
                    className="shrink-0"
                  >
                    {!leadMutationLoading && <Unlink className="kds-control-icon" />}
                    {leadMutationLoading ? 'Atualizando...' : 'Desvincular'}
                  </Button>
                )}
              </Surface>

              <LeadDetailsPanel
                className="whatsapp-lead-drawer-panel rounded-2xl border-[var(--border-subtle)] bg-transparent shadow-none"
                lead={{ ...linkedLead, observacoes: linkedLead.observacoes ?? undefined, favorito: linkedLead.favorito ?? undefined }}
                statusOptions={statusOptions}
                responsavelOptions={responsavelOptions}
                onStatusChange={onStatusChange}
                onResponsavelChange={onResponsavelChange}
                contracts={contracts as unknown as Contract[]}
                contractsLoading={contractsLoading}
                contractsError={contractsError}
                onRefreshContracts={onRefreshContracts}
                onViewLead={onViewLead}
                disabled={leadMutationLoading}
              />

              {canViewAgenda ? (
                <Surface variant="muted" padding="sm" className="sm:p-5">
                  <div className="comm-whatsapp-chat-agenda-header flex min-w-0 flex-col gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Heading level={3} className="min-w-0 text-base font-semibold leading-tight text-[var(--text-primary)]">
                        Agenda do chat
                      </Heading>
                      <InfoTooltip
                        content="Reúne lembretes do lead e dos contratos ligados a esta conversa. Agende, conclua ou reagende sem sair da Inbox."
                        label="Sobre a agenda do chat"
                        side="left"
                      />
                    </div>

                    <div className={`comm-whatsapp-chat-agenda-actions grid gap-2 ${agendaLead && canEditAgenda ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {agendaLead && canEditAgenda ? (
                        <Button variant="secondary" size="sm" className="w-full justify-center" onClick={() => setSchedulerOpen(true)}>
                          <CalendarPlus className="kds-control-icon" />
                          Agendar
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => void loadAgendaReminders()} disabled={agendaLoading}>
                        <RefreshCw className={`h-4 w-4 ${agendaLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </div>

                  {agendaError ? (
                    <Surface variant="danger" padding="sm" className="mt-4 flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="text-sm">{agendaError}</span>
                    </Surface>
                  ) : agendaLoading ? (
                    <div className="mt-4 space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4">
                          <div className="h-4 w-28 rounded bg-[var(--bg-hover)]" />
                          <div className="mt-3 h-3 w-40 rounded bg-[var(--bg-inset)]" />
                          <div className="mt-4 h-8 w-full rounded bg-[var(--bg-inset)]" />
                        </div>
                      ))}
                    </div>
                  ) : pendingAgendaReminders.length === 0 ? (
                    <EmptyState
                      className="mt-4"
                      icon={<Bell className="h-5 w-5" />}
                      title="Nenhum lembrete pendente"
                      description="A agenda deste chat está em dia no momento."
                    />
                  ) : (
                    <div className="mt-4 space-y-4">
                      {[
                        {
                          id: 'overdue',
                          title: 'Atrasados',
                          subtitle: 'Precisam de ação imediata.',
                          items: overdueAgendaReminders,
                          toneClassName: 'text-[var(--danger-text)]',
                        },
                        {
                          id: 'today',
                          title: 'Hoje',
                          subtitle: 'Compromissos do dia atual.',
                          items: todayAgendaReminders,
                          toneClassName: 'text-[var(--accent-gold-hover)]',
                        },
                        {
                          id: 'future',
                          title: 'Futuros',
                          subtitle: 'Próximos acompanhamentos agendados.',
                          items: futureAgendaReminders,
                          toneClassName: 'text-[var(--text-secondary)]',
                        },
                      ].map((section) => (
                        <div key={section.id} className="space-y-3">
                          <div className="flex items-center justify-between gap-3 px-1">
                            <div>
                              <Text className={`text-sm font-semibold ${section.toneClassName}`}>{section.title}</Text>
                              <Text className="text-xs text-[var(--text-muted)]">{section.subtitle}</Text>
                            </div>
                            <Badge tone="neutral" size="sm">{section.items.length}</Badge>
                          </div>

                          {section.items.length > 0 ? (
                            <div className="space-y-3">{section.items.slice(0, 4).map(renderAgendaReminderItem)}</div>
                          ) : (
                            <Surface padding="sm" className="text-sm text-[var(--text-muted)]">
                              Nenhum lembrete nesta seção.
                            </Surface>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <Surface variant="muted" padding="sm" className="flex items-start gap-3 text-sm text-[var(--text-secondary)]">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary)]" />
                <div>
                  <Text className="font-semibold text-[var(--text-primary)]">Nenhum lead vinculado</Text>
                  <Text className="mt-1 leading-6 text-[var(--text-muted)]">
                    Procure um contato já cadastrado para vincular esta conversa e atualizar o atendimento sem sair daqui.
                  </Text>
                </div>
              </Surface>

              <div className="space-y-3">
                {onCreateLead ? (
                  <Button variant="primary" size="sm" className="w-full justify-center" onClick={onCreateLead}>
                    <Plus className="kds-control-icon" />
                    Criar novo lead
                  </Button>
                ) : null}

                <SearchInput
                  value={searchQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
                  placeholder="Buscar lead por nome ou telefone"
                />

                {suggestedLead && (
                  <Surface padding="sm" className="border-[var(--brand-primary-border)]">
                    <div className="flex items-start gap-3">
                      <LeadAvatar label={suggestedLead.nome_completo || suggestedLead.telefone || '?'} />
                      <div className="min-w-0 flex-1">
                        <Text className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-gold-hover)]">
                          Sugestão para esta conversa
                        </Text>
                        <Text className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-primary)]">
                          <LeadFavoriteBadge favorito={suggestedLead.favorito} />
                          {suggestedLead.nome_completo || 'Lead sem nome'}
                        </Text>
                        <Text className="truncate text-xs text-[var(--text-muted)]">{suggestedLead.telefone}</Text>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge
                            tone="neutral"
                            size="sm"
                            style={getStatusColor(suggestedLead.status_nome) ? getBadgeStyle(getStatusColor(suggestedLead.status_nome)!) : undefined}
                          >
                            {suggestedLead.status_nome || 'Sem status'}
                          </Badge>
                          {suggestedLead.responsavel_label ? <Badge tone="neutral" size="sm">{suggestedLead.responsavel_label}</Badge> : null}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onLinkLead(suggestedLead.id)}
                        loading={linkLoadingLeadId === suggestedLead.id}
                      >
                        {linkLoadingLeadId !== suggestedLead.id && <Link2 className="kds-control-icon" />}
                        Vincular
                      </Button>
                    </div>
                  </Surface>
                )}

                {searchError ? (
                  <Surface variant="danger" padding="sm" className="flex items-start gap-3" role="alert">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <Text className="font-semibold text-[var(--text-primary)]">Não foi possível buscar leads.</Text>
                      <Text className="mt-1 text-sm leading-6">O resultado vazio não confirma que não existem leads. Tente novamente.</Text>
                      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetrySearch}>
                        <RefreshCw className="kds-control-icon" aria-hidden="true" />
                        Tentar novamente
                      </Button>
                    </div>
                  </Surface>
                ) : searchLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[var(--border-subtle)] px-4 py-6 text-sm text-[var(--text-muted)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando leads...
                  </div>
                ) : searchResults.length === 0 ? (
                  <EmptyState title="Nenhum lead encontrado" description="Tente buscar por outro nome ou telefone." />
                ) : (
                  <div className="space-y-2">
                    {searchResults
                      .filter((lead) => lead.id !== suggestedLead?.id)
                      .map((lead) => (
                      <Surface key={lead.id} variant="muted" padding="sm" className="flex items-center gap-3">
                        <LeadAvatar label={lead.nome_completo || lead.telefone || '?'} />
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
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onLinkLead(lead.id)}
                          loading={linkLoadingLeadId === lead.id}
                        >
                          {linkLoadingLeadId !== lead.id && <Link2 className="kds-control-icon" />}
                          Vincular
                        </Button>
                      </Surface>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DrawerBody>
    </>
  );

  return (
    <>
      {presentation === 'sidebar' ? (
        <aside className="kds-inbox-lead-context-panel is-open flex min-h-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]" aria-label="Informações do contato">
          {drawerContent}
        </aside>
      ) : (
        <Drawer
          open={isOpen}
          onOpenChange={(open) => !open && onClose()}
          side="right"
          size="md"
          className="comm-whatsapp-lead-drawer"
        >
          {drawerContent}
        </Drawer>
      )}


      {schedulerOpen && agendaLead ? (
        <ReminderSchedulerModal
          lead={agendaLead}
          onClose={() => setSchedulerOpen(false)}
          onScheduled={() => {
            setSchedulerOpen(false);
            void syncLeadNextReturnFromUpcomingReminder(agendaLead!.id);
            void loadAgendaReminders();
            toast.success('Lembrete criado na agenda do chat.');
          }}
          promptMessage="Agende o próximo lembrete deste chat sem sair do inbox."
          defaultType="Follow-up"
        />
      ) : null}
    </>
  );
}
