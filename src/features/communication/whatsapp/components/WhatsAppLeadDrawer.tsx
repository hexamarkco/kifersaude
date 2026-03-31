import { CalendarDays, CalendarPlus, Info, Link2, Loader2, Sparkles, Unlink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';

import LeadDetailsPanel from '../../../../components/LeadDetailsPanel';
import LeadRemindersPanel from '../../../../components/LeadRemindersPanel';
import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import Button from '../../../../components/ui/Button';
import DrawerShell from '../../../../components/ui/DrawerShell';
import Input from '../../../../components/ui/Input';
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
                <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] overflow-hidden">
                  <LeadRemindersPanel
                    title="Agenda deste chat"
                    subtitle="Lembretes do lead e dos contratos vinculados à conversa atual."
                    leadName={linkedLead.nome_completo}
                    reminders={agendaReminders}
                    loading={agendaLoading}
                    error={agendaError}
                    onReload={() => void loadAgendaReminders()}
                    onToggleRead={handleAgendaToggleRead}
                    onReschedule={handleAgendaReschedule}
                    readOnly={!canEditAgenda}
                    actionSlot={(
                      <div className="flex items-center gap-2">
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
                      </div>
                    )}
                  />
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
