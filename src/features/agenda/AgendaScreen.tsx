import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  supabase,
  Reminder,
  Lead,
  Contract,
  fetchAllPages,
} from "../../lib/supabase";
import { formatDateTimeFullBR, getDateKey, isOverdue } from "../../lib/dateUtils";
import {
  addBusinessDaysSkippingWeekends,
  formatEstimatedTime,
} from "../../lib/reminderUtils";
import { syncLeadNextReturnFromUpcomingReminder } from "../../lib/leadReminderUtils";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  KpiCard,
  LoadingState,
  OperationalMetricChip,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionHeader,
  Surface,
  Textarea,
  type SurfaceVariant,
} from "../../design-system";
import FilterSingleSelect from "../../components/FilterSingleSelect";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import LeadForm from "../../components/LeadForm";
import { toast } from "../../lib/toast";
import {
  getReminderWhatsappLink,
  isReminderPriority,
} from "../reminders/shared/reminderHelpers";
import type { ManualReminderPrompt } from "../reminders/shared/reminderTypes";
import FollowUpAgendaOrganizerModal from "./components/FollowUpAgendaOrganizerModal";

const RELATED_ENTITY_BATCH_SIZE = 100;

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
  { value: "all", label: "Todas prioridades" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
];

const AGENDA_DAY_SECTION_STYLES = {
  overdue: {
    title: "Atrasados",
    description: "Exigem atenção primeiro",
    tone: "danger" as const,
  },
  pending: {
    title: "Pendentes",
    description: "Próximas ações do dia",
    tone: "accent" as const,
  },
  completed: {
    title: "Concluídos",
    description: "Itens já finalizados",
    tone: "success" as const,
  },
};

const splitIntoBatches = <T,>(items: T[], batchSize: number): T[][] => {
  if (batchSize <= 0) {
    return [items];
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
};

const fetchContractsByIds = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

  if (uniqueIds.length === 0) {
    return [] as Contract[];
  }

  const batches = splitIntoBatches(uniqueIds, RELATED_ENTITY_BATCH_SIZE);
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase.from("contracts").select("*").in("id", batch);

      if (error) {
        throw error;
      }

      return (data ?? []) as Contract[];
    }),
  );

  return results.flat();
};

const fetchLeadsByIds = async (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

  if (uniqueIds.length === 0) {
    return [] as Lead[];
  }

  const batches = splitIntoBatches(uniqueIds, RELATED_ENTITY_BATCH_SIZE);
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase.from("leads").select("*").in("id", batch);

      if (error) {
        throw error;
      }

      return (data ?? []) as Lead[];
    }),
  );

  return results.flat();
};

