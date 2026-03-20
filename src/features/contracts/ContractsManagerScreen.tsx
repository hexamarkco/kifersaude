import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { supabase, Contract, fetchAllPages } from "../../lib/supabase";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  AlertCircle,
  Trash2,
  Users,
  Calendar,
  Clock3,
  Layers,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import ContractForm from "../../components/ContractForm";
import ContractDetails from "../../components/ContractDetails";
import FilterSingleSelect from "../../components/FilterSingleSelect";
import Pagination from "../../components/Pagination";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { ContractsPageSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import {
  PANEL_EMPTY_STATE_STYLE,
  PANEL_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
  getPanelToneStyle,
} from "../../components/ui/panelStyles";
import { toast } from "../../lib/toast";
import { getContractBonusSummary } from "../../lib/contractBonus";
import { normalizeTitleCase } from "../../lib/textNormalization";
import {
  formatContractManagerDate as formatDate,
  getContractDisplayName as resolveContractDisplayName,
  getContractManagerHighlightBadges,
  hasUpcomingImportantContractDate as hasUpcomingImportantDate,
} from "./shared/contractsManagerUtils";
import type {
  ContractDependentSearch,
  ContractHolder,
  ContractsManagerProps,
} from "./shared/contractsManagerTypes";

const normalizeOperadoraLabel = (value?: string | null) =>
  normalizeTitleCase(value) ?? value?.trim() ?? "";

export default function ContractsManager({
  leadToConvert,
  onConvertComplete,
  initialOperadoraFilter,
}: ContractsManagerProps) {
  const { role } = useAuth();
  const { options, getRoleModulePermission } = useConfig();
  const canEditContracts = getRoleModulePermission(role, "contracts").can_edit;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Record<string, ContractHolder[]>>({});
  const [dependentsByContract, setDependentsByContract] = useState<
    Record<string, ContractDependentSearch[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [filterOperadora, setFilterOperadora] = useState("todas");
  const [dateProximityFilter, setDateProximityFilter] = useState<
    "todos" | "proximos-30"
  >("todos");
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    null,
  );
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const contractsRootRef = useRef<HTMLDivElement | null>(null);
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
  const operadoraOptions = useMemo(
    () => {
      const optionMap = new Map<string, string>();

      contracts.forEach((contract) => {
        const normalizedOperadora = normalizeOperadoraLabel(contract.operadora);
        if (normalizedOperadora) {
          optionMap.set(normalizedOperadora, normalizedOperadora);
        }
      });

      return Array.from(optionMap.values()).sort((left, right) =>
        left.localeCompare(right, "pt-BR"),
      );
    },
    [contracts],
  );

  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo),
    [options.lead_responsavel],
  );

  const responsavelFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    responsavelOptions.forEach((option) => {
      optionMap.set(option.value, option.label);
    });

    contracts.forEach((contract) => {
      if (contract.responsavel && !optionMap.has(contract.responsavel)) {
        optionMap.set(contract.responsavel, contract.responsavel);
      }
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [contracts, responsavelOptions]);

  useEffect(() => {
    loadContracts();

    const channel = supabase
      .channel("contracts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contracts",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setContracts((current) => [payload.new as Contract, ...current]);
          } else if (payload.eventType === "UPDATE") {
            setContracts((current) =>
              current.map((contract) =>
                contract.id === (payload.new as Contract).id
                  ? (payload.new as Contract)
                  : contract,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setContracts((current) =>
              current.filter(
                (contract) => contract.id !== (payload.old as Contract).id,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (leadToConvert) {
      setShowForm(true);
    }
  }, [leadToConvert]);

  useEffect(() => {
    if (initialOperadoraFilter) {
      setFilterOperadora(normalizeOperadoraLabel(initialOperadoraFilter));
    } else if (initialOperadoraFilter === undefined) {
      setFilterOperadora("todas");
    }
  }, [initialOperadoraFilter]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const [contractsData, holdersData, dependentsData] = await Promise.all([
        fetchAllPages<Contract>(
          (from, to) =>
            supabase
              .from("contracts")
              .select("*")
              .order("created_at", { ascending: false })
              .range(from, to) as unknown as Promise<{
              data: Contract[] | null;
              error: unknown;
            }>,
        ),
        fetchAllPages<ContractHolder>(
          (from, to) =>
            supabase
              .from("contract_holders")
              .select(
                "id, contract_id, nome_completo, razao_social, nome_fantasia, cnpj, data_nascimento",
              )
              .range(from, to) as unknown as Promise<{
               data: ContractHolder[] | null;
                 error: unknown;
              }>,
        ),
        fetchAllPages<ContractDependentSearch>(
          (from, to) =>
            supabase
              .from("dependents")
              .select("id, contract_id, nome_completo, data_nascimento")
              .range(from, to) as unknown as Promise<{
              data: ContractDependentSearch[] | null;
               error: unknown;
             }>,
        ),
      ]);

      const holdersMap: Record<string, ContractHolder[]> = {};
      holdersData?.forEach((holder) => {
        if (!holdersMap[holder.contract_id]) {
          holdersMap[holder.contract_id] = [];
        }
        holdersMap[holder.contract_id].push(holder);
      });

      const dependentsMap: Record<string, ContractDependentSearch[]> = {};
      dependentsData?.forEach((dependent) => {
        if (!dependentsMap[dependent.contract_id]) {
          dependentsMap[dependent.contract_id] = [];
        }
        dependentsMap[dependent.contract_id].push(dependent);
      });

      setContracts(contractsData || []);
      setHolders(holdersMap);
      setDependentsByContract(dependentsMap);
      setLastUpdated(new Date());
      return contractsData || [];
    } catch (error) {
      console.error("Erro ao carregar contratos:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleContractsUpdated = async () => {
    const updatedContracts = await loadContracts();
    if (!updatedContracts || !selectedContract) return;
    const refreshed =
      updatedContracts.find(
        (contractItem) => contractItem.id === selectedContract.id,
      ) || null;
    setSelectedContract(refreshed);
  };

  const filterContracts = useCallback(() => {
    let filtered = [...contracts];

    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();

      filtered = filtered.filter(
        (contract) => {
          const contractHolders = holders[contract.id] || [];
          const contractDependents = dependentsByContract[contract.id] || [];
          const searchableFields = [
            contract.codigo_contrato,
            contract.operadora,
            contract.produto_plano,
            contract.cnpj,
            contract.razao_social,
            contract.nome_fantasia,
            ...contractHolders.flatMap((holder) => [
              holder.nome_completo,
              holder.razao_social,
              holder.nome_fantasia,
              holder.cnpj,
            ]),
            ...contractDependents.map((dependent) => dependent.nome_completo),
          ];

          return searchableFields.some((field) =>
            field?.toLowerCase().includes(normalizedSearchTerm),
          );
        },
      );
    }

    if (filterStatus !== "todos") {
      filtered = filtered.filter(
        (contract) => contract.status === filterStatus,
      );
    }

    if (filterResponsavel !== "todos") {
      filtered = filtered.filter(
        (contract) => contract.responsavel === filterResponsavel,
      );
    }

    if (filterOperadora !== "todas") {
      filtered = filtered.filter(
        (contract) =>
          normalizeOperadoraLabel(contract.operadora) === filterOperadora,
      );
    }

    if (dateProximityFilter === "proximos-30") {
      filtered = filtered.filter((contract) =>
        hasUpcomingImportantDate(contract),
      );
    }

    setFilteredContracts(filtered);
  }, [
    contracts,
    dateProximityFilter,
    dependentsByContract,
    filterOperadora,
    filterResponsavel,
    filterStatus,
    holders,
    searchTerm,
  ]);

  useEffect(() => {
    filterContracts();
    setCurrentPage(1);
  }, [filterContracts]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterStatus("todos");
    setFilterResponsavel("todos");
    setFilterOperadora("todas");
    setDateProximityFilter("todos");
  };

  const getContractDisplayName = (contract: Contract) =>
    resolveContractDisplayName(contract, holders);

  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${lastUpdated.toLocaleDateString("pt-BR")} às ${lastUpdated.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "Aguardando atualização...";

  const activeFilterCount = [
    searchTerm.trim() !== "",
    filterStatus !== "todos",
    filterResponsavel !== "todos",
    filterOperadora !== "todas",
    dateProximityFilter !== "todos",
  ].filter(Boolean).length;

  const upcomingImportantCount = filteredContracts.filter((contract) =>
    hasUpcomingImportantDate(contract),
  ).length;

  const handleDeleteContract = async (contract: Contract) => {
    const confirmed = await requestConfirmation({
      title: "Excluir contrato",
      description: `Deseja excluir o contrato ${contract.codigo_contrato}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id);

      if (error) throw error;

      setSelectedContract((current) =>
        current?.id === contract.id ? null : current,
      );
      setEditingContract((current) =>
        current?.id === contract.id ? null : current,
      );
      loadContracts();
    } catch (error) {
      console.error("Erro ao excluir contrato:", error);
      toast.error("Erro ao excluir contrato.");
    }
  };

  const renderDateBadges = (contract: Contract) => {
    const participants = [
      ...(holders[contract.id] || []),
      ...(dependentsByContract[contract.id] || []),
    ];
    const badges = getContractManagerHighlightBadges(contract, participants).map(
      (badge) => (
        <span
          key={`${contract.id}-${badge.key}`}
          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
          style={getPanelToneStyle(badge.tone)}
        >
          {badge.label}
        </span>
      ),
    );

    if (badges.length === 0) return null;

    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  const getBonusValue = (contract: Contract) => {
    const summary = getContractBonusSummary(contract);
    return summary.total > 0 ? summary.total : null;
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContracts.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    const tones = {
      Rascunho: "neutral",
      "Em análise": "info",
      "Documentos pendentes": "warning",
      "Proposta enviada": "accent",
      "Aguardando assinatura": "accent",
      Emitido: "info",
      Ativo: "success",
      Suspenso: "danger",
      Cancelado: "danger",
      Encerrado: "neutral",
    } as const;

    return getPanelToneStyle(tones[status as keyof typeof tones] ?? "neutral");
  };

  useEffect(() => {
    if (loading || hasAnimatedSectionsRef.current) {
      return;
    }

    const root = contractsRootRef.current;
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

  const hasContractsSnapshot = contracts.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasContractsSnapshot}
      skeleton={<ContractsPageSkeleton />}
      stageLabel="Carregando contratos..."
      overlayLabel="Atualizando contratos..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={contractsRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-5"
      >
        <div className="flex flex-col gap-3" data-panel-animate>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.24em]"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Operação contratual
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2
                  className="text-2xl font-bold sm:text-3xl"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  Gestão de Contratos
                </h2>
              </div>
              <p
                className="mt-1 max-w-3xl text-sm"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Organize contratos ativos, datas críticas e responsáveis com a
                mesma leitura operacional do dashboard comercial.
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
                  {filteredContracts.length}
                </span>
                <span>contratos no recorte</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <AlertCircle
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                />
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {upcomingImportantCount}
                </span>
                <span>com data sensível</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <Layers
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                />
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {activeFilterCount}
                </span>
                <span>
                  {activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
                </span>
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

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => void loadContracts()}
                disabled={loading}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </Button>

              {canEditContracts && (
                <Button
                  onClick={() => {
                    setEditingContract(null);
                    setShowForm(true);
                  }}
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-5 w-5" />
                  <span>Novo Contrato</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div
          className="panel-glass-panel space-y-5 rounded-[2rem] border p-5 sm:p-6"
          style={PANEL_SECTION_STYLE}
          data-panel-animate
        >
          <div
            className="flex flex-col gap-3 rounded-[1.7rem] border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
            style={PANEL_INSET_STYLE}
          >
            <div className="relative w-full lg:max-w-2xl">
              <Input
                type="text"
                leftIcon={Search}
                placeholder="Buscar por codigo, empresa, CNPJ, beneficiario, operadora ou plano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={resetFilters}
                variant="soft"
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                Limpar
              </Button>
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
                  {filteredContracts.length}
                </span>
                <span>contratos</span>
              </div>
            </div>
          </div>

          <div>
            <h4
              className="mb-3 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--panel-text-muted,#876f5c)" }}
            >
              Filtros principais
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Status
                </label>
                <FilterSingleSelect
                  icon={Filter}
                  value={filterStatus}
                  onChange={(value) => setFilterStatus(value)}
                  placeholder="Todos os status"
                  includePlaceholderOption={false}
                  options={[
                    { value: "todos", label: "Todos os status" },
                    { value: "Rascunho", label: "Rascunho" },
                    { value: "Em análise", label: "Em análise" },
                    {
                      value: "Documentos pendentes",
                      label: "Documentos pendentes",
                    },
                    { value: "Proposta enviada", label: "Proposta enviada" },
                    {
                      value: "Aguardando assinatura",
                      label: "Aguardando assinatura",
                    },
                    { value: "Emitido", label: "Emitido" },
                    { value: "Ativo", label: "Ativo" },
                    { value: "Suspenso", label: "Suspenso" },
                    { value: "Cancelado", label: "Cancelado" },
                    { value: "Encerrado", label: "Encerrado" },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Responsável
                </label>
                <FilterSingleSelect
                  icon={Users}
                  value={filterResponsavel}
                  onChange={(value) => setFilterResponsavel(value)}
                  placeholder="Todos os responsáveis"
                  includePlaceholderOption={false}
                  options={[
                    { value: "todos", label: "Todos os responsáveis" },
                    ...responsavelFilterOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Operadora
                </label>
                <FilterSingleSelect
                  icon={FileText}
                  value={filterOperadora}
                  onChange={(value) => setFilterOperadora(value)}
                  placeholder="Todas as operadoras"
                  includePlaceholderOption={false}
                  options={[
                    { value: "todas", label: "Todas as operadoras" },
                    ...operadoraOptions.map((operadora) => ({
                      value: operadora,
                      label: operadora,
                    })),
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-xs font-medium"
                  style={{ color: "var(--panel-text-soft,#5b4635)" }}
                >
                  Datas importantes
                </label>
                <FilterSingleSelect
                  icon={Calendar}
                  value={dateProximityFilter}
                  onChange={(value) =>
                    setDateProximityFilter(value as "todos" | "proximos-30")
                  }
                  placeholder="Todas as datas"
                  includePlaceholderOption={false}
                  options={[
                    { value: "todos", label: "Todas as datas" },
                    { value: "proximos-30", label: "Próximos 30 dias" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className="panel-glass-panel rounded-[2rem] border p-5 sm:p-6"
          style={PANEL_SECTION_STYLE}
          data-panel-animate
        >
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.24em]"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Carteira contratual
              </p>
              <h3
                className="mt-2 text-xl font-semibold"
                style={{ color: "var(--panel-text,#1c1917)" }}
              >
                Contratos em acompanhamento
              </h3>
              <p
                className="mt-1 max-w-3xl text-sm"
                style={{ color: "var(--panel-text-muted,#876f5c)" }}
              >
                Monitore vigência, reajustes, titulares e previsões financeiras
                sem perder contexto do responsável comercial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {filteredContracts.length}
                </span>
                <span>resultados</span>
              </span>
              <span
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...PANEL_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <span style={{ color: "var(--panel-text,#1c1917)" }}>
                  {currentPage}/{totalPages}
                </span>
                <span>páginas</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 sm:p-5">
            {paginatedContracts.map((contract) => {
              const bonusValue = getBonusValue(contract);

              return (
                <div
                  key={contract.id}
                  className="panel-glass-lite panel-interactive-glass rounded-[1.7rem] border p-4 shadow-sm transition-all hover:shadow-md sm:p-6"
                  style={PANEL_INSET_STYLE}
                >
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3
                          className="text-lg font-semibold"
                          style={{ color: "var(--panel-text,#1c1917)" }}
                        >
                          {contract.codigo_contrato}
                        </h3>
                        <span
                          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                          style={getStatusColor(contract.status)}
                        >
                          {contract.status}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                          style={getPanelToneStyle("neutral")}
                        >
                          {contract.modalidade}
                        </span>
                        {contract.comissao_multiplicador &&
                          contract.comissao_multiplicador !== 2.8 && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                              style={getPanelToneStyle("warning")}
                            >
                              <AlertCircle className="h-3 w-3" />
                              <span>{contract.comissao_multiplicador}x</span>
                            </span>
                          )}
                        {renderDateBadges(contract)}
                      </div>
                      <div className="mb-3">
                        <span
                          className="font-medium"
                          style={{ color: "var(--panel-text-soft,#5b4635)" }}
                        >
                          {getContractDisplayName(contract)}
                        </span>
                      </div>
                      <div
                        className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-5"
                        style={{ color: "var(--panel-text-soft,#5b4635)" }}
                      >
                        <div>
                          <span className="font-medium">Operadora:</span>{" "}
                          {normalizeOperadoraLabel(contract.operadora)}
                        </div>
                        <div>
                          <span className="font-medium">Plano:</span>{" "}
                          {contract.produto_plano}
                        </div>
                        {contract.mensalidade_total && (
                          <div>
                            <span className="font-medium">Mensalidade:</span> R${" "}
                            {contract.mensalidade_total.toLocaleString(
                              "pt-BR",
                              { minimumFractionDigits: 2 },
                            )}
                          </div>
                        )}
                        {contract.comissao_prevista && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">Comissão:</span>
                            <span>
                              R${" "}
                              {contract.comissao_prevista.toLocaleString(
                                "pt-BR",
                                { minimumFractionDigits: 2 },
                              )}
                            </span>
                            {contract.comissao_recebimento_adiantado ===
                            false ? (
                              <span
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                style={getPanelToneStyle("warning")}
                              >
                                Parcelada
                              </span>
                            ) : contract.comissao_recebimento_adiantado ? (
                              <span
                                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                                style={getPanelToneStyle("success")}
                              >
                                Adiantada
                              </span>
                            ) : null}
                          </div>
                        )}
                        {bonusValue !== null && (
                          <div>
                            <span className="font-medium">Bonificação:</span> R${" "}
                            {bonusValue.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                        )}
                        {contract.data_renovacao && (
                          <div>
                            <span className="font-medium">Fim da fidelidade:</span>{" "}
                            {formatDate(contract.data_renovacao, "monthYear")}
                          </div>
                        )}
                        {contract.mes_reajuste && (
                          <div>
                            <span className="font-medium">Mês de reajuste:</span>{" "}
                            {formatDate(
                              contract.mes_reajuste?.toString(),
                              "monthOnly",
                            )}
                          </div>
                        )}
                        {contract.previsao_recebimento_comissao && (
                          <div>
                            <span className="font-medium">Prev. comissão:</span>{" "}
                            {formatDate(contract.previsao_recebimento_comissao)}
                          </div>
                        )}
                        {contract.previsao_pagamento_bonificacao && (
                          <div>
                            <span className="font-medium">Prev. bonificação:</span>{" "}
                            {formatDate(
                              contract.previsao_pagamento_bonificacao,
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className="text-sm lg:text-right"
                      style={{ color: "var(--panel-text-muted,#876f5c)" }}
                    >
                      <div>
                        Responsável:{" "}
                        <span
                          className="font-medium"
                          style={{ color: "var(--panel-text-soft,#5b4635)" }}
                        >
                          {contract.responsavel}
                        </span>
                      </div>
                      <div className="mt-1">
                        Criado:{" "}
                        {new Date(contract.created_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex flex-wrap items-center justify-end gap-2 border-t pt-4 sm:justify-start"
                    style={{ borderColor: "var(--panel-border-subtle,#e4d5c0)" }}
                  >
                    <Button
                      onClick={() => setSelectedContract(contract)}
                      variant="soft"
                      size="sm"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Abrir</span>
                    </Button>
                    {canEditContracts && (
                      <Button
                        onClick={() => handleDeleteContract(contract)}
                        variant="danger"
                        size="sm"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Excluir</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredContracts.length === 0 && (
              <div
                className="panel-glass-panel rounded-[1.7rem] border py-12 text-center shadow-sm"
                style={PANEL_EMPTY_STATE_STYLE}
                data-panel-animate
              >
                <FileText
                  className="mx-auto mb-4 h-16 w-16"
                  style={{ color: "var(--panel-text-muted,#876f5c)" }}
                />
                <h3
                  className="mb-2 text-lg font-medium"
                  style={{ color: "var(--panel-text,#1c1917)" }}
                >
                  Nenhum contrato encontrado
                </h3>
                <p style={{ color: "var(--panel-text-soft,#5b4635)" }}>
                  Tente ajustar os filtros ou adicione um novo contrato.
                </p>
              </div>
            )}
          </div>

          {filteredContracts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredContracts.length}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>

        {showForm && (
          <ContractForm
            key={editingContract?.id ?? leadToConvert?.id ?? "new-contract"}
            contract={editingContract}
            leadToConvert={leadToConvert}
            onClose={() => {
              setShowForm(false);
              setEditingContract(null);
              if (onConvertComplete) onConvertComplete();
            }}
            onSave={() => {
              setShowForm(false);
              setEditingContract(null);
              if (onConvertComplete) onConvertComplete();
              loadContracts();
            }}
          />
        )}

        {selectedContract && (
          <ContractDetails
            key={selectedContract.id}
            contract={selectedContract}
            onClose={() => setSelectedContract(null)}
            onUpdate={handleContractsUpdated}
            onDelete={handleDeleteContract}
          />
        )}
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
