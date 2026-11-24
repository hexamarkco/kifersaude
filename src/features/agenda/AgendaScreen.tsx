import { useMinimumLoading, LoadingMonogram, Heading, Text } from '../../design-system';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWorkspaceCreate } from "../../hooks/useWorkspaceCreate";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  Eye,
  Heart,
  ListChecks,
  UserRound,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Lead } from "../leads";
import {
  createReminder,
  deleteReminder,
  getReminderWhatsappLink,
  getReminderLead,
  isReminderPriority,
  listReminderContracts,
  listReminderLeads,
  listReminders,
  markLeadLostFromAgenda,
  subscribeToReminderChanges,
  updateReminder,
  updateReminders,
  type ReminderListItem,
  type ReminderContractContext,
  type ReminderLeadContext,
  type ManualReminderPrompt,
} from "../reminders";
import { convertLocalToUTC, formatDateTimeFullBR, formatTimeBR, getDateKey, isOverdue } from "../../lib/dateUtils";
import {
  addBusinessDaysSkippingWeekends,
  formatEstimatedTime,
} from "../../lib/reminderUtils";
import { syncLeadNextReturnFromUpcomingReminder } from "../../lib/leadReminderUtils";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import {
  ActionSurface,
  Alert,
  Badge,
  Button,
  Checkbox,
  DateTimePicker,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  RecordActions,
  Select,
  type RecordAction,
  Surface,
  Textarea,
  IconButton,
  FilterSelect,
  Tabs,
} from "../../design-system";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import LeadForm from "../../components/LeadForm";
import { LeadFavoriteBadge } from "../../components/LeadFavoriteStar";
import { toast } from "../../lib/toast";
import { agendaDateKey, todayForAgenda } from "./agendaDates";
import { AgendaCalendar } from "./components/AgendaCalendar";
import FollowUpAgendaOrganizerModal from "./components/FollowUpAgendaOrganizerModal";

type AgendaStatusFilter = "todos" | "nao-lidos" | "lidos";
type AgendaTimeFilter = "todos" | "atrasados" | "dia" | "futuros";
type AgendaTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TIME_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "atrasados", label: "Atrasados" },
  { value: "dia", label: "Hoje" },
  { value: "futuros", label: "Futuros" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Todas as prioridades" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
];

const EMPTY_FILTERS = { searchQuery: "", typeFilter: "all", priorityFilter: "all", timeFilter: "todos" as AgendaTimeFilter };
const SCHEDULE_OFFSETS = [1, 2, 3, 4, 5] as const;
const TASK_PRIORITIES = PRIORITY_OPTIONS.filter(({ value }) => value !== "all");

const formatAgendaCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const getReminderTypeLabel = (type: string) =>
  type.trim().toLocaleLowerCase("pt-BR") === "follow_up" ? "Follow-up" : type;