export default function AgendaScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>("nao-lidos");
  const [timeFilter, setTimeFilter] = useState<AgendaTimeFilter>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(new Map());
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [manualReminderQueue, setManualReminderQueue] = useState<ManualReminderPrompt[]>([]);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2 | 3 | 4 | 5;
  } | null>(null);
  const [quickScheduleDropdownId, setQuickScheduleDropdownId] = useState<string | null>(null);
  const [reschedulingReminderId, setReschedulingReminderId] = useState<string | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<Reminder | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const loadReminders = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const remindersData = await fetchAllPages<Reminder>(
        (from, to) =>
          supabase
            .from("reminders")
            .select("*")
            .order("data_lembrete", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to) as unknown as Promise<{
            data: Reminder[] | null;
            error: unknown;
          }>,
      );

      setReminders(remindersData);
      setLastUpdated(new Date());
      setError(null);

      const contractIds = Array.from(
        new Set(
          remindersData
            .map((reminder) => reminder.contract_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const fetchedContracts = await fetchContractsByIds(contractIds);
      const nextContractsMap = new Map<string, Contract>();

      fetchedContracts.forEach((contract) => {
        nextContractsMap.set(contract.id, contract);
      });

      setContractsMap(nextContractsMap);

      const contractLeadIds = Array.from(
        new Set(fetchedContracts.map((contract) => contract.lead_id).filter((id): id is string => Boolean(id))),
      );

      const leadIds = Array.from(
        new Set([
          ...remindersData
            .map((reminder) => reminder.lead_id)
            .filter((id): id is string => Boolean(id)),
          ...contractLeadIds,
        ]),
      );
      const fetchedLeads = await fetchLeadsByIds(leadIds);
      const nextLeadsMap = new Map<string, Lead>();

      fetchedLeads.forEach((lead) => {
        nextLeadsMap.set(lead.id, lead);
      });

      setLeadsMap(nextLeadsMap);
    } catch (loadError) {
      console.error("Erro ao carregar agenda:", loadError);
      setError("Nao foi possivel carregar a agenda agora.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadReminders({ showLoading: true });

    const channel = supabase
      .channel("agenda-reminders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reminders",
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
  }, [loadReminders]);

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

  const fetchLeadInfo = useCallback(
    async (leadId: string) => {
      if (!leadId) {
        return null;
      }

      const cachedLead = leadsMap.get(leadId);
      if (cachedLead) {
        return cachedLead;
      }

      setLoadingLeadId(leadId);

      try {
        const { data, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
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
        console.error("Erro ao carregar dados do lead:", leadError);
        return null;
      } finally {
        setLoadingLeadId(null);
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

    const leadData = await fetchLeadInfo(leadId);

    if (!leadData) {
      toast.error("Nao foi possivel localizar os dados deste lead.");
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
    } catch (syncError) {
      console.error("Erro ao sincronizar proximo retorno do lead:", syncError);
    }
  };

  const handleMarkLeadAsLost = async (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);

    if (!leadId) {
      toast.error("Nao foi possivel identificar o lead deste lembrete.");
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

      const { error: updateLeadError } = await supabase
        .from("leads")
        .update({
          status: "Perdido",
          proximo_retorno: null,
          ultimo_contato: nowIso,
        })
        .eq("id", leadId);

      if (updateLeadError) {
        throw updateLeadError;
      }

      if (leadInfo) {
        await supabase.from("interactions").insert([
          {
            lead_id: leadId,
            tipo: "Observacao",
            descricao: `Status alterado de "${previousStatus}" para "Perdido"`,
            responsavel: leadInfo.responsavel,
          },
        ]);

        await supabase.from("lead_status_history").insert([
          {
            lead_id: leadId,
            status_anterior: previousStatus,
            status_novo: "Perdido",
            responsavel: leadInfo.responsavel,
          },
        ]);
      }

      const remindersForLead = reminders.filter((item) => getLeadIdForReminder(item) === leadId);
      remindersForLead.forEach((item) => pendingRefreshIdsRef.current.add(item.id));

      const { error: deleteRemindersError } = await supabase.from("reminders").delete().eq("lead_id", leadId);

      if (deleteRemindersError) {
        throw deleteRemindersError;
      }

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
      toast.error("Nao foi possivel marcar o lead como perdido.");
    } finally {
      setMarkingLostLeadId(null);
    }
  };

  const handleMarkAsRead = async (
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
        .from("reminders")
        .update({
          lido: !currentStatus,
          concluido_em: completionDate,
        })
        .eq("id", reminderId);

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
          const { data } = await supabase
            .from("leads")
            .select("id, nome_completo, telefone, proximo_retorno")
            .eq("id", leadId)
            .maybeSingle();

          if (data) {
            leadInfo = data as Lead;
            setLeadsMap((current) => {
              const next = new Map(current);
              next.set(leadInfo!.id, leadInfo!);
              return next;
            });
          }
        }

        if (leadInfo) {
          setManualReminderQueue((current) => [
            ...current,
            {
              lead: leadInfo,
              promptMessage: "Deseja marcar um proximo lembrete para este lead?",
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
      toast.error("Erro ao atualizar lembrete.");
      return false;
    }
  };

  const handleQuickSchedule = async (reminder: Reminder, daysAhead: 1 | 2 | 3 | 4 | 5) => {
    if (reminder.lido) {
      return;
    }

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error("Nao foi possivel identificar o lead deste lembrete.");
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

      const { data: createdReminder, error: insertError } = await supabase
        .from("reminders")
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
          },
        ])
        .select("*")
        .maybeSingle();

      if (insertError) {
        throw insertError;
      }

      if (createdReminder) {
        pendingRefreshIdsRef.current.add(createdReminder.id);
      }

      await updateLeadNextReturnDate(leadId);

      if (createdReminder) {
        const nextReminder = createdReminder as Reminder;
        setReminders((current) =>
          [...current, nextReminder].sort(
            (left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
          ),
        );
      }
    } catch (scheduleError) {
      console.error("Erro ao agendar lembrete rapido:", scheduleError);
      toast.error("Nao foi possivel criar o novo lembrete rapido.");
    } finally {
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
    if (!reminderPendingDeletion) {
      return;
    }

    const reminderToDelete = reminderPendingDeletion;
    setIsDeletingReminder(true);

    try {
      pendingRefreshIdsRef.current.add(reminderToDelete.id);
      const { error: deleteError } = await supabase.from("reminders").delete().eq("id", reminderToDelete.id);

      if (deleteError) {
        pendingRefreshIdsRef.current.delete(reminderToDelete.id);
        throw deleteError;
      }

      const leadId = getLeadIdForReminder(reminderToDelete);
      if (leadId) {
        await updateLeadNextReturnDate(leadId);
      }

      setReminders((current) => current.filter((item) => item.id !== reminderToDelete.id));
    } catch (deleteError) {
      console.error("Erro ao remover lembrete:", deleteError);
      toast.error("Erro ao remover lembrete.");
    } finally {
      setIsDeletingReminder(false);
      setReminderPendingDeletion(null);
    }
  };

  const handleRescheduleReminder = async (reminderId: string, newDate: Date) => {
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
        .from("reminders")
        .update({ data_lembrete: newDateIso })
        .eq("id", reminderId);

      if (updateError) {
        pendingRefreshIdsRef.current.delete(reminderId);
        throw updateError;
      }

      const leadId = getLeadIdForReminder(reminder);
      if (leadId) {
        await updateLeadNextReturnDate(leadId);
      }

      setReschedulingReminderId(null);
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
      toast.error("Nao foi possivel reagendar o item.");
    }
  };

  const handleAddTask = async (event: React.FormEvent) => {
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
        .from("reminders")
        .insert([
          {
            tipo: "Tarefa",
            titulo: newTaskTitle.trim(),
            descricao: newTaskDescription.trim() || null,
            data_lembrete: dueDate.toISOString(),
            lido: false,
            prioridade: "normal",
          },
        ])
        .select("*")
        .maybeSingle();

      if (insertError) {
        throw insertError;
      }

      if (createdTask) {
        pendingRefreshIdsRef.current.add(createdTask.id);
        setReminders((current) =>
          [...current, createdTask as Reminder].sort(
            (left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime(),
          ),
        );
      }

      setNewTaskTitle("");
      setNewTaskDescription("");
      setIsAddTaskModalOpen(false);
    } catch (insertError) {
      console.error("Erro ao criar tarefa:", insertError);
      setError("Nao foi possivel criar a tarefa.");
    } finally {
      setSavingTask(false);
    }
  };

  const handleMarkAllFilteredAsRead = async () => {
    const unreadFiltered = filteredReminders.filter((item) => !item.lido);

    if (unreadFiltered.length === 0) {
      return;
    }

    const confirmed = await requestConfirmation({
      title: "Marcar filtros como lidos",
      description: `Deseja marcar ${unreadFiltered.length} item(ns) filtrado(s) como lido(s)?`,
      confirmLabel: "Marcar como lidos",
      cancelLabel: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    try {
      const completionDate = new Date().toISOString();
      unreadFiltered.forEach((item) => pendingRefreshIdsRef.current.add(item.id));

      const { error: updateError } = await supabase
        .from("reminders")
        .update({
          lido: true,
          concluido_em: completionDate,
        })
        .in(
          "id",
          unreadFiltered.map((item) => item.id),
        );

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
    } catch (updateError) {
      console.error("Erro ao atualizar lembretes:", updateError);
      toast.error("Erro ao atualizar os itens filtrados.");
    }
  };

  const selectDate = (date: Date) => {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    setSelectedDate(normalizedDate);
    setCurrentMonth(new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), 1));
  };

  const goToPreviousMonth = () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(previous);
    setSelectedDate(new Date(previous.getFullYear(), previous.getMonth(), 1));
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(next);
    setSelectedDate(new Date(next.getFullYear(), next.getMonth(), 1));
  };

  const goToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectDate(today);
  };

  const handleDayClick = async (date: Date) => {
    if (reschedulingReminderId) {
      await handleRescheduleReminder(reschedulingReminderId, date);
      return;
    }

    setError(null);
    selectDate(date);
  };

  const closeAddTaskModal = () => {
    setIsAddTaskModalOpen(false);
    setNewTaskTitle("");
    setNewTaskDescription("");
  };

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
      ...types.map((type) => ({ value: type, label: type })),
    ];
  }, [reminders]);

  const filteredReminders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    return reminders
      .filter((reminder) => {
        if (statusFilter === "nao-lidos" && reminder.lido) {
          return false;
        }

        if (statusFilter === "lidos" && !reminder.lido) {
          return false;
        }

        if (typeFilter !== "all" && reminder.tipo !== typeFilter) {
          return false;
        }

        if (priorityFilter !== "all" && reminder.prioridade !== priorityFilter) {
          return false;
        }

        if (timeFilter !== "todos") {
          const reminderDate = new Date(reminder.data_lembrete);
          if (timeFilter === "atrasados") {
            if (!reminder.lido && reminderDate < now) return true;
            return false;
          }
          if (timeFilter === "dia") {
            if (reminderDate >= now && reminderDate <= todayEnd) return true;
            return false;
          }
          if (timeFilter === "futuros") {
            if (reminderDate > todayEnd) return true;
            return false;
          }
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
      })
      .sort(compareRemindersByDueAtThenAlphabetical);
  }, [
    compareRemindersByDueAtThenAlphabetical,
    getLeadIdForReminder,
    leadsMap,
    priorityFilter,
    reminders,
    searchQuery,
    statusFilter,
    timeFilter,
    typeFilter,
  ]);

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
  const overdueSelectedReminders = pendingSelectedReminders.filter((item) => isOverdue(item.data_lembrete));
  const activeSelectedReminders = pendingSelectedReminders.filter((item) => !isOverdue(item.data_lembrete));
  const selectedDateSections = [
    {
      id: "overdue" as const,
      ...AGENDA_DAY_SECTION_STYLES.overdue,
      items: overdueSelectedReminders,
    },
    {
      id: "pending" as const,
      ...AGENDA_DAY_SECTION_STYLES.pending,
      items: activeSelectedReminders,
    },
    {
      id: "completed" as const,
      ...AGENDA_DAY_SECTION_STYLES.completed,
      items: completedSelectedReminders,
    },
  ].filter((section) => section.items.length > 0);
  const selectedDateDensity = selectedDateReminders.length >= 18 ? "compact" : selectedDateReminders.length >= 8 ? "comfortable" : "spacious";

  const pendingFilteredCount = filteredReminders.filter((item) => !item.lido).length;
  const completedFilteredCount = filteredReminders.filter((item) => item.lido).length;
  const overdueFilteredCount = filteredReminders.filter((item) => isOverdue(item.data_lembrete) && !item.lido).length;
  const taskFilteredCount = filteredReminders.filter((item) => item.tipo === "Tarefa").length;
  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${lastUpdated.toLocaleDateString("pt-BR")} as ${lastUpdated.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Aguardando atualizacao...";

  const hasActiveFilters = [statusFilter !== "todos", typeFilter !== "all", priorityFilter !== "all", searchQuery.trim() !== ""].filter(Boolean).length;

  const getCalendarCellClass = ({
    isSelected,
    isToday,
    hasItems,
    isRescheduling,
  }: {
    isSelected: boolean;
    isToday: boolean;
    hasItems: boolean;
    isRescheduling: boolean;
  }) => {
    if (isSelected) {
      return "kds-calendar-day kds-calendar-day-selected";
    }

    if (isToday) {
      return "kds-calendar-day kds-calendar-day-today";
    }

    if (hasItems) {
      return "kds-calendar-day kds-surface-muted";
    }

    if (isRescheduling) {
      return "kds-calendar-day kds-surface-strong";
    }

    return "kds-calendar-day";
  };

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

    return tones[type as keyof typeof tones] ?? "neutral";
  };

  const getReminderTypeSurface = (type: string): SurfaceVariant => {
    const tone = getReminderTypeTone(type);
    if (tone === "neutral") return "muted";
    if (tone === "accent") return "strong";
    return tone;
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

    const Icon = icons[type as keyof typeof icons] ?? Bell;
    return <Icon className="h-5 w-5" />;
  };

  const getReminderCardClass = (reminder: Reminder) => {
    if (reminder.lido) {
      return "kds-surface-success";
    }

    if (isOverdue(reminder.data_lembrete)) {
      return "kds-surface-danger";
    }

    return "kds-surface-muted";
  };

  const renderCalendar = () => {
    const cells = [];
    const firstWeekday = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const totalDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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
      const stateClass = getCalendarCellClass({
        isSelected,
        isToday,
        hasItems: totalCount > 0,
        isRescheduling: Boolean(reschedulingReminderId),
      });

      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => {
            void handleDayClick(cellDate);
          }}
          className={`kds-action-surface flex min-h-16 flex-col justify-between border p-1.5 text-left transition-colors sm:min-h-20 sm:p-2 ${stateClass}`}
          aria-pressed={isSelected}
          aria-label={`${day} de ${currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}, ${totalCount} item(ns)`}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-bold sm:text-sm">{day}</span>
            {totalCount > 0 && (
              <Badge
                size="sm"
                className="px-1.5 py-0.5 text-[10px] leading-none sm:px-2"
                tone={isSelected ? "neutral" : "accent"}
              >
                {totalCount}
              </Badge>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-1 text-[10px] font-semibold">
            {pendingCount > 0 && <span className="h-1.5 min-w-3 rounded-full bg-[var(--brand-primary)] sm:min-w-5" title={`${pendingCount} pendente(s)`} />}
            {doneCount > 0 && <span className="h-1.5 min-w-3 rounded-full bg-[var(--success)] sm:min-w-5" title={`${doneCount} concluido(s)`} />}
          </div>
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
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
    const canOpenLead = Boolean(leadId);
    const contextBadge = reminder.lead_id || reminder.contract_id
      ? (
          <AgendaReminderContextLink
            leadId={reminder.lead_id ?? contract?.lead_id}
            contractId={reminder.contract_id}
            leadName={leadInfo?.nome_completo}
            isLoading={loadingLeadId === leadId}
          />
        )
      : null;

    const handleCardOpen = () => {
      if (!leadId) {
        return;
      }

      void handleOpenLead(leadId);
    };

    const handleCardKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!canOpenLead || event.target !== event.currentTarget) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void handleOpenLead(leadId!);
      }
    };

    const handleCardAction = (callback: () => unknown | Promise<unknown>) =>
      (event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        void callback();
      };

    return (
      <article
        key={reminder.id}
        className={`kds-surface border p-3 text-[var(--text-secondary)] transition-colors ${getReminderCardClass(reminder)} ${canOpenLead ? "kds-action-surface" : ""}`}
        onClick={canOpenLead ? handleCardOpen : undefined}
        onKeyDown={canOpenLead ? handleCardKeyDown : undefined}
        role={canOpenLead ? "button" : undefined}
        tabIndex={canOpenLead ? 0 : undefined}
        aria-label={canOpenLead ? `Abrir edicao do lead ${leadInfo?.nome_completo ?? ""}`.trim() : undefined}
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
          <Surface
            variant={reminder.lido ? "success" : getReminderTypeSurface(reminder.tipo)}
            padding="none"
            className="flex h-10 w-10 items-center justify-center"
          >
            {getReminderIcon(reminder.tipo)}
          </Surface>

          <div className="min-w-0 flex-1">
            <div className="space-y-2">
              <div>
                <div className="flex flex-col gap-1 xl:flex-row xl:items-center xl:gap-3">
                  <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[var(--text-primary)]">
                    {reminder.titulo}
                  </h3>
                  {contextBadge && <div className="hidden xl:flex xl:items-center">{contextBadge}</div>}
                </div>
                {reminder.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
                    {reminder.descricao}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {contextBadge && <div className="xl:hidden">{contextBadge}</div>}
                <Badge size="sm" tone={getReminderPriorityTone(reminder.prioridade)}>
                  {reminder.prioridade}
                </Badge>
                <Badge size="sm" tone={getReminderTypeTone(reminder.tipo)}>
                  {reminder.tipo}
                </Badge>
                {reminder.tempo_estimado_minutos && (
                  <Badge
                    size="sm"
                    className="gap-1"
                    tone="info"
                  >
                    <Timer className="h-3 w-3" />
                    <span>{formatEstimatedTime(reminder.tempo_estimado_minutos)}</span>
                  </Badge>
                )}
                {overdue && !reminder.lido && (
                  <Badge
                    size="sm"
                    tone="danger"
                  >
                    Atrasado
                  </Badge>
                )}
                {reminder.tags?.map((tag, index) => (
                  <Badge
                    size="sm"
                    key={`${tag}-${index}`}
                    className="gap-1 font-medium"
                    tone="info"
                  >
                    <Tag className="h-3 w-3" />
                    <span>{tag}</span>
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:max-w-36 sm:justify-end">
                <Button
                  onClick={handleCardAction(() => openLeadInOfficialWhatsApp(leadInfo ?? null))}
                  disabled={!hasLeadPhone}
                  variant="soft"
                  size="icon"
                  className="h-8 w-8"
                  title={hasLeadPhone ? "Abrir WhatsApp oficial" : "Telefone nao disponivel"}
                  aria-label={hasLeadPhone ? "Abrir WhatsApp oficial" : "Telefone nao disponivel"}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {!reminder.lido && (
                  <>
                    <Popover open={quickScheduleDropdownId === reminder.id} onOpenChange={(open) => setQuickScheduleDropdownId(open ? reminder.id : null)}>
                      <PopoverTrigger className="inline-flex">
                        <Button type="button" disabled={isQuickSchedulingCurrentReminder} variant="primary" size="icon" className="h-8 w-8" title="Agendar dias uteis e marcar atual como lido" aria-label="Agendar dias uteis e marcar atual como lido">
                          {isQuickSchedulingCurrentReminder ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <span className="relative inline-flex">
                              <CalendarPlus className="h-4 w-4" />
                              <ChevronDown className="absolute -bottom-1 -right-1 h-2.5 w-2.5" />
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent aria-label="Selecionar dias para agendar" className="w-36 p-1">
                        <div className="flex flex-col gap-1">
                          {[1, 2, 3, 4, 5].map((days) => (
                            <Button
                              key={days}
                              type="button"
                              onClick={handleCardAction(() => {
                                setQuickScheduleDropdownId(null);
                                handleQuickSchedule(reminder, days as 1 | 2 | 3 | 4 | 5);
                              })}
                              disabled={isQuickSchedulingCurrentReminder}
                              variant="ghost"
                              size="sm"
                              className="h-auto w-full justify-start px-3 py-2 text-left"
                            >
                              <CalendarPlus className="h-4 w-4" />
                              <span>+{days} dia{days > 1 ? "s" : ""}</span>
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </>
                )}
                <Button
                  onClick={handleCardAction(() => handleMarkAsRead(reminder.id, reminder.lido))}
                  variant={reminder.lido ? "secondary" : "soft"}
                  size="icon"
                  className="h-8 w-8"
                  title={reminder.lido ? "Marcar como nao lido" : "Marcar como lido"}
                  aria-label={reminder.lido ? "Marcar como nao lido" : "Marcar como lido"}
                >
                  <Check className="h-4 w-4" />
                </Button>
                {!reminder.lido && (
                  <Button
                    onClick={handleCardAction(() => setReschedulingReminderId(reminder.id))}
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    title="Reagendar item"
                    aria-label="Reagendar item"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                )}
                {leadId && (
                  <Button
                    onClick={handleCardAction(() => handleMarkLeadAsLost(reminder))}
                    variant="danger"
                    size="icon"
                    className="h-8 w-8"
                    title="Marcar lead como perdido e limpar lembretes"
                    aria-label="Marcar lead como perdido e limpar lembretes"
                    disabled={markingLostLeadId === leadId}
                    loading={markingLostLeadId === leadId}
                  >
                    {markingLostLeadId !== leadId && <X className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  onClick={handleCardAction(() => handleDelete(reminder.id))}
                  variant="danger"
                  size="icon"
                  className="h-8 w-8"
                  title="Excluir item"
                  aria-label="Excluir item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
          </div>
        </div>
      </article>
    );
  };

  const hasAgendaSnapshot = reminders.length > 0;
  const selectedDateLabel = selectedDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      {loading && !hasAgendaSnapshot ? (
        <LoadingState label="Carregando agenda..." className="min-h-96" />
      ) : (
      <div className="panel-page-shell space-y-6">
        <PageHeader
          eyebrow="Rotina operacional"
          title="Agenda unificada"
          description="Tarefas e lembretes compartilham o mesmo calendario, com filtros, contexto do lead e acoes rapidas no mesmo fluxo."
          actions={(
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <OperationalMetricChip value={filteredMonthReminders.length} label="itens no mes" />
              <OperationalMetricChip value={pendingFilteredCount} label="pendentes" tone="accent" />
              <OperationalMetricChip value={overdueFilteredCount} label="atrasados" tone="danger" active={overdueFilteredCount > 0} />
            </div>
          )}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Pendentes", value: pendingFilteredCount, tone: "accent" as const },
            { label: "Concluidos", value: completedFilteredCount, tone: "success" as const },
            { label: "Atrasados", value: overdueFilteredCount, tone: "danger" as const },
            { label: "Tarefas", value: taskFilteredCount, tone: "neutral" as const },
          ].map((item) => (
            <KpiCard key={item.label} title={item.label} value={String(item.value)} padding="sm">
              <Badge tone={item.tone} size="xs">Visao filtrada</Badge>
            </KpiCard>
          ))}
        </div>

        <Surface variant="muted" padding="none" className="kds-op-toolbar">
              <div className="kds-op-toolbar-search relative">
                <Input
                  type="text"
                  placeholder="Buscar por titulo, descricao, tipo ou lead..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  leftIcon={Search}
                  className="pr-10"
                />
                {searchQuery && (
                  <Button
                    onClick={() => setSearchQuery("")}
                    variant="icon"
                    size="icon"
                    className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
                    title="Limpar busca"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="kds-op-toolbar-actions">
                <Button onClick={goToToday} variant="secondary" size="sm">
                  Hoje
                </Button>
                <Button onClick={() => setOrganizerOpen(true)} variant="primary" size="sm">
                  <Sparkles className="h-4 w-4" />
                  Organizar follow-ups
                </Button>
                <Button onClick={() => setIsAddTaskModalOpen(true)} variant="primary" size="sm">
                  <Plus className="h-4 w-4" />
                  Nova tarefa
                </Button>
                {filteredReminders.some((item) => !item.lido) && (
                  <Button onClick={() => void handleMarkAllFilteredAsRead()} variant="soft" size="sm" className="whitespace-nowrap">
                    Marcar filtrados como lidos
                  </Button>
                )}
              </div>

              <div className="grid min-w-0 flex-1 basis-full grid-cols-1 gap-2 md:grid-cols-3">
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
                  options={PRIORITY_OPTIONS}
                />
                <FilterSingleSelect
                  icon={Calendar}
                  value={timeFilter}
                  onChange={(val) => setTimeFilter(val as AgendaTimeFilter)}
                  placeholder="Periodo"
                  includePlaceholderOption={false}
                  options={TIME_FILTER_OPTIONS}
                />
              </div>
              <div className="kds-op-toolbar-actions">
                <Button
                  onClick={() => setStatusFilter("nao-lidos")}
                  variant={statusFilter === "nao-lidos" ? "primary" : "secondary"}
                  size="sm"
                >
                  Pendentes
                </Button>
                <Button
                  onClick={() => setStatusFilter("todos")}
                  variant={statusFilter === "todos" ? "primary" : "secondary"}
                  size="sm"
                >
                  Todos
                </Button>
                <Button
                  onClick={() => setStatusFilter("lidos")}
                  variant={statusFilter === "lidos" ? "primary" : "secondary"}
                  size="sm"
                >
                  Concluidos
                </Button>
                {hasActiveFilters > 0 && (
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                      setPriorityFilter("all");
                      setStatusFilter("todos");
                    }}
                    variant="ghost"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Limpar filtros ({hasActiveFilters})
                  </Button>
                )}
              </div>
        </Surface>

        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <OperationalMetricChip
            icon={<Clock3 className="h-3.5 w-3.5" />}
            value={lastUpdatedLabel}
          />

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge tone="accent" className="gap-2">
              <Circle className="h-3 w-3" />
              <span>Itens pendentes</span>
            </Badge>
            <Badge tone="success" className="gap-2">
              <CheckCircle2 className="h-3 w-3" />
              <span>Itens concluidos</span>
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.18fr)]">
          <Surface padding="none" className="overflow-hidden xl:sticky xl:top-4 xl:self-start">
            <Surface variant="muted" padding="sm" className="flex items-center justify-between gap-2 rounded-none border-x-0 border-t-0 px-4 py-3">
                <Button onClick={goToPreviousMonth} variant="icon" size="icon" aria-label="Mes anterior">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-center">
                  <h3 className="text-lg font-semibold capitalize text-[var(--text-primary)]">
                    {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {filteredMonthReminders.length} item(ns) com os filtros atuais
                  </p>
                </div>
                <Button onClick={goToNextMonth} variant="icon" size="icon" aria-label="Proximo mes">
                  <ChevronRight className="h-5 w-5" />
                </Button>
            </Surface>
            <div className="p-4">{renderCalendar()}</div>
          </Surface>

          <Surface padding="none" className="overflow-hidden">
            <Surface padding="sm" className="sticky top-0 z-10 rounded-none border-x-0 border-t-0 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <SectionHeader
                    eyebrow="Dia selecionado"
                    title={selectedDateLabel}
                    description={selectedDateReminders.length > 0
                      ? `${selectedDateReminders.length} item(ns): ${pendingSelectedReminders.length} pendente(s), ${overdueSelectedReminders.length} atrasado(s), ${completedSelectedReminders.length} concluido(s).`
                      : "Nenhum item encontrado para este dia com os filtros atuais."}
                  />

                  <div className="grid grid-cols-3 gap-2 sm:min-w-80">
                    {[
                      { label: "Atrasados", value: overdueSelectedReminders.length, tone: "danger" as const },
                      { label: "Pendentes", value: activeSelectedReminders.length, tone: "accent" as const },
                      { label: "Concluídos", value: completedSelectedReminders.length, tone: "success" as const },
                    ].map((item) => (
                      <OperationalMetricChip
                        key={item.label}
                        value={item.value}
                        label={item.label}
                        tone={item.tone}
                        active={item.value > 0}
                        className="justify-center"
                      />
                    ))}
                  </div>
                </div>

                {reschedulingReminderId && (
                  <Alert
                    className="mt-3"
                    tone="accent"
                    action={(
                      <Button onClick={() => setReschedulingReminderId(null)} variant="ghost" size="sm">
                        Cancelar reagendamento
                      </Button>
                    )}
                  >
                    <span>Selecione um dia no calendario para reagendar o item.</span>
                  </Alert>
                )}

                {error && (
                  <Alert className="mt-3" tone="danger" title="Nao foi possivel concluir a operacao">
                    {error}
                  </Alert>
                )}
            </Surface>

            <div className={`max-h-[calc(100vh-18rem)] min-h-96 overflow-y-auto px-4 py-4 ${selectedDateDensity === "compact" ? "space-y-3" : "space-y-4"}`}>
                {selectedDateSections.length > 0 ? (
                  selectedDateSections.map((section) => (
                    <section key={section.id} className="space-y-2">
                      <Surface
                        variant={section.tone === "accent" ? "strong" : section.tone}
                        padding="sm"
                        className="sticky top-0 z-10 -mx-1 py-2"
                      >
                        <SectionHeader
                          as="h3"
                          title={section.title}
                          description={section.description}
                          action={<Badge size="sm" tone={section.tone}>{section.items.length}</Badge>}
                        />
                      </Surface>
                      <div className={selectedDateDensity === "compact" ? "space-y-2" : "space-y-3"}>
                        {section.items.map(renderReminderCard)}
                      </div>
                    </section>
                  ))
                ) : (
                  <EmptyState
                    icon={<Calendar className="h-8 w-8" />}
                    title="Nenhum item neste dia"
                    description="Os filtros atuais nao retornaram tarefas ou lembretes para a data selecionada."
                  />
                )}
            </div>
          </Surface>
        </div>

        {filteredReminders.length === 0 && (
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title="Nenhum item encontrado"
            description="Ajuste os filtros ou crie uma nova tarefa para voltar a preencher a agenda."
            action={(
              <Button onClick={() => setIsAddTaskModalOpen(true)} variant="primary" size="md">
                <Plus className="h-4 w-4" />
                Nova tarefa
              </Button>
            )}
          />
        )}

        {reminderPendingDeletion && (
          <Dialog
            open
            aria-label="Remover item da agenda"
            onOpenChange={(open) => {
              if (!open) setReminderPendingDeletion(null);
            }}
            size="sm"
          >
            <DialogHeader onClose={() => setReminderPendingDeletion(null)}>
              <DialogTitle>Remover item</DialogTitle>
              <DialogDescription>Esta acao nao pode ser desfeita.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Alert tone="danger" title={`Remover "${reminderPendingDeletion.titulo}"?`}>
                {reminderPendingDeletion.descricao
                  ? <span className="break-words">{reminderPendingDeletion.descricao}</span>
                  : "O item sera removido permanentemente da agenda."}
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
            onOpenChange={(open) => !open && closeAddTaskModal()}
            size="sm"
          >
            <form onSubmit={(event) => void handleAddTask(event)} className="flex min-h-0 flex-1 flex-col">
              <DialogHeader onClose={closeAddTaskModal}>
                <DialogTitle>Nova tarefa</DialogTitle>
                <DialogDescription>{selectedDateLabel}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <Field label="Tarefa" htmlFor="agenda-task-title">
                  <Input
                    id="agenda-task-title"
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Digite o titulo da tarefa"
                    required
                    disabled={savingTask}
                  />
                </Field>

                <Field label="Descricao (opcional)" htmlFor="agenda-task-description">
                  <Textarea
                    id="agenda-task-description"
                    value={newTaskDescription}
                    onChange={(event) => setNewTaskDescription(event.target.value)}
                    placeholder="Adicione detalhes da tarefa"
                    className="min-h-24"
                    disabled={savingTask}
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" onClick={closeAddTaskModal} variant="secondary" size="md">
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="md" disabled={savingTask} loading={savingTask}>
                  {!savingTask && <Plus className="h-4 w-4" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </form>
          </Dialog>
        )}

        {manualReminderQueue[0] && (
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
        )}

        {loadingLeadId && (
          <Dialog
            open
            aria-label="Carregando dados do lead"
            onOpenChange={() => undefined}
            size="sm"
            closeOnOverlay={false}
            closeOnEscape={false}
            className="max-w-sm"
          >
            <DialogHeader showCloseButton={false}>
              <DialogTitle>Carregando lead</DialogTitle>
              <DialogDescription>Aguarde enquanto buscamos os dados mais recentes.</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex min-h-44 items-center justify-center">
              <Surface variant="strong" padding="sm" className="flex items-center gap-2 px-4 py-3" role="status">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                Carregando lead...
                </span>
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
      )}
    </>
  );
}

type AgendaReminderContextLinkProps = {
  leadId?: string;
  contractId?: string;
  leadName?: string;
  isLoading?: boolean;
};

type ContextInfo =
  | { type: "lead"; label: string }
  | { type: "contract"; label: string };

function AgendaReminderContextLink({
  leadId,
  contractId,
  leadName,
  isLoading,
}: AgendaReminderContextLinkProps) {
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
      if (leadId) {
        if (leadName) {
          if (active) {
            setContextInfo({ type: "lead", label: leadName });
          }
          return;
        }

        const { data } = await supabase.from("leads").select("nome_completo").eq("id", leadId).maybeSingle();

        if (active && data?.nome_completo) {
          setContextInfo({ type: "lead", label: data.nome_completo });
        }
        return;
      }

      if (contractId) {
        const { data } = await supabase
          .from("contracts")
          .select("codigo_contrato")
          .eq("id", contractId)
          .maybeSingle();

        if (active && data?.codigo_contrato) {
          setContextInfo({ type: "contract", label: data.codigo_contrato });
        }
        return;
      }

      if (active) {
        setContextInfo(null);
      }
    };

    void loadContext();

    return () => {
      active = false;
    };
  }, [contractId, leadId, leadName]);

  if (!contextInfo) {
    return null;
  }

  return (
    <Badge tone="neutral" className="gap-1 font-medium">
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
      <span>{contextInfo.label}</span>
    </Badge>
  );
}
