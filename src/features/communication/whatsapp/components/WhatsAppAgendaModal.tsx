import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Calendar,
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

import WhatsAppBatchFollowUpModal from './WhatsAppBatchFollowUpModal';
import type { WhatsAppBatchFollowUpSendProgress } from './WhatsAppBatchFollowUpModal';
import WhatsAppScheduledMessagesPanel from './WhatsAppScheduledMessagesPanel';
import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import {
  Badge,
  Button,
  DateTimePicker,
  EmptyState,
  Input,
  Surface,
  Textarea,
  IconButton,
  FilterSelect,
  WorkspaceDialog,
} from '../../../../design-system';
import PanelPopoverShell from '../../../../components/ui/PanelPopoverShell';
import type { PanelTone } from '../../../../design-system';
import { useConfirmationModal } from '../../../../hooks/useConfirmationModal';
import { formatDateTimeFullBR, getDateKey, isOverdue } from '../../../../lib/dateUtils';
import { whatsappFollowUpService, formatCommWhatsAppPhoneLabel, type CommWhatsAppLeadContractSummary, type CommWhatsAppLeadPanel } from '../data';
import { addBusinessDaysSkippingWeekends, formatEstimatedTime } from '../../../../lib/reminderUtils';
import {
  createReminder,
  deleteReminder,
  deleteReminders,
  getReminderLead,
  getReminderWhatsappLink,
  isReminderPriority,
  listReminderContracts,
  listReminderLeads,
  listReminders,
  markLeadLostFromAgenda,
  subscribeToReminderChanges,
  updateReminder,
  type ManualReminderPrompt,
  type Reminder,
} from '../../../reminders';
import type { Contract } from '../../../contracts';
import type { Lead } from '../../../leads';
import { syncLeadNextReturnFromUpcomingReminder } from '../../../../lib/leadReminderUtils';
import { toast } from '../../../../lib/toast';

type WhatsAppAgendaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  channelId?: string;
  currentLead: CommWhatsAppLeadPanel | null;
  currentLeadContracts: CommWhatsAppLeadContractSummary[];
  canEdit: boolean;
  onGenerateFollowUp?: () => void;
  onOpenLeadChat?: (lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone'>) => Promise<void> | void;
  onSendBatchFollowUps?: (results: Array<{
    chatId: string;
    externalChatId: string | null;
    textSegments: string[];
    reminderId: string;
    leadId: string;
    phone: string | null;
    currentAction: 'send' | 'wait';
    generationId: string | null;
    approvedScheduleAction: 'schedule' | 'no_schedule';
    approvedScheduleDate: string | null;
    scheduleReason: string | null;
    opportunityRecommendation: 'continue' | 'pause' | 'mark_lost_recommended';
  }>, options?: {
    onProgress?: (progress: WhatsAppBatchFollowUpSendProgress) => void;
  }) => Promise<{ sentCount: number; scheduledCount: number; failedCount: number; errorMessage?: string }>;
};

type SchedulerDraft = {
  lead: Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'responsavel'>;
  promptMessage: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: 'Follow-up' | 'Outro';
  defaultPriority?: 'normal' | 'alta' | 'baixa';
};

type WhatsAppAgendaCacheSnapshot = {
  reminders: Reminder[];
  contracts: Contract[];
  leads: Lead[];
  updatedAt: string;
};

const getDefaultSelectedDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string) => {
  const [year, month, day] = value.split('-').map((item) => Number(item));
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function WhatsAppAgendaModal({
  isOpen,
  onClose,
  channelId,
  currentLead,
  currentLeadContracts,
  canEdit,
  onGenerateFollowUp,
  onOpenLeadChat,
  onSendBatchFollowUps,
}: WhatsAppAgendaModalProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(getDefaultSelectedDate);
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(new Map());
  const [manualReminderQueue, setManualReminderQueue] = useState<ManualReminderPrompt[]>([]);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2 | 3 | 4 | 5;
  } | null>(null);
  const [quickScheduleDropdown, setQuickScheduleDropdown] = useState<{
    reminderId: string;
    position: { top: number; left: number };
  } | null>(null);
  const quickScheduleDropdownRef = useRef<HTMLDivElement>(null);
  const quickScheduleButtonRef = useRef<HTMLButtonElement>(null);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [schedulerDraft, setSchedulerDraft] = useState<SchedulerDraft | null>(null);
  const [openingLeadChatId, setOpeningLeadChatId] = useState<string | null>(null);
  const [onlyCurrentLead, setOnlyCurrentLead] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [duplicateKeepSelection, setDuplicateKeepSelection] = useState<Record<string, string>>({});
  const [dedupingGroupKey, setDedupingGroupKey] = useState<string | null>(null);
  const [isDedupingAll, setIsDedupingAll] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isScheduledMessagesOpen, setScheduledMessagesOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const loadRemindersRequestIdRef = useRef(0);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const applyAgendaSnapshot = useCallback((snapshot: WhatsAppAgendaCacheSnapshot) => {
    setReminders(snapshot.reminders);
    setError(null);

    const nextContractsMap = new Map<string, Contract>();
    snapshot.contracts.forEach((contract) => {
      nextContractsMap.set(contract.id, contract);
    });
    setContractsMap(nextContractsMap);

    const nextLeadsMap = new Map<string, Lead>();
    snapshot.leads.forEach((lead) => {
      nextLeadsMap.set(lead.id, lead);
    });
    setLeadsMap(nextLeadsMap);
  }, []);

  const currentLeadId = currentLead?.id ?? null;
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

  useEffect(() => {
    if (!quickScheduleDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickScheduleDropdownRef.current &&
        !quickScheduleDropdownRef.current.contains(event.target as Node) &&
        quickScheduleButtonRef.current &&
        !quickScheduleButtonRef.current.contains(event.target as Node)
      ) {
        setQuickScheduleDropdown(null);
      }
    };

    const handleScroll = () => setQuickScheduleDropdown(null);

    document.addEventListener('mousedown', handleClickOutside);
    const scrollContainer = document.querySelector('.overflow-auto, .overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [quickScheduleDropdown]);

  const loadReminders = useCallback(async (options?: { showLoading?: boolean }) => {
    const requestId = ++loadRemindersRequestIdRef.current;
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const remindersData = await listReminders();

      const contractIds = Array.from(
        new Set(remindersData.map((reminder) => reminder.contract_id).filter((id): id is string => Boolean(id))),
      );
      const fetchedContracts = await listReminderContracts(contractIds);

      const leadIds = Array.from(
        new Set([
          ...remindersData.map((reminder) => reminder.lead_id).filter((id): id is string => Boolean(id)),
          ...fetchedContracts.map((contract) => contract.lead_id).filter((id): id is string => Boolean(id)),
        ]),
      );
      const fetchedLeads = await listReminderLeads(leadIds);
      const snapshot: WhatsAppAgendaCacheSnapshot = {
        reminders: remindersData,
        contracts: fetchedContracts,
        leads: fetchedLeads,
        updatedAt: new Date().toISOString(),
      };

      if (requestId !== loadRemindersRequestIdRef.current) {
        return;
      }

      applyAgendaSnapshot(snapshot);
      try {
        const pendingChats = await whatsappFollowUpService.listPendingChats();
        if (requestId === loadRemindersRequestIdRef.current) {
          setPendingCount(pendingChats.length);
        }
      } catch {
        if (requestId === loadRemindersRequestIdRef.current) {
          setPendingCount(null);
        }
      }
    } catch (loadError) {
      if (requestId !== loadRemindersRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppAgendaModal] erro ao carregar agenda', loadError);
      setError('Não foi possível carregar a agenda agora.');
    } finally {
      if (showLoading && requestId === loadRemindersRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [applyAgendaSnapshot]);

  useEffect(() => {
    if (!isOpen) {
      loadRemindersRequestIdRef.current += 1;
      return;
    }

    setSelectedDate(getDefaultSelectedDate());
    setSearchQuery('');
    setTypeFilter('all');
    setOnlyCurrentLead(false);
    setShowCompleted(false);
    setIsDuplicatesModalOpen(false);
    setDuplicateKeepSelection({});
    setError(null);
    setReminders([]);
    setLeadsMap(new Map());
    setContractsMap(new Map());
    pendingRefreshIdsRef.current.clear();
    void loadReminders({ showLoading: true });

    return subscribeToReminderChanges(({ current, previous }) => {
      const affectedId = current?.id ?? previous?.id;

      if (affectedId && pendingRefreshIdsRef.current.has(affectedId)) {
        pendingRefreshIdsRef.current.delete(affectedId);
        return;
      }

      void loadReminders();
    });
  }, [isOpen, loadReminders]);

  useEffect(() => {
    if (currentLead) {
      return;
    }

    setOnlyCurrentLead(false);
  }, [currentLead]);

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
        const leadData = await getReminderLead(leadId);
        if (!leadData) {
          return null;
        }
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
      toast.error('Não foi possível identificar o lead deste lembrete.');
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

      const remindersForLead = reminders.filter((item) => getLeadIdForReminder(item) === leadId);
      remindersForLead.forEach((item) => pendingRefreshIdsRef.current.add(item.id));
      await markLeadLostFromAgenda({
        leadId,
        previousStatus,
        responsible: leadInfo?.responsavel,
        changedAt: nowIso,
        logHistory: Boolean(leadInfo),
      });

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
      toast.error('Não foi possível marcar o lead como perdido.');
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

      try {
        await updateReminder(reminderId, {
          lido: !currentStatus,
          concluido_em: completionDate,
        });
      } catch (updateError) {
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
              promptMessage: 'Deseja marcar um próximo lembrete para este lead?',
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
      toast.error('Não foi possível atualizar este item.');
      return false;
    }
  }, [fetchLeadInfo, getLeadIdForReminder, leadsMap, reminders, updateLeadNextReturnDate]);

  const handleQuickSchedule = useCallback(async (reminder: Reminder, daysAhead: 1 | 2 | 3 | 4 | 5) => {
    if (reminder.lido) {
      return;
    }

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error('Não foi possível identificar o lead deste lembrete.');
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

      const createdReminder = await createReminder({
        lead_id: leadId,
        contract_id: reminder.contract_id ?? null,
        tipo: reminder.tipo,
        titulo: reminder.titulo,
        descricao: reminder.descricao ?? null,
        data_lembrete: nextReminderDateIso,
        lido: false,
        prioridade: reminder.prioridade,
        tags: reminder.tags ?? null,
        tempo_estimado_minutos: reminder.tempo_estimado_minutos ?? null,
      });

      if (createdReminder) {
        pendingRefreshIdsRef.current.add(createdReminder.id);
        setReminders((current) =>
          [...current, createdReminder].sort(compareRemindersByDueAtThenAlphabetical),
        );
      }

      await updateLeadNextReturnDate(leadId);
      toast.success(`Novo lembrete criado para +${daysAhead} dia(s) util(eis).`);
    } catch (scheduleError) {
      console.error('[WhatsAppAgendaModal] erro ao criar lembrete rapido:', scheduleError);
      toast.error('Não foi possível criar o novo lembrete rápido.');
    } finally {
      setQuickSchedulingAction(null);
    }
  }, [compareRemindersByDueAtThenAlphabetical, getLeadIdForReminder, handleMarkAsRead, updateLeadNextReturnDate]);

  const handleDeleteReminder = useCallback(async (reminder: Reminder) => {
    const confirmed = await requestConfirmation({
      title: 'Remover item',
      description: `Deseja remover "${reminder.titulo}"? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      pendingRefreshIdsRef.current.add(reminder.id);
      try {
        await deleteReminder(reminder.id);
      } catch (deleteError) {
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
      toast.error('Não foi possível remover este item.');
    }
  }, [getLeadIdForReminder, requestConfirmation, updateLeadNextReturnDate]);

  const handleOpenReminderChat = useCallback(async (reminder: Reminder) => {
    if (!onOpenLeadChat) {
      return;
    }

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error('Este item não tem lead vinculado para abrir o chat.');
      return;
    }

    const cachedLead = leadsMap.get(leadId);
    const leadInfo = cachedLead ?? (await fetchLeadInfo(leadId));
    if (!leadInfo) {
      toast.error('Não foi possível localizar os dados do lead deste item.');
      return;
    }

    setOpeningLeadChatId(leadId);
    onClose();

    try {
      await onOpenLeadChat({
        id: leadInfo.id,
        nome_completo: leadInfo.nome_completo,
        telefone: leadInfo.telefone,
      });
    } catch (openError) {
      console.error('[WhatsAppAgendaModal] erro ao abrir chat do lead:', openError);
      toast.error('Não foi possível abrir o chat deste lead.');
    } finally {
      setOpeningLeadChatId(null);
    }
  }, [fetchLeadInfo, getLeadIdForReminder, leadsMap, onClose, onOpenLeadChat]);

  const handleOpenScheduler = useCallback(async (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error('Este item não possui lead para receber um novo lembrete.');
      return;
    }

    const cachedLead = leadsMap.get(leadId);
    const leadInfo = cachedLead ?? (await fetchLeadInfo(leadId));
    if (!leadInfo) {
      toast.error('Não foi possível carregar o lead deste item.');
      return;
    }

    setSchedulerDraft({
      lead: {
        id: leadInfo.id,
        nome_completo: leadInfo.nome_completo,
        telefone: leadInfo.telefone,
        responsavel: leadInfo.responsavel,
      },
      promptMessage: 'Agende o próximo lembrete deste lead sem sair do inbox.',
      defaultTitle: reminder.titulo,
      defaultDescription: reminder.descricao ?? undefined,
      defaultType: 'Follow-up',
      defaultPriority: isReminderPriority(reminder.prioridade) ? reminder.prioridade : 'normal',
    });
  }, [fetchLeadInfo, getLeadIdForReminder, leadsMap]);

  const closeAddTaskModal = useCallback(() => {
    setIsAddTaskModalOpen(false);
    setNewTaskTitle('');
    setNewTaskDescription('');
  }, []);

  const handleAddTask = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newTaskTitle.trim()) {
      return;
    }

    setSavingTask(true);
    setError(null);

    const dueDate = new Date(selectedDate);
    dueDate.setHours(12, 0, 0, 0);

    try {
      const createdTask = await createReminder({
        tipo: 'Tarefa',
        titulo: newTaskTitle.trim(),
        descricao: newTaskDescription.trim() || null,
        data_lembrete: dueDate.toISOString(),
        lido: false,
        prioridade: 'normal',
      });

      if (createdTask) {
        pendingRefreshIdsRef.current.add(createdTask.id);
        setReminders((current) => [...current, createdTask].sort(compareRemindersByDueAtThenAlphabetical));
      }

      closeAddTaskModal();
      toast.success('Tarefa adicionada na agenda.');
    } catch (insertError) {
      console.error('[WhatsAppAgendaModal] erro ao criar tarefa:', insertError);
      setError('Não foi possível criar a tarefa.');
      toast.error('Não foi possível criar a tarefa.');
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

  // Bucket de duplicidade: lembretes atrasados (de qualquer dia anterior) caem
  // no mesmo grupo de "hoje", pois e exatamente isso que o envio automatico de
  // follow-up em lote considera "devido agora" (data <= hoje). Ja um lembrete
  // futuro so conta como duplicado de outro no mesmo dia futuro.
  const getDuplicateBucketDateKey = useCallback((reminder: Reminder) => {
    const todayKey = getDateKey(new Date());
    const reminderDateKey = getDateKey(reminder.data_lembrete);

    if (!reminderDateKey) {
      return reminderDateKey;
    }

    return reminderDateKey < todayKey ? todayKey : reminderDateKey;
  }, []);

  // Lembretes pendentes agrupados por lead + tipo + bucket de vencimento: mais
  // de um no mesmo grupo significa risco real de follow-up duplicado no envio
  // em lote (o mesmo lead receberia 2 mensagens do mesmo tipo).
  const duplicateReminderGroups = useMemo(() => {
    const groups = new Map<string, Reminder[]>();

    reminders.forEach((reminder) => {
      if (reminder.lido) {
        return;
      }

      const leadId = getLeadIdForReminder(reminder);
      if (!leadId) {
        return;
      }

      const key = `${leadId}|${reminder.tipo}|${getDuplicateBucketDateKey(reminder)}`;
      const group = groups.get(key);
      if (group) {
        group.push(reminder);
      } else {
        groups.set(key, [reminder]);
      }
    });

    return groups;
  }, [getDuplicateBucketDateKey, getLeadIdForReminder, reminders]);

  const duplicateReminderIds = useMemo(() => {
    const ids = new Set<string>();
    duplicateReminderGroups.forEach((group) => {
      if (group.length > 1) {
        group.forEach((reminder) => ids.add(reminder.id));
      }
    });
    return ids;
  }, [duplicateReminderGroups]);

  const duplicateReminderCount = duplicateReminderIds.size;

  type DuplicateReminderGroup = {
    key: string;
    leadId: string;
    leadName: string;
    tipo: string;
    dateLabel: string;
    reminders: Reminder[];
  };

  const duplicateReminderGroupList = useMemo<DuplicateReminderGroup[]>(() => {
    const list: DuplicateReminderGroup[] = [];

    duplicateReminderGroups.forEach((group, key) => {
      if (group.length <= 1) {
        return;
      }

      const sortedReminders = [...group].sort(
        (left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
      );
      const leadId = getLeadIdForReminder(sortedReminders[0]) ?? '';
      const leadName = leadId ? leadsMap.get(leadId)?.nome_completo ?? 'Lead sem nome' : 'Lead sem nome';
      const bucketDateKey = getDuplicateBucketDateKey(sortedReminders[0]);
      const spansDifferentDays = sortedReminders.some(
        (reminder) => getDateKey(reminder.data_lembrete) !== bucketDateKey,
      );
      const dateLabel = spansDifferentDays
        ? 'Atrasados agrupados com hoje'
        : new Date(sortedReminders[0].data_lembrete).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

      list.push({
        key,
        leadId,
        leadName,
        tipo: sortedReminders[0].tipo,
        dateLabel,
        reminders: sortedReminders,
      });
    });

    return list.sort((left, right) => {
      const dateComparison =
        new Date(left.reminders[0].data_lembrete).getTime() - new Date(right.reminders[0].data_lembrete).getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      return left.leadName.localeCompare(right.leadName, 'pt-BR', { sensitivity: 'base' });
    });
  }, [duplicateReminderGroups, getDuplicateBucketDateKey, getLeadIdForReminder, leadsMap]);

  const getKeepIdForGroup = useCallback(
    (group: DuplicateReminderGroup) => duplicateKeepSelection[group.key] ?? group.reminders[0]?.id ?? null,
    [duplicateKeepSelection],
  );

  const handleSelectDuplicateKeep = useCallback((groupKey: string, reminderId: string) => {
    setDuplicateKeepSelection((current) => ({ ...current, [groupKey]: reminderId }));
  }, []);

  const handleDedupeGroup = useCallback(async (group: DuplicateReminderGroup) => {
    const keepId = getKeepIdForGroup(group);
    const idsToDelete = group.reminders.filter((reminder) => reminder.id !== keepId).map((reminder) => reminder.id);

    if (idsToDelete.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Remover duplicados',
      description: `Remover ${idsToDelete.length} lembrete(s) duplicado(s) de ${group.leadName} (${group.tipo}, ${group.dateLabel})? O lembrete marcado como "Manter" será preservado.`,
      confirmLabel: 'Remover duplicados',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setDedupingGroupKey(group.key);

    try {
      idsToDelete.forEach((id) => pendingRefreshIdsRef.current.add(id));
      try {
        await deleteReminders(idsToDelete);
      } catch (deleteError) {
        idsToDelete.forEach((id) => pendingRefreshIdsRef.current.delete(id));
        throw deleteError;
      }

      if (group.leadId) {
        await updateLeadNextReturnDate(group.leadId);
      }

      const idsToDeleteSet = new Set(idsToDelete);
      setReminders((current) => current.filter((item) => !idsToDeleteSet.has(item.id)));
      toast.success(`${idsToDelete.length} lembrete(s) duplicado(s) removido(s).`);
    } catch (dedupError) {
      console.error('[WhatsAppAgendaModal] erro ao remover duplicados:', dedupError);
      toast.error('Não foi possível remover os duplicados deste grupo.');
    } finally {
      setDedupingGroupKey(null);
    }
  }, [getKeepIdForGroup, requestConfirmation, updateLeadNextReturnDate]);

  const handleDedupeAllGroups = useCallback(async () => {
    const idsToDelete = duplicateReminderGroupList.flatMap((group) => {
      const keepId = getKeepIdForGroup(group);
      return group.reminders.filter((reminder) => reminder.id !== keepId).map((reminder) => reminder.id);
    });

    if (idsToDelete.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Deduplicar agenda',
      description: `Remover ${idsToDelete.length} lembrete(s) duplicado(s) em ${duplicateReminderGroupList.length} grupo(s)? Os itens marcados como "Manter" serão preservados.`,
      confirmLabel: 'Deduplicar tudo',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setIsDedupingAll(true);

    try {
      idsToDelete.forEach((id) => pendingRefreshIdsRef.current.add(id));
      try {
        await deleteReminders(idsToDelete);
      } catch (deleteError) {
        idsToDelete.forEach((id) => pendingRefreshIdsRef.current.delete(id));
        throw deleteError;
      }

      const affectedLeadIds = Array.from(
        new Set(duplicateReminderGroupList.map((group) => group.leadId).filter(Boolean)),
      );
      await Promise.all(affectedLeadIds.map((leadId) => updateLeadNextReturnDate(leadId)));

      const idsToDeleteSet = new Set(idsToDelete);
      setReminders((current) => current.filter((item) => !idsToDeleteSet.has(item.id)));
      toast.success(`${idsToDelete.length} lembrete(s) duplicado(s) removido(s).`);
      setIsDuplicatesModalOpen(false);
    } catch (dedupError) {
      console.error('[WhatsAppAgendaModal] erro ao deduplicar agenda:', dedupError);
      toast.error('Não foi possível concluir a deduplicação.');
    } finally {
      setIsDedupingAll(false);
    }
  }, [duplicateReminderGroupList, getKeepIdForGroup, requestConfirmation, updateLeadNextReturnDate]);

  const filteredReminders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return reminders
      .filter((reminder) => {
        if (onlyCurrentLead && !currentLeadMatchesReminder(reminder)) {
          return false;
        }

        if (typeFilter !== 'all' && reminder.tipo !== typeFilter) {
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
  }, [compareRemindersByDueAtThenAlphabetical, contractsMap, currentLeadMatchesReminder, getLeadIdForReminder, leadsMap, onlyCurrentLead, reminders, searchQuery, typeFilter]);

  const selectedDateKey = getDateKey(selectedDate);
  const selectedDateReminders = useMemo(
    () => filteredReminders.filter((reminder) => getDateKey(reminder.data_lembrete) === selectedDateKey),
    [filteredReminders, selectedDateKey],
  );
  const pendingSelectedReminders = selectedDateReminders.filter((item) => !item.lido);
  const completedSelectedReminders = selectedDateReminders.filter((item) => item.lido);
  const overdueReminders = useMemo(
    () => filteredReminders.filter((item) => !item.lido && isOverdue(item.data_lembrete) && getDateKey(item.data_lembrete) !== selectedDateKey),
    [filteredReminders, selectedDateKey],
  );
  const visiblePendingReminders = useMemo(() => {
    const next = new Map<string, Reminder>();
    [...overdueReminders, ...pendingSelectedReminders].forEach((reminder) => {
      next.set(reminder.id, reminder);
    });
    return Array.from(next.values());
  }, [overdueReminders, pendingSelectedReminders]);
  const hasActiveFilters = [typeFilter !== 'all', searchQuery.trim() !== '', onlyCurrentLead].filter(Boolean).length;

  const selectedDateLabel = selectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const selectedDateInputValue = formatDateInputValue(selectedDate);
  const isSelectedDateToday = selectedDateKey === getDateKey(getDefaultSelectedDate());

  const goToToday = () => {
    setSelectedDate(getDefaultSelectedDate());
  };

  const goToPreviousDay = () => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() - 1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const goToNextDay = () => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const handleSelectedDateChange = (nextValue: string) => {
    const parsedDate = parseDateInputValue(nextValue);
    if (!parsedDate) {
      return;
    }

    setSelectedDate(parsedDate);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setOnlyCurrentLead(false);
  };


  const handleCloseBatchModal = useCallback(() => {
    setIsBatchModalOpen(false);
    void loadReminders();
  }, [loadReminders]);

  const getReminderPriorityTone = (priority: string): PanelTone => {
    const tones = {
      baixa: 'info',
      normal: 'neutral',
      alta: 'danger',
    } as const;

    return tones[priority as keyof typeof tones] ?? 'neutral';
  };

  const getReminderTypeTone = (type: string): PanelTone => {
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

    return tones[type as keyof typeof tones] ?? 'neutral';
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
      Aniversario: Calendar,
      'Aniversário': Calendar,
      Reajuste: Calendar,
    } as const;

    const Icon = icons[type as keyof typeof icons] ?? Bell;
    return <Icon className="h-5 w-5" />;
  };

  const getReminderCardVariant = (reminder: Reminder): 'success' | 'danger' | 'default' => {
    if (reminder.lido) {
      return 'success';
    }

    if (isOverdue(reminder.data_lembrete)) {
      return 'danger';
    }

    return 'default';
  };

  const renderReminderCard = (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);
    const contract = reminder.contract_id ? contractsMap.get(reminder.contract_id) : undefined;
    const leadInfo = leadId ? leadsMap.get(leadId) : undefined;
    const hasLeadPhone = Boolean(leadInfo?.telefone);
    const overdue = isOverdue(reminder.data_lembrete) && !reminder.lido;
    const isDuplicate = duplicateReminderIds.has(reminder.id);
    const isQuickSchedulingCurrentReminder = quickSchedulingAction?.reminderId === reminder.id;
    const matchesCurrentLead = currentLeadMatchesReminder(reminder);
    const isOpeningChat = leadId ? openingLeadChatId === leadId : false;

    return (
      <Surface
        key={reminder.id}
        variant={getReminderCardVariant(reminder)}
        padding="sm"
        className="transition-all"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`rounded-[1rem] border p-3 kds-surface-${reminder.lido ? 'success' : getReminderTypeTone(reminder.tipo)}`}>
                {getReminderIcon(reminder.tipo)}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {reminder.titulo}
                    </h3>
                    {overdue ? (
                      <Badge tone="danger">Atrasado</Badge>
                    ) : null}
                    {isDuplicate ? (
                      <Badge tone="warning" icon={Copy}>Duplicado</Badge>
                    ) : null}
                    {matchesCurrentLead ? (
                      <Badge tone="accent">Chat atual</Badge>
                    ) : null}
                    {reminder.lido ? (
                      <Badge tone="success">Concluído</Badge>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {leadInfo?.nome_completo ? (
                      <Badge tone="neutral" icon={<LeadFavoriteBadge favorito={leadInfo.favorito} />}>
                        {leadInfo.nome_completo}
                      </Badge>
                    ) : null}
                    {contract?.codigo_contrato ? (
                      <Badge tone="info">Contrato {contract.codigo_contrato}</Badge>
                    ) : null}
                    <Badge tone={getReminderTypeTone(reminder.tipo)}>{reminder.tipo}</Badge>
                    <Badge tone={getReminderPriorityTone(reminder.prioridade)}>{reminder.prioridade}</Badge>
                    {reminder.tempo_estimado_minutos ? (
                      <Badge tone="info" icon={Timer}>
                        {formatEstimatedTime(reminder.tempo_estimado_minutos)}
                      </Badge>
                    ) : null}
                  </div>

                  {reminder.descricao ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {reminder.descricao}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--text-muted)]">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                  </div>
                  {hasLeadPhone ? (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      <span>{formatCommWhatsAppPhoneLabel(leadInfo?.telefone ?? '')}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 min-[400px]:justify-between lg:max-w-[360px] lg:justify-end">
            {onOpenLeadChat && leadId ? (
              <IconButton
                onClick={() => void handleOpenReminderChat(reminder)}
                variant={matchesCurrentLead ? 'primary' : 'secondary'}
                className="shrink-0"
                loading={isOpeningChat}
                disabled={isOpeningChat}
                title={matchesCurrentLead ? 'Ir para chat' : 'Abrir chat'}
                aria-label={matchesCurrentLead ? 'Ir para chat' : 'Abrir chat'}
                size="md"
              >
                {!isOpeningChat && <MessageCircle aria-hidden="true" />}
              </IconButton>
            ) : null}

            {!reminder.lido && canEdit ? (
              <>
                <div className="relative">
                  <IconButton
                    ref={quickScheduleButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (quickScheduleDropdown?.reminderId === reminder.id) {
                        setQuickScheduleDropdown(null);
                      } else {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        const viewportHeight = window.innerHeight;
                        const spaceBelow = viewportHeight - rect.bottom;
                        const dropdownHeight = 200;
                        const shouldOpenUpward = spaceBelow < dropdownHeight + 20;
                        setQuickScheduleDropdown({
                          reminderId: reminder.id,
                          position: {
                            top: shouldOpenUpward ? rect.top - dropdownHeight - 8 : rect.bottom + 4,
                            left: rect.left,
                          },
                        });
                      }
                    }}
                    disabled={isQuickSchedulingCurrentReminder}
                    variant="primary"
                    className="shrink-0"
                    title="Agendar dias úteis e marcar atual como lido"
                    aria-label="Agendar dias úteis e marcar atual como lido"
                    size="md"
                  >
                    {isQuickSchedulingCurrentReminder ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <CalendarClock className="kds-control-icon" aria-hidden="true" />
                    )}
                  </IconButton>
                  {quickScheduleDropdown?.reminderId === reminder.id && (
                    <PanelPopoverShell
                      ref={quickScheduleDropdownRef}
                      isOpen={true}
                      position={quickScheduleDropdown.position}
                      onClose={() => setQuickScheduleDropdown(null)}
                      ariaLabel="Selecionar dias para agendar"
                      className="rounded-xl border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 shadow-xl"
                      style={{ width: 140, zIndex: 9999 }}
                    >
                      <div className="flex flex-col gap-1">
                        {[1, 2, 3, 4, 5].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setQuickScheduleDropdown(null);
                              void handleQuickSchedule(reminder, days as 1 | 2 | 3 | 4 | 5);
                            }}
                            disabled={isQuickSchedulingCurrentReminder}
                            className="flex items-center gap-2 rounded-full px-3 py-2 text-left text-sm text-[var(--text-primary)] transition hover:bg-[var(--bg-hover)] disabled:opacity-60"
                          >
                            <CalendarPlus className="h-4 w-4" />
                            <span>+{days} dia{days > 1 ? 's' : ''}</span>
                          </button>
                        ))}
                      </div>
                    </PanelPopoverShell>
                  )}
                </div>
              </>
            ) : null}

            {canEdit ? (
              <IconButton
                onClick={() => void handleMarkAsRead(reminder.id, reminder.lido)}
                variant={reminder.lido ? 'secondary' : 'soft'}
                className="shrink-0"
                title={reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                aria-label={reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                size="md"
              >
                <Check aria-hidden="true" />
              </IconButton>
            ) : null}

            {canEdit && leadId ? (
              <IconButton
                onClick={() => void handleOpenScheduler(reminder)}
                variant="secondary"
                className="shrink-0"
                title="Novo lembrete"
                aria-label="Novo lembrete"
                size="md"
              >
                <CalendarPlus aria-hidden="true" />
              </IconButton>
            ) : null}

            {matchesCurrentLead && onGenerateFollowUp ? (
              <IconButton
                onClick={() => {
                  onClose();
                  onGenerateFollowUp();
                }}
                variant="warning"
                className="shrink-0"
                title="Gerar follow-up"
                aria-label="Gerar follow-up"
                size="md"
              >
                <Sparkles aria-hidden="true" />
              </IconButton>
            ) : null}

            {!onOpenLeadChat && hasLeadPhone ? (
              <IconButton
                onClick={() => openLeadInOfficialWhatsApp(leadInfo ?? null)}
                variant="soft"
                className="shrink-0"
                title="Abrir WhatsApp oficial"
                aria-label="Abrir WhatsApp oficial"
                size="md"
              >
                <ExternalLink aria-hidden="true" />
              </IconButton>
            ) : null}

            {leadId && canEdit ? (
              <IconButton
                onClick={() => void handleMarkLeadAsLost(reminder)}
                variant="danger"
                className="shrink-0"
                title="Marcar lead como perdido e limpar lembretes"
                aria-label="Marcar lead como perdido e limpar lembretes"
                disabled={markingLostLeadId === leadId}
                loading={markingLostLeadId === leadId}
                size="md"
              >
                {markingLostLeadId !== leadId && <X aria-hidden="true" />}
              </IconButton>
            ) : null}

            {canEdit ? (
              <IconButton
                onClick={() => void handleDeleteReminder(reminder)}
                variant="danger"
                className="shrink-0"
                title="Excluir item"
                aria-label="Excluir item"
                size="md"
              >
                <Trash2 aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
      </Surface>
    );
  };

  const emptyStateMessage = 'Nenhum item encontrado com os filtros atuais.';

  return (
    <>
      <WorkspaceDialog
        isOpen={isOpen}
        onClose={onClose}
        title="Agenda do WhatsApp"
        description="Mesma base da Agenda unificada, agora acessível dentro do inbox. Tudo o que você fizer aqui reflete em /painel/agenda."
        size="xl"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        }
      >
        {loading ? (
          <Surface variant="muted" padding="none" className="flex min-h-[520px] items-center justify-center">
            <Surface variant="strong" padding="sm" className="flex items-center gap-3 shadow-lg">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Carregando agenda...
              </span>
            </Surface>
          </Surface>
        ) : (
          <div className="space-y-5">
            <Surface padding="sm" className="sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Dia em foco
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {selectedDateLabel}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {visiblePendingReminders.length > 0
                      ? `${visiblePendingReminders.length} pendência(s) em foco: ${overdueReminders.length} atrasada(s) e ${pendingSelectedReminders.length} no dia.`
                      : `Sem pendências abertas para ${selectedDateLabel.toLowerCase()}.`}
                  </p>
                </div>

                <div className="grid w-full grid-cols-[2.75rem_2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:flex sm:flex-wrap sm:justify-end xl:w-auto">
                  {onSendBatchFollowUps ? (
                    <div className="relative inline-flex">
                      <IconButton variant="secondary"  size="lg" onClick={() => setIsBatchModalOpen(true)} aria-label="Follow-ups com IA" title="Follow-ups com IA">
                        <Sparkles className="kds-control-icon" />
                      </IconButton>
                      {pendingCount !== null && pendingCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex min-w-[20px] items-center justify-center rounded-full bg-[var(--warning)] px-1.5 py-0.5 text-[10px] font-bold leading-tight text-[var(--text-on-brand)] shadow-sm">
                          {pendingCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <IconButton variant="secondary" size="lg" onClick={() => setScheduledMessagesOpen(true)} aria-label="Mensagens agendadas" title="Mensagens agendadas">
                    <Calendar className="kds-control-icon" />
                  </IconButton>
                  <IconButton onClick={goToPreviousDay} variant="secondary"  aria-label="Dia anterior" size="lg">
                    <ChevronLeft className="kds-control-icon" />
                  </IconButton>
                  <div className={onSendBatchFollowUps ? "min-w-0 w-full sm:flex-none sm:w-[176px]" : "col-span-2 min-w-0 w-full sm:flex-none sm:w-[176px]"}>
                    <DateTimePicker type="date" value={selectedDateInputValue} onChange={(event) => handleSelectedDateChange(event.target.value)} />
                  </div>
                  <IconButton onClick={goToNextDay} variant="secondary"  aria-label="Próximo dia" size="lg">
                    <ChevronRight className="kds-control-icon" />
                  </IconButton>
                  <Button onClick={goToToday} variant={isSelectedDateToday ? 'primary' : 'secondary'} size="md" className="col-span-2 w-full sm:w-auto">
                    Hoje
                  </Button>
                  <Button onClick={() => setIsAddTaskModalOpen(true)} variant="soft" size="md" className="col-span-2 w-full sm:w-auto" disabled={!canEdit}>
                    <Plus className="kds-control-icon" />
                    Nova tarefa
                  </Button>
                </div>
              </div>
            </Surface>

            <Surface padding="sm" className="sm:p-5">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px_auto_auto]">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar por título, descrição, lead ou contrato..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    leftIcon={Search}
                    
                  />
                  {searchQuery ? (
                    <IconButton
                      onClick={() => setSearchQuery('')}
                      variant="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      title="Limpar busca"
                     size="md" aria-label="Limpar busca">
                      <X aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </div>

                <FilterSelect
                  icon={Tag}
                  value={typeFilter}
                  onChange={setTypeFilter}
                  placeholder="Todos os tipos"
                  includePlaceholderOption={false}
                  options={typeOptions}
                />

                {currentLead ? (
                  <Button onClick={() => setOnlyCurrentLead((current) => !current)} variant={onlyCurrentLead ? 'primary' : 'secondary'} size="md" >
                    {onlyCurrentLead ? 'Só chat atual' : 'Filtrar chat atual'}
                  </Button>
                ) : null}

                {duplicateReminderCount > 0 ? (
                  <Button
                    onClick={() => setIsDuplicatesModalOpen(true)}
                    variant="warning"
                    size="md"
                    
                  >
                    <Copy className="kds-control-icon" />
                    {`Duplicados (${duplicateReminderCount})`}
                  </Button>
                ) : null}

                {hasActiveFilters > 0 ? (
                  <Button onClick={clearFilters} variant="ghost" size="md" >
                    Limpar filtros ({hasActiveFilters})
                  </Button>
                ) : null}
              </div>
            </Surface>

            {duplicateReminderCount > 0 ? (
              <Surface variant="warning" padding="sm" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {duplicateReminderCount} lembrete(s) duplicado(s): mesmo lead, mesmo tipo e vencendo juntos hoje
                    (inclui atrasados de outros dias). Isso pode gerar 2 follow-ups para a mesma pessoa no envio em lote.
                  </span>
                </div>
                <Button onClick={() => setIsDuplicatesModalOpen(true)} variant="secondary" size="sm">
                  Revisar duplicados
                </Button>
              </Surface>
            ) : null}

            {error ? (
              <Surface variant="danger" padding="sm" className="flex items-center gap-2 py-3 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </Surface>
            ) : null}

            {filteredReminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-14 w-14" />}
                title="Nenhum item encontrado"
                description={emptyStateMessage}
              />
            ) : (
              <div className="space-y-4">
                {overdueReminders.length > 0 ? (
                  <Surface padding="sm" className="sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--danger-text)]">
                          Atrasados
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                          Pendências de dias anteriores
                        </h4>
                      </div>
                      <Badge tone="danger">{overdueReminders.length}</Badge>
                    </div>
                    <div className="space-y-3">{overdueReminders.map(renderReminderCard)}</div>
                  </Surface>
                ) : null}

                <Surface padding="sm" className="sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Rotina do dia
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                        {selectedDateLabel}
                      </h4>
                    </div>
                    <Badge tone="accent">{pendingSelectedReminders.length} pendente(s)</Badge>
                  </div>

                  {pendingSelectedReminders.length > 0 ? (
                    <div className="space-y-3">{pendingSelectedReminders.map(renderReminderCard)}</div>
                  ) : (
                    <Surface variant="muted" padding="sm" className="py-8 text-center text-sm text-[var(--text-secondary)]">
                      Nenhum item pendente neste dia.
                    </Surface>
                  )}
                </Surface>

                <Surface padding="sm" className="sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Concluídos no dia
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                        {completedSelectedReminders.length > 0 ? 'Histórico do dia em foco' : 'Nada concluído ainda'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="success">{completedSelectedReminders.length}</Badge>
                      <Button onClick={() => setShowCompleted((current) => !current)} variant="ghost" size="sm">
                        {showCompleted ? 'Ocultar' : 'Mostrar'}
                      </Button>
                    </div>
                  </div>

                  {showCompleted ? (
                    completedSelectedReminders.length > 0 ? (
                      <div className="space-y-3">{completedSelectedReminders.map(renderReminderCard)}</div>
                    ) : (
                      <Surface variant="muted" padding="sm" className="py-8 text-center text-sm text-[var(--text-secondary)]">
                        Nenhum item concluído neste dia.
                      </Surface>
                    )
                  ) : (
                    <Surface variant="muted" padding="sm" className="py-5 text-center text-sm text-[var(--text-secondary)]">
                      Expanda quando quiser revisar o que já foi concluído neste dia.
                    </Surface>
                  )}
                </Surface>
              </div>
            )}
          </div>
        )}
      </WorkspaceDialog>

      {isAddTaskModalOpen ? (
        <WorkspaceDialog
          isOpen
          onClose={closeAddTaskModal}
          title="Nova tarefa"
          description={selectedDateLabel}
          size="sm"
        >
          <form onSubmit={(event) => void handleAddTask(event)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="whatsapp-agenda-task-title" className="text-sm font-medium text-[var(--text-secondary)]">
                Tarefa
              </label>
              <Input
                id="whatsapp-agenda-task-title"
                type="text"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="Digite o título da tarefa"
                required
                disabled={savingTask}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="whatsapp-agenda-task-description" className="text-sm font-medium text-[var(--text-secondary)]">
                Descrição (opcional)
              </label>
              <Textarea
                id="whatsapp-agenda-task-description"
                value={newTaskDescription}
                onChange={(event) => setNewTaskDescription(event.target.value)}
                placeholder="Adicione detalhes da tarefa"
                
                disabled={savingTask}
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" onClick={closeAddTaskModal} variant="secondary" size="md">
                Cancelar
              </Button>
              <Button type="submit" variant="primary" size="md" disabled={savingTask} loading={savingTask}>
                {!savingTask && <Plus className="kds-control-icon" />}
                Adicionar
              </Button>
            </div>
          </form>
        </WorkspaceDialog>
      ) : null}

      {schedulerDraft ? (
        <ReminderSchedulerModal
          lead={schedulerDraft.lead}
          onClose={() => setSchedulerDraft(null)}
          onScheduled={() => {
            void updateLeadNextReturnDate(schedulerDraft.lead.id);
            void loadReminders();
          }}
          promptMessage={schedulerDraft.promptMessage}
          defaultTitle={schedulerDraft.defaultTitle}
          defaultDescription={schedulerDraft.defaultDescription}
          defaultType={schedulerDraft.defaultType}
          defaultPriority={schedulerDraft.defaultPriority}
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

      {isDuplicatesModalOpen ? (
        <WorkspaceDialog
          isOpen
          onClose={() => setIsDuplicatesModalOpen(false)}
          title="Lembretes duplicados"
          description="Mesmo lead, mesmo tipo e vencendo juntos hoje (atrasados de outros dias contam). Escolha qual lembrete manter em cada grupo antes de remover os repetidos."
          size="lg"
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-[var(--text-muted)]">
                {duplicateReminderGroupList.length > 0
                  ? `${duplicateReminderGroupList.length} grupo(s) com duplicidade`
                  : 'Nenhum duplicado no momento'}
              </span>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => setIsDuplicatesModalOpen(false)}>
                  Fechar
                </Button>
                {canEdit && duplicateReminderGroupList.length > 0 ? (
                  <Button
                    variant="danger"
                    onClick={() => void handleDedupeAllGroups()}
                    loading={isDedupingAll}
                    disabled={isDedupingAll || dedupingGroupKey !== null}
                  >
                    Deduplicar tudo
                  </Button>
                ) : null}
              </div>
            </div>
          }
        >
          {duplicateReminderGroupList.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-14 w-14" />}
              title="Sem duplicados"
              description="Nenhum lembrete duplicado encontrado no momento."
            />
          ) : (
            <div className="space-y-4">
              {duplicateReminderGroupList.map((group) => {
                const keepId = getKeepIdForGroup(group);
                const isDedupingThisGroup = dedupingGroupKey === group.key;

                return (
                  <Surface key={group.key} variant="warning" padding="sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{group.leadName}</p>
                        <p className="text-xs text-[var(--text-muted)]">{group.tipo} - {group.dateLabel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">{group.reminders.length} duplicados</Badge>
                        {canEdit ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => void handleDedupeGroup(group)}
                            loading={isDedupingThisGroup}
                            disabled={isDedupingThisGroup || isDedupingAll}
                          >
                            Remover duplicados
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {group.reminders.map((reminder) => (
                        <label
                          key={reminder.id}
                          className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm"
                        >
                          <input
                            type="radio"
                            name={`duplicate-keep-${group.key}`}
                            checked={keepId === reminder.id}
                            onChange={() => handleSelectDuplicateKeep(group.key, reminder.id)}
                            disabled={!canEdit}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-[var(--text-primary)]">{reminder.titulo}</span>
                              {keepId === reminder.id ? <Badge tone="success">Manter</Badge> : null}
                            </div>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {formatDateTimeFullBR(reminder.data_lembrete)}
                            </p>
                            {reminder.descricao ? (
                              <p className="mt-1 text-xs text-[var(--text-secondary)]">{reminder.descricao}</p>
                            ) : null}
                          </div>
                        </label>
                      ))}
                    </div>
                  </Surface>
                );
              })}
            </div>
          )}
        </WorkspaceDialog>
      ) : null}

      <WhatsAppBatchFollowUpModal
        isOpen={isBatchModalOpen}
        onClose={handleCloseBatchModal}
        onSendBatchFollowUps={onSendBatchFollowUps}
      />

      <WhatsAppScheduledMessagesPanel
        channelId={channelId}
        isOpen={isScheduledMessagesOpen}
        onClose={() => setScheduledMessagesOpen(false)}
      />

      {ConfirmationDialog}
    </>
  );
}
