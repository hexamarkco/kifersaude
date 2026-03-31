import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import FilterSingleSelect from '../../../../components/FilterSingleSelect';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import {
  PANEL_EMPTY_STATE_STYLE,
  PANEL_INSET_STYLE,
  PANEL_MUTED_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
  getPanelToneStyle,
} from '../../../../components/ui/panelStyles';
import { useConfirmationModal } from '../../../../hooks/useConfirmationModal';
import { formatDateTimeFullBR, getDateKey, isOverdue } from '../../../../lib/dateUtils';
import { formatCommWhatsAppPhoneLabel, type CommWhatsAppLeadContractSummary, type CommWhatsAppLeadPanel } from '../../../../lib/commWhatsAppService';
import { addBusinessDaysSkippingWeekends, formatEstimatedTime } from '../../../../lib/reminderUtils';
import { getReminderWhatsappLink, isReminderPriority } from '../../../reminders/shared/reminderHelpers';
import type { ManualReminderPrompt } from '../../../reminders/shared/reminderTypes';
import { syncLeadNextReturnFromUpcomingReminder } from '../../../../lib/leadReminderUtils';
import { supabase, type CommWhatsAppChat, type Contract, type Lead, type Reminder, fetchAllPages } from '../../../../lib/supabase';
import { toast } from '../../../../lib/toast';

type AgendaStatusFilter = 'nao-lidos' | 'todos' | 'lidos';
type WhatsAppAgendaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentChat: CommWhatsAppChat | null;
  currentLead: CommWhatsAppLeadPanel | null;
  currentLeadContracts: CommWhatsAppLeadContractSummary[];
  canEdit: boolean;
  onOpenLeadInCrm?: () => void;
  onGenerateFollowUp?: () => void;
};

const RELATED_ENTITY_BATCH_SIZE = 80;

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'Todas prioridades' },
  { value: 'alta', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baixa', label: 'Baixa' },
] as const;

const splitIntoBatches = <T,>(items: T[], batchSize: number): T[][] => {
  if (items.length === 0 || batchSize <= 0) {
    return [];
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
};

const fetchContractsByIds = async (ids: Array<string | undefined>) => {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

  if (uniqueIds.length === 0) {
    return [] as Contract[];
  }

  const batches = splitIntoBatches(uniqueIds, RELATED_ENTITY_BATCH_SIZE);
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase.from('contracts').select('*').in('id', batch);

      if (error) {
        throw error;
      }

      return (data ?? []) as Contract[];
    }),
  );

  return results.flat();
};

const fetchLeadsByIds = async (ids: Array<string | undefined>) => {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

  if (uniqueIds.length === 0) {
    return [] as Lead[];
  }

  const batches = splitIntoBatches(uniqueIds, RELATED_ENTITY_BATCH_SIZE);
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase.from('leads').select('*').in('id', batch);

      if (error) {
        throw error;
      }

      return (data ?? []) as Lead[];
    }),
  );

  return results.flat();
};

const getDefaultMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDefaultSelectedDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const buildContextualLead = (
  currentLead: CommWhatsAppLeadPanel | null,
): Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'> | null => {
  if (!currentLead) {
    return null;
  }

  return {
    id: currentLead.id,
    nome_completo: currentLead.nome_completo,
    telefone: currentLead.telefone,
    responsavel: currentLead.responsavel_value ?? currentLead.responsavel_label ?? '',
  };
};