export default function AgendaScreen() {
  const [filterDraft, setFilterDraft] = useState<typeof EMPTY_FILTERS | null>(null);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>("todos");
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [timeFilter, setTimeFilter] = useState<AgendaTimeFilter>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayForAgenda);
  const [leadsMap, setLeadsMap] = useState<Map<string, ReminderLeadContext>>(new Map());
  const [contractsMap, setContractsMap] = useState<Map<string, ReminderContractContext>>(new Map());
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const showLeadLoading = useMinimumLoading(Boolean(loadingLeadId));
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [manualReminderQueue, setManualReminderQueue] = useState<ManualReminderPrompt[]>([]);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2 | 3 | 4 | 5;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ id: string; date: string; time: string } | null>(null);
  const [reschedulingInFlightId, setReschedulingInFlightId] = useState<string | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<ReminderListItem | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("12:00");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const openNewTask = useCallback((date = selectedDate, time = "12:00") => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDate(agendaDateKey(date));
    setNewTaskTime(time);
    setNewTaskPriority("normal");
    setError(null);
    setIsAddTaskModalOpen(true);
  }, [selectedDate]);
  useWorkspaceCreate(!isAddTaskModalOpen, openNewTask);
  const [savingTask, setSavingTask] = useState(false);
  const [updatingReminderIds, setUpdatingReminderIds] = useState<Set<string>>(new Set());
  const [markingAllFiltered, setMarkingAllFiltered] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const quickSchedulingReminderIdRef = useRef<string | null>(null);
  const reschedulingInFlightIdRef = useRef<string | null>(null);
  const deletingReminderRef = useRef(false);
  const savingTaskRef = useRef(false);
  const updatingReminderIdsRef = useRef<Set<string>>(new Set());
  const markingAllFilteredRef = useRef(false);
  const loadRemindersRequestIdRef = useRef(0);
  const leadInfoRequestIdRef = useRef(0);
  const openLeadRequestIdRef = useRef(0);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const loadReminders = useCallback(async (options?: { showLoading?: boolean }) => {
    const requestId = ++loadRemindersRequestIdRef.current;
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }
    let mainListLoaded = false;

    try {
      const remindersData = await listReminders();

      if (requestId !== loadRemindersRequestIdRef.current) {
        return;
      }

      // Os lembretes são a lista principal da tela. Exiba-os assim que
      // chegarem, sem bloquear a agenda enquanto os dados complementares de
      // contratos e leads são hidratados em seguida.
      setReminders(remindersData);
      setError(null);
      setLoading(false);
      mainListLoaded = true;

      const contractIds = Array.from(
        new Set(
          remindersData
            .map((reminder) => reminder.contract_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const directLeadIds = Array.from(
        new Set(
          remindersData
            .map((reminder) => reminder.lead_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const [fetchedContracts, fetchedDirectLeads] = await Promise.all([
        listReminderContracts(contractIds),
        listReminderLeads(directLeadIds),
      ]);
      const nextContractsMap = new Map<string, ReminderContractContext>();

      fetchedContracts.forEach((contract) => {
        nextContractsMap.set(contract.id, contract);
      });

      const contractLeadIds = Array.from(
        new Set(fetchedContracts.map((contract) => contract.lead_id).filter((id): id is string => Boolean(id))),
      );
      const directLeadIdSet = new Set(directLeadIds);
      const contractOnlyLeadIds = contractLeadIds.filter((leadId) => !directLeadIdSet.has(leadId));
      const fetchedContractLeads = await listReminderLeads(contractOnlyLeadIds);
      const fetchedLeads = [...fetchedDirectLeads, ...fetchedContractLeads];
      const nextLeadsMap = new Map<string, ReminderLeadContext>();

      fetchedLeads.forEach((lead) => {
        nextLeadsMap.set(lead.id, lead);
      });

      if (requestId !== loadRemindersRequestIdRef.current) {
        return;
      }

      setContractsMap(nextContractsMap);
      setLeadsMap(nextLeadsMap);
    } catch (loadError) {
      if (requestId !== loadRemindersRequestIdRef.current) {
        return;
      }

      console.error("Erro ao carregar agenda:", loadError);
      setError(mainListLoaded
        ? "A agenda foi carregada, mas os detalhes dos leads ainda não puderam ser atualizados."
        : "Não foi possível carregar a agenda agora.");
    } finally {
      if (requestId === loadRemindersRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      loadRemindersRequestIdRef.current += 1;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadReminders();
      }, 350);
    };

    void loadReminders({ showLoading: true });

    const unsubscribe = subscribeToReminderChanges(({ current, previous }) => {
      const affectedId = current?.id ?? previous?.id;

      if (affectedId && pendingRefreshIdsRef.current.has(affectedId)) {
        pendingRefreshIdsRef.current.delete(affectedId);
        return;
      }

      scheduleRefresh();
    });

    return () => {
      loadRemindersRequestIdRef.current += 1;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      leadInfoRequestIdRef.current += 1;
      openLeadRequestIdRef.current += 1;
      unsubscribe();
    };
  }, [loadReminders]);

  const getLeadIdForReminder = useCallback(
    (reminder?: ReminderListItem | null) => {
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

  const fetchLeadInfo = useCallback(
    async (leadId: string) => {
      if (!leadId) {
        return null;
      }

      const cachedLead = leadsMap.get(leadId);
      if (cachedLead) {
        return cachedLead;
      }

      const requestId = ++leadInfoRequestIdRef.current;
      setLoadingLeadId(leadId);

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
        console.error("Erro ao carregar dados do lead:", leadError);
        return null;
      } finally {
        if (requestId === leadInfoRequestIdRef.current) {
          setLoadingLeadId(null);
        }
      }
    },
    [leadsMap],
  );

  const openLeadInOfficialWhatsApp = (lead?: Pick<Lead, "telefone"> | null) => {
    const whatsappLink = getReminderWhatsappLink(lead?.telefone);

    if (!whatsappLink) {
      return;
    }

    window.open(whatsappLink, "_blank", "noopener,noreferrer");
  };

  const handleOpenLead = async (leadId: string) => {
    if (!leadId) {
      return;
    }

    const requestId = ++openLeadRequestIdRef.current;
    setLoadingLeadId(leadId);
    let leadData: Lead | null = null;

    try {
      leadData = await getReminderLead(leadId);
    } catch (leadError) {
      console.error("Erro ao carregar dados completos do lead:", leadError);
    } finally {
      if (requestId === openLeadRequestIdRef.current) {
        setLoadingLeadId(null);
      }
    }

    if (requestId !== openLeadRequestIdRef.current) {
      return;
    }

    if (!leadData) {
      toast.error("Não foi possível localizar os dados deste lead.");
      return;
    }

    setEditingLead(leadData);
  };

  const handleLeadSaved = () => {
    setEditingLead(null);
    void loadReminders();
  };

  const updateLeadNextReturnDate = async (leadId: string) => {
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
      return true;
    } catch (syncError) {
      console.error("Erro ao sincronizar proximo follow-up do lead:", syncError);
      return false;
    }
  };

  const handleMarkLeadAsLost = async (reminder: ReminderListItem) => {
    const leadId = getLeadIdForReminder(reminder);

    if (!leadId) {
      toast.error("Não foi possível identificar o lead deste lembrete.");
      return;
    }

    const leadInfo = leadsMap.get(leadId) ?? (await fetchLeadInfo(leadId));
    const leadName = leadInfo?.nome_completo ?? "este lead";
    const previousStatus = leadInfo?.status ?? "Sem status";

    const confirmed = await requestConfirmation({
      title: "Marcar lead como perdido",
      description: `Deseja marcar ${leadName} como perdido e remover os lembretes pendentes?`,
      confirmLabel: "Marcar como perdido",
      cancelLabel: "Cancelar",
      tone: "danger",
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
            status: "Perdido",
            proximo_retorno: null,
            ultimo_contato: nowIso,
          });
        }

        return next;
      });

      setReminders((current) => current.filter((item) => getLeadIdForReminder(item) !== leadId));
    } catch (markError) {
      console.error("Erro ao marcar lead como perdido:", markError);
      toast.error("Não foi possível marcar o lead como perdido.");
    } finally {
      setMarkingLostLeadId(null);
    }
  };

  const handleMarkAsRead = async (
    reminderId: string,
    currentStatus: boolean,
    options?: { queueNextReminderPrompt?: boolean; suppressErrorToast?: boolean },
  ) => {
    if (markingAllFilteredRef.current || updatingReminderIdsRef.current.has(reminderId)) {
      return false;
    }

    updatingReminderIdsRef.current.add(reminderId);
    setUpdatingReminderIds(new Set(updatingReminderIdsRef.current));

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
        const synchronized = await updateLeadNextReturnDate(leadId);
        if (!synchronized && !options?.suppressErrorToast) {
          toast.warning('Lembrete atualizado, mas o próximo retorno do lead ainda precisa ser sincronizado.');
        }
      }

      if (completionDate && leadId && reminder && queueNextReminderPrompt) {
        let leadInfo = leadsMap.get(leadId);

        if (!leadInfo) {
          leadInfo = (await getReminderLead(leadId)) ?? undefined;

          if (leadInfo) {
            const loadedLead = leadInfo;
            setLeadsMap((current) => {
              const next = new Map(current);
              next.set(loadedLead.id, loadedLead);
              return next;
            });
          }
        }

        if (leadInfo) {
          setManualReminderQueue((current) => [
            ...current,
            {
              lead: leadInfo,
              promptMessage: "Deseja marcar um próximo lembrete para este lead?",
              defaultTitle: reminder.titulo,
              defaultDescription: reminder.descricao ?? undefined,
              defaultType: "Follow-up",
              defaultPriority: isReminderPriority(reminder.prioridade) ? reminder.prioridade : "normal",
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
      console.error("Erro ao atualizar lembrete:", updateError);
      if (!options?.suppressErrorToast) {
        toast.error("Erro ao atualizar lembrete.");
      }
      return false;
    } finally {
      updatingReminderIdsRef.current.delete(reminderId);
      setUpdatingReminderIds(new Set(updatingReminderIdsRef.current));
    }
  };

  const handleQuickSchedule = async (reminder: ReminderListItem, daysAhead: 1 | 2 | 3 | 4 | 5) => {
    if (reminder.lido || quickSchedulingReminderIdRef.current || markingAllFilteredRef.current) {
      return;
    }

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error("Não foi possível identificar o lead deste lembrete.");
      return;
    }

    const nextReminderDate = addBusinessDaysSkippingWeekends(reminder.data_lembrete, daysAhead);
    const nextReminderDateIso = nextReminderDate.toISOString();

    quickSchedulingReminderIdRef.current = reminder.id;
    setQuickSchedulingAction({ reminderId: reminder.id, daysAhead });

    try {
      const createdReminder = await createReminder({
        lead_id: leadId,
        contract_id: reminder.contract_id ?? undefined,
        tipo: reminder.tipo,
        titulo: reminder.titulo,
        descricao: reminder.descricao ?? null,
        data_lembrete: nextReminderDateIso,
        lido: false,
        prioridade: reminder.prioridade,
      });

      if (!createdReminder) {
        toast.error("Não foi possível confirmar o novo lembrete. O lembrete atual continua pendente.");
        return;
      }

      pendingRefreshIdsRef.current.add(createdReminder.id);
      setReminders((current) =>
        [...current, createdReminder].sort(
          (left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
        ),
      );

      const markedAsRead = await handleMarkAsRead(reminder.id, reminder.lido, {
        queueNextReminderPrompt: false,
        suppressErrorToast: true,
      });
      const synchronized = await updateLeadNextReturnDate(leadId);

      if (!markedAsRead || !synchronized) {
        toast.warning("Novo lembrete criado, mas alguns dados do anterior ainda precisam de atenção.");
      }
    } catch (scheduleError) {
      console.error("Erro ao agendar lembrete rápido:", scheduleError);
      toast.error("Não foi possível criar o novo lembrete rápido.");
    } finally {
      quickSchedulingReminderIdRef.current = null;
      setQuickSchedulingAction(null);
    }
  };

  const handleDelete = (reminderId: string) => {
    const reminder = reminders.find((item) => item.id === reminderId);
    if (reminder) {
      setReminderPendingDeletion(reminder);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!reminderPendingDeletion || deletingReminderRef.current) {
      return;
    }

    const reminderToDelete = reminderPendingDeletion;
    deletingReminderRef.current = true;
    setIsDeletingReminder(true);

    try {
      pendingRefreshIdsRef.current.add(reminderToDelete.id);
      try {
        await deleteReminder(reminderToDelete.id);
      } catch (deleteError) {
        pendingRefreshIdsRef.current.delete(reminderToDelete.id);
        throw deleteError;
      }

      const leadId = getLeadIdForReminder(reminderToDelete);
      if (leadId) {
        const synchronized = await updateLeadNextReturnDate(leadId);
        if (!synchronized) {
          toast.warning('Lembrete removido, mas o próximo retorno do lead ainda precisa ser sincronizado.');
        }
      }

      setReminders((current) => current.filter((item) => item.id !== reminderToDelete.id));
    } catch (deleteError) {
      console.error("Erro ao remover lembrete:", deleteError);
      toast.error("Erro ao remover lembrete.");
    } finally {
      deletingReminderRef.current = false;
      setIsDeletingReminder(false);
      setReminderPendingDeletion(null);
    }
  };

  const handleRescheduleReminder = async (reminderId: string, date: string, time: string) => {
    if (reschedulingInFlightIdRef.current) {
      return;
    }

    try {
      const reminder = reminders.find((item) => item.id === reminderId);
      if (!reminder) {
        return;
      }

      const newDateIso = convertLocalToUTC(`${date}T${time}`);

      reschedulingInFlightIdRef.current = reminderId;
      setReschedulingInFlightId(reminderId);
      pendingRefreshIdsRef.current.add(reminderId);
      try {
        await updateReminder(reminderId, { data_lembrete: newDateIso });
      } catch (updateError) {
        pendingRefreshIdsRef.current.delete(reminderId);
        throw updateError;
      }

      const leadId = getLeadIdForReminder(reminder);
      if (leadId) {
        const synchronized = await updateLeadNextReturnDate(leadId);
        if (!synchronized) {
          toast.warning('Lembrete reagendado, mas o próximo retorno do lead ainda precisa ser sincronizado.');
        }
      }

      setReschedule(null);
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
    } catch (rescheduleError) {
      console.error("Erro ao reagendar lembrete:", rescheduleError);
      toast.error("Não foi possível reagendar o item.");
    } finally {
      reschedulingInFlightIdRef.current = null;
      setReschedulingInFlightId(null);
    }
  };

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();

    if (savingTaskRef.current || !newTaskTitle.trim() || !newTaskDate || !newTaskTime) {
      return;
    }

    savingTaskRef.current = true;
    setSavingTask(true);
    setError(null);

    try {
      const createdTask = await createReminder({
        tipo: "Tarefa",
        titulo: newTaskTitle.trim(),
        descricao: newTaskDescription.trim() || null,
        data_lembrete: convertLocalToUTC(`${newTaskDate}T${newTaskTime}`),
        lido: false,
        prioridade: newTaskPriority,
      });

      if (!createdTask) {
        const message = "Não foi possível confirmar a tarefa. Tente novamente.";
        setError(message);
        toast.error(message);
        return;
      }

      pendingRefreshIdsRef.current.add(createdTask.id);
      setReminders((current) =>
        [...current, createdTask].sort(
          (left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
        ),
      );

      setNewTaskTitle("");
      setNewTaskDescription("");
      setIsAddTaskModalOpen(false);
    } catch (insertError) {
      console.error("Erro ao criar tarefa:", insertError);
      setError("Não foi possível criar a tarefa.");
    } finally {
      savingTaskRef.current = false;
      setSavingTask(false);
    }
  };

  const handleMarkAllFilteredAsRead = async () => {
    if (markingAllFilteredRef.current || updatingReminderIdsRef.current.size > 0) {
      return;
    }

    const unreadFiltered = filteredReminders.filter((item) => !item.lido);

    if (unreadFiltered.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Marcar filtros como lidos",
      description: `Deseja marcar ${formatAgendaCount(unreadFiltered.length, "item filtrado", "itens filtrados")} como ${unreadFiltered.length === 1 ? "lido" : "lidos"}?`,
      confirmLabel: "Marcar como lidos",
      cancelLabel: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    markingAllFilteredRef.current = true;
    setMarkingAllFiltered(true);

    try {
      const completionDate = new Date().toISOString();
      unreadFiltered.forEach((item) => pendingRefreshIdsRef.current.add(item.id));

      try {
        await updateReminders(
          unreadFiltered.map((item) => item.id),
          { lido: true, concluido_em: completionDate },
        );
      } catch (updateError) {
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

      const syncResults = await Promise.all(leadIds.map((leadId) => updateLeadNextReturnDate(leadId)));

      if (syncResults.some((result) => !result)) {
        toast.warning("Os itens foram marcados como lidos, mas alguns leads ainda não foram sincronizados.");
      }

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
    } catch (updateError) {
      console.error("Erro ao atualizar lembretes:", updateError);
      toast.error("Erro ao atualizar os itens filtrados.");
    } finally {
      markingAllFilteredRef.current = false;
      setMarkingAllFiltered(false);
    }
  };

  const selectDate = (date: Date) => {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    setSelectedDate(normalizedDate);
  };

  const moveCalendar = (direction: -1 | 1) => {
    if (calendarView === 'week') {
      selectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + direction * 7));
    } else {
      selectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1));
    }
  };

  const goToToday = () => {
    selectDate(todayForAgenda());
  };

  const closeAddTaskModal = () => {
    setIsAddTaskModalOpen(false);
    setNewTaskTitle("");
    setNewTaskDescription("");
  };

  const compareRemindersByDueAtThenAlphabetical = useCallback(
    (left: ReminderListItem, right: ReminderListItem) => {
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

      const leftLeadName = leftLeadId ? leadsMap.get(leftLeadId)?.nome_completo : "";
      const rightLeadName = rightLeadId ? leadsMap.get(rightLeadId)?.nome_completo : "";
      const leftLabel = (leftLeadName || left.titulo || "").trim();
      const rightLabel = (rightLeadName || right.titulo || "").trim();
      const labelComparison = leftLabel.localeCompare(rightLabel, "pt-BR", {
        sensitivity: "base",
      });

      if (labelComparison !== 0) {
        return labelComparison;
      }

      return left.id.localeCompare(right.id, "pt-BR", { sensitivity: "base" });
    },
    [getLeadIdForReminder, leadsMap],
  );

  const typeOptions = useMemo(() => {
    const types = Array.from(new Set(reminders.map((item) => item.tipo).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { sensitivity: "base" }),
    );

    return [
      { value: "all", label: "Todos os tipos" },
      ...types.map((type) => ({ value: type, label: getReminderTypeLabel(type) })),
    ];
  }, [reminders]);

  const matchesNonStatusFilters = useCallback(
    (reminder: ReminderListItem) => {
      if (typeFilter !== "all" && reminder.tipo !== typeFilter) {
        return false;
      }

      if (priorityFilter !== "all" && reminder.prioridade !== priorityFilter) {
        return false;
      }

      if (timeFilter !== "todos") {
        const reminderDay = getDateKey(reminder.data_lembrete);
        const today = getDateKey(new Date());
        if (!reminderDay) return false;
        if (timeFilter === "atrasados" && (reminder.lido || reminderDay >= today)) return false;
        if (timeFilter === "dia" && reminderDay !== today) return false;
        if (timeFilter === "futuros" && reminderDay <= today) return false;
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const leadName = (() => {
        const leadId = getLeadIdForReminder(reminder);
        return leadId ? leadsMap.get(leadId)?.nome_completo ?? "" : "";
      })();

      const normalizedQuery = searchQuery.trim().toLowerCase();
      return [reminder.titulo, reminder.descricao, reminder.tipo, leadName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    },
    [getLeadIdForReminder, leadsMap, priorityFilter, searchQuery, timeFilter, typeFilter],
  );

  const filteredReminders = useMemo(() => {
    return reminders
      .filter((reminder) => {
        if (statusFilter === "nao-lidos" && reminder.lido) {
          return false;
        }

        if (statusFilter === "lidos" && !reminder.lido) {
          return false;
        }

        return matchesNonStatusFilters(reminder);
      })
      .sort(compareRemindersByDueAtThenAlphabetical);
  }, [compareRemindersByDueAtThenAlphabetical, matchesNonStatusFilters, reminders, statusFilter]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, ReminderListItem[]>();

    filteredReminders.forEach((reminder) => {
      const dateKey = getDateKey(reminder.data_lembrete);
      const items = map.get(dateKey) ?? [];
      items.push(reminder);
      map.set(dateKey, items);
    });

    return map;
  }, [filteredReminders]);

  const selectedDateKey = agendaDateKey(selectedDate);

  const selectedDateReminders = remindersByDay.get(selectedDateKey) ?? [];
  const detail = reminders.find((item) => item.id === detailId);
  const detailLeadId = detail ? getLeadIdForReminder(detail) : undefined;
  const detailLead = detailLeadId ? leadsMap.get(detailLeadId) : undefined;
  const detailContract = detail?.contract_id ? contractsMap.get(detail.contract_id) : undefined;
  const rescheduledItem = reschedule ? reminders.find((item) => item.id === reschedule.id) : undefined;
  const hasAdvancedFilters = typeFilter !== "all" || timeFilter !== "todos";
  const hasActiveFilters = hasAdvancedFilters || priorityFilter !== "all" || searchQuery.trim() !== "";

  const beginReschedule = (reminder: ReminderListItem) => {
    const date = getDateKey(reminder.data_lembrete);
    const time = formatTimeBR(reminder.data_lembrete);
    setDetailId(null);
    setReschedule({ id: reminder.id, date: date || selectedDateKey, time: time || "12:00" });
  };

  const reminderBusy = (id: string) =>
    updatingReminderIds.has(id) || quickSchedulingAction?.reminderId === id || Boolean(reschedulingInFlightId) || markingAllFiltered;

  const openFilters = () => setFilterDraft({ searchQuery, typeFilter, priorityFilter, timeFilter });

  const pageActions: RecordAction[] = [
    { label: "Organizar follow-ups", icon: Sparkles, onClick: () => setOrganizerOpen(true) },
    ...(statusFilter === "todos" ? [{ label: "Filtrar agenda", icon: SlidersHorizontal, onClick: openFilters }] : []),
    ...(filteredReminders.some((item) => !item.lido) ? [{
      label: "Marcar itens filtrados como lidos",
      icon: ListChecks,
      onClick: () => void handleMarkAllFilteredAsRead(),
      disabled: markingAllFiltered || updatingReminderIds.size > 0,
    }] : []),
  ];

  const getReminderPriorityTone = (priority: string): AgendaTone => {
    const tones = {
      baixa: "info",
      normal: "neutral",
      alta: "danger",
    } as const;

    return tones[priority as keyof typeof tones] ?? "neutral";
  };

  const getReminderTypeTone = (type: string): AgendaTone => {
    const tones = {
      "Documentos pendentes": "warning",
      Assinatura: "accent",
      Ativacao: "info",
      Renovacao: "warning",
      Retorno: "neutral",
      "Follow-up": "accent",
      Tarefa: "accent",
      Outro: "neutral",
      Aniversario: "warning",
      Reajuste: "info",
    } as const;

    const label = getReminderTypeLabel(type);
    return tones[label as keyof typeof tones] ?? "neutral";
  };

  const getReminderIcon = (type: string) => {
    const icons = {
      "Documentos pendentes": AlertCircle,
      Assinatura: AlertCircle,
      Ativacao: Calendar,
      Renovacao: Calendar,
      Retorno: Bell,
      Tarefa: CheckCircle2,
      "Follow-up": CalendarPlus,
    } as const;

    const label = getReminderTypeLabel(type);
    const Icon = icons[label as keyof typeof icons] ?? Bell;
    return <Icon className="h-4 w-4" aria-hidden="true" />;
  };

  const renderReminderRow = (reminder: ReminderListItem) => {
    const leadId = getLeadIdForReminder(reminder);
    const lead = leadId ? leadsMap.get(leadId) : undefined;
    const contract = reminder.contract_id ? contractsMap.get(reminder.contract_id) : undefined;
    const overdue = !reminder.lido && isOverdue(reminder.data_lembrete);
    const dueDay = getDateKey(reminder.data_lembrete);
    const dueTime = formatTimeBR(reminder.data_lembrete);
    const showDay = statusFilter !== "todos" && dueDay && dueDay !== getDateKey(new Date());
    const busy = reminderBusy(reminder.id);
    const actions: RecordAction[] = [
      { label: "Ver detalhes", icon: Eye, onClick: () => setDetailId(reminder.id) },
    ];

    if (!reminder.lido) {
      actions.push(
        { label: "Reagendar item", icon: Calendar, disabled: busy, onClick: () => beginReschedule(reminder) },
        ...SCHEDULE_OFFSETS.map((days) => ({
          label: `Concluir e agendar em +${days} ${days === 1 ? "dia útil" : "dias úteis"}`,
          icon: CalendarClock,
          disabled: busy,
          onClick: () => void handleQuickSchedule(reminder, days),
        })),
      );
    }

    if (leadId) {
      actions.push(
        { label: "Abrir cadastro do lead", icon: UserRound, onClick: () => void handleOpenLead(leadId) },
        { label: "Abrir WhatsApp oficial", icon: ExternalLink, disabled: !lead?.telefone, onClick: () => void openLeadInOfficialWhatsApp(lead ?? null) },
        { label: "Marcar lead como perdido e limpar lembretes", icon: X, destructive: true, disabled: markingLostLeadId === leadId, onClick: () => void handleMarkLeadAsLost(reminder) },
      );
    }

    actions.push({ label: "Excluir item", icon: Trash2, destructive: true, disabled: busy, onClick: () => handleDelete(reminder.id) });

    return (
      <article key={reminder.id} className="kds-agenda-task-row" data-completed={reminder.lido}>
        <Checkbox touchTarget checked={reminder.lido} disabled={busy} aria-label={`${reminder.lido ? "Reabrir" : "Concluir"} ${reminder.titulo}`} onChange={() => void handleMarkAsRead(reminder.id, reminder.lido)} />
        <ActionSurface variant="plain" padding="none" className="kds-agenda-task-copy" onClick={() => setDetailId(reminder.id)}>
          <strong>{reminder.titulo}</strong>
          <small>
            {lead?.nome_completo && <><LeadFavoriteBadge favorito={lead.favorito} />{lead.nome_completo}<span aria-hidden="true">·</span></>}
            {!lead?.nome_completo && contract?.codigo_contrato && <>{contract.codigo_contrato}<span aria-hidden="true">·</span></>}
            {getReminderTypeLabel(reminder.tipo)}
          </small>
        </ActionSurface>
        <time className="kds-agenda-task-time" data-overdue={overdue} dateTime={reminder.data_lembrete} title={dueDay ? formatDateTimeFullBR(reminder.data_lembrete) : undefined}>
          {overdue ? "Atrasado" : showDay ? `${dueDay.slice(8, 10)}/${dueDay.slice(5, 7)} · ${dueTime}` : dueTime || "Sem horário"}
        </time>
        <RecordActions label={`Ações de ${reminder.titulo}`} actions={actions} visibleCount={0} />
      </article>
    );
  };

  const hasAgendaSnapshot = reminders.length > 0;
  const selectedDateLabel = selectedDate.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const showCalendar = statusFilter === "todos";
  return (
    <>
      {<LoadingState active={loading && !hasAgendaSnapshot} label="Carregando agenda..." className="min-h-96" fallback={() => (
      <div className="kds-agenda-page panel-page-shell space-y-4 sm:space-y-5">
        <PageHeader
          title={statusFilter === 'nao-lidos' ? 'O que precisa acontecer.' : statusFilter === 'lidos' ? 'O trabalho que já foi feito.' : calendarView === 'week' ? 'Uma semana com mais clareza.' : 'Sua rotina, bem organizada.'}
          description={statusFilter === 'nao-lidos' ? 'Priorize os retornos e mantenha o acompanhamento em dia.' : statusFilter === 'lidos' ? 'Consulte o histórico de tarefas e lembretes concluídos.' : calendarView === 'week' ? 'Atendimentos, tarefas e follow-ups distribuídos no tempo.' : 'Encontre tempo para o que merece a sua atenção.'}
          actions={(
            <div role="group" aria-label="Ações da agenda" className="kds-agenda-header-actions">
              <RecordActions label="Ações da página" actions={pageActions} visibleCount={0} />
              <Button onClick={() => openNewTask()} variant="primary" size="md">
                <Plus className="kds-control-icon" aria-hidden="true" />
                Nova tarefa
              </Button>
            </div>
          )}
        />

        <Tabs
            items={[
              { id: "month", label: "Calendário" },
              { id: "week", label: "Semana" },
              { id: "nao-lidos", label: "Pendentes" },
              { id: "lidos", label: "Concluídos" },
            ]}
            value={statusFilter === 'todos' ? calendarView : statusFilter}
            onChange={(view) => {
              if (view === 'month' || view === 'week') {
                setCalendarView(view);
                setStatusFilter('todos');
              } else {
                setStatusFilter(view);
              }
            }}
            className="kds-agenda-status-switcher"
            listClassName="flex-nowrap overflow-x-auto pb-1"
            ariaLabel="Visões da agenda"
        />

        {error && <Alert tone="danger" title="Não foi possível concluir a operação">{error}</Alert>}

        {showCalendar ? (
          <div className={`kds-agenda-workspace-grid${calendarView === "month" ? " kds-month-layout" : ""}`}>
            <AgendaCalendar
              view={calendarView}
              selected={selectedDate}
              remindersByDay={remindersByDay}
              onSelect={selectDate}
              onMove={moveCalendar}
              onToday={goToToday}
              onCreate={openNewTask}
              onDetail={setDetailId}
            />
            {calendarView === "month" && (
              <Surface padding="none" className="kds-agenda-selected-day">
                <div className="kds-agenda-selected-heading">
                  <div>
                    <Heading level={2}>{selectedDateLabel}</Heading>
                    <Text>O que está reservado para este dia.</Text>
                  </div>
                  <IconButton variant="secondary" size="sm" aria-label="Adicionar tarefa neste dia" onClick={() => openNewTask()}><Plus /></IconButton>
                </div>
                <div className="kds-agenda-day-body">
                  {selectedDateReminders.length > 0 ? selectedDateReminders.map(renderReminderRow) : (
                    <EmptyState
                      icon={<Calendar />}
                      title={hasActiveFilters ? "Nenhum item com esses filtros." : "Um espaço livre na sua agenda."}
                      description="Adicione uma tarefa ou escolha outro dia."
                      action={<Button variant="secondary" size="sm" onClick={() => openNewTask()}>Adicionar tarefa</Button>}
                    />
                  )}
                </div>
                <div className="kds-agenda-day-note">
                  <div className="kds-agenda-day-notice">
                    <Heart aria-hidden="true" />
                    <div><strong>O acompanhamento faz a diferença.</strong><Text>Reserve tempo para retomar as conversas com calma.</Text></div>
                  </div>
                </div>
              </Surface>
            )}
          </div>
        ) : (
          <>
            <div className="kds-agenda-toolbar">
              <Input
                placeholder="Buscar tarefa ou contato…"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                leftIcon={Search}
                aria-label="Buscar tarefas e lembretes"
              />
              <FilterSelect
                value={priorityFilter}
                onChange={setPriorityFilter}
                placeholder="Todas as prioridades"
                includePlaceholderOption={false}
                options={PRIORITY_OPTIONS}
                neutralValues={["all"]}
              />
              <Button onClick={openFilters} variant="secondary" size="md">
                <SlidersHorizontal className="kds-control-icon" aria-hidden="true" />
                Filtros
                {hasAdvancedFilters && <Badge size="sm" tone="accent">Ativos</Badge>}
              </Button>
              <Text className="kds-agenda-toolbar-count" role="status">
                {statusFilter === "nao-lidos"
                  ? formatAgendaCount(filteredReminders.length, "pendente", "pendentes")
                  : formatAgendaCount(filteredReminders.length, "concluído", "concluídos")}
              </Text>
            </div>
            <Surface padding="none" className="kds-agenda-task-list">
              {filteredReminders.length > 0 ? filteredReminders.map(renderReminderRow) : (
                <EmptyState
                  icon={<CheckCircle2 />}
                  title={statusFilter === "lidos" && !hasActiveFilters ? "Ainda não há tarefas concluídas." : hasActiveFilters ? "Nenhuma tarefa com esses filtros." : "Nenhuma tarefa pendente."}
                  description="Experimente ajustar os filtros ou voltar ao calendário."
                />
              )}
            </Surface>
          </>
        )}

        {filterDraft && (
          <Dialog open size="md" className="kds-agenda-dialog" onOpenChange={(open) => !open && setFilterDraft(null)}>
            <DialogHeader onClose={() => setFilterDraft(null)}>
              <DialogTitle>Filtrar agenda</DialogTitle>
              <DialogDescription placement="visible">Encontre as tarefas e os lembretes que você quer acompanhar.</DialogDescription>
            </DialogHeader>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
              event.preventDefault();
              setSearchQuery(filterDraft.searchQuery);
              setTypeFilter(filterDraft.typeFilter);
              setPriorityFilter(filterDraft.priorityFilter);
              setTimeFilter(filterDraft.timeFilter);
              setFilterDraft(null);
            }}>
              <DialogBody className="space-y-4">
                <Field label="Buscar tarefa ou contato" htmlFor="agenda-filter-search">
                  <Input id="agenda-filter-search" leftIcon={Search} value={filterDraft.searchQuery} onChange={(event) => setFilterDraft({ ...filterDraft, searchQuery: event.target.value })} />
                </Field>
                <div className="kds-agenda-form-grid">
                  <Field label="Tipo" htmlFor="agenda-filter-type">
                    <Select id="agenda-filter-type" value={filterDraft.typeFilter} options={typeOptions} onChange={(event) => setFilterDraft({ ...filterDraft, typeFilter: event.target.value })} />
                  </Field>
                  <Field label="Prazo" htmlFor="agenda-filter-time">
                    <Select id="agenda-filter-time" value={filterDraft.timeFilter} options={TIME_FILTER_OPTIONS} onChange={(event) => setFilterDraft({ ...filterDraft, timeFilter: event.target.value as AgendaTimeFilter })} />
                  </Field>
                  <Field label="Prioridade" htmlFor="agenda-filter-priority">
                    <Select id="agenda-filter-priority" value={filterDraft.priorityFilter} options={PRIORITY_OPTIONS} onChange={(event) => setFilterDraft({ ...filterDraft, priorityFilter: event.target.value })} />
                  </Field>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFilterDraft({ ...EMPTY_FILTERS })}>Limpar filtros</Button>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setFilterDraft(null)}>Cancelar</Button>
                <Button variant="primary" type="submit">Aplicar filtros</Button>
              </DialogFooter>
            </form>
          </Dialog>
        )}

        {detail && (
          <Dialog open size="md" className="kds-agenda-dialog" onOpenChange={(open) => !open && setDetailId(null)}>
            <DialogHeader onClose={() => setDetailId(null)}>
              <DialogTitle>Detalhes do lembrete</DialogTitle>
              <DialogDescription placement="visible">Informações e ações deste item da agenda.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="kds-agenda-detail-summary">
                <span className="kds-agenda-detail-icon">{getReminderIcon(detail.tipo)}</span>
                <Heading level={3}>{detail.titulo}</Heading>
                <Badge tone={detail.lido ? "success" : isOverdue(detail.data_lembrete) ? "danger" : "accent"}>
                  {detail.lido ? "Concluído" : isOverdue(detail.data_lembrete) ? "Atrasado" : "Pendente"}
                </Badge>
              </div>
              <dl className="kds-agenda-detail-grid">
                {detailLead && <><dt>Contato</dt><dd><Button variant="ghost" size="sm" onClick={() => { setDetailId(null); void handleOpenLead(detailLead.id); }}>{detailLead.nome_completo}</Button></dd></>}
                {detailContract?.codigo_contrato && <><dt>Contrato</dt><dd>{detailContract.codigo_contrato}</dd></>}
                <dt>Quando</dt><dd>{formatDateTimeFullBR(detail.data_lembrete)}</dd>
                <dt>Tipo</dt><dd><Badge tone={getReminderTypeTone(detail.tipo)}>{getReminderTypeLabel(detail.tipo)}</Badge></dd>
                {detail.prioridade && <><dt>Prioridade</dt><dd><Badge tone={getReminderPriorityTone(detail.prioridade)}>{detail.prioridade}</Badge></dd></>}
                {detail.descricao && <><dt>Detalhes</dt><dd className="whitespace-pre-wrap">{detail.descricao}</dd></>}
                {detail.tempo_estimado_minutos && <><dt>Tempo estimado</dt><dd>{formatEstimatedTime(detail.tempo_estimado_minutos)}</dd></>}
                {Boolean(detail.tags?.length) && <><dt>Marcadores</dt><dd className="flex flex-wrap gap-1">{detail.tags?.map((tag, index) => <Badge key={`${tag}-${index}`} tone="info">{tag}</Badge>)}</dd></>}
              </dl>
              {!detail.lido && <Button variant="secondary" size="sm" disabled={reminderBusy(detail.id)} onClick={() => beginReschedule(detail)}><CalendarClock className="kds-control-icon" />Reagendar</Button>}
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDetailId(null)}>Fechar</Button>
              <Button variant="primary" disabled={reminderBusy(detail.id)} onClick={() => { setDetailId(null); void handleMarkAsRead(detail.id, detail.lido); }}>
                {detail.lido ? "Reabrir item" : "Concluir item"}
              </Button>
            </DialogFooter>
          </Dialog>
        )}

        {reschedule && (
          <Dialog open size="md" className="kds-agenda-dialog" onOpenChange={(open) => !open && !reschedulingInFlightId && setReschedule(null)}>
            <DialogHeader onClose={reschedulingInFlightId ? undefined : () => setReschedule(null)}>
              <DialogTitle>Reagendar lembrete</DialogTitle>
              <DialogDescription placement="visible">Escolha quando este lembrete deve aparecer na agenda.</DialogDescription>
            </DialogHeader>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => {
              event.preventDefault();
              if (reschedule.date && reschedule.time) void handleRescheduleReminder(reschedule.id, reschedule.date, reschedule.time);
            }}>
              <DialogBody className="space-y-4">
                {rescheduledItem && (
                  <div className="kds-agenda-reschedule-summary">
                    <span className="kds-agenda-detail-icon">{getReminderIcon(rescheduledItem.tipo)}</span>
                    <div>
                      <Text weight="semibold">{rescheduledItem.titulo}</Text>
                      {rescheduledItem.descricao && <Text size="sm" tone="muted">{rescheduledItem.descricao}</Text>}
                    </div>
                  </div>
                )}
                <div className="kds-agenda-form-grid">
                  <Field label="Nova data" htmlFor="agenda-reschedule-date" required>
                    <DateTimePicker id="agenda-reschedule-date" type="date" value={reschedule.date} disabled={Boolean(reschedulingInFlightId)} onChange={({ target }) => setReschedule({ ...reschedule, date: target.value })} />
                  </Field>
                  <Field label="Horário" htmlFor="agenda-reschedule-time" required>
                    <DateTimePicker id="agenda-reschedule-time" type="time" value={reschedule.time} disabled={Boolean(reschedulingInFlightId)} onChange={({ target }) => setReschedule({ ...reschedule, time: target.value })} />
                  </Field>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setReschedule(null)} disabled={Boolean(reschedulingInFlightId)}>Cancelar</Button>
                <Button type="submit" variant="primary" loading={Boolean(reschedulingInFlightId)} disabled={!reschedule.date || !reschedule.time || Boolean(reschedulingInFlightId)}>Salvar reagendamento</Button>
              </DialogFooter>
            </form>
          </Dialog>
        )}

        {reminderPendingDeletion && (
          <Dialog
            open
            aria-label="Remover item da agenda"
            className="kds-agenda-dialog"
            onOpenChange={(open) => {
              if (!open && !isDeletingReminder) setReminderPendingDeletion(null);
            }}
            size="sm"
          >
            <DialogHeader onClose={isDeletingReminder ? undefined : () => setReminderPendingDeletion(null)}>
              <DialogTitle>Remover item</DialogTitle>
              <DialogDescription placement="visible">Esta ação não pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Alert tone="danger" title={`Remover "${reminderPendingDeletion.titulo}"?`}>
                {reminderPendingDeletion.descricao
                  ? <span className="break-words">{reminderPendingDeletion.descricao}</span>
                  : "O item será removido permanentemente da agenda."}
              </Alert>
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => setReminderPendingDeletion(null)} disabled={isDeletingReminder} variant="secondary" size="md">
                Cancelar
              </Button>
              <Button onClick={() => void confirmDeleteReminder()} disabled={isDeletingReminder} variant="danger" size="md" loading={isDeletingReminder}>
                Remover
              </Button>
            </DialogFooter>
          </Dialog>
        )}

        {isAddTaskModalOpen && (
          <Dialog
            open
            aria-label="Criar nova tarefa"
            className="kds-agenda-dialog"
            onOpenChange={(open) => !open && !savingTask && closeAddTaskModal()}
            size="md"
          >
            <form onSubmit={(event) => void handleAddTask(event)} className="flex min-h-0 flex-1 flex-col">
              <DialogHeader onClose={savingTask ? undefined : closeAddTaskModal}>
                <Text className="kds-dialog-eyebrow">Agenda</Text>
                <DialogTitle>Nova tarefa</DialogTitle>
                <DialogDescription placement="visible">Reserve um horário para o próximo passo.</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <Field label="Título da tarefa" htmlFor="agenda-task-title" required>
                  <Input
                    id="agenda-task-title"
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Ex.: Retornar sobre a proposta"
                    required
                    disabled={savingTask}
                  />
                </Field>

                <div className="kds-agenda-form-grid">
                  <Field label="Data" htmlFor="agenda-task-date" required>
                    <DateTimePicker id="agenda-task-date" type="date" value={newTaskDate} onChange={({ target }) => setNewTaskDate(target.value)} disabled={savingTask} />
                  </Field>
                  <Field label="Horário" htmlFor="agenda-task-time" required>
                    <DateTimePicker id="agenda-task-time" type="time" value={newTaskTime} onChange={({ target }) => setNewTaskTime(target.value)} disabled={savingTask} />
                  </Field>
                </div>
                <Field label="Prioridade" htmlFor="agenda-task-priority">
                  <Select id="agenda-task-priority" value={newTaskPriority} options={TASK_PRIORITIES} onChange={({ target }) => setNewTaskPriority(target.value)} disabled={savingTask} />
                </Field>
                <Field label="Detalhes (opcional)" htmlFor="agenda-task-description">
                  <Textarea
                    id="agenda-task-description"
                    value={newTaskDescription}
                    onChange={(event) => setNewTaskDescription(event.target.value)}
                    placeholder="Adicione detalhes da tarefa"
                    disabled={savingTask}
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" onClick={closeAddTaskModal} disabled={savingTask} variant="secondary" size="md">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingTask || !newTaskTitle.trim() || !newTaskDate || !newTaskTime}
                  loading={savingTask}
                >
                  Salvar tarefa
                </Button>
              </DialogFooter>
            </form>
          </Dialog>
        )}

        {manualReminderQueue[0] && (
          <ReminderSchedulerModal
            className="kds-agenda-dialog kds-agenda-reminder-dialog"
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
        )}

        {showLeadLoading && (
          <Dialog
            open
            aria-label="Carregando dados do lead"
            onOpenChange={() => undefined}
            size="sm"
            closeOnOverlay={false}
            closeOnEscape={false}
            className="max-w-sm"
          >
            <DialogHeader showCloseButton={false} className="sr-only">
              <DialogTitle>Carregando lead</DialogTitle>
              <DialogDescription placement="visible">Aguarde enquanto buscamos os dados mais recentes.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex min-h-44 items-center justify-center">
              <Surface variant="strong" padding="sm" className="flex items-center gap-2 px-4 py-3" role="status">
                <LoadingMonogram className="h-5 w-5 text-[var(--brand-primary)]" label="Carregando lead" />
              </Surface>
            </DialogBody>
          </Dialog>
        )}

        {editingLead && <LeadForm lead={editingLead} onClose={() => setEditingLead(null)} onSave={handleLeadSaved} />}
        <FollowUpAgendaOrganizerModal
          isOpen={organizerOpen}
          onClose={() => setOrganizerOpen(false)}
          onApplied={() => loadReminders({ showLoading: true })}
        />
        {ConfirmationDialog}
      </div>
      )} />}
    </>
  );
}
