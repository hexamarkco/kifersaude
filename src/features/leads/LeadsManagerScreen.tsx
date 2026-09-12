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
import type { Lead } from "./domain/types";
import {
  clearLeadReminders,
  createLeadReminder,
  deleteLead,
  listContractLeadIds,
  listLeads,
  listNextReminderByLeadId,
  persistLeadStatusChange,
  registerLeadContact,
  subscribeToLeadChanges,
  type LeadRealtimeChange,
  updateLeadDetails,
} from "./data/leadsRepository";
import {
  Search,
  Filter,
  MessageCircle,
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
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import LeadForm from "../../components/LeadForm";
import LeadDetails from "../../components/LeadDetails";
import { LeadFavoriteToggle } from "../../components/LeadFavoriteStar";
import StatusDropdown from "../../components/StatusDropdown";
import ReminderSchedulerModal from "../../components/ReminderSchedulerModal";
import { ObserverBanner } from "../../components/ObserverRestriction";
import { useAuth } from "../../contexts/AuthContext";
import { convertLocalToUTC, formatDateTimeFullBR } from "../../lib/dateUtils";
import { toast } from "../../lib/toast";
import { useConfig } from "../../contexts/ConfigContext";
import {
  Badge,
  Button,
  Checkbox,
  DateTimePicker,
  EmptyState,
  Input,
  OperationalMetricChip,
  OperationalStatusBadge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toolbar,
  ToolbarActions,
  ToolbarSearch,
  IconButton,
  FilterSelect,
  FilterMultiSelect,
  DateRangeFilter,
  Pagination,
} from "../../design-system";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { mapLeadRelations } from "../../lib/leadRelations";
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
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [leadContractIds, setLeadContractIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkResponsavel, setBulkResponsavel] = useState("");
  const [bulkProximoRetorno, setBulkProximoRetorno] = useState("");
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
        setLeadContractIds(await listContractLeadIds(leadIds));
      } catch (error) {
        console.error("Erro ao carregar contratos dos leads:", error);
      }
    },
    [],
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLeads();
      const mappedLeads = data.map((lead) =>
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
      setNextReminderByLeadId(await listNextReminderByLeadId(leadIds));
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  }, [
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
    let filtered = leads;

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
    sortDirection,
    sortField,
  ]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [filteredLeads.length, itemsPerPage, currentPage]);

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
  const advancedFilterCount = useMemo(() => {
    let count = 0;

    if (filterTags.length > 0) count += 1;
    if (filterCanais.length > 0) count += 1;
    if (filterCreatedFrom || filterCreatedTo) count += 1;
    if (filterUltimoContatoFrom || filterUltimoContatoTo) count += 1;
    if (filterProximoRetornoFrom || filterProximoRetornoTo) count += 1;

    return count;
  }, [
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
  ]);
  const contentSectionTitle =
    viewMode === "kanban"
      ? "Pipeline comercial"
      : "Leads em acompanhamento";
  const contentSectionDescription =
    viewMode === "kanban"
      ? "Visualize gargalos por etapa, ajuste WIP e mova leads rapidamente entre os status."
      : "Analise cada lead com contexto, próximos retornos e ações rápidas no mesmo fluxo.";
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
      await updateLeadDetails(selectedLeadIds, updates);
      toast.success("Dados aplicados com sucesso aos leads selecionados.");
    } catch (error) {
      console.error("Erro ao aplicar dados em massa:", error);
      toast.error(
        "Não foi possível aplicar os dados. Tente novamente.",
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
      await deleteLead(lead.id);

      setSelectedLead((current) => (current?.id === lead.id ? null : current));
      setEditingLead((current) => (current?.id === lead.id ? null : current));
      closeReminderScheduler();
      setSelectedLeadIds((current) => current.filter((id) => id !== lead.id));
      loadLeads();
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      toast.error("Não foi possível excluir o lead.");
    }
  };

  const getStatusColor = useCallback(
    (statusName: string | null | undefined) => {
      const statusConfig = activeLeadStatuses.find(
        (status) => status.nome === statusName,
      );

      return statusConfig?.cor ?? null;
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
        await registerLeadContact(lead, tipo, timestamp);
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
    ({ eventType, current, previous }: LeadRealtimeChange) => {
      const newLead = current
        ? mapLeadRelations(current, {
            origins: leadOrigins,
            statuses: leadStatuses,
            tipoContratacao: tipoContratacaoOptions,
            responsaveis: responsavelOptions,
          })
        : null;
      const oldLead = previous;

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
      await persistLeadStatusChange({ lead, newStatus, timestamp });

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
        await clearLeadReminders(leadId);

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

          await createLeadReminder({
            leadId,
            type: reminderRule.type ?? "Follow-up",
            title: `${reminderRule.title} - ${lead.nome_completo}`,
            description: reminderRule.description ?? null,
            remindAt: reminderDateISO,
            priority: reminderRule.priority ?? "normal",
          });

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
      toast.error("Não foi possível atualizar o status do lead.");

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

  useEffect(() => {
    loadLeads();

    return subscribeToLeadChanges(handleRealtimeLeadChange);
  }, [handleRealtimeLeadChange, loadLeads]);

  useEffect(() => {
    if (viewMode !== "list") {
      clearSelection();
    }
  }, [viewMode, clearSelection]);

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
      overlayLabel="Atualizando leads..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={leadsRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-5"
      >
        <ObserverBanner />
        <LeadsHeader
          viewMode={viewMode}
          canEditLeads={canEditLeads}
          onViewModeChange={setViewMode}
          onCreateLead={handleCreateLead}
        />
        <Surface className="space-y-5" data-panel-animate>
          <Toolbar>
            <ToolbarSearch className="relative">
              <Input
                type="text"
                leftIcon={Search}
                placeholder="Buscar por nome, telefone, e-mail ou use status:origem:responsável:tag:canal..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </ToolbarSearch>
            <ToolbarActions className="kds-leads-toolbar-actions">
              <Button
                type="button"
                onClick={resetFilters}
                variant="soft"
                size="md"
                className="whitespace-nowrap kds-mobile-icon-action"
                aria-label="Limpar filtros"
                title="Limpar filtros"
              >
                <Filter className="kds-control-icon" />
                <span className="kds-mobile-icon-action-label">Limpar</span>
              </Button>
              <Popover>
                <PopoverTrigger className="inline-flex">
                  <Button type="button" variant="secondary" size="md" className="whitespace-nowrap kds-mobile-icon-action" aria-label="Opções de exportação" title="Exportar">
                    <Download className="kds-control-icon" />
                    <span className="kds-mobile-icon-action-label">Exportar</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 space-y-1 p-2" aria-label="Opções de exportação">
                  <button type="button" onClick={handleExportCurrentPage} className="kds-popover-menu-item">Exportar página atual</button>
                  <button type="button" onClick={handleExportFilteredLeads} className="kds-popover-menu-item">Exportar todos os resultados</button>
                </PopoverContent>
              </Popover>
              <OperationalMetricChip
                value={filteredLeads.length}
                label="leads"
                className="kds-toolbar-inline-metric"
              />
            </ToolbarActions>
          </Toolbar>

          <div className="space-y-4">
            <div className="kds-leads-filter-grid">
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

            <div className="kds-leads-filter-secondary">
              <details className="kds-leads-advanced-filters group">
                <summary className="kds-leads-advanced-summary cursor-pointer list-none">
                  <Surface variant="muted" padding="sm" className="kds-op-disclosure-trigger flex items-center justify-between gap-3 px-4 py-2 transition-colors sm:inline-flex sm:justify-start">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <Filter className="w-4 h-4" />
                      Filtros avançados
                      {advancedFilterCount > 0 && (
                        <Badge tone="accent" size="sm">{advancedFilterCount}</Badge>
                      )}
                    </h4>
                    <span className="text-xs transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </Surface>
                </summary>
                <Surface variant="muted" padding="none" className="kds-op-disclosure-content kds-leads-advanced-panel mt-3 grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
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
                    return <DateRangeFilter key={id} {...props} />;
                  })}
                </Surface>
              </details>

              <div className="kds-leads-sort-field" role="group" aria-label="Ordenação dos leads">
                <span className="kds-leads-sort-label">Ordenar por</span>
                <div className="flex items-center gap-2">
                  <FilterSelect
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
                  <IconButton
                    type="button"
                    variant="secondary"
                    size="md" onClick={() =>
                      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                    }
                    title={sortDirection === "asc" ? "Ordem crescente" : "Ordem decrescente"}
                    aria-label={sortDirection === "asc" ? "Ordem crescente" : "Ordem decrescente"}
                    className="shrink-0"
                  >
                    {sortDirection === "asc" ? (
                      <ArrowUp className="kds-control-icon" />
                    ) : (
                      <ArrowDown className="kds-control-icon" />
                    )}
                  </IconButton>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        {viewMode === "kanban" ? (
          <div data-panel-animate>
            <LeadKanbanBoard
              leads={filteredLeads}
              onLeadClick={setSelectedLead}
              onConvertToContract={handleConvertToContract}
            />
          </div>
        ) : (
          <Surface data-panel-animate>
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="kds-op-section-label">
                  Carteira em foco
                </p>
                <h3 className="kds-op-panel-title mt-2">
                  {contentSectionTitle}
                </h3>
                <p className="kds-op-lead-muted mt-1 max-w-3xl text-sm">
                  {contentSectionDescription}
                </p>
              </div>

              <div className="kds-leads-list-summary flex flex-wrap gap-2">
                <OperationalMetricChip
                  value={filteredLeads.length}
                  label="resultados"
                  className="kds-leads-list-summary-metric"
                  title={`${filteredLeads.length} resultados`}
                />
                <OperationalMetricChip
                  value={`${currentPage}/${totalPages}`}
                  label="páginas"
                  className="kds-leads-list-summary-metric"
                  title={`Página ${currentPage} de ${totalPages}`}
                />
                {canSelectLeads && paginatedLeads.length > 0 && (
                  <label
                    className="kds-op-chip kds-leads-select-page cursor-pointer"
                  >
                    <Checkbox
                      checked={areAllPageLeadsSelected}
                      onChange={toggleSelectAllCurrentPage}
                      aria-label={areAllPageLeadsSelected ? "Desselecionar página" : "Selecionar página"}
                    />
                    <span className="kds-leads-select-page-label">
                      {areAllPageLeadsSelected
                        ? "Página selecionada"
                        : "Selecionar página"}
                    </span>
                  </label>
                )}
                {selectedLeadIds.length > 0 && (
                  <OperationalMetricChip value={selectedLeadIds.length} label="selecionados" active />
                )}
              </div>
            </div>

            {selectedLeadIds.length > 0 && (
                <Surface variant="muted" padding="md" className="kds-leads-bulk-panel">
                  <div className="kds-leads-bulk-header">
                    <span className="kds-op-bulk-title">
                      {selectedLeadIds.length} lead(s) selecionado(s)
                    </span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={isBulkUpdating}
                      className="kds-leads-bulk-clear"
                    >
                      Limpar seleção
                    </button>
                  </div>

                  <div className="kds-leads-bulk-body">
                    <div className="kds-leads-bulk-controls">
                      <div className="kds-leads-bulk-control">
                        <FilterSelect
                          icon={Tag}
                          value={bulkStatus}
                          onChange={(value) => setBulkStatus(value)}
                          placeholder="Novo status"
                          includePlaceholderOption={false}
                          size="sm"
                          disabled={isBulkUpdating}
                          options={[
                            { value: "", label: "Novo status" },
                            ...activeLeadStatuses.map((status) => ({
                              value: status.nome,
                              label: status.nome,
                            })),
                          ]}
                        />
                      </div>
                      <div className="kds-leads-bulk-control">
                        <FilterSelect
                          icon={UserCircle}
                          value={bulkResponsavel}
                          onChange={(value) => setBulkResponsavel(value)}
                          placeholder="Responsável"
                          includePlaceholderOption={false}
                          size="sm"
                          disabled={isBulkUpdating}
                          options={[
                            { value: "", label: "Responsável" },
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
                        onChange={(event) => setBulkProximoRetorno(event.target.value)}
                        size="sm"
                        className="kds-leads-bulk-date"
                        disabled={isBulkUpdating}
                        placeholder="Próximo retorno"
                      />

                    </div>

                    <div className="kds-leads-bulk-actions">
                        <Button
                          type="button"
                          onClick={handleBulkStatusApply}
                          disabled={!bulkStatus || isBulkUpdating}
                          variant="primary"
                          size="sm"
                        >
                          {isBulkUpdating ? "Atualizando..." : "Aplicar status"}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleBulkDetailsApply}
                          disabled={
                            isBulkUpdating ||
                            (!bulkResponsavel && !bulkProximoRetorno)
                          }
                          variant="soft"
                          size="sm"
                        >
                          {isBulkUpdating ? "Aplicando..." : "Aplicar dados"}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleExportSelectedLeads}
                          disabled={isBulkUpdating}
                          variant="secondary"
                          size="sm"
                        >
                          <Download className="kds-control-icon" />
                          <span>Exportar XLSX</span>
                        </Button>
                    </div>
                  </div>
                </Surface>
            )}
            <div className="hidden lg:block">
              <Table size="sm" stickyHeader>
                <TableHeader>
                  <TableRow>
                    {canSelectLeads && <TableHead align="center" className="w-12" aria-label="Selecionar" />}
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem e tipo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Próximo retorno</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead align="right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canSelectLeads ? 8 : 7}>
                        <EmptyState
                          icon={<Users className="h-8 w-8" />}
                          title="Nenhum lead encontrado"
                          description="Tente ajustar os filtros ou adicione um novo lead."
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {paginatedLeads.map((lead) => {
                    const nextReminder = nextReminderByLeadId.get(lead.id);

                    return (
                      <TableRow
                        key={lead.id}
                        selected={selectedLeadIdsSet.has(lead.id)}
                        className="align-middle"
                      >
                        {canSelectLeads && (
                          <TableCell align="center" className="w-12 align-middle">
                            <Checkbox
                              checked={selectedLeadIdsSet.has(lead.id)}
                              onChange={() => toggleLeadSelection(lead.id)}
                              aria-label={`Selecionar lead ${lead.nome_completo}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-start gap-1.5">
                            <LeadFavoriteToggle
                              leadId={lead.id}
                              favorito={Boolean(lead.favorito)}
                              size="sm"
                              className="mt-0.5"
                              onToggled={(next) => setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, favorito: next } : item)))}
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedLead(lead)}
                              className="block max-w-72 text-left transition-colors hover:text-[var(--brand-primary)]"
                            >
                              <span className="block truncate font-semibold text-[var(--text-primary)]">{lead.nome_completo}</span>
                              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{lead.telefone || lead.email || "Sem contato"}</span>
                            </button>
                          </div>
                          {leadContractIds.has(lead.id) && <Badge tone="info" size="sm" className="mt-2">Contrato</Badge>}
                        </TableCell>
                        <TableCell>
                          {canEditLeads ? (
                            <StatusDropdown currentStatus={lead.status ?? ""} leadId={lead.id} onStatusChange={handleStatusChange} disabled={isBulkUpdating} statusOptions={activeLeadStatuses} />
                          ) : (
                            <OperationalStatusBadge statusColor={getStatusColor(lead.status)}>{lead.status ?? "Sem status"}</OperationalStatusBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="block font-medium text-[var(--text-secondary)]">{lead.origem || "Sem origem"}</span>
                          <span className="mt-1 block text-xs text-[var(--text-muted)]">{lead.tipo_contratacao || "Sem tipo"}</span>
                        </TableCell>
                        <TableCell>{lead.responsavel || "Não atribuído"}</TableCell>
                        <TableCell>
                          {nextReminder ? (
                            <span className="font-medium text-[var(--accent-gold-hover)]">{formatDateTimeFullBR(nextReminder)}</span>
                          ) : <span className="text-[var(--text-muted)]">Sem retorno</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(lead.data_criacao).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell align="right">
                          <div className="flex justify-end gap-1">
                            <IconButton onClick={() => setSelectedLead(lead)} variant="secondary" title="Abrir lead" aria-label="Abrir lead" size="md"><MessageCircle aria-hidden="true" /></IconButton>
                            {canEditLeads && <IconButton onClick={() => openReminderScheduler(lead)} variant="soft" title="Agendar lembrete" aria-label="Agendar lembrete" size="md"><Bell aria-hidden="true" /></IconButton>}
                            {canEditLeads && <IconButton onClick={() => handleConvertToContract(lead)} variant="soft" title="Converter em contrato" aria-label="Converter em contrato" size="md"><FileText aria-hidden="true" /></IconButton>}
                            {canEditLeads && <IconButton onClick={() => handleDeleteLead(lead)} variant="danger" title="Excluir lead" aria-label="Excluir lead" size="md"><Trash2 aria-hidden="true" /></IconButton>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="kds-op-lead-list lg:hidden">
              {paginatedLeads.map((lead) => (
                <Surface
                  key={lead.id}
                  variant="muted"
                  padding="sm"
                  className="kds-op-lead-card transition-colors sm:p-4"
                >
                  <div className="min-w-0">
                    <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {canSelectLeads && (
                              <Checkbox
                                checked={selectedLeadIdsSet.has(lead.id)}
                                onChange={() => toggleLeadSelection(lead.id)}
                                aria-label={`Selecionar lead ${lead.nome_completo}`}
                              />
                            )}
                            <LeadFavoriteToggle
                              leadId={lead.id}
                              favorito={Boolean(lead.favorito)}
                              size="sm"
                              onToggled={(next) => setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, favorito: next } : item)))}
                            />
                            <h3 className="kds-op-lead-title">
                              {lead.nome_completo}
                            </h3>
                            {leadContractIds.has(lead.id) && (
                              <Badge tone="info" title="Contrato cadastrado para este lead">
                                <FileText className="h-3.5 w-3.5" />
                                Contrato
                              </Badge>
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
                              <OperationalStatusBadge statusColor={getStatusColor(lead.status)}>
                                {lead.status ?? "Sem status"}
                              </OperationalStatusBadge>
                            )}
                          </div>
                          <div className="kds-op-lead-meta grid grid-cols-2 gap-x-3 gap-y-2.5">
                            <div className="col-span-2 min-[480px]:col-span-1 flex items-center gap-2 break-words">
                              {lead.telefone && (
                                <a
                                  href={
                                    getWhatsappLink(lead.telefone) || undefined
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="kds-op-icon-chip kds-op-icon-chip-success inline-flex h-8 w-8 items-center justify-center transition-colors"
                                  aria-label={`Abrir WhatsApp para ${lead.nome_completo}`}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                              <span>{lead.telefone}</span>
                            </div>
                            {lead.email && (
                              <div className="col-span-2 min-[480px]:col-span-1 flex min-w-0 items-center gap-2">
                                <IconButton
                                  type="button"
                                  onClick={() => handleEmailContact(lead)}
                                  variant="icon"
                                  className="kds-op-icon-chip"
                                  title="Enviar e-mail"
                                  aria-label={`Enviar e-mail para ${lead.nome_completo}`}
                                 size="sm">
                                  <Mail aria-hidden="true" />
                                </IconButton>
                                <span className="min-w-0 truncate">{lead.email}</span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Origem</span>{" "}
                              {lead.origem}
                            </div>
                            <div>
                              <span className="font-medium">Tipo</span>{" "}
                              {lead.tipo_contratacao}
                            </div>
                            <div>
                              <span className="font-medium">Responsável</span>{" "}
                              <span className="kds-op-lead-strong">
                                {lead.responsavel}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Criado</span>{" "}
                              {new Date(lead.data_criacao).toLocaleDateString(
                                "pt-BR",
                              )}
                            </div>
                          </div>
                          {lead.cidade && (
                            <div className="kds-op-lead-meta mt-2.5">
                              <span className="font-medium">Cidade</span>{" "}
                              {lead.cidade}
                            </div>
                          )}
                          {nextReminderByLeadId.get(lead.id) && (
                            <div className="kds-op-lead-accent mt-2.5 flex items-center space-x-2 text-sm">
                              <Calendar className="h-4 w-4" />
                              <span className="kds-op-lead-accent font-medium">
                                Retorno{" "}
                                {formatDateTimeFullBR(
                                  nextReminderByLeadId.get(lead.id) ?? "",
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  <div
                    className={`kds-op-lead-actions mt-3 grid items-center gap-1.5 pt-3 ${
                      canEditLeads ? "grid-cols-4" : "grid-cols-1"
                    }`}
                  >
                    <Button
                      onClick={() => setSelectedLead(lead)}
                      variant="secondary"
                      size="sm"
                      className="kds-op-inline-action w-full justify-center space-x-0 sm:space-x-1.5"
                      aria-label={
                        canEditLeads
                          ? "Ver e editar lead"
                          : "Ver detalhes do lead"
                      }
                    >
                      <MessageCircle className="kds-control-icon" />
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
                          className="kds-op-inline-action w-full justify-center space-x-0 sm:space-x-1.5"
                          aria-label="Converter em contrato"
                        >
                          <FileText className="kds-control-icon" />
                          <span className="hidden sm:inline">Converter</span>
                        </Button>
                        <Button
                          onClick={() => openReminderScheduler(lead)}
                          variant="soft"
                          size="sm"
                          className="kds-op-inline-action w-full justify-center space-x-0 sm:space-x-1.5"
                          aria-label="Agendar lembrete"
                          type="button"
                        >
                          <Bell className="kds-control-icon" />
                          <span className="hidden sm:inline">
                            Agendar lembrete
                          </span>
                        </Button>
                        <Button
                          onClick={() => handleDeleteLead(lead)}
                          variant="danger"
                          size="sm"
                          className="kds-op-inline-action w-full justify-center space-x-0 sm:space-x-1.5"
                          aria-label="Excluir lead"
                          type="button"
                        >
                          <Trash2 className="kds-control-icon" />
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                      </>
                    )}
                  </div>
                </Surface>
              ))}

              {filteredLeads.length === 0 && (
                <EmptyState
                  icon={<Users className="h-8 w-8" />}
                  title="Nenhum lead encontrado"
                  description="Tente ajustar os filtros ou adicione um novo lead."
                  data-panel-animate
                />
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
          </Surface>
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
