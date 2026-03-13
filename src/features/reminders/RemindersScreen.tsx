import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
import { supabase, Reminder, Lead, Contract } from "../../lib/supabase";
import {
  Bell,
  Check,
  Trash2,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  CheckSquare,
  Square,
  Timer,
  ExternalLink,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Tag,
  X,
  MessageCircle,
  Loader2,
  CalendarPlus,
  Clock3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTimeFullBR, isOverdue } from "../../lib/dateUtils";
import {
  groupRemindersByPeriod,
  getPeriodLabel,
  getUrgencyLevel,
  formatEstimatedTime,
  addBusinessDaysSkippingWeekends,
  ReminderPeriod,
} from "../../lib/reminderUtils";
import { syncLeadNextReturnFromUpcomingReminder } from "../../lib/leadReminderUtils";
import RemindersCalendar from "../../components/RemindersCalendar";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import LeadForm from "../../components/LeadForm";
import FilterSingleSelect from "../../components/FilterSingleSelect";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ModalShell from "../../components/ui/ModalShell";
import {
  PANEL_EMPTY_STATE_STYLE,
  PANEL_INSET_STYLE,
  PANEL_MUTED_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
  getPanelToneStyle,
} from "../../components/ui/panelStyles";
import { RemindersPageSkeleton } from "../../components/ui/panelSkeletons";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { toast } from "../../lib/toast";
import {
  getReminderWhatsappLink as getWhatsappLink,
  isReminderPriority,
  normalizeReminderLeadPhone as normalizeLeadPhone,
} from "./shared/reminderHelpers";
import type { ManualReminderPrompt } from "./shared/reminderTypes";

