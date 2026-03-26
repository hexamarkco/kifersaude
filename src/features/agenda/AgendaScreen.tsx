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
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  Search,
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
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Textarea from "../../components/ui/Textarea";
import ModalShell from "../../components/ui/ModalShell";
import FilterSingleSelect from "../../components/FilterSingleSelect";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import LeadForm from "../../components/LeadForm";
import {
  PANEL_EMPTY_STATE_STYLE,
  PANEL_INSET_STYLE,
  PANEL_MUTED_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
  getPanelToneStyle,
} from "../../components/ui/panelStyles";
import { TodoCalendarSkeleton } from "../../components/ui/panelSkeletons";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { toast } from "../../lib/toast";
import {
  getReminderWhatsappLink,
  isReminderPriority,
} from "../reminders/shared/reminderHelpers";
import type { ManualReminderPrompt } from "../reminders/shared/reminderTypes";

const RELATED_ENTITY_BATCH_SIZE = 100;

type AgendaStatusFilter = "todos" | "nao-lidos" | "lidos";

const PRIORITY_OPTIONS = [
  { value: "all", label: "Todas prioridades" },
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
];

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
    daysAhead: 1 | 2;
  } | null>(null);
  const [reschedulingReminderId, setReschedulingReminderId] = useState<string | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<Reminder | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const loadingUi = useAdaptiveLoading(loading);
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

  const handleQuickSchedule = async (reminder: Reminder, daysAhead: 1 | 2) => {
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

  const getCalendarCellStyle = ({
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
    const baseCellStyle = {
      ...PANEL_INSET_STYLE,
      color: "var(--panel-text,#1c1917)",
    };

    if (isSelected) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-strong,#b85c1f)",
        background: "var(--panel-accent-soft,#f6e4c7)",
        color: "var(--panel-accent-ink-strong,#4a2411)",
        boxShadow: "0 18px 34px -26px rgba(26,18,13,0.34)",
      };
    }

    if (isToday) {
      return {
        ...getPanelToneStyle("accent"),
        boxShadow: "0 14px 28px -24px rgba(26,18,13,0.18)",
      };
    }

    if (hasItems) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-border,#d5a25c)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel-accent-soft,#f6e4c7) 52%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
      };
    }

    if (isRescheduling) {
      return {
        ...baseCellStyle,
        borderColor: "var(--panel-accent-border,#d5a25c)",
      };
    }

    return baseCellStyle;
  };

  const getReminderPriorityStyle = (priority: string) => {
    const tones = {
      baixa: "info",
      normal: "neutral",
      alta: "danger",
    } as const;

    return getPanelToneStyle(tones[priority as keyof typeof tones] ?? "neutral");
  };

  const getReminderTypeStyle = (type: string) => {
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

    return getPanelToneStyle(tones[type as keyof typeof tones] ?? "neutral");
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

  const getReminderCardStyle = (reminder: Reminder) => {
    if (reminder.lido) {
      return {
        ...PANEL_INSET_STYLE,
        ...getPanelToneStyle("success"),
      };
    }

    if (isOverdue(reminder.data_lembrete)) {
      return {
        ...PANEL_INSET_STYLE,
        borderColor: "var(--panel-accent-red-border,#d79a8f)",
        boxShadow: "0 0 0 1px var(--panel-accent-red-border,#d79a8f), 0 18px 34px -28px rgba(138,49,40,0.22)",
      };
    }

    return PANEL_INSET_STYLE;
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
      const baseClasses =
        "aspect-square rounded-[1.1rem] border p-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 flex flex-col justify-between";
      const stateStyle = getCalendarCellStyle({
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
          className={baseClasses}
          style={{
            ...stateStyle,
            outlineColor: "var(--panel-focus,#c86f1d)",
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold">{day}</span>
            {totalCount > 0 && (
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                style={isSelected ? getPanelToneStyle("neutral") : getPanelToneStyle("accent")}
              >
                {totalCount}
              </span>
            )}
          </div>
          <div className="mt-auto space-y-1 text-[10px] font-semibold">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1" style={{ color: "var(--panel-accent-ink,#6f3f16)" }}>
                <Circle className="h-3 w-3" />
                <span>{pendingCount} aberto(s)</span>
              </div>
            )}
            {doneCount > 0 && (
              <div className="flex items-center gap-1" style={{ color: "var(--panel-accent-green-text,#275c39)" }}>
                <CheckCircle2 className="h-3 w-3" />
                <span>{doneCount} concluido(s)</span>
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
            style={{ color: "var(--panel-text-muted,#876f5c)" }}
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
        className={`panel-glass-lite rounded-[1.35rem] border p-4 shadow-sm transition-all ${canOpenLead ? "cursor-pointer" : ""}`}
        style={getReminderCardStyle(reminder)}
        onClick={canOpenLead ? handleCardOpen : undefined}
        onKeyDown={canOpenLead ? handleCardKeyDown : undefined}
        role={canOpenLead ? "button" : undefined}
        tabIndex={canOpenLead ? 0 : undefined}
        aria-label={canOpenLead ? `Abrir edicao do lead ${leadInfo?.nome_completo ?? ""}`.trim() : undefined}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-[1rem] border p-3" style={reminder.lido ? getPanelToneStyle("success") : getReminderTypeStyle(reminder.tipo)}>
            {getReminderIcon(reminder.tipo)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="space-y-3">
              <div>
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-3">
                  <h3 className="text-base font-semibold" style={{ color: "var(--panel-text,#1c1917)" }}>
                    {reminder.titulo}
                  </h3>
                  {contextBadge && <div className="hidden xl:flex xl:items-center">{contextBadge}</div>}
                </div>
                {reminder.descricao && (
                  <p className="mt-1 text-sm" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                    {reminder.descricao}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {contextBadge && <div className="xl:hidden">{contextBadge}</div>}
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={getReminderPriorityStyle(reminder.prioridade)}
                >
                  {reminder.prioridade}
                </span>
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={getReminderTypeStyle(reminder.tipo)}
                >
                  {reminder.tipo}
                </span>
                {reminder.tempo_estimado_minutos && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={getPanelToneStyle("info")}
                  >
                    <Timer className="h-3 w-3" />
                    <span>{formatEstimatedTime(reminder.tempo_estimado_minutos)}</span>
                  </span>
                )}
                {overdue && !reminder.lido && (
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={getPanelToneStyle("danger")}
                  >
                    Atrasado
                  </span>
                )}
                {reminder.tags?.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={getPanelToneStyle("info")}
                  >
                    <Tag className="h-3 w-3" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2">
                <Button
                  onClick={handleCardAction(() => openLeadInOfficialWhatsApp(leadInfo ?? null))}
                  disabled={!hasLeadPhone}
                  variant="soft"
                  size="icon"
                  className="h-9 w-9"
                  title={hasLeadPhone ? "Abrir WhatsApp oficial" : "Telefone nao disponivel"}
                  aria-label={hasLeadPhone ? "Abrir WhatsApp oficial" : "Telefone nao disponivel"}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                {!reminder.lido && (
                  <>
                    <Button
                      onClick={handleCardAction(() => handleQuickSchedule(reminder, 1))}
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
                            style={getPanelToneStyle("neutral")}
                          >
                            1
                          </span>
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={handleCardAction(() => handleQuickSchedule(reminder, 2))}
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
                            style={getPanelToneStyle("neutral")}
                          >
                            2
                          </span>
                        </span>
                      )}
                    </Button>
                  </>
                )}
                <Button
                  onClick={handleCardAction(() => handleMarkAsRead(reminder.id, reminder.lido))}
                  variant={reminder.lido ? "secondary" : "soft"}
                  size="icon"
                  className="h-9 w-9"
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
                    className="h-9 w-9"
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
                    className="h-9 w-9"
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
                  className="h-9 w-9"
                  title="Excluir item"
                  aria-label="Excluir item"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
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
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasAgendaSnapshot}
      skeleton={<TodoCalendarSkeleton />}
      stageLabel="Carregando agenda..."
      overlayLabel="Atualizando agenda..."
      stageClassName="panel-dashboard-immersive"
    >
      <div className="panel-dashboard-immersive panel-page-shell space-y-6">
        <section className="panel-glass-panel space-y-6 rounded-[2rem] border p-5 sm:p-6" style={PANEL_SECTION_STYLE}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                Rotina operacional
              </p>
              <h2 className="mt-3 text-2xl font-bold sm:text-3xl" style={{ color: "var(--panel-text,#1c1917)" }}>
                Agenda unificada
              </h2>
              <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                Tarefas e lembretes agora compartilham o mesmo calendario, com filtros, contexto do lead e acoes rapidas no mesmo fluxo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>{filteredMonthReminders.length}</span>
                <span>itens no mes</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>{pendingFilteredCount}</span>
                <span>pendentes</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>{overdueFilteredCount}</span>
                <span>atrasados</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Pendentes", value: pendingFilteredCount, tone: "accent" as const },
              { label: "Concluidos", value: completedFilteredCount, tone: "success" as const },
              { label: "Atrasados", value: overdueFilteredCount, tone: "danger" as const },
              { label: "Tarefas", value: taskFilteredCount, tone: "neutral" as const },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.35rem] border p-4" style={PANEL_INSET_STYLE}>
                <div className="text-sm" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                  {item.label}
                </div>
                <div className="mt-2 text-3xl font-bold" style={{ color: getPanelToneStyle(item.tone).color }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-1">
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

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={goToToday} variant="secondary" size="md">
                  Hoje
                </Button>
                <Button onClick={() => setIsAddTaskModalOpen(true)} variant="primary" size="md">
                  <Plus className="h-4 w-4" />
                  Nova tarefa
                </Button>
                {filteredReminders.some((item) => !item.lido) && (
                  <Button onClick={() => void handleMarkAllFilteredAsRead()} variant="soft" size="md">
                    Marcar filtrados como lidos
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_1fr]">
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
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => setStatusFilter("nao-lidos")}
                  variant={statusFilter === "nao-lidos" ? "primary" : "secondary"}
                  size="md"
                >
                  Pendentes
                </Button>
                <Button
                  onClick={() => setStatusFilter("todos")}
                  variant={statusFilter === "todos" ? "primary" : "secondary"}
                  size="md"
                >
                  Todos
                </Button>
                <Button
                  onClick={() => setStatusFilter("lidos")}
                  variant={statusFilter === "lidos" ? "primary" : "secondary"}
                  size="md"
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
                    size="md"
                  >
                    Limpar filtros ({hasActiveFilters})
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm" style={{ ...PANEL_PILL_STYLE, color: "var(--panel-text-soft,#5b4635)" }}>
              <Clock3 className="h-4 w-4" style={{ color: "var(--panel-accent-strong,#b85c1f)" }} />
              <span>{lastUpdatedLabel}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={getPanelToneStyle("accent")}>
                <Circle className="h-3 w-3" />
                <span>Itens pendentes</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5" style={getPanelToneStyle("success")}>
                <CheckCircle2 className="h-3 w-3" />
                <span>Itens concluidos</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.9fr)]">
            <div className="overflow-hidden rounded-[1.7rem] border" style={PANEL_INSET_STYLE}>
              <div className="flex items-center justify-between gap-2 px-4 py-3" style={PANEL_MUTED_INSET_STYLE}>
                <Button onClick={goToPreviousMonth} variant="icon" size="icon" aria-label="Mes anterior">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-lg font-semibold capitalize" style={{ color: "var(--panel-text,#1c1917)" }}>
                  {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </h3>
                <Button onClick={goToNextMonth} variant="icon" size="icon" aria-label="Proximo mes">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-4">{renderCalendar()}</div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 px-1">
                <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                  Dia selecionado
                </p>
                <h3 className="text-xl font-semibold" style={{ color: "var(--panel-text,#1c1917)" }}>
                  {selectedDateLabel}
                </h3>
                <p className="text-sm" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                  {selectedDateReminders.length > 0
                    ? `${selectedDateReminders.length} item(ns) ao todo - ${pendingSelectedReminders.length} pendente(s) e ${completedSelectedReminders.length} concluido(s).`
                    : "Nenhum item encontrado para este dia com os filtros atuais."}
                </p>
              </div>

              {reschedulingReminderId && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border px-4 py-3 text-sm" style={getPanelToneStyle("accent")}>
                  <span>Selecione um dia no calendario para reagendar o item.</span>
                  <Button onClick={() => setReschedulingReminderId(null)} variant="ghost" size="sm" className="h-auto px-0 hover:bg-transparent">
                    Cancelar reagendamento
                  </Button>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-[1.1rem] border p-3 text-sm" style={getPanelToneStyle("danger")}>
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                    Pendentes
                  </h4>
                  <span className="text-xs font-semibold" style={{ color: "var(--panel-accent-ink,#6f3f16)" }}>
                    {pendingSelectedReminders.length}
                  </span>
                </div>

                {pendingSelectedReminders.length > 0 ? (
                  <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">{pendingSelectedReminders.map(renderReminderCard)}</div>
                ) : (
                  <div className="rounded-[1.3rem] border py-8 text-center text-sm" style={PANEL_MUTED_INSET_STYLE}>
                    Nenhum item pendente neste dia.
                  </div>
                )}
              </div>

              <div className="rounded-[1.7rem] border p-4 sm:p-5" style={PANEL_INSET_STYLE}>
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                    Concluidos
                  </h4>
                  <span className="text-xs font-semibold" style={{ color: "var(--panel-accent-green-text,#275c39)" }}>
                    {completedSelectedReminders.length}
                  </span>
                </div>

                {completedSelectedReminders.length > 0 ? (
                  <div className="space-y-3">{completedSelectedReminders.map(renderReminderCard)}</div>
                ) : (
                  <div className="rounded-[1.3rem] border py-8 text-center text-sm" style={PANEL_MUTED_INSET_STYLE}>
                    Nenhum item concluido neste dia.
                  </div>
                )}
              </div>
            </div>
          </div>

          {filteredReminders.length === 0 && (
            <div className="rounded-[1.7rem] border py-12 text-center" style={PANEL_EMPTY_STATE_STYLE}>
              <Bell className="mx-auto mb-4 h-14 w-14" style={{ color: "var(--panel-text-muted,#876f5c)" }} />
              <h3 className="text-lg font-medium" style={{ color: "var(--panel-text,#1c1917)" }}>
                Nenhum item encontrado
              </h3>
              <p className="mt-2 text-sm" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                Ajuste os filtros ou crie uma nova tarefa para voltar a preencher a agenda.
              </p>
            </div>
          )}
        </section>

        {reminderPendingDeletion && (
          <ModalShell
            isOpen
            onClose={() => setReminderPendingDeletion(null)}
            title="Remover item"
            size="sm"
            panelClassName="max-w-md"
            footer={
              <div className="flex justify-end gap-3">
                <Button onClick={() => setReminderPendingDeletion(null)} disabled={isDeletingReminder} variant="secondary" size="md">
                  Cancelar
                </Button>
                <Button onClick={() => void confirmDeleteReminder()} disabled={isDeletingReminder} variant="danger" size="md" loading={isDeletingReminder}>
                  Remover
                </Button>
              </div>
            }
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full border p-3" style={getPanelToneStyle("danger")}>
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <p className="mt-1 text-sm" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                  Tem certeza que deseja remover o item
                  <span className="font-semibold" style={{ color: "var(--panel-text,#1c1917)" }}>
                    {` "${reminderPendingDeletion.titulo}"`}
                  </span>
                  ? Esta acao nao pode ser desfeita.
                </p>
                {reminderPendingDeletion.descricao && (
                  <p className="mt-2 break-words text-xs" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                    {reminderPendingDeletion.descricao}
                  </p>
                )}
              </div>
            </div>
          </ModalShell>
        )}

        {isAddTaskModalOpen && (
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
                <label htmlFor="agenda-task-title" className="text-sm font-medium" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                  Tarefa
                </label>
                <Input
                  id="agenda-task-title"
                  type="text"
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                  placeholder="Digite o titulo da tarefa"
                  required
                  disabled={savingTask}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="agenda-task-description" className="text-sm font-medium" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                  Descricao (opcional)
                </label>
                <Textarea
                  id="agenda-task-description"
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
          <ModalShell
            isOpen
            onClose={() => undefined}
            title="Carregando lead"
            description="Aguarde enquanto buscamos os dados mais recentes."
            size="sm"
            panelClassName="max-w-sm"
            closeOnOverlay={false}
            closeOnEscape={false}
            showCloseButton={false}
            bodyClassName="flex min-h-[180px] items-center justify-center"
          >
            <div className="panel-glass-strong flex items-center gap-2 rounded-[1.1rem] border px-4 py-3 shadow-lg" style={PANEL_INSET_STYLE}>
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--panel-accent-strong,#b85c1f)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                Carregando lead...
              </span>
            </div>
          </ModalShell>
        )}

        {editingLead && <LeadForm lead={editingLead} onClose={() => setEditingLead(null)} onSave={handleLeadSaved} />}
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
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
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium" style={getPanelToneStyle("neutral")}>
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
      <span>{contextInfo.label}</span>
    </span>
  );
}
