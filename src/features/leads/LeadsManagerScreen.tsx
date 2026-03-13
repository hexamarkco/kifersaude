import {
  startTransition,
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { supabase, Lead, fetchAllPages } from "../../lib/supabase";
import {
  Search,
  Filter,
  MessageCircle,
  Archive,
  FileText,
  Calendar,
  Users,
  Mail,
  Bell,
  MapPin,
  Layers,
  UserCircle,
  Tag,
  Share2,
  Trash2,
  Download,
  ArrowUpDown,
} from "lucide-react";
import LeadForm from "../../components/LeadForm";
import LeadDetails from "../../components/LeadDetails";
import StatusDropdown from "../../components/StatusDropdown";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import Pagination from "../../components/Pagination";
import { ObserverBanner } from "../../components/ObserverRestriction";
import { useAuth } from "../../contexts/AuthContext";
import { convertLocalToUTC, formatDateTimeFullBR } from "../../lib/dateUtils";
import { toast } from "../../lib/toast";
import { useConfig } from "../../contexts/ConfigContext";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import FilterMultiSelect from "../../components/FilterMultiSelect";
import FilterDateRange from "../../components/FilterDateRange";
import FilterSingleSelect from "../../components/FilterSingleSelect";
import Checkbox from "../../components/ui/Checkbox";
import DateTimePicker from "../../components/ui/DateTimePicker";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { mapLeadRelations } from "../../lib/leadRelations";
import { getBadgeStyle } from "../../lib/colorUtils";
import {
  shouldPromptFirstReminderAfterQuote,
  syncLeadNextReturnFromUpcomingReminder,
} from "../../lib/leadReminderUtils";
import { downloadXlsx } from "../../lib/xlsxExport";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { LeadsPageSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { SORT_OPTIONS, STATUS_REMINDER_RULES } from "./shared/leadsManagerConfig";
import LeadKanbanBoard from "./components/LeadKanbanBoard";
import { LeadsHeader } from "./components/LeadsHeader";
import {
  LEADS_EMPTY_STATE_STYLE,
  LEADS_INSET_STYLE,
  LEADS_MUTED_INSET_STYLE,
  LEADS_PILL_STYLE,
  LEADS_SECTION_STYLE,
} from "./shared/leadsManagerStyles";
import {
  getLeadFirstName,
  getWhatsappLink,
  isWithinDateRange,
} from "./shared/leadsManagerUtils";
import type {
  LeadsManagerProps,
  LeadsSortField as SortField,
  LeadsViewMode,
} from "./shared/leadsManagerTypes";

export default function LeadsManager({
  onConvertToContract,
  initialStatusFilter,
  initialLeadIdFilter,
}: LeadsManagerProps) {
  const { isObserver, role } = useAuth();
  const { leadStatuses, leadOrigins, options, getRoleModulePermission } =
    useConfig();
  const canEditLeads = getRoleModulePermission(role, "leads").can_edit;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [nextReminderByLeadId, setNextReminderByLeadId] = useState<
    Map<string, string>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState(initialLeadIdFilter ?? "");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [filterStatus, setFilterStatus] = useState<string[]>(
    initialStatusFilter ?? [],
  );
  const [filterResponsavel, setFilterResponsavel] = useState<string[]>([]);
  const [filterOrigem, setFilterOrigem] = useState<string[]>([]);
  const [filterTipoContratacao, setFilterTipoContratacao] = useState<string[]>(
    [],
  );
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterCanais, setFilterCanais] = useState<string[]>([]);
  const [filterCreatedFrom, setFilterCreatedFrom] = useState("");
  const [filterCreatedTo, setFilterCreatedTo] = useState("");
  const [filterUltimoContatoFrom, setFilterUltimoContatoFrom] = useState("");
  const [filterUltimoContatoTo, setFilterUltimoContatoTo] = useState("");
  const [filterProximoRetornoFrom, setFilterProximoRetornoFrom] = useState("");
  const [filterProximoRetornoTo, setFilterProximoRetornoTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderLead, setReminderLead] = useState<Lead | null>(null);
  const [reminderPromptMessage, setReminderPromptMessage] = useState<
    string | undefined
  >(undefined);
  const openReminderScheduler = (lead: Lead, promptMessage?: string) => {
    setReminderLead(lead);
    setReminderPromptMessage(promptMessage);
  };

  useEffect(() => {
    if (initialLeadIdFilter !== undefined) {
      setSearchTerm(initialLeadIdFilter);
    } else {
      setSearchTerm("");
    }
  }, [initialLeadIdFilter]);

  const closeReminderScheduler = () => {
    setReminderLead(null);
    setReminderPromptMessage(undefined);
  };
  const [viewMode, setViewMode] = useState<LeadsViewMode>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadContractIds, setLeadContractIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkResponsavel, setBulkResponsavel] = useState("");
  const [bulkProximoRetorno, setBulkProximoRetorno] = useState("");
  const [bulkArchiveAction, setBulkArchiveAction] = useState<
    "none" | "archive" | "unarchive"
  >("none");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const leadsRootRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedSectionsRef = useRef(false);
  const {
    motionEnabled,
    sectionDuration,
    sectionStagger,
    revealDistance,
    ease,
  } = usePanelMotion();
  const loadingUi = useAdaptiveLoading(loading);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const activeLeadStatuses = useMemo(
    () => leadStatuses.filter((status) => status.ativo),
    [leadStatuses],
  );
  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo),
    [options.lead_responsavel],
  );
  const restrictedOriginNamesForObservers = useMemo(
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.nome),
    [leadOrigins],
  );
  const isOriginVisibleToObserver = useCallback(
    (originName: string | null | undefined) => {
      if (!originName) {
        return true;
      }
      return !restrictedOriginNamesForObservers.includes(originName);
    },
    [restrictedOriginNamesForObservers],
  );
  const activeLeadOrigins = useMemo(
    () => leadOrigins.filter((origin) => origin.ativo),
    [leadOrigins],
  );
  const visibleLeadOrigins = useMemo(
    () =>
      activeLeadOrigins.filter(
        (origin) => !isObserver || isOriginVisibleToObserver(origin.nome),
      ),
    [activeLeadOrigins, isObserver, isOriginVisibleToObserver],
  );
  const tipoContratacaoOptions = useMemo(
    () =>
      (options.lead_tipo_contratacao || []).filter((option) => option.ativo),
    [options.lead_tipo_contratacao],
  );
  const statusFilterOptions = useMemo(
    () =>
      activeLeadStatuses.map((status) => ({
        value: status.nome,
        label: status.nome,
      })),
    [activeLeadStatuses],
  );
  const responsavelFilterOptions = useMemo(
    () =>
      responsavelOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [responsavelOptions],
  );
  const origemFilterOptions = useMemo(
    () =>
      visibleLeadOrigins.map((origin) => ({
        value: origin.nome,
        label: origin.nome,
      })),
    [visibleLeadOrigins],
  );
  const tipoContratacaoFilterOptions = useMemo(
    () =>
      tipoContratacaoOptions.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [tipoContratacaoOptions],
  );
  const tagFilterOptions = useMemo(() => {
    const uniqueTags = new Set<string>();
    for (const lead of leads) {
      if (!Array.isArray(lead.tags)) continue;
      for (const tag of lead.tags) {
        if (typeof tag === "string" && tag.trim() !== "") {
          uniqueTags.add(tag);
        }
      }
    }
    return Array.from(uniqueTags)
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }));
  }, [leads]);
  const canalFilterOptions = useMemo(() => {
    const uniqueChannels = new Set<string>();
    for (const lead of leads) {
      if (lead.canal && lead.canal.trim() !== "") {
        uniqueChannels.add(lead.canal);
      }
    }
    return Array.from(uniqueChannels)
      .sort((a, b) => a.localeCompare(b))
      .map((canal) => ({ value: canal, label: canal }));
  }, [leads]);

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setSearchTerm("");
      setFilterStatus(initialStatusFilter ?? []);
      setFilterResponsavel([]);
      setFilterOrigem([]);
      setFilterTipoContratacao([]);
      setFilterTags([]);
      setFilterCanais([]);
      setFilterCreatedFrom("");
      setFilterCreatedTo("");
      setFilterUltimoContatoFrom("");
      setFilterUltimoContatoTo("");
      setFilterProximoRetornoFrom("");
      setFilterProximoRetornoTo("");
    });
  }, [initialStatusFilter]);

  const chunkArray = useCallback(<T,>(items: T[], chunkSize: number): T[][] => {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
  }, []);

  const parseSearchQuery = useCallback((value: string) => {
    const tokens: Record<string, string[]> = {};
    const regex = /(\w+):"([^"]+)"|(\w+):(\S+)/g;
    let cleaned = value;
    let match = regex.exec(value);

    while (match) {
      const key = (match[1] || match[3] || "").toLowerCase();
      const tokenValue = (match[2] || match[4] || "").trim();
      if (key && tokenValue) {
        if (!tokens[key]) tokens[key] = [];
        tokens[key].push(tokenValue);
        cleaned = cleaned.replace(match[0], "").trim();
      }
      match = regex.exec(value);
    }

    return {
      freeText: cleaned,
      tokens,
    };
  }, []);
  const deferredSearchQuery = useMemo(
    () => parseSearchQuery(deferredSearchTerm),
    [deferredSearchTerm, parseSearchQuery],
  );
  const scheduleExportTask = useCallback((task: () => void) => {
    if (typeof window === "undefined") {
      task();
      return;
    }

    window.setTimeout(task, 0);
  }, []);

  const fetchContractsForLeads = useCallback(
    async (leadIds: string[]) => {
      if (leadIds.length === 0) {
        setLeadContractIds(new Set());
        return;
      }

      try {
        const uniqueLeadIds = Array.from(new Set(leadIds));
        const leadIdChunks = chunkArray(uniqueLeadIds, 100);
        const results = await Promise.all(
          leadIdChunks.map(async (chunk) => {
            const { data, error } = await supabase
              .from("contracts")
              .select("lead_id")
              .in("lead_id", chunk);

            if (error) throw error;
            return data || [];
          }),
        );

        const ids = results
          .flat()
          .map((contract) => contract.lead_id)
          .filter((leadId): leadId is string => Boolean(leadId));

        setLeadContractIds(new Set(ids));
      } catch (error) {
        console.error("Erro ao carregar contratos dos leads:", error);
      }
    },
    [chunkArray],
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllPages<Lead>(
        (from, to) =>
          supabase
            .from("leads")
            .select("*")
            .order("created_at", { ascending: false })
            .range(from, to) as unknown as Promise<{
            data: Lead[] | null;
            error: unknown;
          }>,
      );
      const mappedLeads = (data || []).map((lead) =>
        mapLeadRelations(lead, {
          origins: leadOrigins,
          statuses: leadStatuses,
          tipoContratacao: tipoContratacaoOptions,
          responsaveis: responsavelOptions,
        }),
      );

      const visibleLeads = isObserver
        ? mappedLeads.filter((lead) => isOriginVisibleToObserver(lead.origem))
        : mappedLeads;

      setLeads(visibleLeads);
      const leadIds = visibleLeads.map((lead) => lead.id).filter(Boolean);
      if (leadIds.length === 0) {
        setNextReminderByLeadId(new Map());
      } else {
        const nowIso = new Date().toISOString();
        const leadIdChunks = chunkArray(leadIds, 100);
        const results = await Promise.all(
          leadIdChunks.map(async (chunk) => {
            const { data: remindersData, error } = await supabase
              .from("reminders")
              .select("lead_id, data_lembrete, lido")
              .in("lead_id", chunk)
              .eq("lido", false)
              .gte("data_lembrete", nowIso)
              .order("data_lembrete", { ascending: true });

            if (error) throw error;
            return remindersData || [];
          }),
        );

        const nextMap = new Map<string, string>();
        results.flat().forEach((reminder) => {
          if (!reminder.lead_id || !reminder.data_lembrete) return;
          if (!nextMap.has(reminder.lead_id)) {
            nextMap.set(reminder.lead_id, reminder.data_lembrete);
          }
        });
        setNextReminderByLeadId(nextMap);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  }, [
    chunkArray,
    isObserver,
    isOriginVisibleToObserver,
    leadOrigins,
    leadStatuses,
    tipoContratacaoOptions,
    responsavelOptions,
  ]);

  useEffect(() => {
    void fetchContractsForLeads(leads.map((lead) => lead.id));
  }, [fetchContractsForLeads, leads]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterStatus,
    filterResponsavel,
    filterOrigem,
    filterTipoContratacao,
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
    itemsPerPage,
  ]);

  useEffect(() => {
    if (initialStatusFilter === undefined) {
      setFilterStatus([]);
      return;
    }

    setFilterStatus(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    setFilterStatus((current) => {
      const valid = current.filter((value) =>
        activeLeadStatuses.some((status) => status.nome === value),
      );
      return valid.length === current.length ? current : valid;
    });
  }, [activeLeadStatuses]);

  useEffect(() => {
    setFilterResponsavel((current) => {
      const valid = current.filter((value) =>
        responsavelOptions.some((option) => option.value === value),
      );
      return valid.length === current.length ? current : valid;
    });
  }, [responsavelOptions]);

  useEffect(() => {
    setFilterOrigem((current) => {
      const valid = current.filter((value) =>
        visibleLeadOrigins.some((origin) => origin.nome === value),
      );
      return valid.length === current.length ? current : valid;
    });
  }, [visibleLeadOrigins]);

  useEffect(() => {
    setFilterTipoContratacao((current) => {
      const valid = current.filter((value) =>
        tipoContratacaoOptions.some((option) => option.value === value),
      );
      return valid.length === current.length ? current : valid;
    });
  }, [tipoContratacaoOptions]);

  const filteredLeads = useMemo(() => {
    let filtered = leads.filter((lead) =>
      showArchived ? lead.arquivado : !lead.arquivado,
    );

    const selectedStatusSet = new Set(filterStatus);
    const selectedResponsavelSet = new Set(filterResponsavel);
    const selectedOrigemSet = new Set(filterOrigem);
    const selectedTipoSet = new Set(filterTipoContratacao);
    const selectedTagSet = new Set(filterTags);
    const selectedCanaisSet = new Set(filterCanais);

    if (isObserver) {
      filtered = filtered.filter((lead) =>
        isOriginVisibleToObserver(lead.origem),
      );
    }

    const { freeText, tokens } = deferredSearchQuery;

    if (freeText) {
      const lowerSearch = freeText.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.nome_completo.toLowerCase().includes(lowerSearch) ||
          lead.id?.includes(freeText) ||
          lead.telefone.includes(freeText) ||
          lead.email?.toLowerCase().includes(lowerSearch) ||
          lead.cidade?.toLowerCase().includes(lowerSearch) ||
          lead.observacoes?.toLowerCase().includes(lowerSearch),
      );
    }

    if (Object.keys(tokens).length > 0) {
      const normalizePhone = (phone: string | null | undefined) =>
        phone ? phone.replace(/\D/g, "") : "";
      filtered = filtered.filter((lead) => {
        const matchValues = (key: string, value: string) => {
          const lowerValue = value.toLowerCase();
          switch (key) {
            case "status":
              return lead.status?.toLowerCase().includes(lowerValue);
            case "origem":
              return lead.origem?.toLowerCase().includes(lowerValue);
            case "responsavel":
              return lead.responsavel?.toLowerCase().includes(lowerValue);
            case "tipo":
              return lead.tipo_contratacao?.toLowerCase().includes(lowerValue);
            case "canal":
              return lead.canal?.toLowerCase().includes(lowerValue);
            case "tag":
              return Array.isArray(lead.tags)
                ? lead.tags.some((tag) =>
                    tag.toLowerCase().includes(lowerValue),
                  )
                : false;
            case "telefone":
              return normalizePhone(lead.telefone).includes(
                normalizePhone(value),
              );
            case "email":
              return lead.email?.toLowerCase().includes(lowerValue);
            case "nome":
              return lead.nome_completo.toLowerCase().includes(lowerValue);
            case "id":
              return lead.id?.includes(value) ?? false;
            default:
              return true;
          }
        };

        return Object.entries(tokens).every(([key, values]) =>
          values.some((value) => matchValues(key, value)),
        );
      });
    }

    if (selectedStatusSet.size > 0) {
      filtered = filtered.filter(
        (lead) => lead.status && selectedStatusSet.has(lead.status),
      );
    }

    if (selectedResponsavelSet.size > 0) {
      filtered = filtered.filter(
        (lead) =>
          lead.responsavel && selectedResponsavelSet.has(lead.responsavel),
      );
    }

    if (selectedOrigemSet.size > 0) {
      filtered = filtered.filter(
        (lead) => lead.origem && selectedOrigemSet.has(lead.origem),
      );
    }

    if (selectedTipoSet.size > 0) {
      filtered = filtered.filter(
        (lead) =>
          lead.tipo_contratacao && selectedTipoSet.has(lead.tipo_contratacao),
      );
    }

    filtered = filtered.filter((lead) =>
      isWithinDateRange(
        lead.data_criacao ?? lead.created_at,
        filterCreatedFrom,
        filterCreatedTo,
      ),
    );
    filtered = filtered.filter((lead) =>
      isWithinDateRange(
        lead.ultimo_contato,
        filterUltimoContatoFrom,
        filterUltimoContatoTo,
      ),
    );
    filtered = filtered.filter((lead) =>
      isWithinDateRange(
        lead.proximo_retorno,
        filterProximoRetornoFrom,
        filterProximoRetornoTo,
      ),
    );

    if (selectedTagSet.size > 0) {
      const requiredTags = Array.from(selectedTagSet);
      filtered = filtered.filter(
        (lead) =>
          Array.isArray(lead.tags) &&
          requiredTags.every((tag) => lead.tags?.includes(tag)),
      );
    }

    if (selectedCanaisSet.size > 0) {
      filtered = filtered.filter(
        (lead) => lead.canal && selectedCanaisSet.has(lead.canal),
      );
    }

    const normalizePhone = (phone: string | null | undefined) =>
      phone ? phone.replace(/\D/g, "") : "";

    const sorted = [...filtered].sort((a, b) => {
      const sortValue = (lead: Lead): string | number | null => {
        switch (sortField) {
          case "nome":
            return lead.nome_completo || "";
          case "origem":
            return lead.origem || "";
          case "tipo_contratacao":
            return lead.tipo_contratacao || "";
          case "telefone":
            return normalizePhone(lead.telefone);
          case "created_at":
          default: {
            const createdDate = lead.created_at ?? lead.data_criacao;
            if (!createdDate) return null;
            const timestamp = new Date(createdDate).getTime();
            return Number.isNaN(timestamp) ? null : timestamp;
          }
        }
      };

      const valueA = sortValue(a);
      const valueB = sortValue(b);

      if (typeof valueA === "number" || typeof valueB === "number") {
        const numA = typeof valueA === "number" ? valueA : null;
        const numB = typeof valueB === "number" ? valueB : null;

        if (numA === null && numB === null) return 0;
        if (numA === null) return 1;
        if (numB === null) return -1;

        const numberResult = numA - numB;
        return sortDirection === "asc" ? numberResult : -numberResult;
      }

      const stringA = typeof valueA === "string" ? valueA : "";
      const stringB = typeof valueB === "string" ? valueB : "";

      if (!stringA && !stringB) return 0;
      if (!stringA) return 1;
      if (!stringB) return -1;

      const stringResult = stringA.localeCompare(stringB, "pt-BR", {
        sensitivity: "base",
      });
      return sortDirection === "asc" ? stringResult : -stringResult;
    });

    return sorted;
  }, [
    leads,
    deferredSearchQuery,
    filterStatus,
    filterResponsavel,
    filterOrigem,
    filterTipoContratacao,
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
    isObserver,
    isOriginVisibleToObserver,
    showArchived,
    sortDirection,
    sortField,
  ]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [filteredLeads.length, itemsPerPage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showArchived]);

  useEffect(() => {
    if (showArchived && viewMode === "kanban") {
      setViewMode("list");
    }
  }, [showArchived, viewMode]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLeads.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = filteredLeads.slice(
    startIndex,
    startIndex + itemsPerPage,
  );
  const selectedLeadIdsSet = useMemo(
    () => new Set(selectedLeadIds),
    [selectedLeadIds],
  );
  const paginatedLeadIds = useMemo(
    () => paginatedLeads.map((lead) => lead.id),
    [paginatedLeads],
  );
  const areAllPageLeadsSelected = useMemo(
    () =>
      paginatedLeadIds.length > 0 &&
      paginatedLeadIds.every((id) => selectedLeadIdsSet.has(id)),
    [paginatedLeadIds, selectedLeadIdsSet],
  );
  const canSelectLeads = canEditLeads && viewMode === "list";
  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (searchTerm.trim()) count += 1;
    if (filterStatus.length > 0) count += 1;
    if (filterResponsavel.length > 0) count += 1;
    if (filterOrigem.length > 0) count += 1;
    if (filterTipoContratacao.length > 0) count += 1;
    if (filterTags.length > 0) count += 1;
    if (filterCanais.length > 0) count += 1;
    if (filterCreatedFrom || filterCreatedTo) count += 1;
    if (filterUltimoContatoFrom || filterUltimoContatoTo) count += 1;
    if (filterProximoRetornoFrom || filterProximoRetornoTo) count += 1;

    return count;
  }, [
    searchTerm,
    filterStatus,
    filterResponsavel,
    filterOrigem,
    filterTipoContratacao,
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
  ]);
  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "";

    const date = lastUpdated.toLocaleDateString("pt-BR");
    const time = lastUpdated.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${date} as ${time}`;
  }, [lastUpdated]);
  const contentSectionTitle = showArchived
    ? "Leads arquivados"
    : viewMode === "kanban"
      ? "Pipeline comercial"
      : "Leads em acompanhamento";
  const contentSectionDescription = showArchived
    ? "Revise historicos, acompanhe reativacoes e recupere oportunidades com contexto completo."
    : viewMode === "kanban"
      ? "Visualize gargalos por etapa, ajuste WIP e mova leads rapidamente entre os status."
      : "Analise cada lead com contexto, proximos retornos e acoes rapidas no mesmo fluxo.";
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const toggleLeadSelection = (leadId: string) => {
    if (!canSelectLeads || isBulkUpdating) return;

    setSelectedLeadIds((current) => {
      if (current.includes(leadId)) {
        return current.filter((id) => id !== leadId);
      }
      return [...current, leadId];
    });
  };

  const toggleSelectAllCurrentPage = () => {
    if (!canSelectLeads || isBulkUpdating) return;

    setSelectedLeadIds((current) => {
      const currentSet = new Set(current);
      const shouldSelectAll = !paginatedLeadIds.every((id) =>
        currentSet.has(id),
      );

      if (!shouldSelectAll) {
        return current.filter((id) => !paginatedLeadIds.includes(id));
      }

      const updated = new Set(current);
      paginatedLeadIds.forEach((id) => updated.add(id));
      return Array.from(updated);
    });
  };

  const clearSelection = useCallback(() => {
    setSelectedLeadIds([]);
    setBulkStatus("");
    setBulkResponsavel("");
    setBulkProximoRetorno("");
    setBulkArchiveAction("none");
  }, []);

  const normalizePhoneNumber = useCallback(
    (phone: string | null | undefined) => {
      if (!phone) return "";
      return phone.replace(/\D/g, "");
    },
    [],
  );

  const formatDateForExport = useCallback(
    (value: string | null | undefined) => {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "";
      return parsed.toLocaleString("pt-BR");
    },
    [],
  );

  const exportLeadsList = useCallback(
    (leadsToExport: Lead[], fileLabel: string) => {
      if (leadsToExport.length === 0) {
        toast.info("Nenhum lead encontrado para exportar.");
        return;
      }

      scheduleExportTask(() => {
        const headers = [
          "ID",
          "Nome",
          "Telefone",
          "Telefone (WhatsApp)",
          "E-mail",
          "Status",
          "Origem",
          "Tipo de contratação",
          "Responsável",
          "Cidade",
          "Próximo retorno",
          "Último contato",
          "Criado em",
          "Tags",
          "Canal",
          "Observações",
        ];

        const rows = leadsToExport.map((lead) => {
          const phoneDigits = normalizePhoneNumber(lead.telefone);
          const whatsappNumber = phoneDigits ? `55${phoneDigits}` : "";

          return [
            lead.id || "",
            lead.nome_completo || "",
            lead.telefone || "",
            whatsappNumber,
            lead.email || "",
            lead.status || "",
            lead.origem || "",
            lead.tipo_contratacao || "",
            lead.responsavel || "",
            lead.cidade || "",
            formatDateForExport(lead.proximo_retorno),
            formatDateForExport(lead.ultimo_contato),
            formatDateForExport(lead.data_criacao ?? lead.created_at),
            Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
            lead.canal || "",
            lead.observacoes?.trim() || "",
          ];
        });

        const today = new Date().toISOString().slice(0, 10);
        downloadXlsx(`leads-${fileLabel}-${today}.xlsx`, headers, rows, "Leads");
      });
    },
    [formatDateForExport, normalizePhoneNumber, scheduleExportTask],
  );

  const handleExportSelectedLeads = useCallback(() => {
    if (selectedLeadIds.length === 0) {
      toast.warning("Selecione ao menos um lead para exportar.");
      return;
    }

    const selectedSet = new Set(selectedLeadIds);
    const leadsToExport = leads.filter((lead) => selectedSet.has(lead.id));
    exportLeadsList(leadsToExport, "selecionados");
  }, [leads, selectedLeadIds, exportLeadsList]);

  const handleExportFilteredLeads = useCallback(() => {
    exportLeadsList(filteredLeads, "filtrados");
  }, [exportLeadsList, filteredLeads]);

  const handleExportCurrentPage = useCallback(() => {
    exportLeadsList(paginatedLeads, "pagina");
  }, [exportLeadsList, paginatedLeads]);

  const handleBulkDetailsApply = async () => {
    if (selectedLeadIds.length === 0) return;

    const updates: Partial<Lead> = {};
    const proximoRetorno = bulkProximoRetorno
      ? convertLocalToUTC(bulkProximoRetorno) || null
      : undefined;

    if (bulkResponsavel) {
      updates.responsavel = bulkResponsavel;
    }
    if (proximoRetorno !== undefined) {
      updates.proximo_retorno = proximoRetorno;
    }
    if (bulkArchiveAction !== "none") {
      updates.arquivado = bulkArchiveAction === "archive";
    }

    if (Object.keys(updates).length === 0) return;

    setIsBulkUpdating(true);

    setLeads((current) =>
      current.map((lead) =>
        selectedLeadIds.includes(lead.id)
          ? {
              ...lead,
              ...updates,
            }
          : lead,
      ),
    );

    try {
      const { error } = await supabase
        .from("leads")
        .update(updates)
        .in("id", selectedLeadIds);
      if (error) throw error;
      toast.success("Dados aplicados com sucesso aos leads selecionados.");
    } catch (error) {
      console.error("Erro ao aplicar dados em massa:", error);
      toast.error(
        "Erro ao aplicar dados aos leads selecionados. Tente novamente.",
      );
      loadLeads();
    } finally {
      setIsBulkUpdating(false);
      clearSelection();
    }
  };

  const handleBulkStatusApply = async () => {
    if (!bulkStatus || selectedLeadIds.length === 0) return;

    setIsBulkUpdating(true);
    let hasError = false;

    for (const leadId of selectedLeadIds) {
      try {
        await handleStatusChange(leadId, bulkStatus);
      } catch (error) {
        console.error("Erro ao atualizar status do lead em massa:", error);
        hasError = true;
      }
    }

    if (hasError) {
      toast.warning(
        "Alguns leads não puderam ter o status atualizado. Verifique e tente novamente.",
      );
    }

    setIsBulkUpdating(false);
    clearSelection();
  };

  const handleArchive = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: "Arquivar lead",
      description: "Deseja arquivar este lead? Você poderá reativá-lo depois.",
      confirmLabel: "Arquivar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ arquivado: true })
        .eq("id", id);

      if (error) throw error;
      loadLeads();
    } catch (error) {
      console.error("Erro ao arquivar lead:", error);
      toast.error("Erro ao arquivar lead.");
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    const confirmed = await requestConfirmation({
      title: "Excluir lead",
      description: `Deseja excluir o lead ${lead.nome_completo}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase.from("leads").delete().eq("id", lead.id);

      if (error) throw error;

      setSelectedLead((current) => (current?.id === lead.id ? null : current));
      setEditingLead((current) => (current?.id === lead.id ? null : current));
      closeReminderScheduler();
      setSelectedLeadIds((current) => current.filter((id) => id !== lead.id));
      loadLeads();
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      toast.error("Erro ao excluir lead.");
    }
  };

  const handleUnarchive = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: "Reativar lead",
      description: "Deseja reativar este lead?",
      confirmLabel: "Reativar",
      cancelLabel: "Cancelar",
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ arquivado: false })
        .eq("id", id);

      if (error) throw error;
      loadLeads();
    } catch (error) {
      console.error("Erro ao reativar lead:", error);
      toast.error("Erro ao reativar lead.");
    }
  };

  const getStatusBadgeStyles = useCallback(
    (statusName: string | null | undefined) => {
      const statusConfig = activeLeadStatuses.find(
        (status) => status.nome === statusName,
      );

      if (!statusConfig) {
        return {
          backgroundColor: "rgba(148, 163, 184, 0.15)",
          color: "#475569",
          borderColor: "rgba(148, 163, 184, 0.35)",
        } as const;
      }

      return getBadgeStyle(statusConfig.cor, 1);
    },
    [activeLeadStatuses],
  );

  const registerContact = useCallback(
    async (lead: Lead, tipo: "Email" | "Mensagem Automática") => {
      const timestamp = new Date().toISOString();

      setLeads((current) =>
        current.map((l) =>
          l.id === lead.id ? { ...l, ultimo_contato: timestamp } : l,
        ),
      );

      setSelectedLead((current) =>
        current && current.id === lead.id
          ? { ...current, ultimo_contato: timestamp }
          : current,
      );

      try {
        await supabase
          .from("interactions")
          .insert([
            {
              lead_id: lead.id,
              tipo,
              descricao: `Contato via ${tipo}`,
              responsavel: lead.responsavel,
            },
          ]);

        const { error: updateError } = await supabase
          .from("leads")
          .update({ ultimo_contato: timestamp })
          .eq("id", lead.id);

        if (updateError) throw updateError;
      } catch (error) {
        console.error("Erro ao registrar contato:", error);
      }
    },
    [],
  );

  const buildEmailUrl = (lead: Lead) => {
    if (!lead.email) return "";
    const subject = "Contato sobre plano de saúde";
    const body = `Olá ${getLeadFirstName(lead.nome_completo)}, tudo bem?`;
    const params = new URLSearchParams({
      subject,
      body,
    });
    return `mailto:${lead.email}?${params.toString()}`;
  };

  const handleEmailContact = async (lead: Lead) => {
    const url = buildEmailUrl(lead);
    if (!url) return;

    await registerContact(lead, "Email");

    if (typeof window !== "undefined") {
      window.location.href = url;
    }
  };

  const handleRealtimeLeadChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Lead>) => {
      const { eventType } = payload;
      const newLead = payload.new
        ? mapLeadRelations(payload.new as Lead, {
            origins: leadOrigins,
            statuses: leadStatuses,
            tipoContratacao: tipoContratacaoOptions,
            responsaveis: responsavelOptions,
          })
        : null;
      const oldLead = payload.old as Lead | null;

      setLeads((current) => {
        let updatedLeads = current;

        switch (eventType) {
          case "INSERT":
            if (!newLead) return current;
            if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
              return current.filter((lead) => lead.id !== newLead.id);
            }
            updatedLeads = [
              newLead,
              ...current.filter((lead) => lead.id !== newLead.id),
            ];
            break;
          case "UPDATE":
            if (!newLead) return current;
            {
              const otherLeads = current.filter(
                (lead) => lead.id !== newLead.id,
              );
              if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
                updatedLeads = otherLeads;
              } else {
                updatedLeads = [newLead, ...otherLeads];
              }
            }
            break;
          case "DELETE":
            if (!oldLead) return current;
            updatedLeads = current.filter((lead) => lead.id !== oldLead.id);
            break;
          default:
            return current;
        }

        return updatedLeads.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });

      if (eventType === "DELETE" && oldLead) {
        setSelectedLead((current) =>
          current && current.id === oldLead.id ? null : current,
        );
        setEditingLead((current) =>
          current && current.id === oldLead.id ? null : current,
        );
        return;
      }

      if (newLead) {
        if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
          setSelectedLead((current) =>
            current && current.id === newLead.id ? null : current,
          );
          setEditingLead((current) =>
            current && current.id === newLead.id ? null : current,
          );
        } else {
          setSelectedLead((current) =>
            current && current.id === newLead.id ? newLead : current,
          );
          setEditingLead((current) =>
            current && current.id === newLead.id ? newLead : current,
          );
        }
      }
    },
    [
      isObserver,
      isOriginVisibleToObserver,
      leadOrigins,
      leadStatuses,
      tipoContratacaoOptions,
      responsavelOptions,
    ],
  );

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    const oldStatus = lead.status;
    const timestamp = new Date().toISOString();

    setLeads((current) =>
      current.map((l) =>
        l.id === leadId
          ? { ...l, status: newStatus, ultimo_contato: timestamp }
          : l,
      ),
    );

    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: newStatus,
          ultimo_contato: timestamp,
        })
        .eq("id", leadId);

      if (updateError) throw updateError;

      await supabase.from("interactions").insert([
        {
          lead_id: leadId,
          tipo: "Observação",
          descricao: `Status alterado de "${oldStatus}" para "${newStatus}"`,
          responsavel: lead.responsavel,
        },
      ]);

      await supabase.from("lead_status_history").insert([
        {
          lead_id: leadId,
          status_anterior: oldStatus,
          status_novo: newStatus,
          responsavel: lead.responsavel,
        },
      ]);

      const normalizedStatus = newStatus.trim().toLowerCase();

      if (shouldPromptFirstReminderAfterQuote(newStatus)) {
        openReminderScheduler(
          { ...lead, status: newStatus },
          "Deseja agendar o primeiro lembrete após a proposta enviada?",
        );
      } else if (
        normalizedStatus === "perdido" ||
        normalizedStatus === "convertido"
      ) {
        const { error: deleteRemindersError } = await supabase
          .from("reminders")
          .delete()
          .eq("lead_id", leadId);

        if (deleteRemindersError) throw deleteRemindersError;

        const { error: clearNextReturnError } = await supabase
          .from("leads")
          .update({ proximo_retorno: null })
          .eq("id", leadId);

        if (clearNextReturnError) throw clearNextReturnError;

        setLeads((current) =>
          current.map((leadItem) =>
            leadItem.id === leadId
              ? { ...leadItem, proximo_retorno: null }
              : leadItem,
          ),
        );
      } else {
        const reminderRule = STATUS_REMINDER_RULES[normalizedStatus];

        if (reminderRule) {
          const reminderDate = new Date();
          reminderDate.setHours(
            reminderDate.getHours() + reminderRule.hoursFromNow,
          );
          reminderDate.setMinutes(0, 0, 0);

          const reminderDateISO = reminderDate.toISOString();

          const { error: insertReminderError } = await supabase
            .from("reminders")
            .insert([
              {
                lead_id: leadId,
                tipo: reminderRule.type ?? "Follow-up",
                titulo: `${reminderRule.title} - ${lead.nome_completo}`,
                descricao: reminderRule.description ?? null,
                data_lembrete: reminderDateISO,
                lido: false,
                prioridade: reminderRule.priority ?? "normal",
              },
            ]);

          if (insertReminderError) throw insertReminderError;

          const nextReturnDate =
            await syncLeadNextReturnFromUpcomingReminder(leadId);

          setLeads((current) =>
            current.map((leadItem) =>
              leadItem.id === leadId
                ? { ...leadItem, proximo_retorno: nextReturnDate }
                : leadItem,
            ),
          );
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status do lead.");

      setLeads((current) =>
        current.map((l) => (l.id === leadId ? { ...l, status: oldStatus } : l)),
      );

      throw error;
    }
  };

  const handleConvertToContract = (lead: Lead) => {
    if (onConvertToContract) {
      onConvertToContract(lead);
    }
  };

  const handleCreateLead = useCallback(() => {
    setEditingLead(null);
    setShowForm(true);
  }, []);

  const handleRefresh = useCallback(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        handleRealtimeLeadChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleRealtimeLeadChange, loadLeads]);

  useEffect(() => {
    if (viewMode !== "list") {
      clearSelection();
    }
  }, [viewMode, clearSelection]);

  useEffect(() => {
    if (showArchived) {
      clearSelection();
    }
  }, [showArchived, clearSelection]);

  useEffect(() => {
    if (!canEditLeads) {
      clearSelection();
    }
  }, [canEditLeads, clearSelection]);

  useEffect(() => {
    setSelectedLeadIds((current) => {
      const filteredIds = new Set(filteredLeads.map((lead) => lead.id));
      const updated = current.filter((id) => filteredIds.has(id));
      return updated.length === current.length ? current : updated;
    });
  }, [filteredLeads]);

  useEffect(() => {
    if (selectedLeadIds.length === 0) {
      setBulkStatus("");
      setBulkResponsavel("");
      setBulkProximoRetorno("");
      setBulkArchiveAction("none");
    }
  }, [selectedLeadIds.length]);

  useEffect(() => {
    if (loading || hasAnimatedSectionsRef.current) {
      return;
    }

    const root = leadsRootRef.current;
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

  const hasLeadsSnapshot = leads.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasLeadsSnapshot}
      skeleton={<LeadsPageSkeleton />}
      stageLabel="Carregando leads..."
      overlayLabel="Atualizando leads..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={leadsRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-5"
      >
        <ObserverBanner />
        <LeadsHeader
          showArchived={showArchived}
          viewMode={viewMode}
          loading={loading}
          lastUpdatedLabel={lastUpdatedLabel}
          filteredLeadCount={filteredLeads.length}
          activeFilterCount={activeFilterCount}
          canEditLeads={canEditLeads}
          onViewModeChange={setViewMode}
          onRefresh={handleRefresh}
          onToggleArchived={() => setShowArchived((current) => !current)}
          onCreateLead={handleCreateLead}
        />
        <div
          className="panel-glass-panel space-y-5 rounded-[2rem] border p-5 sm:p-6"
          style={LEADS_SECTION_STYLE}
          data-panel-animate
        >
          <div
            className="flex flex-col gap-3 rounded-[1.7rem] border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
            style={LEADS_INSET_STYLE}
          >
            <div className="relative w-full lg:max-w-2xl">
              <Input
                type="text"
                leftIcon={Search}
                placeholder="Buscar por nome, telefone, e-mail ou use status:origem:responsavel:tag:canal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Button
                type="button"
                onClick={resetFilters}
                variant="soft"
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                Limpar
              </Button>
              <Button
                type="button"
                onClick={handleExportFilteredLeads}
                variant="secondary"
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
              <Button
                type="button"
                onClick={handleExportCurrentPage}
                variant="secondary"
                className="whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                Página
              </Button>
              <div
                className="flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm"
                style={{
                  ...LEADS_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span
                  className="font-semibold"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  {filteredLeads.length}
                </span>
                <span>leads</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Filtros Principais
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  {
                    id: "status",
                    icon: Filter,
                    options: statusFilterOptions,
                    placeholder: "Todos os status",
                    values: filterStatus,
                    onChange: setFilterStatus,
                  },
                  {
                    id: "responsavel",
                    icon: UserCircle,
                    options: responsavelFilterOptions,
                    placeholder: "Todos os responsáveis",
                    values: filterResponsavel,
                    onChange: setFilterResponsavel,
                  },
                  {
                    id: "origem",
                    icon: MapPin,
                    options: origemFilterOptions,
                    placeholder: "Todas as origens",
                    values: filterOrigem,
                    onChange: setFilterOrigem,
                  },
                  {
                    id: "tipo-contratacao",
                    icon: Layers,
                    options: tipoContratacaoFilterOptions,
                    placeholder: "Todos os tipos",
                    values: filterTipoContratacao,
                    onChange: setFilterTipoContratacao,
                  },
                ].map((filter) => {
                  const { id, ...props } = filter;
                  return <FilterMultiSelect key={id} {...props} />;
                })}
              </div>
            </div>

            <details className="group">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros Avançados
                  </h4>
                  <span className="text-xs text-slate-500 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </div>
              </summary>
              <div className="mt-3 space-y-4 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                <div>
                  <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Tags e Canais
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        id: "tags",
                        icon: Tag,
                        options: tagFilterOptions,
                        placeholder: "Todas as tags",
                        values: filterTags,
                        onChange: setFilterTags,
                      },
                      {
                        id: "canais",
                        icon: Share2,
                        options: canalFilterOptions,
                        placeholder: "Todos os canais",
                        values: filterCanais,
                        onChange: setFilterCanais,
                      },
                    ].map((filter) => {
                      const { id, ...props } = filter;
                      return <FilterMultiSelect key={id} {...props} />;
                    })}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Filtros de Data
                  </h5>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {[
                      {
                        id: "criacao",
                        icon: Calendar,
                        label: "Criação",
                        fromValue: filterCreatedFrom,
                        toValue: filterCreatedTo,
                        onFromChange: setFilterCreatedFrom,
                        onToChange: setFilterCreatedTo,
                        type: "date" as const,
                      },
                      {
                        id: "ultimo-contato",
                        icon: MessageCircle,
                        label: "Último contato",
                        fromValue: filterUltimoContatoFrom,
                        toValue: filterUltimoContatoTo,
                        onFromChange: setFilterUltimoContatoFrom,
                        onToChange: setFilterUltimoContatoTo,
                        type: "datetime-local" as const,
                      },
                      {
                        id: "proximo-retorno",
                        icon: Bell,
                        label: "Próximo retorno",
                        fromValue: filterProximoRetornoFrom,
                        toValue: filterProximoRetornoTo,
                        onFromChange: setFilterProximoRetornoFrom,
                        onToChange: setFilterProximoRetornoTo,
                        type: "datetime-local" as const,
                      },
                    ].map((dateFilter) => {
                      const { id, ...props } = dateFilter;
                      return <FilterDateRange key={id} {...props} />;
                    })}
                  </div>
                </div>
              </div>
            </details>

            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Ordenação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Ordenar por
                  </label>
                  <FilterSingleSelect
                    icon={Filter}
                    value={sortField}
                    onChange={(value) => setSortField(value as SortField)}
                    placeholder="Data de criação"
                    includePlaceholderOption={false}
                    options={SORT_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    Direção
                  </label>
                  <FilterSingleSelect
                    icon={ArrowUpDown}
                    value={sortDirection}
                    onChange={(value) =>
                      setSortDirection(value as typeof sortDirection)
                    }
                    placeholder="Decrescente"
                    includePlaceholderOption={false}
                    options={[
                      { value: "asc", label: "Crescente" },
                      { value: "desc", label: "Decrescente" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {viewMode === "kanban" ? (
          <div data-panel-animate>
            <LeadKanbanBoard
              leads={filteredLeads}
              onLeadClick={setSelectedLead}
              onConvertToContract={handleConvertToContract}
            />
          </div>
        ) : (
          <div
            className="panel-glass-panel rounded-[2rem] border p-5 sm:p-6"
            style={LEADS_SECTION_STYLE}
            data-panel-animate
          >
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p
                  className="text-[11px] font-black uppercase tracking-[0.24em]"
                  style={{ color: "var(--panel-text-muted,#876f5c)" }}
                >
                  Carteira em foco
                </p>
                <h3
                  className="mt-2 text-xl font-semibold"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  {contentSectionTitle}
                </h3>
                <p
                  className="mt-1 max-w-3xl text-sm"
                  style={{ color: "var(--panel-text-muted,#876f5c)" }}
                >
                  {contentSectionDescription}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    ...LEADS_PILL_STYLE,
                    color: "var(--panel-text-soft,#5b4635)",
                  }}
                >
                  <span style={{ color: "var(--panel-text,#1c1917)" }}>
                    {filteredLeads.length}
                  </span>
                  <span>resultados</span>
                </span>
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{
                    ...LEADS_PILL_STYLE,
                    color: "var(--panel-text-soft,#5b4635)",
                  }}
                >
                  <span style={{ color: "var(--panel-text,#1c1917)" }}>
                    {currentPage}/{totalPages}
                  </span>
                  <span>paginas</span>
                </span>
              </div>
            </div>

            <div
              className="rounded-[1.75rem] border"
              style={LEADS_MUTED_INSET_STYLE}
            >
            {canEditLeads && paginatedLeads.length > 0 && (
              <div
                className="flex flex-col gap-3 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-5"
                style={{ borderColor: "var(--panel-border-subtle,#e4d5c0)" }}
              >
                <label
                  className="inline-flex items-center gap-2 text-sm"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  <Checkbox
                    checked={areAllPageLeadsSelected}
                    onChange={toggleSelectAllCurrentPage}
                  />
                  Selecionar todos desta página
                </label>

                {selectedLeadIds.length > 0 && (
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
                    >
                      {selectedLeadIds.length} lead(s) selecionado(s)
                    </span>
                    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-2">
                      <div className="w-full xl:w-48">
                        <FilterSingleSelect
                          icon={Tag}
                          value={bulkStatus}
                          onChange={(value) => setBulkStatus(value)}
                          placeholder="Selecionar novo status"
                          includePlaceholderOption={false}
                          disabled={isBulkUpdating}
                          options={[
                            { value: "", label: "Selecionar novo status" },
                            ...activeLeadStatuses.map((status) => ({
                              value: status.nome,
                              label: status.nome,
                            })),
                          ]}
                        />
                      </div>
                      <div className="w-full xl:w-48">
                        <FilterSingleSelect
                          icon={UserCircle}
                          value={bulkResponsavel}
                          onChange={(value) => setBulkResponsavel(value)}
                          placeholder="Selecionar responsável"
                          includePlaceholderOption={false}
                          disabled={isBulkUpdating}
                          options={[
                            { value: "", label: "Selecionar responsável" },
                            ...responsavelOptions.map((option) => ({
                              value: option.value,
                              label: option.label,
                            })),
                          ]}
                        />
                      </div>
                      <DateTimePicker
                        type="datetime-local"
                        value={bulkProximoRetorno}
                        onChange={setBulkProximoRetorno}
                        className="w-full xl:w-56"
                        triggerClassName="h-10 border-[var(--panel-border,#d4c0a7)]"
                        disabled={isBulkUpdating}
                        placeholder="Proximo retorno"
                      />
                      <div className="w-full xl:w-48">
                        <FilterSingleSelect
                          icon={Archive}
                          value={bulkArchiveAction}
                          onChange={(value) =>
                            setBulkArchiveAction(
                              value as typeof bulkArchiveAction,
                            )
                          }
                          placeholder="Ação de arquivamento"
                          includePlaceholderOption={false}
                          disabled={isBulkUpdating}
                          options={[
                            {
                              value: "none",
                              label: "Ação de arquivamento (opcional)",
                            },
                            {
                              value: "archive",
                              label: "Arquivar selecionados",
                            },
                            {
                              value: "unarchive",
                              label: "Reativar selecionados",
                            },
                          ]}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          onClick={handleBulkStatusApply}
                          disabled={!bulkStatus || isBulkUpdating}
                          variant="primary"
                        >
                          {isBulkUpdating ? "Atualizando..." : "Aplicar Status"}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleBulkDetailsApply}
                          disabled={
                            isBulkUpdating ||
                            (!bulkResponsavel &&
                              !bulkProximoRetorno &&
                              bulkArchiveAction === "none")
                          }
                          variant="soft"
                        >
                          {isBulkUpdating ? "Aplicando..." : "Aplicar dados"}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleExportSelectedLeads}
                          disabled={isBulkUpdating}
                          variant="secondary"
                        >
                          <Download className="h-4 w-4" />
                          <span>Exportar XLSX</span>
                        </Button>
                        <Button
                          type="button"
                          onClick={clearSelection}
                          disabled={isBulkUpdating}
                          variant="secondary"
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
              {paginatedLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="panel-glass-lite panel-interactive-glass rounded-[1.7rem] border p-4 shadow-sm transition-all hover:shadow-md sm:p-6"
                  style={LEADS_INSET_STYLE}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {canSelectLeads && (
                              <Checkbox
                                checked={selectedLeadIdsSet.has(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                                aria-label={`Selecionar lead ${lead.nome_completo}`}
                              />
                            )}
                            <h3 className="text-lg font-semibold text-slate-900">
                              {lead.nome_completo}
                            </h3>
                            {leadContractIds.has(lead.id) && (
                              <span
                                className="comm-badge comm-badge-contract inline-flex min-h-[30px] items-center gap-2 px-3 py-1 text-xs font-medium leading-none"
                                title="Contrato cadastrado para este lead"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Contrato
                              </span>
                            )}
                            {canEditLeads ? (
                              <StatusDropdown
                                currentStatus={lead.status ?? ""}
                                leadId={lead.id}
                                onStatusChange={handleStatusChange}
                                disabled={isBulkUpdating}
                                statusOptions={activeLeadStatuses}
                              />
                            ) : (
                              <span
                                className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold"
                                style={getStatusBadgeStyles(lead.status)}
                              >
                                {lead.status ?? "Sem status"}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-slate-600">
                            <div className="flex items-center gap-2 break-words">
                              {lead.telefone && (
                                <a
                                  href={
                                    getWhatsappLink(lead.telefone) || undefined
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="comm-icon-chip comm-icon-chip-success inline-flex h-8 w-8 items-center justify-center transition-colors"
                                  aria-label={`Abrir WhatsApp para ${lead.nome_completo}`}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                              <span>{lead.telefone}</span>
                            </div>
                            {lead.email && (
                              <div className="flex items-center gap-2 truncate">
                                <Button
                                  type="button"
                                  onClick={() => handleEmailContact(lead)}
                                  variant="icon"
                                  size="icon"
                                  className="comm-icon-chip comm-icon-chip-brand h-8 w-8 rounded-full"
                                  title="Enviar e-mail"
                                  aria-label={`Enviar e-mail para ${lead.nome_completo}`}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                <span className="truncate">{lead.email}</span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Origem:</span>{" "}
                              {lead.origem}
                            </div>
                            <div>
                              <span className="font-medium">Tipo:</span>{" "}
                              {lead.tipo_contratacao}
                            </div>
                          </div>
                          {lead.cidade && (
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-medium">Cidade:</span>{" "}
                              {lead.cidade}
                            </div>
                          )}
                          {nextReminderByLeadId.get(lead.id) && (
                            <div
                              className="mt-2 flex items-center space-x-2 text-sm"
                              style={{ color: "var(--panel-accent-ink,#6f3f16)" }}
                            >
                              <Calendar className="h-4 w-4" />
                              <span className="font-medium">
                                Retorno:{" "}
                                {formatDateTimeFullBR(
                                  nextReminderByLeadId.get(lead.id) ?? "",
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-slate-500 lg:text-right">
                          <div>
                            Responsável:{" "}
                            <span className="font-medium text-slate-700">
                              {lead.responsavel}
                            </span>
                          </div>
                          <div className="mt-1">
                            Criado:{" "}
                            {new Date(lead.data_criacao).toLocaleDateString(
                              "pt-BR",
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3"
                    style={{ borderColor: "var(--panel-border-subtle,#e4d5c0)" }}
                  >
                    <Button
                      onClick={() => setSelectedLead(lead)}
                      variant="secondary"
                      size="sm"
                      className="h-[30px] px-2.5 text-[11px] space-x-0 sm:space-x-1.5"
                      aria-label={
                        canEditLeads
                          ? "Ver e editar lead"
                          : "Ver detalhes do lead"
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">
                        {canEditLeads ? "Ver/Editar" : "Ver Detalhes"}
                      </span>
                    </Button>
                    {canEditLeads && (
                      <>
                        <Button
                          onClick={() => handleConvertToContract(lead)}
                          variant="soft"
                          size="sm"
                          className="hidden h-[30px] px-2.5 text-[11px] md:inline-flex space-x-1.5"
                        >
                          <FileText className="h-4 w-4" />
                          <span>Converter em Contrato</span>
                        </Button>
                        <Button
                          onClick={() => openReminderScheduler(lead)}
                          variant="soft"
                          size="sm"
                          className="h-[30px] px-2.5 text-[11px] space-x-0 sm:space-x-1.5"
                          aria-label="Agendar lembrete"
                          type="button"
                        >
                          <Bell className="h-4 w-4" />
                          <span className="hidden sm:inline">
                            Agendar Lembrete
                          </span>
                        </Button>
                        <Button
                          onClick={() => handleDeleteLead(lead)}
                          variant="danger"
                          size="sm"
                          className="h-[30px] px-2.5 text-[11px] space-x-0 sm:space-x-1.5"
                          aria-label="Excluir lead"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                        {!showArchived ? (
                          <Button
                            onClick={() => handleArchive(lead.id)}
                            variant="warning"
                            size="sm"
                            className="h-[30px] px-2.5 text-[11px] space-x-0 sm:space-x-1.5 sm:ml-auto"
                            aria-label="Arquivar lead"
                          >
                            <Archive className="h-4 w-4" />
                            <span className="hidden sm:inline">Arquivar</span>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUnarchive(lead.id)}
                            variant="secondary"
                            size="sm"
                            className="h-[30px] px-2.5 text-[11px] space-x-0 sm:space-x-1.5 sm:ml-auto"
                            aria-label="Reativar lead"
                          >
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">Reativar</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {filteredLeads.length === 0 && (
                <div
                  className="panel-glass-panel rounded-[1.7rem] border py-12 text-center shadow-sm"
                  style={LEADS_EMPTY_STATE_STYLE}
                  data-panel-animate
                >
                  <Users
                    className="mx-auto mb-4 h-16 w-16"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  />
                  <h3
                    className="mb-2 text-lg font-medium"
                    style={{ color: "var(--panel-text,#1c1917)" }}
                  >
                    Nenhum lead encontrado
                  </h3>
                  <p style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                    Tente ajustar os filtros ou adicione um novo lead.
                  </p>
                </div>
              )}
            </div>

            {filteredLeads.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
            </div>
          </div>
        )}

        {showForm && (
          <LeadForm
            lead={editingLead}
            onClose={() => {
              setShowForm(false);
              setEditingLead(null);
            }}
            onSave={async () => {
              setShowForm(false);
              setEditingLead(null);
              await loadLeads();
            }}
          />
        )}

        {selectedLead && (
          <LeadDetails
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onUpdate={loadLeads}
            onEdit={(lead) => {
              setSelectedLead(null);
              setEditingLead(lead);
              setShowForm(true);
            }}
            onDelete={handleDeleteLead}
          />
        )}

        {reminderLead && (
          <ReminderSchedulerModal
            lead={reminderLead}
            onClose={closeReminderScheduler}
            onScheduled={(_details) => {
              if (!reminderLead) {
                closeReminderScheduler();
                return;
              }

              setLeads((current) =>
                current.map((lead) =>
                  lead.id === reminderLead.id
                    ? { ...lead, proximo_retorno: _details.reminderDate }
                    : lead,
                ),
              );

              setNextReminderByLeadId((current) => {
                const next = new Map(current);
                next.set(reminderLead.id, _details.reminderDate);
                return next;
              });

              closeReminderScheduler();
            }}
            promptMessage={
              reminderPromptMessage ??
              "Deseja agendar o primeiro lembrete após a proposta enviada?"
            }
            defaultType="Follow-up"
          />
        )}
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