export default function RemindersManagerEnhanced() {
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<"todos" | "nao-lidos" | "lidos">(
    "nao-lidos",
  );
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grouped" | "list">("grouped");
  const [showStats, setShowStats] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<ReminderPeriod>>(
    new Set(["overdue", "today", "tomorrow"]),
  );
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [showCalendar, setShowCalendar] = useState(false);
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(
    new Map(),
  );
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] =
    useState<Reminder | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);

  const [manualReminderQueue, setManualReminderQueue] = useState<
    ManualReminderPrompt[]
  >([]);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(
    null,
  );
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2;
  } | null>(null);
  const remindersRootRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedSectionsRef = useRef(false);
  const {
    motionEnabled,
    sectionDuration,
    sectionStagger,
    revealDistance,
    ease,
  } = usePanelMotion();
  const loadingUi = useAdaptiveLoading(loading);

  const getLeadIdForReminder = (reminder?: Reminder | null) => {
    if (!reminder) return null;
    if (reminder.lead_id) return reminder.lead_id;

    if (reminder.contract_id) {
      const contract = contractsMap.get(reminder.contract_id);
      if (contract?.lead_id) return contract.lead_id;
    }

    return null;
  };

  const openLeadInWhatsAppTab = (
    lead?: Pick<Lead, "id" | "nome_completo" | "telefone"> | null,
  ) => {
    const normalizedPhone = normalizeLeadPhone(lead?.telefone);
    if (!normalizedPhone) {
      navigate("/painel/whatsapp");
      return;
    }

    const params = new URLSearchParams();
    params.set("openPhone", normalizedPhone);
    if (lead?.nome_completo) {
      params.set("leadName", lead.nome_completo);
    }
    if (lead?.id) {
      params.set("leadId", lead.id);
    }

    navigate(`/painel/whatsapp?${params.toString()}`);
  };

  const openLeadInOfficialWhatsApp = (lead?: Pick<Lead, "telefone"> | null) => {
    const whatsappLink = getWhatsappLink(lead?.telefone);

    if (!whatsappLink) {
      return;
    }

    window.open(whatsappLink, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    loadReminders({ showLoading: true });

    const channel = supabase
      .channel("reminders-changes")
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

          loadReminders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadReminders = async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("data_lembrete", { ascending: true });

      if (error) throw error;
      setReminders(data || []);
      setLastUpdated(new Date());

      const contractIds = [
        ...new Set((data || []).map((r) => r.contract_id).filter(Boolean)),
      ];
      let fetchedContracts = [] as Contract[];

      if (contractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from("contracts")
          .select("*")
          .in("id", contractIds);

        if (contractsData) {
          fetchedContracts = contractsData as Contract[];
          const newContractsMap = new Map();
          contractsData.forEach((contract) =>
            newContractsMap.set(contract.id, contract),
          );
          setContractsMap(newContractsMap);
        }
      }

      const contractLeadIds = [
        ...new Set(
          fetchedContracts
            .map((contract) => contract.lead_id)
            .filter(Boolean) as string[],
        ),
      ];

      const leadIds = [
        ...new Set([
          ...(data || []).map((r) => r.lead_id).filter(Boolean),
          ...contractLeadIds,
        ]),
      ];

      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("*")
          .in("id", leadIds);

        if (leadsData) {
          const newLeadsMap = new Map();
          leadsData.forEach((lead) => newLeadsMap.set(lead.id, lead));
          setLeadsMap(newLeadsMap);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar lembretes:", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchLeadInfo = async (leadId: string) => {
    if (!leadId) {
      return null;
    }

    const cachedLead = leadsMap.get(leadId);
    if (cachedLead) {
      return cachedLead;
    }

    setLoadingLeadId(leadId);

    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const leadData = data as Lead;

      setLeadsMap((current) => {
        const next = new Map(current);
        next.set(leadData.id, leadData);
        return next;
      });

      return leadData;
    } catch (error) {
      console.error("Erro ao carregar dados do lead:", error);
      return null;
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleOpenLead = async (leadId: string) => {
    if (!leadId) {
      return;
    }

    const leadData = await fetchLeadInfo(leadId);

    if (!leadData) {
      toast.error("Não foi possível localizar os dados deste lead.");
      return;
    }

    setEditingLead(leadData);
  };

  const handleLeadSaved = (_lead?: Lead, _context?: { created: boolean }) => {
    setEditingLead(null);
    loadReminders();
  };

  const updateLeadNextReturnDate = async (
    leadId: string,
    _nextReturnDate: string | null,
    _options?: { onlyIfMatches?: string },
  ) => {
    try {
      const nextReturnDate =
        await syncLeadNextReturnFromUpcomingReminder(leadId);

      setLeadsMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(leadId);
        if (existing) {
          next.set(leadId, { ...existing, proximo_retorno: nextReturnDate });
        }
        return next;
      });
    } catch (error) {
      console.error("Erro ao sincronizar próximo retorno do lead:", error);
    }
  };

  const handleMarkLeadAsLost = async (reminder: Reminder) => {
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

    if (!confirmed) return;

    setMarkingLostLeadId(leadId);

    try {
      const nowISO = new Date().toISOString();

      const { error: updateLeadError } = await supabase
        .from("leads")
        .update({
          status: "Perdido",
          proximo_retorno: null,
          ultimo_contato: nowISO,
        })
        .eq("id", leadId);

      if (updateLeadError) throw updateLeadError;

      if (leadInfo) {
        const interactionPayload = {
          lead_id: leadId,
          tipo: "Observação",
          descricao: `Status alterado de "${previousStatus}" para "Perdido"`,
          responsavel: leadInfo.responsavel,
        };

        const statusHistoryPayload = {
          lead_id: leadId,
          status_anterior: previousStatus,
          status_novo: "Perdido",
          responsavel: leadInfo.responsavel,
        };

        await supabase.from("interactions").insert([interactionPayload]);
        await supabase
          .from("lead_status_history")
          .insert([statusHistoryPayload]);
      }

      const { error: deleteRemindersError } = await supabase
        .from("reminders")
        .delete()
        .eq("lead_id", leadId);

      if (deleteRemindersError) throw deleteRemindersError;

      setLeadsMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(leadId);

        if (existing) {
          next.set(leadId, {
            ...existing,
            status: "Perdido",
            proximo_retorno: null,
            ultimo_contato: nowISO,
          });
        }

        return next;
      });

      setSelectedReminders((prev) => {
        const next = new Set(prev);
        reminders.forEach((item) => {
          if (getLeadIdForReminder(item) === leadId) {
            next.delete(item.id);
          }
        });
        return next;
      });

      setReminders((current) =>
        current.filter((item) => getLeadIdForReminder(item) !== leadId),
      );
    } catch (error) {
      console.error("Erro ao marcar lead como perdido:", error);
      toast.error("Não foi possível marcar o lead como perdido.");
    } finally {
      setMarkingLostLeadId(null);
    }
  };

  const handleMarkAsRead = async (
    id: string,
    currentStatus: boolean,
    options?: { queueNextReminderPrompt?: boolean },
  ): Promise<boolean> => {
    try {
      pendingRefreshIdsRef.current.add(id);
      const queueNextReminderPrompt = options?.queueNextReminderPrompt ?? true;

      const reminder = reminders.find((r) => r.id === id);
      const leadId = getLeadIdForReminder(reminder);
      const completionDate = !currentStatus ? new Date().toISOString() : null;
      const updateData: Pick<Reminder, "lido" | "concluido_em"> = {
        lido: !currentStatus,
        concluido_em: completionDate ?? undefined,
      };

      const { error } = await supabase
        .from("reminders")
        .update(updateData)
        .eq("id", id);

      if (error) {
        pendingRefreshIdsRef.current.delete(id);
        throw error;
      }

      if (leadId) {
        await updateLeadNextReturnDate(leadId, null);
      }

      if (completionDate && leadId && reminder) {
        if (queueNextReminderPrompt) {
          let leadInfo = leadsMap.get(leadId);

          if (!leadInfo) {
            const { data: leadData } = await supabase
              .from("leads")
              .select("id, nome_completo, telefone, proximo_retorno")
              .eq("id", leadId)
              .maybeSingle();

            if (leadData) {
              leadInfo = leadData as Lead;
              setLeadsMap((prev) => {
                const next = new Map(prev);
                next.set(leadInfo!.id, leadInfo!);
                return next;
              });
            }
          }

          if (leadInfo) {
            setManualReminderQueue((prev) => [
              ...prev,
              {
                lead: leadInfo,
                promptMessage:
                  "Deseja marcar um próximo lembrete para este lead?",
                defaultTitle: reminder.titulo,
                defaultDescription: reminder.descricao ?? undefined,
                defaultType: "Follow-up",
                defaultPriority: isReminderPriority(reminder.prioridade)
                  ? reminder.prioridade
                  : "normal",
              },
            ]);
          }
        }
      }
      setReminders((currentReminders) =>
        currentReminders.map((reminderItem) =>
          reminderItem.id === id
            ? {
                ...reminderItem,
                lido: !currentStatus,
                concluido_em: completionDate ?? undefined,
              }
            : reminderItem,
        ),
      );
      setSelectedReminders((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      pendingRefreshIdsRef.current.add(id);
      return true;
    } catch (error) {
      console.error("Erro ao atualizar lembrete:", error);
      toast.error("Erro ao atualizar lembrete.");
      return false;
    }
  };

  const handleQuickSchedule = async (reminder: Reminder, daysAhead: 1 | 2) => {
    if (reminder.lido) return;

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      toast.error("Não foi possível identificar o lead deste lembrete.");
      return;
    }

    const nextReminderDate = addBusinessDaysSkippingWeekends(
      reminder.data_lembrete,
      daysAhead,
    );
    const nextReminderDateISO = nextReminderDate.toISOString();

    setQuickSchedulingAction({ reminderId: reminder.id, daysAhead });

    try {
      const markedAsRead = await handleMarkAsRead(reminder.id, reminder.lido, {
        queueNextReminderPrompt: false,
      });

      if (!markedAsRead) {
        return;
      }

      const payload = {
        lead_id: leadId,
        contract_id: reminder.contract_id ?? undefined,
        tipo: reminder.tipo,
        titulo: reminder.titulo,
        descricao: reminder.descricao ?? null,
        data_lembrete: nextReminderDateISO,
        lido: false,
        prioridade: reminder.prioridade,
      };

      const { data: createdReminder, error: insertError } = await supabase
        .from("reminders")
        .insert([payload])
        .select("*")
        .maybeSingle();

      if (insertError) throw insertError;

      await updateLeadNextReturnDate(leadId, nextReminderDateISO);

      if (createdReminder) {
        const nextReminder = createdReminder as Reminder;
        setReminders((current) =>
          [...current, nextReminder].sort(
            (a, b) =>
              new Date(a.data_lembrete).getTime() -
              new Date(b.data_lembrete).getTime(),
          ),
        );
      }
    } catch (error) {
      console.error("Erro ao agendar lembrete rápido:", error);
      toast.error("Não foi possível criar o novo lembrete rápido.");
    } finally {
      setQuickSchedulingAction(null);
    }
  };

  const handleDelete = (id: string) => {
    const reminder = reminders.find((item) => item.id === id);
    if (reminder) {
      setReminderPendingDeletion(reminder);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!reminderPendingDeletion) return;

    const reminderToDelete = reminderPendingDeletion;

    setIsDeletingReminder(true);
    try {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", reminderToDelete.id);

      if (error) throw error;
      setReminders((currentReminders) =>
        currentReminders.filter(
          (reminder) => reminder.id !== reminderToDelete.id,
        ),
      );
      setSelectedReminders((prev) => {
        if (!prev.has(reminderToDelete.id)) return prev;
        const next = new Set(prev);
        next.delete(reminderToDelete.id);
        return next;
      });
      pendingRefreshIdsRef.current.add(reminderToDelete.id);

      const leadId = getLeadIdForReminder(reminderToDelete);
      if (leadId) {
        await updateLeadNextReturnDate(leadId, null);
      }
    } catch (error) {
      console.error("Erro ao remover lembrete:", error);
      toast.error("Erro ao remover lembrete.");
    } finally {
      setIsDeletingReminder(false);
      setReminderPendingDeletion(null);
    }
  };

  const handleRescheduleReminder = async (
    reminderId: string,
    newDate: Date,
  ) => {
    try {
      const reminder = reminders.find((r) => r.id === reminderId);
      if (!reminder) return;

      const reminderDateTime = new Date(reminder.data_lembrete);
      const newDateTime = new Date(newDate);
      newDateTime.setHours(
        reminderDateTime.getHours(),
        reminderDateTime.getMinutes(),
        0,
        0,
      );

      const newDateISO = newDateTime.toISOString();

      const { error } = await supabase
        .from("reminders")
        .update({
          data_lembrete: newDateISO,
        })
        .eq("id", reminderId);

      if (error) throw error;

      {
        const leadId = getLeadIdForReminder(reminder);
        if (leadId) {
          await updateLeadNextReturnDate(leadId, newDateISO);
        }
      }
      setReminders((current) =>
        current.map((item) =>
          item.id === reminderId
            ? {
                ...item,
                data_lembrete: newDateISO,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Erro ao reagendar lembrete:", error);
      toast.error("Erro ao reagendar lembrete.");
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedReminders.size === 0) return;

    try {
      const remindersToUpdate = reminders.filter(
        (reminder) => selectedReminders.has(reminder.id) && !reminder.lido,
      );
      const completionDate = new Date().toISOString();

      const { error } = await supabase
        .from("reminders")
        .update({
          lido: true,
          concluido_em: completionDate,
        })
        .in("id", Array.from(selectedReminders));

      if (error) throw error;

      const leadIdsToSync = Array.from(
        new Set(
          remindersToUpdate
            .map((reminder) => getLeadIdForReminder(reminder))
            .filter((leadId): leadId is string => Boolean(leadId)),
        ),
      );

      const leadUpdates = leadIdsToSync.map((leadId) =>
        updateLeadNextReturnDate(leadId, null),
      );

      await Promise.all(leadUpdates);

      const reminderLeadPairs = remindersToUpdate
        .map((reminder) => ({
          reminder,
          leadId: getLeadIdForReminder(reminder),
        }))
        .filter(({ leadId }) => Boolean(leadId));

      const missingLeadIds = Array.from(
        new Set(
          reminderLeadPairs
            .map(({ leadId }) => leadId)
            .filter((leadId) => leadId && !leadsMap.has(leadId)),
        ),
      ) as string[];

      let fetchedLeads = [] as Lead[];

      if (missingLeadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("id, nome_completo, telefone, proximo_retorno")
          .in("id", missingLeadIds);

        if (leadsData) {
          fetchedLeads = leadsData as Lead[];
          setLeadsMap((prev) => {
            const next = new Map(prev);
            fetchedLeads.forEach((lead) => next.set(lead.id, lead));
            return next;
          });
        }
      }

      const fallbackLeadsMap = fetchedLeads.reduce((acc, lead) => {
        acc.set(lead.id, lead);
        return acc;
      }, new Map<string, Lead>());

      const manualPrompts = reminderLeadPairs
        .map(({ reminder, leadId }) => {
          if (!leadId) return null;
          const leadInfo = leadsMap.get(leadId) ?? fallbackLeadsMap.get(leadId);

          if (!leadInfo) return null;

          return {
            lead: leadInfo,
            promptMessage: "Deseja marcar um próximo lembrete para este lead?",
            defaultTitle: reminder.titulo,
            defaultDescription: reminder.descricao ?? undefined,
            defaultType: "Follow-up",
            defaultPriority: isReminderPriority(reminder.prioridade)
              ? reminder.prioridade
              : "normal",
          } as ManualReminderPrompt;
        })
        .filter((prompt): prompt is ManualReminderPrompt => Boolean(prompt));

      if (manualPrompts.length > 0) {
        setManualReminderQueue((prev) => [...prev, ...manualPrompts]);
      }

      setSelectedReminders(new Set());
      setReminders((current) =>
        current.map((item) =>
          selectedReminders.has(item.id)
            ? {
                ...item,
                lido: true,
                concluido_em: completionDate,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Erro ao atualizar lembretes:", error);
      toast.error("Erro ao atualizar lembretes.");
    }
  };

  const handleBatchDelete = async () => {
    if (selectedReminders.size === 0) return;
    const confirmed = await requestConfirmation({
      title: "Excluir lembretes selecionados",
      description: `Deseja remover ${selectedReminders.size} lembrete(s)? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir lembretes",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      const reminderIds = Array.from(selectedReminders);
      const remindersToDelete = reminders.filter((reminder) =>
        reminderIds.includes(reminder.id),
      );

      const { error } = await supabase
        .from("reminders")
        .delete()
        .in("id", reminderIds);

      if (error) throw error;
      setSelectedReminders(new Set());
      const leadIdsToSync = Array.from(
        new Set(
          remindersToDelete
            .map((reminder) => getLeadIdForReminder(reminder))
            .filter((leadId): leadId is string => Boolean(leadId)),
        ),
      );

      const leadUpdates = leadIdsToSync.map((leadId) =>
        updateLeadNextReturnDate(leadId, null),
      );
      await Promise.all(leadUpdates);
      setReminders((current) =>
        current.filter((reminder) => !reminderIds.includes(reminder.id)),
      );
    } catch (error) {
      console.error("Erro ao remover lembretes:", error);
      toast.error("Erro ao remover lembretes.");
    }
  };

  const handleMarkAllAsRead = async () => {
    const confirmed = await requestConfirmation({
      title: "Marcar lembretes como lidos",
      description: "Deseja marcar todos os lembretes não lidos como lidos?",
      confirmLabel: "Marcar como lidos",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;

    try {
      const unreadLeadIds = Array.from(
        new Set(
          reminders
            .filter((reminder) => !reminder.lido)
            .map((reminder) => getLeadIdForReminder(reminder))
            .filter((leadId): leadId is string => Boolean(leadId)),
        ),
      );

      const { error } = await supabase
        .from("reminders")
        .update({
          lido: true,
          concluido_em: new Date().toISOString(),
        })
        .eq("lido", false);

      if (error) throw error;

      if (unreadLeadIds.length > 0) {
        await Promise.all(
          unreadLeadIds.map((leadId) => updateLeadNextReturnDate(leadId, null)),
        );
      }

      const completionDate = new Date().toISOString();
      setReminders((current) =>
        current.map((item) =>
          item.lido
            ? item
            : {
                ...item,
                lido: true,
                concluido_em: completionDate,
              },
        ),
      );
    } catch (error) {
      console.error("Erro ao atualizar lembretes:", error);
      toast.error("Erro ao atualizar lembretes.");
    }
  };

  const toggleReminderSelection = (id: string) => {
    const newSelection = new Set(selectedReminders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReminders(newSelection);
  };

  const togglePeriod = (period: ReminderPeriod) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(period)) {
      newExpanded.delete(period);
    } else {
      newExpanded.add(period);
    }
    setExpandedPeriods(newExpanded);
  };

  const compareRemindersByDueAtThenAlphabetical = (
    left: Reminder,
    right: Reminder,
  ) => {
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

    const leftLeadName = leftLeadId
      ? leadsMap.get(leftLeadId)?.nome_completo
      : "";
    const rightLeadName = rightLeadId
      ? leadsMap.get(rightLeadId)?.nome_completo
      : "";
    const leftLabel = (leftLeadName || left.titulo || "").trim();
    const rightLabel = (rightLeadName || right.titulo || "").trim();
    const labelComparison = leftLabel.localeCompare(rightLabel, "pt-BR", {
      sensitivity: "base",
    });

    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.id.localeCompare(right.id, "pt-BR", { sensitivity: "base" });
  };

  const filteredReminders = reminders
    .filter((reminder) => {
      if (filter === "nao-lidos" && reminder.lido) {
        return false;
      }
      if (filter === "lidos" && !reminder.lido) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          reminder.titulo.toLowerCase().includes(query) ||
          (reminder.descricao &&
            reminder.descricao.toLowerCase().includes(query)) ||
          reminder.tipo.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (typeFilter !== "all" && reminder.tipo !== typeFilter) {
        return false;
      }

      if (priorityFilter !== "all" && reminder.prioridade !== priorityFilter) {
        return false;
      }

      return true;
    })
    .sort(compareRemindersByDueAtThenAlphabetical);

  const groupedReminders = groupRemindersByPeriod(filteredReminders);

  const stats = {
    total: reminders.length,
    unread: reminders.filter((r) => !r.lido).length,
    overdue: reminders.filter((r) => isOverdue(r.data_lembrete) && !r.lido)
      .length,
    today: groupedReminders.today.length,
    completed: reminders.filter((r) => r.lido).length,
  };

  const activeFilterCount = [
    filter !== "todos",
    searchQuery.trim() !== "",
    typeFilter !== "all",
    priorityFilter !== "all",
  ].filter(Boolean).length;

  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${lastUpdated.toLocaleDateString("pt-BR")} às ${lastUpdated.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Aguardando atualização...";

  const getReminderPriorityStyle = (prioridade: string) => {
    const tones = {
      baixa: "info",
      normal: "neutral",
      alta: "danger",
    } as const;

    return getPanelToneStyle(tones[prioridade as keyof typeof tones] ?? "neutral");
  };

  const getReminderTypeStyle = (tipo: string) => {
    const tones = {
      "Documentos pendentes": "warning",
      Assinatura: "accent",
      Ativação: "info",
      Renovação: "warning",
      Retorno: "neutral",
      Tarefa: "accent",
    } as const;

    return getPanelToneStyle(tones[tipo as keyof typeof tones] ?? "neutral");
  };

  const getReminderGroupStyle = (period: ReminderPeriod) => {
    const tones = {
      overdue: "danger",
      today: "accent",
      tomorrow: "info",
      thisWeek: "warning",
      thisMonth: "neutral",
      later: "neutral",
    } as const;
    const toneStyle = getPanelToneStyle(tones[period]);
    const toneBackground = toneStyle.background as string;

    return {
      ...PANEL_SECTION_STYLE,
      borderColor: toneStyle.borderColor,
      background: `linear-gradient(180deg, ${toneBackground} 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, transparent) 100%)`,
    };
  };

  const getReminderCardStyle = (
    urgency: ReturnType<typeof getUrgencyLevel>,
    isRead: boolean,
    isSelected: boolean,
  ) => {
    if (isRead) {
      return {
        ...PANEL_INSET_STYLE,
        opacity: 0.72,
      };
    }

    const toneByUrgency = {
      critical: "danger",
      high: "warning",
      medium: "accent",
      low: "neutral",
    } as const;

    const toneStyle = getPanelToneStyle(toneByUrgency[urgency]);
    const borderColor = toneStyle.borderColor as string;

    return {
      ...PANEL_INSET_STYLE,
      borderColor,
      boxShadow: isSelected
        ? `0 0 0 2px ${borderColor}, 0 24px 44px -34px rgba(26,18,13,0.34)`
        : `0 0 0 1px ${borderColor}, 0 18px 34px -28px rgba(26,18,13,0.24)`,
    };
  };

  useEffect(() => {
    if (loading || hasAnimatedSectionsRef.current) {
      return;
    }

    const root = remindersRootRef.current;
    if (!root) {
      return;
    }

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-panel-animate]"),
    );
    if (sections.length === 0) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(sections, {
        autoAlpha: 1,
        y: 0,
        clearProps: "transform,opacity,willChange",
      });
      hasAnimatedSectionsRef.current = true;
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        sections,
        {
          autoAlpha: 0,
          y: revealDistance,
          willChange: "transform,opacity",
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: sectionDuration,
          ease,
          stagger: sectionStagger,
          clearProps: "transform,opacity,willChange",
          overwrite: "auto",
          force3D: true,
        },
      );
    }, root);

    hasAnimatedSectionsRef.current = true;

    return () => {
      context.revert();
    };
  }, [
    ease,
    loading,
    motionEnabled,
    revealDistance,
    sectionDuration,
    sectionStagger,
  ]);

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, LucideIcon> = {
      "Documentos pendentes": AlertCircle,
      Assinatura: AlertCircle,
      Ativação: Calendar,
      Renovação: Calendar,
      Retorno: Bell,
    };
    const Icon = icons[tipo] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  const renderReminderCard = (reminder: Reminder) => {
    const overdue = isOverdue(reminder.data_lembrete);
    const urgency = getUrgencyLevel(reminder);
    const isSelected = selectedReminders.has(reminder.id);
    const contract = reminder.contract_id
      ? contractsMap.get(reminder.contract_id)
      : undefined;
    const leadInfo = reminder.lead_id
      ? leadsMap.get(reminder.lead_id)
      : contract?.lead_id
        ? leadsMap.get(contract.lead_id)
        : undefined;
    const leadIdForReminder = getLeadIdForReminder(reminder);
    const hasLeadPhone = Boolean(leadInfo?.telefone);
    const isQuickSchedulingCurrentReminder =
      quickSchedulingAction?.reminderId === reminder.id;
    const iconToneStyle = reminder.lido
      ? getPanelToneStyle("neutral")
      : overdue
        ? getPanelToneStyle("danger")
        : getReminderTypeStyle(reminder.tipo);

    return (
      <div
        key={reminder.id}
        className="panel-glass-lite panel-interactive-glass rounded-[1.6rem] border p-5 transition-all"
        style={getReminderCardStyle(urgency, reminder.lido, isSelected)}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start space-x-4 xl:flex-1">
            <Button
              onClick={() => toggleReminderSelection(reminder.id)}
              variant="icon"
              size="icon"
              className="mt-1 h-8 w-8"
            >
              {isSelected ? (
                <CheckSquare
                  className="h-5 w-5"
                  style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                />
              ) : (
                <Square
                  className="h-5 w-5"
                  style={{ color: "var(--panel-text-muted,#876f5c)" }}
                />
              )}
            </Button>

            <div
              className="rounded-[1rem] border p-3"
              style={iconToneStyle}
            >
              {getTipoIcon(reminder.tipo)}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  {reminder.titulo}
                </h3>
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
                    className="inline-flex items-center space-x-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={getPanelToneStyle("info")}
                  >
                    <Timer className="h-3 w-3" />
                    <span>
                      {formatEstimatedTime(reminder.tempo_estimado_minutos)}
                    </span>
                  </span>
                )}
              </div>

              {reminder.descricao && (
                <p
                  className="mb-3 text-sm"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  {reminder.descricao}
                </p>
              )}

              {reminder.tags && reminder.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {reminder.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                      style={getPanelToneStyle("info")}
                    >
                      <Tag className="h-3 w-3" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}

              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
                {overdue && !reminder.lido && (
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                    style={getPanelToneStyle("danger")}
                  >
                    Atrasado
                  </span>
                )}
                {(reminder.lead_id || reminder.contract_id) && (
                  <ReminderContextLink
                    leadId={reminder.lead_id ?? contract?.lead_id}
                    contractId={reminder.contract_id}
                    leadName={leadInfo?.nome_completo}
                    onLeadClick={handleOpenLead}
                    isLoading={loadingLeadId === reminder.lead_id}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:ml-4 xl:w-auto">
            <Button
              onClick={() => openLeadInWhatsAppTab(leadInfo ?? null)}
              variant="secondary"
              size="icon"
              className="h-9 w-9"
              title="Abrir /painel/whatsapp"
              aria-label="Abrir /painel/whatsapp"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => openLeadInOfficialWhatsApp(leadInfo ?? null)}
              disabled={!hasLeadPhone}
              variant="soft"
              size="icon"
              className="h-9 w-9"
              title={
                hasLeadPhone
                  ? "Abrir WhatsApp oficial"
                  : "Telefone não disponível"
              }
              aria-label={
                hasLeadPhone
                  ? "Abrir WhatsApp oficial"
                  : "Telefone não disponível"
              }
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {!reminder.lido && (
              <>
                <Button
                  onClick={() => handleQuickSchedule(reminder, 1)}
                  disabled={isQuickSchedulingCurrentReminder}
                  variant="primary"
                  size="icon"
                  className="h-9 w-9"
                  title="Agendar +1 dia util e marcar atual como lido"
                  aria-label="Agendar +1 dia util e marcar atual como lido"
                >
                  {isQuickSchedulingCurrentReminder &&
                  quickSchedulingAction?.daysAhead === 1 ? (
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
                  onClick={() => handleQuickSchedule(reminder, 2)}
                  disabled={isQuickSchedulingCurrentReminder}
                  variant="primary"
                  size="icon"
                  className="h-9 w-9"
                  title="Agendar +2 dias uteis e marcar atual como lido"
                  aria-label="Agendar +2 dias uteis e marcar atual como lido"
                >
                  {isQuickSchedulingCurrentReminder &&
                  quickSchedulingAction?.daysAhead === 2 ? (
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
              onClick={() => handleMarkAsRead(reminder.id, reminder.lido)}
              variant={reminder.lido ? "secondary" : "soft"}
              size="icon"
              className="h-9 w-9"
              title={
                reminder.lido ? "Marcar como não lido" : "Marcar como lido"
              }
              aria-label={
                reminder.lido ? "Marcar como não lido" : "Marcar como lido"
              }
            >
              <Check className="h-4 w-4" />
            </Button>
            {leadIdForReminder && (
              <Button
                onClick={() =>
                  leadIdForReminder && handleMarkLeadAsLost(reminder)
                }
                variant="danger"
                size="icon"
                className="h-9 w-9"
                title="Marcar lead como perdido e limpar lembretes"
                aria-label="Marcar lead como perdido e limpar lembretes"
                disabled={markingLostLeadId === leadIdForReminder}
                loading={markingLostLeadId === leadIdForReminder}
              >
                {markingLostLeadId !== leadIdForReminder && (
                  <X className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              onClick={() => handleDelete(reminder.id)}
              variant="danger"
              size="icon"
              className="h-9 w-9"
              title="Excluir lembrete"
              aria-label="Excluir lembrete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const hasRemindersSnapshot = reminders.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasRemindersSnapshot}
      skeleton={<RemindersPageSkeleton />}
      stageLabel="Carregando lembretes..."
      overlayLabel="Atualizando lembretes..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={remindersRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-5"
      >
        <div
          className="flex flex-col gap-3"
          data-panel-animate
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.24em]"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Operação de acompanhamento
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2
                  className="text-2xl font-bold sm:text-3xl"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  Lembretes e Notificações
                </h2>
              </div>
              <p
                className="mt-1 max-w-3xl text-sm"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Priorize retornos, acompanhe urgências e avance a carteira sem
                perder contexto do lead ou contrato vinculado.
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
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {filteredReminders.length}
                </span>
                <span>lembretes no recorte</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {activeFilterCount}
                </span>
                <span>{activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {viewMode === "grouped" ? "Agrupado" : "Lista"}
                </span>
                <span>modo atual</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"
              style={{
                ...PANEL_PILL_STYLE,
                color: "var(--panel-text-soft,#5b4635)",
              }}
            >
              <Clock3
                className="h-4 w-4"
                style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
              />
              <span>{lastUpdatedLabel}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setShowCalendar(true)}
                variant="secondary"
                size="icon"
                title="Ver calendário"
              >
                <Calendar className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => setShowStats(!showStats)}
                variant={showStats ? "primary" : "secondary"}
                size="icon"
                title="Estatísticas"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
              <Button
                onClick={() => setFilter("nao-lidos")}
                variant={filter === "nao-lidos" ? "primary" : "secondary"}
                size="md"
              >
                Não lidos ({stats.unread})
              </Button>
              <Button
                onClick={() => setFilter("todos")}
                variant={filter === "todos" ? "primary" : "secondary"}
                size="md"
              >
                Todos ({stats.total})
              </Button>
              <Button
                onClick={() => setFilter("lidos")}
                variant={filter === "lidos" ? "primary" : "secondary"}
                size="md"
              >
                Lidos ({stats.completed})
              </Button>
            </div>
          </div>
        </div>

        {showStats && (
          <div
            className="grid grid-cols-1 gap-4 md:grid-cols-5"
            data-panel-animate
          >
            {[
              { label: "Total", value: stats.total, tone: "neutral" as const },
              { label: "Não lidos", value: stats.unread, tone: "accent" as const },
              { label: "Atrasados", value: stats.overdue, tone: "danger" as const },
              { label: "Hoje", value: stats.today, tone: "warning" as const },
              { label: "Concluídos", value: stats.completed, tone: "success" as const },
            ].map((item) => (
              <div
                key={item.label}
                className="panel-glass-panel rounded-[1.5rem] border p-4 shadow-sm"
                style={PANEL_SECTION_STYLE}
              >
                <div className="mb-2 text-sm" style={{ color: "var(--panel-text-muted,#876f5c)" }}>
                  {item.label}
                </div>
                <div
                  className="text-3xl font-bold"
                  style={{ color: getPanelToneStyle(item.tone).color }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          className="panel-glass-panel space-y-5 rounded-[2rem] border p-5 sm:p-6"
          style={PANEL_SECTION_STYLE}
          data-panel-animate
        >
          <div
            className="flex flex-col gap-3 rounded-[1.7rem] border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
            style={PANEL_INSET_STYLE}
          >
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Buscar lembretes por título, descrição ou tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={Search}
                className="pr-10"
              />
              {searchQuery && (
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="icon"
                  size="icon"
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div
                className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span
                  className="font-semibold"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  {filteredReminders.length}
                </span>
                <span>lembretes</span>
              </div>
              <Button
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                  setPriorityFilter("all");
                }}
                variant="soft"
              >
                <Filter className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="w-full">
              <FilterSingleSelect
                icon={Tag}
                value={typeFilter}
                onChange={(value) => setTypeFilter(value)}
                placeholder="Todos os tipos"
                includePlaceholderOption={false}
                options={[
                  { value: "all", label: "Todos os tipos" },
                  {
                    value: "Documentos pendentes",
                    label: "Documentos pendentes",
                  },
                  { value: "Assinatura", label: "Assinatura" },
                  { value: "Ativação", label: "Ativação" },
                  { value: "Renovação", label: "Renovação" },
                  { value: "Retorno", label: "Retorno" },
                ]}
              />
            </div>

            <div className="w-full">
              <FilterSingleSelect
                icon={AlertCircle}
                value={priorityFilter}
                onChange={(value) => setPriorityFilter(value)}
                placeholder="Todas prioridades"
                includePlaceholderOption={false}
                options={[
                  { value: "all", label: "Todas prioridades" },
                  { value: "baixa", label: "Baixa" },
                  { value: "normal", label: "Normal" },
                  { value: "alta", label: "Alta" },
                ]}
              />
            </div>

            <Button
              onClick={() =>
                setViewMode(viewMode === "grouped" ? "list" : "grouped")
              }
              variant="secondary"
              size="md"
              className="w-full"
            >
              {viewMode === "grouped" ? "Ver lista" : "Agrupar por período"}
            </Button>
          </div>

          {selectedReminders.size > 0 && (
            <div
              className="flex flex-col gap-2 rounded-[1.4rem] border px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
              style={PANEL_MUTED_INSET_STYLE}
            >
              <span
                className="text-sm font-medium"
                style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
              >
                {selectedReminders.size} selecionado(s)
              </span>
              <Button
                onClick={handleBatchMarkAsRead}
                variant="soft"
                size="md"
              >
                Marcar como lido
              </Button>
              <Button onClick={handleBatchDelete} variant="danger" size="md">
                Excluir
              </Button>
              <Button
                onClick={() => setSelectedReminders(new Set())}
                variant="secondary"
                size="md"
              >
                Cancelar
              </Button>
              {filter === "nao-lidos" && stats.unread > 0 && (
                <Button
                onClick={handleMarkAllAsRead}
                variant="primary"
                size="md"
                  className="sm:ml-auto"
                >
                  Marcar todos como lido
                </Button>
              )}
            </div>
          )}
        </div>

        {filteredReminders.length === 0 ? (
          <div
            className="panel-glass-panel rounded-[1.7rem] border py-12 text-center shadow-sm"
            style={PANEL_EMPTY_STATE_STYLE}
            data-panel-animate
          >
            <Bell
              className="mx-auto mb-4 h-16 w-16"
              style={{ color: "var(--panel-text-muted,#876f5c)" }}
            />
            <h3
              className="mb-2 text-lg font-medium"
              style={{ color: "var(--panel-text,#1c1917)" }}
            >
              Nenhum lembrete encontrado
            </h3>
            <p style={{ color: "var(--panel-text-soft,#5b4635)" }}>
              {searchQuery || typeFilter !== "all" || priorityFilter !== "all"
                ? "Tente ajustar os filtros de busca"
                : filter === "nao-lidos"
                  ? "Você não tem lembretes pendentes"
                  : filter === "lidos"
                    ? "Você não tem lembretes lidos"
                    : "Você não tem lembretes cadastrados"}
            </p>
          </div>
        ) : viewMode === "grouped" ? (
          <div className="space-y-6" data-panel-animate>
            {(
              [
                "overdue",
                "today",
                "tomorrow",
                "thisWeek",
                "thisMonth",
                "later",
              ] as ReminderPeriod[]
            ).map((period) => {
              const periodReminders = groupedReminders[period];
              if (periodReminders.length === 0) return null;

              const isExpanded = expandedPeriods.has(period);

              return (
                <div
                  key={period}
                  className="panel-glass-panel panel-interactive-glass rounded-[1.7rem] border"
                  style={getReminderGroupStyle(period)}
                >
                  <Button
                    onClick={() => togglePeriod(period)}
                    variant="ghost"
                    size="md"
                    className="w-full justify-between rounded-[1.7rem] px-6 py-4"
                  >
                    <div className="flex items-center space-x-3">
                      <h3
                        className="text-lg font-semibold"
                        style={{ color: "var(--panel-text,#1c1917)" }}
                      >
                        {getPeriodLabel(period)}
                      </h3>
                      <span
                        className="rounded-full border px-3 py-1 text-sm font-medium"
                        style={PANEL_PILL_STYLE}
                      >
                        {periodReminders.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        className="h-5 w-5"
                        style={{ color: "var(--panel-text-soft,#5b4635)" }}
                      />
                    ) : (
                      <ChevronDown
                        className="h-5 w-5"
                        style={{ color: "var(--panel-text-soft,#5b4635)" }}
                      />
                    )}
                  </Button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {periodReminders.map(renderReminderCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3" data-panel-animate>
            {filteredReminders.map(renderReminderCard)}
          </div>
        )}

        {reminderPendingDeletion && (
          <ModalShell
            isOpen
            onClose={() => setReminderPendingDeletion(null)}
            title="Remover lembrete"
            size="sm"
            panelClassName="max-w-md"
            footer={
              <div className="flex justify-end space-x-3">
                <Button
                  onClick={() => setReminderPendingDeletion(null)}
                  disabled={isDeletingReminder}
                  variant="secondary"
                  size="md"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmDeleteReminder}
                  disabled={isDeletingReminder}
                  variant="danger"
                  size="md"
                  loading={isDeletingReminder}
                >
                  Remover
                </Button>
              </div>
            }
          >
            <div className="flex items-start space-x-3">
              <div
                className="rounded-full border p-3"
                style={getPanelToneStyle("danger")}
              >
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Tem certeza que deseja remover o lembrete
                  <span
                    className="font-semibold"
                    style={{ color: "var(--panel-text,#1c1917)" }}
                  >
                    {" "}
                    "{reminderPendingDeletion.titulo}"
                  </span>
                  ? Esta ação não pode ser desfeita.
                </p>
                {reminderPendingDeletion.descricao && (
                  <p
                    className="mt-2 break-words text-xs"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    {reminderPendingDeletion.descricao}
                  </p>
                )}
              </div>
            </div>
          </ModalShell>
        )}

        {showCalendar && (
          <RemindersCalendar
            reminders={reminders}
            onClose={() => setShowCalendar(false)}
            onRescheduleReminder={handleRescheduleReminder}
          />
        )}

        {manualReminderQueue[0] && (
          <ReminderSchedulerModal
            lead={manualReminderQueue[0].lead}
            onClose={() => setManualReminderQueue((prev) => prev.slice(1))}
            onScheduled={({ reminderDate }) => {
              const { lead } = manualReminderQueue[0];
              setLeadsMap((prev) => {
                const next = new Map(prev);
                next.set(lead.id, { ...lead, proximo_retorno: reminderDate });
                return next;
              });
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
            <div
              className="panel-glass-strong flex items-center space-x-2 rounded-[1.1rem] border px-4 py-3 shadow-lg"
              style={PANEL_INSET_STYLE}
            >
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--panel-text-soft,#5b4635)" }}
              >
                Carregando lead...
              </span>
            </div>
          </ModalShell>
        )}

        {editingLead && (
          <LeadForm
            lead={editingLead}
            onClose={() => setEditingLead(null)}
            onSave={handleLeadSaved}
          />
        )}
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}

type ReminderContextLinkProps = {
  leadId?: string;
  contractId?: string;
  leadName?: string;
  onLeadClick?: (leadId: string) => void;
  isLoading?: boolean;
};

type ContextInfo =
  | { type: "lead"; label: string }
  | { type: "contract"; label: string };

function ReminderContextLink({
  leadId,
  contractId,
  leadName,
  onLeadClick,
  isLoading,
}: ReminderContextLinkProps) {
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      if (leadId) {
        if (leadName) {
          setContextInfo({ type: "lead", label: leadName });
          return;
        }

        const { data } = await supabase
          .from("leads")
          .select("nome_completo")
          .eq("id", leadId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: "lead", label: data.nome_completo });
        }
      } else if (contractId) {
        const { data } = await supabase
          .from("contracts")
          .select("codigo_contrato")
          .eq("id", contractId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: "contract", label: data.codigo_contrato });
        }
      } else {
        setContextInfo(null);
      }
    };

    loadContext();
  }, [leadId, contractId, leadName]);

  if (!contextInfo) return null;

  const baseClassName = "flex items-center space-x-1 text-xs";
  const baseStyle = { color: "var(--panel-accent-ink,#6f3f16)" } as const;

  if (contextInfo.type === "lead" && leadId) {
    if (isLoading) {
      return (
        <span className={baseClassName} style={baseStyle}>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Carregando lead...</span>
        </span>
      );
    }

    if (onLeadClick) {
      return (
        <Button
          onClick={() => onLeadClick(leadId)}
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs hover:bg-transparent"
          style={baseStyle}
        >
          <ExternalLink className="w-3 h-3" />
          <span>Lead: {contextInfo.label}</span>
        </Button>
      );
    }

    return (
      <span className={baseClassName} style={baseStyle}>
        <ExternalLink className="w-3 h-3" />
        <span>Lead: {contextInfo.label}</span>
      </span>
    );
  }

  return (
    <span className={baseClassName} style={baseStyle}>
      <ExternalLink className="w-3 h-3" />
      <span>Contrato: {contextInfo.label}</span>
    </span>
  );
}
