import { AlertTriangle, ArrowUpRight, Bell, CalendarDays, CalendarPlus, Check, Clock3, Loader2, RefreshCw, Sparkles, Unlink, Info, Link2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';

import LeadDetailsPanel from '../../../../components/LeadDetailsPanel';
import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import Button from '../../../../components/ui/Button';
import DateTimePicker from '../../../../components/ui/DateTimePicker';
import DrawerShell from '../../../../components/ui/DrawerShell';
import Input from '../../../../components/ui/Input';
import { SAO_PAULO_TIMEZONE, formatDateTimeForInput, formatDateTimeFullBR, isOverdue } from '../../../../lib/dateUtils';
import { syncLeadNextReturnFromUpcomingReminder } from '../../../../lib/leadReminderUtils';
import { supabase, fetchAllPages, type Reminder } from '../../../../lib/supabase';
import { toast } from '../../../../lib/toast';
import type {
  CommWhatsAppLeadContractSummary,
  CommWhatsAppLeadPanel,
  CommWhatsAppLeadSearchResult,
} from '../../../../lib/commWhatsAppService';
import type { ConfigOption, Contract, LeadStatusConfig } from '../../../../lib/supabase';

type WhatsAppLeadDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  chatDisplayName: string;
  linkedLead: CommWhatsAppLeadPanel | null;
  autoLinked: boolean;
  loading: boolean;
  contracts: CommWhatsAppLeadContractSummary[];
  contractsLoading: boolean;
  contractsError: string | null;
  statusOptions: LeadStatusConfig[];
  responsavelOptions: ConfigOption[];
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onResponsavelChange: (leadId: string, responsavelValue: string) => Promise<void>;
  onRefreshContracts: () => void;
  onViewLead: (() => void) | undefined;
  onUnlinkLead: (() => void) | undefined;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: CommWhatsAppLeadSearchResult[];
  suggestedLead: CommWhatsAppLeadSearchResult | null;
  searchLoading: boolean;
  onLinkLead: (leadId: string) => void;
  linkLoadingLeadId: string | null;
  canViewAgenda: boolean;
  canEditAgenda: boolean;
  onOpenAgenda: (() => void) | undefined;
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

export default function WhatsAppLeadDrawer({
  isOpen,
  onClose,
  chatDisplayName,
  linkedLead,
  autoLinked,
  loading,
  contracts,
  contractsLoading,
  contractsError,
  statusOptions,
  responsavelOptions,
  onStatusChange,
  onResponsavelChange,
  onRefreshContracts,
  onViewLead,
  onUnlinkLead,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  suggestedLead,
  searchLoading,
  onLinkLead,
  linkLoadingLeadId,
  canViewAgenda,
  canEditAgenda,
  onOpenAgenda,
}: WhatsAppLeadDrawerProps) {
  const [agendaReminders, setAgendaReminders] = useState<Reminder[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [agendaRescheduleTargetId, setAgendaRescheduleTargetId] = useState<string | null>(null);
  const [agendaRescheduleValue, setAgendaRescheduleValue] = useState('');
  const [agendaActionLoading, setAgendaActionLoading] = useState<Record<string, boolean>>({});
  const [agendaRescheduleLoading, setAgendaRescheduleLoading] = useState<Record<string, boolean>>({});

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
    if (!linkedLead || !canViewAgenda) {
      setAgendaReminders([]);
      setAgendaError(null);
      return;
    }

    setAgendaLoading(true);
    setAgendaError(null);

    try {
      const contractIds = contracts.map((contract) => contract.id).filter(Boolean);
      const [leadReminders, contractReminders] = await Promise.all([
        fetchAllPages<Reminder>(
          (from, to) =>
            supabase
              .from('reminders')
              .select('*')
              .eq('lead_id', linkedLead.id)
              .order('data_lembrete', { ascending: true })
              .order('id', { ascending: true })
              .range(from, to) as unknown as Promise<{ data: Reminder[] | null; error: unknown }>,
        ),
        contractIds.length > 0
          ? fetchAllPages<Reminder>(
              (from, to) =>
                supabase
                  .from('reminders')
                  .select('*')
                  .in('contract_id', contractIds)
                  .order('data_lembrete', { ascending: true })
                  .order('id', { ascending: true })
                  .range(from, to) as unknown as Promise<{ data: Reminder[] | null; error: unknown }>,
            )
          : Promise.resolve([] as Reminder[]),
      ]);

      const next = new Map<string, Reminder>();
      [...leadReminders, ...contractReminders].forEach((reminder) => {
        next.set(reminder.id, reminder);
      });
      setAgendaReminders(Array.from(next.values()));
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao carregar agenda do chat', error);
      setAgendaError('Não foi possível carregar a agenda deste chat agora.');
    } finally {
      setAgendaLoading(false);
    }
  }, [canViewAgenda, contracts, linkedLead]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadAgendaReminders();
  }, [isOpen, loadAgendaReminders]);

  const handleAgendaToggleRead = useCallback(async (reminderId: string, currentStatus: boolean) => {
    try {
      const completionDate = !currentStatus ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('reminders')
        .update({
          lido: !currentStatus,
          concluido_em: completionDate,
        })
        .eq('id', reminderId);

      if (error) {
        throw error;
      }

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
      const { error } = await supabase
        .from('reminders')
        .update({ data_lembrete: nextDateIso })
        .eq('id', reminderId);

      if (error) {
        throw error;
      }

      if (linkedLead?.id) {
        await syncLeadNextReturnFromUpcomingReminder(linkedLead.id);
      }

      await loadAgendaReminders();
    } catch (error) {
      console.error('[WhatsAppLeadDrawer] erro ao reagendar lembrete do chat', error);
      throw error;
    }
  }, [linkedLead?.id, loadAgendaReminders]);

  const openAgendaReschedule = (reminder: Reminder) => {
    setAgendaRescheduleTargetId(reminder.id);
    setAgendaRescheduleValue(formatDateTimeForInput(reminder.data_lembrete));
  };

  const closeAgendaReschedule = () => {
    setAgendaRescheduleTargetId(null);
    setAgendaRescheduleValue('');
  };

  const handleAgendaToggleReadAction = async (reminder: Reminder) => {
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
    }
  };

  const handleAgendaRescheduleSubmit = async (reminder: Reminder) => {
    if (!agendaRescheduleValue) {
      toast.warning('Informe a nova data e hora do lembrete.');
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
    }
  };

  const renderAgendaReminderItem = (reminder: Reminder) => {
    const isRescheduling = agendaRescheduleLoading[reminder.id];
    const isToggling = agendaActionLoading[reminder.id];
    const isOpen = agendaRescheduleTargetId === reminder.id;
    const overdue = isOverdue(reminder.data_lembrete);

    return (
      <div key={reminder.id} className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">{reminder.titulo}</p>
              {overdue ? (
                <span className="rounded-full border border-[var(--panel-accent-red-border,#d79a8f)] bg-[rgba(122,33,24,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-red-text,#b4534a)]">
                  Atrasado
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateTimeFullBR(reminder.data_lembrete)}
            </p>
            {reminder.descricao ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--panel-text-soft,#5b4635)]">{reminder.descricao}</p>
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
              {!isToggling && <Check className="h-4 w-4" />}
              Concluir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openAgendaReschedule(reminder)}
              disabled={!canEditAgenda || isToggling || isRescheduling}
            >
              <ArrowUpRight className="h-4 w-4" />
              Reagendar
            </Button>
          </div>
        </div>

        {isOpen && canEditAgenda ? (
          <div className="mt-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">Novo horário</p>
            <DateTimePicker
              type="datetime-local"
              value={agendaRescheduleValue}
              onChange={setAgendaRescheduleValue}
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
          </div>
        ) : null}
      </div>
    );
  };

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return (
    <>
      <DrawerShell
        isOpen={isOpen}
        onClose={onClose}
        eyebrow="CRM do chat"
        title={chatDisplayName}
        closeButtonLabel="Fechar painel do lead"
        panelClassName="max-w-[440px]"
      >
          {loading ? (
            <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando dados do CRM...
            </div>
          ) : linkedLead ? (
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                {autoLinked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Vinculado automaticamente
                  </span>
                )}
                {onUnlinkLead && (
                  <Button variant="secondary" size="sm" onClick={onUnlinkLead}>
                    <Unlink className="h-4 w-4" />
                    Desvincular
                  </Button>
                )}
              </div>

              <LeadDetailsPanel
                className="whatsapp-lead-drawer-panel min-h-[520px] rounded-2xl border-[var(--panel-border-subtle,#e7dac8)] bg-transparent shadow-none"
                lead={{ ...linkedLead, observacoes: linkedLead.observacoes ?? undefined }}
                statusOptions={statusOptions}
                responsavelOptions={responsavelOptions}
                onStatusChange={onStatusChange}
                onResponsavelChange={onResponsavelChange}
                contracts={contracts as unknown as Contract[]}
                contractsLoading={contractsLoading}
                contractsError={contractsError}
                onRefreshContracts={onRefreshContracts}
                onViewLead={onViewLead}
              />

              {canViewAgenda ? (
                <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-text-muted,#876f5c)]">
                        Agenda do chat
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--panel-text,#1c1917)]">
                        Acompanhamento contextual
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--panel-text-muted,#876f5c)]">
                        Lembretes do lead e dos contratos vinculados a esta conversa, com foco na próxima ação operacional.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {agendaLead && canEditAgenda ? (
                        <Button variant="secondary" size="sm" onClick={() => setSchedulerOpen(true)}>
                          <CalendarPlus className="h-4 w-4" />
                          Agendar
                        </Button>
                      ) : null}
                      {onOpenAgenda ? (
                        <Button variant="soft" size="sm" onClick={onOpenAgenda}>
                          <CalendarDays className="h-4 w-4" />
                          Agenda completa
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => void loadAgendaReminders()} disabled={agendaLoading}>
                        <RefreshCw className={`h-4 w-4 ${agendaLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                    </div>
                  </div>

                  {agendaError ? (
                    <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[var(--panel-accent-red-border,#d79a8f)] bg-[rgba(122,33,24,0.08)] px-4 py-3 text-sm text-[var(--panel-accent-red-text,#b4534a)]">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{agendaError}</span>
                    </div>
                  ) : agendaLoading ? (
                    <div className="mt-4 space-y-3">
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="animate-pulse rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-4">
                          <div className="h-4 w-28 rounded bg-black/10" />
                          <div className="mt-3 h-3 w-40 rounded bg-black/5" />
                          <div className="mt-4 h-8 w-full rounded bg-black/5" />
                        </div>
                      ))}
                    </div>
                  ) : pendingAgendaReminders.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-8 text-center">
                      <Bell className="mx-auto h-5 w-5 text-[var(--panel-text-muted,#876f5c)]" />
                      <p className="mt-3 text-base font-semibold text-[var(--panel-text,#1c1917)]">Nenhum lembrete pendente</p>
                      <p className="mt-1 text-sm text-[var(--panel-text-muted,#876f5c)]">
                        A agenda deste chat está em dia no momento.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {[
                        {
                          id: 'overdue',
                          title: 'Atrasados',
                          subtitle: 'Precisam de ação imediata.',
                          items: overdueAgendaReminders,
                          toneClassName: 'text-[var(--panel-accent-red-text,#b4534a)]',
                        },
                        {
                          id: 'today',
                          title: 'Hoje',
                          subtitle: 'Compromissos do dia atual.',
                          items: todayAgendaReminders,
                          toneClassName: 'text-[var(--panel-accent-ink,#8b4d12)]',
                        },
                        {
                          id: 'future',
                          title: 'Futuros',
                          subtitle: 'Próximos acompanhamentos agendados.',
                          items: futureAgendaReminders,
                          toneClassName: 'text-[var(--panel-text-soft,#5b4635)]',
                        },
                      ].map((section) => (
                        <div key={section.id} className="space-y-3">
                          <div className="flex items-center justify-between gap-3 px-1">
                            <div>
                              <p className={`text-sm font-semibold ${section.toneClassName}`}>{section.title}</p>
                              <p className="text-xs text-[var(--panel-text-muted,#876f5c)]">{section.subtitle}</p>
                            </div>
                            <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-[11px] font-semibold text-[var(--panel-text-soft,#5b4635)]">
                              {section.items.length}
                            </span>
                          </div>

                          {section.items.length > 0 ? (
                            <div className="space-y-3">{section.items.slice(0, 4).map(renderAgendaReminderItem)}</div>
                          ) : (
                            <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-4 text-sm text-[var(--panel-text-muted,#876f5c)]">
                              Nenhum lembrete nesta seção.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-4 py-4 text-sm text-[var(--panel-text-soft,#5b4635)]">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-[var(--panel-accent-strong,#c86f1d)]" />
                  <div>
                    <p className="font-semibold text-[var(--panel-text,#1c1917)]">Nenhum lead vinculado</p>
                    <p className="mt-1 leading-6 text-[var(--panel-text-muted,#876f5c)]">
                      Procure um lead existente do CRM para ligar esta conversa e editar status sem sair do inbox.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  value={searchQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
                  placeholder="Buscar lead por nome ou telefone"
                />

                {suggestedLead && (
                  <div className="rounded-2xl border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/45 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">
                          Sugestão para esta conversa
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">
                          {suggestedLead.nome_completo || 'Lead sem nome'}
                        </p>
                        <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{suggestedLead.telefone}</p>
                        <p className="mt-1 truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                          {suggestedLead.status_nome || 'Sem status'}
                          {suggestedLead.responsavel_label ? ` • ${suggestedLead.responsavel_label}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onLinkLead(suggestedLead.id)}
                        loading={linkLoadingLeadId === suggestedLead.id}
                      >
                        {linkLoadingLeadId !== suggestedLead.id && <Link2 className="h-4 w-4" />}
                        Vincular
                      </Button>
                    </div>
                  </div>
                )}

                {searchLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] px-4 py-6 text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando leads...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] px-4 py-6 text-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    Nenhum lead encontrado para esta busca.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults
                      .filter((lead) => lead.id !== suggestedLead?.id)
                      .map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">{lead.nome_completo || 'Lead sem nome'}</p>
                          <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{lead.telefone}</p>
                          <p className="mt-1 truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                            {lead.status_nome || 'Sem status'}
                            {lead.responsavel_label ? ` • ${lead.responsavel_label}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onLinkLead(lead.id)}
                          loading={linkLoadingLeadId === lead.id}
                        >
                          {linkLoadingLeadId !== lead.id && <Link2 className="h-4 w-4" />}
                          Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
      </DrawerShell>

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