export default function WhatsAppAgendaModal({
  isOpen,
  onClose,
  currentChat,
  currentLead,
  currentLeadContracts,
  canEdit,
  onOpenLeadInCrm,
  onGenerateFollowUp,
}: WhatsAppAgendaModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>('nao-lidos');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(getDefaultMonth);
  const [selectedDate, setSelectedDate] = useState(getDefaultSelectedDate);
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(new Map());
  const [manualReminderQueue, setManualReminderQueue] = useState<ManualReminderPrompt[]>([]);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2;
  } | null>(null);
  const [reschedulingReminderId, setReschedulingReminderId] = useState<string | null>(null);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [directSchedulerOpen, setDirectSchedulerOpen] = useState(false);
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const contextualLead = useMemo(() => buildContextualLead(currentLead), [currentLead]);
  const currentLeadId = contextualLead?.id ?? null;
  const currentLeadContractIds = useMemo(
    () => new Set(currentLeadContracts.map((contract) => contract.id)),
    [currentLeadContracts],
  );

  const getLeadIdForReminder = useCallback(
    (reminder?: Reminder | null) => {
      if (!reminder) {
        return null;
      }

      if (reminder.lead_id) {
        return reminder.lead_id;
      }

      if (reminder.contract_id) {
        return contractsMap.get(reminder.contract_id)?.lead_id ?? null;
      }

      return null;
    },
    [contractsMap],
  );

  const loadReminders = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const remindersData = await fetchAllPages<Reminder>(
        (from, to) =>
          supabase
            .from('reminders')
            .select('*')
            .order('data_lembrete', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to) as unknown as Promise<{
            data: Reminder[] | null;
            error: unknown;
          }>,
      );

      setReminders(remindersData);
      setLastUpdated(new Date());
      setError(null);

      const contractIds = Array.from(
        new Set(remindersData.map((reminder) => reminder.contract_id).filter((id): id is string => Boolean(id))),
      );
      const fetchedContracts = await fetchContractsByIds(contractIds);
      const nextContractsMap = new Map<string, Contract>();
      fetchedContracts.forEach((contract) => {
        nextContractsMap.set(contract.id, contract);
      });
      setContractsMap(nextContractsMap);

      const leadIds = Array.from(
        new Set([
          ...remindersData.map((reminder) => reminder.lead_id).filter((id): id is string => Boolean(id)),
          ...fetchedContracts.map((contract) => contract.lead_id).filter((id): id is string => Boolean(id)),
        ]),
      );
      const fetchedLeads = await fetchLeadsByIds(leadIds);
      const nextLeadsMap = new Map<string, Lead>();
      fetchedLeads.forEach((lead) => {
        nextLeadsMap.set(lead.id, lead);
      });
      setLeadsMap(nextLeadsMap);
    } catch (loadError) {
      console.error('[WhatsAppAgendaModal] erro ao carregar agenda', loadError);
      setError('Nao foi possivel carregar a agenda agora.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCurrentMonth(getDefaultMonth());
    setSelectedDate(getDefaultSelectedDate());
    setReschedulingReminderId(null);
    void loadReminders({ showLoading: true });

    const channel = supabase
      .channel(`whatsapp-agenda-reminders-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
        },
        (payload) => {
          const newReminder = payload.new as Reminder | null;
          const oldReminder = payload.old as Reminder | null;
          const affectedId = newReminder?.id ?? oldReminder?.id;

          if (affectedId && pendingRefreshIdsRef.current.has(affectedId)) {
            pendingRefreshIdsRef.current.delete(affectedId);
            return;
          }

          void loadReminders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, loadReminders]);

  const fetchLeadInfo = useCallback(
    async (leadId: string) => {
      if (!leadId) {
        return null;
      }

      const cachedLead = leadsMap.get(leadId);
      if (cachedLead) {
        return cachedLead;
      }

      try {
        const { data, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (leadError) {
          throw leadError;
        }

        if (!data) {
          return null;
        }

        const leadData = data as Lead;
        setLeadsMap((current) => {
          const next = new Map(current);
          next.set(leadData.id, leadData);
          return next;
        });

        return leadData;
      } catch (leadError) {
        console.error('[WhatsAppAgendaModal] erro ao carregar lead:', leadError);
        return null;
      }
    },
    [leadsMap],
  );

  const compareRemindersByDueAtThenAlphabetical = useCallback(
    (left: Reminder, right: Reminder) => {
      const leftDueAt = new Date(left.data_lembrete).getTime();
      const rightDueAt = new Date(right.data_lembrete).getTime();
      const leftHasValidDate = Number.isFinite(leftDueAt);
      const rightHasValidDate = Number.isFinite(rightDueAt);
      const leftLeadId = getLeadIdForReminder(left);
      const rightLeadId = getLeadIdForReminder(right);

      if (leftHasValidDate && rightHasValidDate && leftDueAt !== rightDueAt) {
        return leftDueAt - rightDueAt;
      }

      if (leftHasValidDate !== rightHasValidDate) {
        return leftHasValidDate ? -1 : 1;
      }

      const leftLeadName = leftLeadId ? leadsMap.get(leftLeadId)?.nome_completo : '';
      const rightLeadName = rightLeadId ? leadsMap.get(rightLeadId)?.nome_completo : '';
      const leftLabel = (leftLeadName || left.titulo || '').trim();
      const rightLabel = (rightLeadName || right.titulo || '').trim();
      const labelComparison = leftLabel.localeCompare(rightLabel, 'pt-BR', {
        sensitivity: 'base',
      });

      if (labelComparison !== 0) {
        return labelComparison;
      }

      return left.id.localeCompare(right.id, 'pt-BR', { sensitivity: 'base' });
    },
    [getLeadIdForReminder, leadsMap],
  );

  const updateLeadNextReturnDate = useCallback(async (leadId: string) => {
    try {
      const nextReturnDate = await syncLeadNextReturnFromUpcomingReminder(leadId);

      setLeadsMap((current) => {
        const next = new Map(current);
        const existing = next.get(leadId);

        if (existing) {
          next.set(leadId, { ...existing, proximo_retorno: nextReturnDate });
        }

        return next;
      });
    } catch (syncError) {
      console.error('[WhatsAppAgendaModal] erro ao sincronizar proximo retorno:', syncError);
    }
  }, []);

  const openLeadInOfficialWhatsApp = (lead?: Pick<Lead, 'telefone'> | null) => {
    const whatsappLink = getReminderWhatsappLink(lead?.telefone);

    if (!whatsappLink) {
      return;
    }

    window.open(whatsappLink, '_blank', 'noopener,noreferrer');
  };

  const handleMarkLeadAsLost = useCallback(async (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);

    if (!leadId) {
      toast.error('Nao foi possivel identificar o lead deste lembrete.');
      return;
    }

    const leadInfo = leadsMap.get(leadId) ?? (await fetchLeadInfo(leadId));
    const leadName = leadInfo?.nome_completo ?? 'este lead';
    const previousStatus = leadInfo?.status ?? 'Sem status';

    const confirmed = await requestConfirmation({
      title: 'Marcar lead como perdido',
      description: `Deseja marcar ${leadName} como perdido e remover os lembretes pendentes?`,
      confirmLabel: 'Marcar como perdido',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setMarkingLostLeadId(leadId);

    try {
      const nowIso = new Date().toISOString();

      const { error: updateLeadError } = await supabase
        .from('leads')
        .update({
          status: 'Perdido',
          proximo_retorno: null,
          ultimo_contato: nowIso,
        })
        .eq('id', leadId);

      if (updateLeadError) {
        throw updateLeadError;
      }

      if (leadInfo) {
        await supabase.from('interactions').insert([
          {
            lead_id: leadId,
            tipo: 'Observacao',
            descricao: `Status alterado de "${previousStatus}" para "Perdido"`,
            responsavel: leadInfo.responsavel,
          },
        ]);

        await supabase.from('lead_status_history').insert([
          {
            lead_id: leadId,
            status_anterior: previousStatus,
            status_novo: 'Perdido',
            responsavel: leadInfo.responsavel,
          },
        ]);
      }

      const remindersForLead = reminders.filter((item) => getLeadIdForReminder(item) === leadId);
      remindersForLead.forEach((item) => pendingRefreshIdsRef.current.add(item.id));

      const { error: deleteRemindersError } = await supabase.from('reminders').delete().eq('lead_id', leadId);

      if (deleteRemindersError) {
        throw deleteRemindersError;
      }

      setLeadsMap((current) => {
        const next = new Map(current);
        const existing = next.get(leadId);

        if (existing) {
          next.set(leadId, {
            ...existing,
            status: 'Perdido',
            proximo_retorno: null,
            ultimo_contato: nowIso,
          });
        }

        return next;
      });

      setReminders((current) => current.filter((item) => getLeadIdForReminder(item) !== leadId));
      toast.success('Lead marcado como perdido.');
    } catch (markError) {
      console.error('[WhatsAppAgendaModal] erro ao marcar lead como perdido:', markError);
      toast.error('Nao foi possivel marcar o lead como perdido.');
    } finally {
      setMarkingLostLeadId(null);
    }
  }, [fetchLeadInfo, getLeadIdForReminder, leadsMap, reminders, requestConfirmation]);

  const handleMarkAsRead = useCallback(async (
    reminderId: string,
    currentStatus: boolean,
    options?: { queueNextReminderPrompt?: boolean },
  ) => {
    try {
      pendingRefreshIdsRef.current.add(reminderId);
      const queueNextReminderPrompt = options?.queueNextReminderPrompt ?? true;
      const reminder = reminders.find((item) => item.id === reminderId);
      const leadId = getLeadIdForReminder(reminder);
      const completionDate = !currentStatus ? new Date().toISOString() : null;

      const { error: updateError } = await supabase
        .from('reminders')
        .update({
          lido: !currentStatus,
          concluido_em: completionDate,
        })
        .eq('id', reminderId);

      if (updateError) {
        pendingRefreshIdsRef.current.delete(reminderId);
        throw updateError;
      }

      if (leadId) {
        await updateLeadNextReturnDate(leadId);
      }

      if (completionDate && leadId && reminder && queueNextReminderPrompt) {
        let leadInfo = leadsMap.get(leadId);

        if (!leadInfo) {
          const fetchedLeadInfo = await fetchLeadInfo(leadId);
          if (fetchedLeadInfo) {
            leadInfo = fetchedLeadInfo;
          }
        }

        if (leadInfo) {
          setManualReminderQueue((current) => [
            ...current,
            {
              lead: leadInfo,
              promptMessage: 'Deseja marcar um proximo lembrete para este lead?',
              defaultTitle: reminder.titulo,
              defaultDescription: reminder.descricao ?? undefined,
              defaultType: 'Follow-up',
              defaultPriority: isReminderPriority(reminder.prioridade) ? reminder.prioridade : 'normal',
            },
          ]);
        }
      }

      setReminders((current) =>
        current.map((item) =>
          item.id === reminderId
            ? {
                ...item,
                lido: !currentStatus,
                concluido_em: completionDate ?? undefined,
              }
            : item,
        ),
      );

      return true;
    } catch (updateError) {
      console.error('[WhatsAppAgendaModal] erro ao atualizar lembrete:', updateError);
      toast.error('Nao foi possivel atualizar este item.');
      return false;
    }
  }, [fetchLeadInfo, getLeadIdForReminder, leadsMap, reminders, updateLeadNextReturnDate]);

  const handleQuickSchedule = useCallback(async (reminder: Reminder, daysAhead: 1 | 2) => {
    if (reminder.lido) {
      return;
    }

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error('Nao foi possivel identificar o lead deste lembrete.');
      return;
    }

    const nextReminderDate = addBusinessDaysSkippingWeekends(reminder.data_lembrete, daysAhead);
    const nextReminderDateIso = nextReminderDate.toISOString();

    setQuickSchedulingAction({ reminderId: reminder.id, daysAhead });

    try {
      const markedAsRead = await handleMarkAsRead(reminder.id, reminder.lido, {
        queueNextReminderPrompt: false,
      });

      if (!markedAsRead) {
        return;
      }

      const { data: createdReminder, error: createError } = await supabase
        .from('reminders')
        .insert([
          {
            lead_id: leadId,
            contract_id: reminder.contract_id ?? undefined,
            tipo: reminder.tipo,
            titulo: reminder.titulo,
            descricao: reminder.descricao ?? null,
            data_lembrete: nextReminderDateIso,
            lido: false,
            prioridade: reminder.prioridade,
            tags: reminder.tags ?? undefined,
            tempo_estimado_minutos: reminder.tempo_estimado_minutos ?? undefined,
          },
        ])
        .select('*')
        .maybeSingle();

      if (createError) {
        throw createError;
      }

      if (createdReminder) {
        pendingRefreshIdsRef.current.add(createdReminder.id);
        setReminders((current) =>
          [...current, createdReminder as Reminder].sort(compareRemindersByDueAtThenAlphabetical),
        );
      }

      await updateLeadNextReturnDate(leadId);
      toast.success(`Novo lembrete criado para +${daysAhead} dia(s) util(eis).`);
    } catch (scheduleError) {
      console.error('[WhatsAppAgendaModal] erro ao criar lembrete rapido:', scheduleError);
      toast.error('Nao foi possivel criar o novo lembrete rapido.');
    } finally {
      setQuickSchedulingAction(null);
    }
  }, [compareRemindersByDueAtThenAlphabetical, getLeadIdForReminder, handleMarkAsRead, updateLeadNextReturnDate]);

  const handleDeleteReminder = useCallback(async (reminder: Reminder) => {
    const confirmed = await requestConfirmation({
      title: 'Remover item',
      description: `Deseja remover "${reminder.titulo}"? Esta acao nao pode ser desfeita.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      pendingRefreshIdsRef.current.add(reminder.id);
      const { error: deleteError } = await supabase.from('reminders').delete().eq('id', reminder.id);

      if (deleteError) {
        pendingRefreshIdsRef.current.delete(reminder.id);
        throw deleteError;
      }

      const leadId = getLeadIdForReminder(reminder);
      if (leadId) {
        await updateLeadNextReturnDate(leadId);
      }

      setReminders((current) => current.filter((item) => item.id !== reminder.id));
      toast.success('Item removido da agenda.');
    } catch (deleteError) {
      console.error('[WhatsAppAgendaModal] erro ao remover lembrete:', deleteError);
      toast.error('Nao foi possivel remover este item.');
    }
  }, [getLeadIdForReminder, requestConfirmation, updateLeadNextReturnDate]);

  const handleRescheduleReminder = useCallback(async (reminderId: string, newDate: Date) => {
    try {
      const reminder = reminders.find((item) => item.id === reminderId);
      if (!reminder) {
        return;
      }

      const reminderDateTime = new Date(reminder.data_lembrete);
      const newDateTime = new Date(newDate);
      newDateTime.setHours(reminderDateTime.getHours(), reminderDateTime.getMinutes(), 0, 0);
      const newDateIso = newDateTime.toISOString();

      pendingRefreshIdsRef.current.add(reminderId);
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ data_lembrete: newDateIso })
        .eq('id', reminderId);

      if (updateError) {
        pendingRefreshIdsRef.current.delete(reminderId);
        throw updateError;
      }

      const leadId = getLeadIdForReminder(reminder);
      if (leadId) {
        await updateLeadNextReturnDate(leadId);
      }

      setReminders((current) =>
        current.map((item) =>
          item.id === reminderId
            ? {
                ...item,
                data_lembrete: newDateIso,
              }
            : item,
        ),
      );
      setReschedulingReminderId(null);
      toast.success('Item reagendado com sucesso.');
    } catch (rescheduleError) {
      console.error('[WhatsAppAgendaModal] erro ao reagendar:', rescheduleError);
      toast.error('Nao foi possivel reagendar o item.');
    }
  }, [getLeadIdForReminder, reminders, updateLeadNextReturnDate]);

  const handleDayClick = useCallback(async (date: Date) => {
    if (reschedulingReminderId) {
      await handleRescheduleReminder(reschedulingReminderId, date);
      return;
    }

    setSelectedDate(date);
  }, [handleRescheduleReminder, reschedulingReminderId]);

  const closeAddTaskModal = useCallback(() => {
    setIsAddTaskModalOpen(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
  }, []);

  const handleAddTask = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newTaskTitle.trim()) {
      return;
    }

    setSavingTask(true);
    setError(null);

    const dueDate = new Date(selectedDate);
    dueDate.setHours(12, 0, 0, 0);

    try {
      const { data: createdTask, error: insertError } = await supabase
        .from('reminders')
        .insert([
          {
            tipo: 'Tarefa',
            titulo: newTaskTitle.trim(),
            descricao: newTaskDescription.trim() || null,
            data_lembrete: dueDate.toISOString(),
            lido: false,
            prioridade: 'normal',
          },
        ])
        .select('*')
        .maybeSingle();

      if (insertError) {
        throw insertError;
      }

      if (createdTask) {
        pendingRefreshIdsRef.current.add(createdTask.id);
        setReminders((current) => [...current, createdTask as Reminder].sort(compareRemindersByDueAtThenAlphabetical));
      }

      closeAddTaskModal();
      toast.success('Tarefa adicionada na agenda.');
    } catch (insertError) {
      console.error('[WhatsAppAgendaModal] erro ao criar tarefa:', insertError);
      setError('Nao foi possivel criar a tarefa.');
      toast.error('Nao foi possivel criar a tarefa.');
    } finally {
      setSavingTask(false);
    }
  }, [closeAddTaskModal, compareRemindersByDueAtThenAlphabetical, newTaskDescription, newTaskTitle, selectedDate]);

  const currentLeadMatchesReminder = useCallback((reminder: Reminder) => {
    if (!currentLeadId) {
      return false;
    }

    if (reminder.lead_id === currentLeadId) {
      return true;
    }

    return Boolean(reminder.contract_id && currentLeadContractIds.has(reminder.contract_id));
  }, [currentLeadContractIds, currentLeadId]);

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(reminders.map((item) => item.tipo).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }),
    );

    return [
      { value: 'all', label: 'Todos os tipos' },
      ...types.map((type) => ({ value: type, label: type })),
    ];
  }, [reminders]);

  const filteredReminders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reminders
      .filter((reminder) => {
        if (statusFilter === 'nao-lidos' && reminder.lido) {
          return false;
        }

        if (statusFilter === 'lidos' && !reminder.lido) {
          return false;
        }

        if (typeFilter !== 'all' && reminder.tipo !== typeFilter) {
          return false;
        }

        if (priorityFilter !== 'all' && reminder.prioridade !== priorityFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const leadId = getLeadIdForReminder(reminder);
        const leadName = leadId ? leadsMap.get(leadId)?.nome_completo ?? '' : '';
        const contractCode = reminder.contract_id ? contractsMap.get(reminder.contract_id)?.codigo_contrato ?? '' : '';

        return [reminder.titulo, reminder.descricao, reminder.tipo, leadName, contractCode]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort(compareRemindersByDueAtThenAlphabetical);
  }, [compareRemindersByDueAtThenAlphabetical, contractsMap, getLeadIdForReminder, leadsMap, priorityFilter, reminders, searchQuery, statusFilter, typeFilter]);

  const handleMarkAllFilteredAsRead = useCallback(async () => {
    const unreadFiltered = filteredReminders.filter((item) => !item.lido);

    if (unreadFiltered.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Marcar filtros como lidos',
      description: `Deseja marcar ${unreadFiltered.length} item(ns) filtrado(s) como lido(s)?`,
      confirmLabel: 'Marcar como lidos',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    try {
      const completionDate = new Date().toISOString();
      unreadFiltered.forEach((item) => pendingRefreshIdsRef.current.add(item.id));

      const { error: updateError } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: completionDate,
        })
        .in('id', unreadFiltered.map((item) => item.id));

      if (updateError) {
        unreadFiltered.forEach((item) => pendingRefreshIdsRef.current.delete(item.id));
        throw updateError;
      }

      const leadIds = Array.from(
        new Set(
          unreadFiltered
            .map((item) => getLeadIdForReminder(item))
            .filter((leadId): leadId is string => Boolean(leadId)),
        ),
      );

      await Promise.all(leadIds.map((leadId) => updateLeadNextReturnDate(leadId)));

      setReminders((current) =>
        current.map((item) =>
          unreadFiltered.some((candidate) => candidate.id === item.id)
            ? {
                ...item,
                lido: true,
                concluido_em: completionDate,
              }
            : item,
        ),
      );

      toast.success('Itens filtrados marcados como lidos.');
    } catch (updateError) {
      console.error('[WhatsAppAgendaModal] erro ao marcar filtros como lidos:', updateError);
      toast.error('Nao foi possivel atualizar os itens filtrados.');
    }
  }, [filteredReminders, getLeadIdForReminder, requestConfirmation, updateLeadNextReturnDate]);

  const filteredMonthReminders = useMemo(() => {
    const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;

    return filteredReminders.filter((reminder) => {
      const reminderDate = new Date(reminder.data_lembrete);
      if (Number.isNaN(reminderDate.getTime())) {
        return false;
      }

      return `${reminderDate.getFullYear()}-${reminderDate.getMonth()}` === currentMonthKey;
    });
  }, [currentMonth, filteredReminders]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();

    filteredMonthReminders.forEach((reminder) => {
      const dateKey = getDateKey(reminder.data_lembrete);
      const items = map.get(dateKey) ?? [];
      items.push(reminder);
      items.sort(compareRemindersByDueAtThenAlphabetical);
      map.set(dateKey, items);
    });

    return map;
  }, [compareRemindersByDueAtThenAlphabetical, filteredMonthReminders]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedDateReminders = useMemo(
    () => filteredReminders.filter((reminder) => getDateKey(reminder.data_lembrete) === selectedDateKey),
    [filteredReminders, selectedDateKey],
  );
  const pendingSelectedReminders = selectedDateReminders.filter((item) => !item.lido);
  const completedSelectedReminders = selectedDateReminders.filter((item) => item.lido);
  const pendingFilteredCount = filteredReminders.filter((item) => !item.lido).length;
  const completedFilteredCount = filteredReminders.filter((item) => item.lido).length;
  const overdueFilteredCount = filteredReminders.filter((item) => isOverdue(item.data_lembrete) && !item.lido).length;
  const taskFilteredCount = filteredReminders.filter((item) => item.tipo === 'Tarefa').length;
  const hasActiveFilters = [statusFilter !== 'todos', typeFilter !== 'all', priorityFilter !== 'all', searchQuery.trim() !== ''].filter(Boolean).length;

  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${lastUpdated.toLocaleDateString('pt-BR')} às ${lastUpdated.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : 'Ainda nao atualizado';

  const selectedDateLabel = selectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const goToToday = () => {
    const today = getDefaultSelectedDate();
    setSelectedDate(today);
    setCurrentMonth(getDefaultMonth());
    setReschedulingReminderId(null);
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setPriorityFilter('all');
    setStatusFilter('todos');
  };

  const getReminderPriorityStyle = (priority: string) => {
    const tones = {
      baixa: 'info',
      normal: 'neutral',
      alta: 'danger',
    } as const;

    return getPanelToneStyle(tones[priority as keyof typeof tones] ?? 'neutral');
  };

  const getReminderTypeStyle = (type: string) => {
    const tones = {
      'Documentos pendentes': 'warning',
      Assinatura: 'accent',
      Ativacao: 'info',
      Renovacao: 'warning',
      Retorno: 'neutral',
      'Follow-up': 'accent',
      Tarefa: 'accent',
      Outro: 'neutral',
      Aniversario: 'warning',
      'Aniversário': 'warning',
      Reajuste: 'info',
    } as const;

    return getPanelToneStyle(tones[type as keyof typeof tones] ?? 'neutral');
  };

  const getReminderIcon = (type: string) => {
    const icons = {
      'Documentos pendentes': AlertCircle,
      Assinatura: AlertCircle,
      Ativacao: Calendar,
      Renovacao: Calendar,
      'Renovação': Calendar,
      Retorno: Bell,
      Tarefa: CheckCircle2,
      'Follow-up': CalendarPlus,
      Aniversario: CalendarDays,
      'Aniversário': CalendarDays,
      Reajuste: Calendar,
    } as const;

    const Icon = icons[type as keyof typeof icons] ?? Bell;
    return <Icon className="h-5 w-5" />;
  };

  const getReminderCardStyle = (reminder: Reminder) => {
    if (reminder.lido) {
      return {
        ...PANEL_INSET_STYLE,
        ...getPanelToneStyle('success'),
      };
    }

    if (isOverdue(reminder.data_lembrete)) {
      return {
        ...PANEL_INSET_STYLE,
        borderColor: 'var(--panel-accent-red-border,#d79a8f)',
        boxShadow: '0 0 0 1px var(--panel-accent-red-border,#d79a8f), 0 18px 34px -28px rgba(138,49,40,0.22)',
      };
    }

    return PANEL_INSET_STYLE;
  };

  const renderCalendar = () => {
    const cells = [];
    const firstWeekday = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push(<div key={`empty-${index}`} className="aspect-square" />);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayKey = getDateKey(cellDate);
      const dayReminders = remindersByDay.get(dayKey) ?? [];
      const pendingCount = dayReminders.filter((item) => !item.lido).length;
      const doneCount = dayReminders.filter((item) => item.lido).length;
      const totalCount = dayReminders.length;
      const isToday = getDateKey(new Date()) === dayKey;
      const isSelected = selectedDateKey === dayKey;

      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => {
            void handleDayClick(cellDate);
          }}
          className="aspect-square rounded-[1.1rem] border p-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            ...(isSelected
              ? { ...PANEL_INSET_STYLE, ...getPanelToneStyle('accent') }
              : isToday
                ? { ...PANEL_INSET_STYLE, ...getPanelToneStyle('neutral') }
                : totalCount > 0
                  ? PANEL_INSET_STYLE
                  : PANEL_MUTED_INSET_STYLE),
            outlineColor: 'var(--panel-focus,#c86f1d)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold">{day}</span>
            {totalCount > 0 && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={isSelected ? getPanelToneStyle('neutral') : getPanelToneStyle('accent')}
              >
                {totalCount}
              </span>
            )}
          </div>
          <div className="mt-auto space-y-1 text-[10px] font-semibold">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }}>
                <Circle className="h-3 w-3" />
                <span>{pendingCount}</span>
              </div>
            )}
            {doneCount > 0 && (
              <div className="flex items-center gap-1" style={{ color: 'var(--panel-accent-green-text,#275c39)' }}>
                <CheckCircle2 className="h-3 w-3" />
                <span>{doneCount}</span>
              </div>
            )}
          </div>
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--panel-text-muted,#876f5c)' }}
          >
            {day}
          </div>
        ))}
        {cells}
      </div>
    );
  };

  const renderReminderCard = (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);
    const contract = reminder.contract_id ? contractsMap.get(reminder.contract_id) : undefined;
    const leadInfo = leadId ? leadsMap.get(leadId) : undefined;
    const hasLeadPhone = Boolean(leadInfo?.telefone);
    const overdue = isOverdue(reminder.data_lembrete);
    const isQuickSchedulingCurrentReminder = quickSchedulingAction?.reminderId === reminder.id;
    const matchesCurrentLead = currentLeadMatchesReminder(reminder);

    return (
      <article
        key={reminder.id}
        className="panel-glass-lite rounded-[1.35rem] border p-4 shadow-sm transition-all"
        style={getReminderCardStyle(reminder)}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-[1rem] border p-3" style={reminder.lido ? getPanelToneStyle('success') : getReminderTypeStyle(reminder.tipo)}>
            {getReminderIcon(reminder.tipo)}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                <h3 className="text-base font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                  {reminder.titulo}
                </h3>
                {leadInfo?.nome_completo ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium" style={getPanelToneStyle('neutral')}>
                    {leadInfo.nome_completo}
                  </span>
                ) : null}
                {contract?.codigo_contrato ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium" style={getPanelToneStyle('info')}>
                    Contrato {contract.codigo_contrato}
                  </span>
                ) : null}
              </div>
              {reminder.descricao ? (
                <p className="mt-1 text-sm" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                  {reminder.descricao}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" style={getReminderPriorityStyle(reminder.prioridade)}>
                {reminder.prioridade}
              </span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" style={getReminderTypeStyle(reminder.tipo)}>
                {reminder.tipo}
              </span>
              {reminder.tempo_estimado_minutos ? (
                <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold" style={getPanelToneStyle('info')}>
                  <Timer className="h-3 w-3" />
                  <span>{formatEstimatedTime(reminder.tempo_estimado_minutos)}</span>
                </span>
              ) : null}
              {overdue && !reminder.lido ? (
                <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" style={getPanelToneStyle('danger')}>
                  Atrasado
                </span>
              ) : null}
              {matchesCurrentLead ? (
                <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" style={getPanelToneStyle('accent')}>
                  Chat atual
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2">
              <Button
                onClick={() => openLeadInOfficialWhatsApp(leadInfo ?? null)}
                disabled={!hasLeadPhone}
                variant="soft"
                size="icon"
                className="h-9 w-9"
                title={hasLeadPhone ? 'Abrir WhatsApp oficial' : 'Telefone nao disponivel'}
                aria-label={hasLeadPhone ? 'Abrir WhatsApp oficial' : 'Telefone nao disponivel'}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>

              {onOpenLeadInCrm && leadId ? (
                <Button
                  onClick={onOpenLeadInCrm}
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  title="Abrir CRM"
                  aria-label="Abrir CRM"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              ) : null}

              {matchesCurrentLead && onGenerateFollowUp ? (
                <Button
                  onClick={() => {
                    onClose();
                    onGenerateFollowUp();
                  }}
                  variant="warning"
                  size="icon"
                  className="h-9 w-9"
                  title="Gerar follow-up no chat atual"
                  aria-label="Gerar follow-up no chat atual"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              ) : null}

              {!reminder.lido && canEdit ? (
                <>
                  <Button
                    onClick={() => void handleQuickSchedule(reminder, 1)}
                    disabled={isQuickSchedulingCurrentReminder}
                    variant="primary"
                    size="icon"
                    className="h-9 w-9"
                    title="Agendar +1 dia util e marcar atual como lido"
                    aria-label="Agendar +1 dia util e marcar atual como lido"
                  >
                    {isQuickSchedulingCurrentReminder && quickSchedulingAction?.daysAhead === 1 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="relative inline-flex">
                        <CalendarPlus className="h-4 w-4" />
                        <span
                          className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border px-0.5 text-[9px] font-bold leading-none"
                          style={getPanelToneStyle('neutral')}
                        >
                          1
                        </span>
                      </span>
                    )}
                  </Button>
                  <Button
                    onClick={() => void handleQuickSchedule(reminder, 2)}
                    disabled={isQuickSchedulingCurrentReminder}
                    variant="primary"
                    size="icon"
                    className="h-9 w-9"
                    title="Agendar +2 dias uteis e marcar atual como lido"
                    aria-label="Agendar +2 dias uteis e marcar atual como lido"
                  >
                    {isQuickSchedulingCurrentReminder && quickSchedulingAction?.daysAhead === 2 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="relative inline-flex">
                        <CalendarPlus className="h-4 w-4" />
                        <span
                          className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full border px-0.5 text-[9px] font-bold leading-none"
                          style={getPanelToneStyle('neutral')}
                        >
                          2
                        </span>
                      </span>
                    )}
                  </Button>
                </>
              ) : null}

              {canEdit ? (
                <Button
                  onClick={() => void handleMarkAsRead(reminder.id, reminder.lido)}
                  variant={reminder.lido ? 'secondary' : 'soft'}
                  size="icon"
                  className="h-9 w-9"
                  title={reminder.lido ? 'Marcar como nao lido' : 'Marcar como lido'}
                  aria-label={reminder.lido ? 'Marcar como nao lido' : 'Marcar como lido'}
                >
                  <Check className="h-4 w-4" />
                </Button>
              ) : null}

              {!reminder.lido && canEdit ? (
                <Button
                  onClick={() => setReschedulingReminderId(reminder.id)}
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  title="Reagendar item"
                  aria-label="Reagendar item"
                >
                  <Calendar className="h-4 w-4" />
                </Button>
              ) : null}

              {leadId && canEdit ? (
                <Button
                  onClick={() => void handleMarkLeadAsLost(reminder)}
                  variant="danger"
                  size="icon"
                  className="h-9 w-9"
                  title="Marcar lead como perdido e limpar lembretes"
                  aria-label="Marcar lead como perdido e limpar lembretes"
                  disabled={markingLostLeadId === leadId}
                  loading={markingLostLeadId === leadId}
                >
                  {markingLostLeadId !== leadId && <X className="h-4 w-4" />}
                </Button>
              ) : null}

              {canEdit ? (
                <Button
                  onClick={() => void handleDeleteReminder(reminder)}
                  variant="danger"
                  size="icon"
                  className="h-9 w-9"
                  title="Excluir item"
                  aria-label="Excluir item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    );
  };

  const emptyStateMessage = 'Nenhum item encontrado com os filtros atuais.';

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        title="Agenda do WhatsApp"
        description="Mesma base da Agenda unificada, agora acessivel dentro do inbox. Tudo o que voce fizer aqui reflete em /painel/agenda."
        size="xl"
        panelClassName="config-transparent-buttons max-w-6xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-[1.7rem] border" style={PANEL_MUTED_INSET_STYLE}>
            <div className="panel-glass-strong flex items-center gap-3 rounded-[1.1rem] border px-4 py-3 shadow-lg" style={PANEL_INSET_STYLE}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--panel-accent-strong,#b85c1f)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                Carregando agenda...
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="panel-glass-panel space-y-5 rounded-[1.8rem] border p-5" style={PANEL_SECTION_STYLE}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                    Rotina operacional no inbox
                  </p>
                  <h2 className="mt-3 text-2xl font-bold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                    Agenda sincronizada
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                    Consulte e manipule a mesma agenda do painel sem sair do WhatsApp. Os reminders daqui e de /painel/agenda sao exatamente os mesmos.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={PANEL_PILL_STYLE}>
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{lastUpdatedLabel}</span>
                  </span>
                  <Button variant="secondary" size="icon" onClick={() => void loadReminders({ showLoading: true })} aria-label="Atualizar agenda" title="Atualizar agenda">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  {currentLead ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                      <span className="inline-flex items-center rounded-full border px-3 py-1.5 font-semibold" style={getPanelToneStyle('accent')}>
                        {currentLead?.nome_completo}
                      </span>
                      {currentChat?.phone_number ? (
                        <span className="inline-flex items-center rounded-full border px-3 py-1.5 font-semibold" style={PANEL_PILL_STYLE}>
                          {formatCommWhatsAppPhoneLabel(currentChat.phone_number)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[1.1rem] border px-4 py-3 text-sm" style={PANEL_MUTED_INSET_STYLE}>
                      A agenda global do WhatsApp continua disponível aqui. Se houver lead vinculado no chat atual, ele aparece destacado nos itens relacionados.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={goToToday} variant="secondary" size="md">
                    Hoje
                  </Button>
                  {contextualLead ? (
                    <Button onClick={() => setDirectSchedulerOpen(true)} variant="primary" size="md" disabled={!canEdit}>
                      <Bell className="h-4 w-4" />
                      Agendar lead atual
                    </Button>
                  ) : null}
                  <Button onClick={() => setIsAddTaskModalOpen(true)} variant="soft" size="md" disabled={!canEdit}>
                    <Plus className="h-4 w-4" />
                    Nova tarefa
                  </Button>
                  {filteredReminders.some((item) => !item.lido) ? (
                    <Button onClick={() => void handleMarkAllFilteredAsRead()} variant="secondary" size="md" disabled={!canEdit}>
                      Marcar filtrados como lidos
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: 'Pendentes', value: pendingFilteredCount, tone: 'accent' as const },
                { label: 'Concluidos', value: completedFilteredCount, tone: 'success' as const },
                { label: 'Atrasados', value: overdueFilteredCount, tone: 'danger' as const },
                { label: 'Tarefas', value: taskFilteredCount, tone: 'neutral' as const },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.35rem] border p-4" style={PANEL_INSET_STYLE}>
                  <div className="text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                    {item.label}
                  </div>
                  <div className="mt-2 text-3xl font-bold" style={{ color: getPanelToneStyle(item.tone).color }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative flex-1">
                  <Input
                    type="text"
                    placeholder="Buscar por titulo, descricao, tipo, lead ou contrato..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    leftIcon={Search}
                    className="pr-10"
                  />
                  {searchQuery ? (
                    <Button
                      onClick={() => setSearchQuery('')}
                      variant="icon"
                      size="icon"
                      className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
                      title="Limpar busca"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_220px]">
                  <FilterSingleSelect
                    icon={Tag}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    placeholder="Todos os tipos"
                    includePlaceholderOption={false}
                    options={typeOptions}
                  />
                  <FilterSingleSelect
                    icon={AlertCircle}
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    placeholder="Todas prioridades"
                    includePlaceholderOption={false}
                    options={[...PRIORITY_OPTIONS]}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => setStatusFilter('nao-lidos')} variant={statusFilter === 'nao-lidos' ? 'primary' : 'secondary'} size="md">
                  Pendentes
                </Button>
                <Button onClick={() => setStatusFilter('todos')} variant={statusFilter === 'todos' ? 'primary' : 'secondary'} size="md">
                  Todos
                </Button>
                <Button onClick={() => setStatusFilter('lidos')} variant={statusFilter === 'lidos' ? 'primary' : 'secondary'} size="md">
                  Concluidos
                </Button>
                {hasActiveFilters > 0 ? (
                  <Button onClick={clearFilters} variant="ghost" size="md">
                    Limpar filtros ({hasActiveFilters})
                  </Button>
                ) : null}
              </div>
            </section>

            {error ? (
              <div className="flex items-center gap-2 rounded-[1.1rem] border p-3 text-sm" style={getPanelToneStyle('danger')}>
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            ) : null}

            {reschedulingReminderId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border px-4 py-3 text-sm" style={getPanelToneStyle('accent')}>
                <span>Selecione um dia no calendario para reagendar o item.</span>
                <Button onClick={() => setReschedulingReminderId(null)} variant="ghost" size="sm" className="h-auto px-0 hover:bg-transparent">
                  Cancelar reagendamento
                </Button>
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="overflow-hidden rounded-[1.7rem] border" style={PANEL_INSET_STYLE}>
                <div className="flex items-center justify-between gap-2 px-4 py-3" style={PANEL_MUTED_INSET_STYLE}>
                  <Button onClick={goToPreviousMonth} variant="icon" size="icon" aria-label="Mes anterior">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <h3 className="text-lg font-semibold capitalize" style={{ color: 'var(--panel-text,#1c1917)' }}>
                    {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <Button onClick={goToNextMonth} variant="icon" size="icon" aria-label="Proximo mes">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <div className="p-4">{renderCalendar()}</div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1 px-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                    Dia selecionado
                  </p>
                  <h3 className="text-xl font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                    {selectedDateLabel}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                    {selectedDateReminders.length > 0
                      ? `${selectedDateReminders.length} item(ns) ao todo - ${pendingSelectedReminders.length} pendente(s) e ${completedSelectedReminders.length} concluido(s).`
                      : emptyStateMessage}
                  </p>
                </div>

                <div className="rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                      Pendentes
                    </h4>
                    <span className="text-xs font-semibold" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }}>
                      {pendingSelectedReminders.length}
                    </span>
                  </div>

                  {pendingSelectedReminders.length > 0 ? (
                    <div className="max-h-[54vh] space-y-3 overflow-y-auto pr-1">{pendingSelectedReminders.map(renderReminderCard)}</div>
                  ) : (
                    <div className="rounded-[1.3rem] border py-8 text-center text-sm" style={PANEL_MUTED_INSET_STYLE}>
                      Nenhum item pendente neste dia.
                    </div>
                  )}
                </div>

                <div className="rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                      Concluidos
                    </h4>
                    <span className="text-xs font-semibold" style={{ color: 'var(--panel-accent-green-text,#275c39)' }}>
                      {completedSelectedReminders.length}
                    </span>
                  </div>

                  {completedSelectedReminders.length > 0 ? (
                    <div className="max-h-[36vh] space-y-3 overflow-y-auto pr-1">{completedSelectedReminders.map(renderReminderCard)}</div>
                  ) : (
                    <div className="rounded-[1.3rem] border py-8 text-center text-sm" style={PANEL_MUTED_INSET_STYLE}>
                      Nenhum item concluido neste dia.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {filteredReminders.length === 0 ? (
              <div className="rounded-[1.7rem] border py-12 text-center" style={PANEL_EMPTY_STATE_STYLE}>
                <Bell className="mx-auto mb-4 h-14 w-14" style={{ color: 'var(--panel-text-muted,#876f5c)' }} />
                <h3 className="text-lg font-medium" style={{ color: 'var(--panel-text,#1c1917)' }}>
                  Nenhum item encontrado
                </h3>
                <p className="mt-2 text-sm" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                  {emptyStateMessage}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </ModalShell>

      {isAddTaskModalOpen ? (
        <ModalShell
          isOpen
          onClose={closeAddTaskModal}
          title="Nova tarefa"
          description={selectedDateLabel}
          size="sm"
          panelClassName="max-w-md"
        >
          <form onSubmit={(event) => void handleAddTask(event)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="whatsapp-agenda-task-title" className="text-sm font-medium" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                Tarefa
              </label>
              <Input
                id="whatsapp-agenda-task-title"
                type="text"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="Digite o titulo da tarefa"
                required
                disabled={savingTask}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="whatsapp-agenda-task-description" className="text-sm font-medium" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                Descricao (opcional)
              </label>
              <Textarea
                id="whatsapp-agenda-task-description"
                value={newTaskDescription}
                onChange={(event) => setNewTaskDescription(event.target.value)}
                placeholder="Adicione detalhes da tarefa"
                className="min-h-[96px]"
                disabled={savingTask}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" onClick={closeAddTaskModal} variant="secondary" size="md">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={savingTask} loading={savingTask}>
                {!savingTask && <Plus className="h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {directSchedulerOpen && contextualLead ? (
        <ReminderSchedulerModal
          lead={contextualLead}
          onClose={() => setDirectSchedulerOpen(false)}
          onScheduled={() => {
            void updateLeadNextReturnDate(contextualLead.id);
            void loadReminders();
          }}
          promptMessage="Agende o proximo lembrete do lead vinculado a esta conversa."
          defaultType="Follow-up"
        />
      ) : null}

      {manualReminderQueue[0] ? (
        <ReminderSchedulerModal
          lead={manualReminderQueue[0].lead}
          onClose={() => setManualReminderQueue((current) => current.slice(1))}
          onScheduled={() => {
            const lead = manualReminderQueue[0].lead;
            void updateLeadNextReturnDate(lead.id);
            void loadReminders();
          }}
          promptMessage={manualReminderQueue[0].promptMessage}
          defaultTitle={manualReminderQueue[0].defaultTitle}
          defaultDescription={manualReminderQueue[0].defaultDescription}
          defaultType={manualReminderQueue[0].defaultType}
          defaultPriority={manualReminderQueue[0].defaultPriority}
        />
      ) : null}

      {ConfirmationDialog}
    </>
  );
}
