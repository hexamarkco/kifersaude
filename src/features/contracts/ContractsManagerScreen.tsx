import { Heading, Text } from '../../design-system';
import { ActionSurface } from '../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Contract } from "./domain/types";
import {
  deleteContract,
  listContractsSearchSnapshot,
  subscribeToContractChanges,
} from "./data/contractsRepository";
import { createContractRecordsBulk } from "./data/contractJsonImportRepository";
import type { ContractJsonBulkImportPayload } from "./domain/contractJsonImport";
import {
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Trash2,
  Users,
  Calendar,
  FileUp,
  Download,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import ContractForm from "../../components/ContractForm";
import ContractDetails from "../../components/ContractDetails";
import HolderImportPreparation from "./components/HolderImportPreparation";
import { ContractBulkJsonImportDialog } from "./components/ContractBulkJsonImportDialog";
import ContractStatusDropdown from "./components/ContractStatusDropdown";
import { useContractStatus } from "./hooks/useContractStatus";
import { useProductionOperators } from "../production";
import {
  Badge,
  Button,
  Alert,
  EmptyState,
  Input,
  OperationalMetricChip,
  PageHeader,
  SectionHeader,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  SortableTableHead,
  TableHeader,
  TableRow,
  Toolbar,
  ToolbarActions,
  ToolbarSearch,
  Tooltip,
  type PanelTone,
  FilterSelect,
  Pagination,
  KpiCard,
  RecordActions,
  useTableSorting,
  useSortedTableRows,
} from "../../design-system";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { ContractsPageSkeleton } from '../../design-system';
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from '../../design-system';
import { toast } from "../../lib/toast";
import { downloadXlsx } from "../../lib/xlsxExport";
import { getContractBonusSummary } from "../../lib/contractBonus";
import {
  normalizeOperadoraLabel,
} from "../../lib/textNormalization";
import {
  formatContractManagerDate as formatDate,
  formatContractEntityName,
  formatContractModalityLabel,
  formatContractPlanLabel,
  getContractDisplayName as resolveContractDisplayName,
  getContractManagerHighlightBadges,
  hasUpcomingImportantContractDate as hasUpcomingImportantDate,
} from "./shared/contractsManagerUtils";
import type {
  ContractDependentSearch,
  ContractHolder,
  ContractsManagerProps,
} from "./shared/contractsManagerTypes";

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
  const [contractsLoadError, setContractsLoadError] = useState<string | null>(null);
  const [contractsLoadWarning, setContractsLoadWarning] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [filterOperadora, setFilterOperadora] = useState("todas");
  const [dateProximityFilter, setDateProximityFilter] = useState<
    "todos" | "proximos-30"
  >("todos");
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    null,
  );
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const statusOptions = (options.contract_status || []).filter((option) => option.ativo);
  const { operators: productionOperators, error: productionOperatorsError } = useProductionOperators();
  const { changeStatus, savingIds } = useContractStatus((updated) => {
    setContracts((current) => current.map((contract) =>
      contract.id === updated.id ? { ...contract, ...updated } : contract,
    ));
    setSelectedContract((current) => current?.id === updated.id ? { ...current, ...updated } : current);
  });
  const [currentPage, setCurrentPage] = useState(1);
  const { sorting, sortBy } = useTableSorting<"contract" | "status" | "plan" | "monthly" | "start" | "renewal" | "owner">();
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const contractsRootRef = useRef<HTMLDivElement | null>(null);
  const contractsLoadRequestIdRef = useRef(0);
  const hasAnimatedSectionsRef = useRef(false);
  const deletingContractIdsRef = useRef(new Set<string>());
  const [deletingContractIds, setDeletingContractIds] = useState<Set<string>>(new Set());
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
    const unsubscribe = subscribeToContractChanges(({ eventType, current: changed, previous }) => {
      contractsLoadRequestIdRef.current += 1;

      if (eventType === "INSERT" && changed) {
        setContracts((contracts) => [changed, ...contracts]);
      } else if (eventType === "UPDATE" && changed) {
        setContracts((contracts) =>
          contracts.map((contract) =>
            contract.id === changed.id ? changed : contract,
          ),
        );
        setSelectedContract((current) =>
          current?.id === changed.id ? changed : current,
        );
      } else if (eventType === "DELETE" && previous) {
        setContracts((contracts) =>
          contracts.filter((contract) => contract.id !== previous.id),
        );
        setSelectedContract((current) =>
          current?.id === previous.id ? null : current,
        );
      }
    });

    void loadContracts();

    return () => {
      contractsLoadRequestIdRef.current += 1;
      unsubscribe();
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
    const requestId = ++contractsLoadRequestIdRef.current;
    setLoading(true);
    setContractsLoadError(null);
    setContractsLoadWarning(null);
    try {
      const snapshot = await listContractsSearchSnapshot();

      if (requestId !== contractsLoadRequestIdRef.current) {
        return null;
      }

      setContracts(snapshot.contracts);
      setHolders(snapshot.holdersByContractId);
      setDependentsByContract(snapshot.dependentsByContractId);
      setContractsLoadError(null);
      setContractsLoadWarning(snapshot.failedSources.length > 0
        ? "A lista de contratos foi carregada, mas alguns titulares ou dependentes não puderam ser atualizados."
        : null);
      return snapshot.contracts;
    } catch (error) {
      if (requestId === contractsLoadRequestIdRef.current) {
        console.error("Erro ao carregar contratos:", error);
        setContractsLoadError("Não foi possível carregar os contratos agora.");
        setContractsLoadWarning(null);
      }
      return null;
    } finally {
      if (requestId === contractsLoadRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleContractsUpdated = async () => {
    const updatedContracts = await loadContracts();
    if (!updatedContracts) return;
    setSelectedContract((current) => {
      if (!current) return current;
      return updatedContracts.find((contractItem) => contractItem.id === current.id) || null;
    });
  };

  const handleBulkJsonImport = async (
    contractsToImport: ContractJsonBulkImportPayload["contracts"],
  ) => {
    try {
      await createContractRecordsBulk(contractsToImport);
      toast.success(`${contractsToImport.length} contrato(s) importado(s).`);
      await loadContracts();
    } catch (error) {
      console.error("Erro ao importar contratos em massa:", error);
      if (error instanceof Error && error.message.includes("Nenhum contrato do lote foi incluído")) {
        throw error;
      }
      throw new Error("Não foi possível importar o lote. Verifique os dados e tente novamente.");
    }
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

  const handleDeleteContract = async (contract: Contract) => {
    if (deletingContractIdsRef.current.has(contract.id)) return;

    const confirmed = await requestConfirmation({
      title: "Excluir contrato",
      description: `Deseja excluir o contrato ${contract.codigo_contrato}? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;
    if (deletingContractIdsRef.current.has(contract.id)) return;

    deletingContractIdsRef.current.add(contract.id);
    setDeletingContractIds((current) => new Set(current).add(contract.id));

    try {
      await deleteContract(contract.id);

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
    } finally {
      deletingContractIdsRef.current.delete(contract.id);
      setDeletingContractIds((current) => {
        const next = new Set(current);
        next.delete(contract.id);
        return next;
      });
    }
  };

  const renderDateBadges = (contract: Contract, compact = false) => {
    const participants = [
      ...(holders[contract.id] || []),
      ...(dependentsByContract[contract.id] || []),
    ];
    const shortLabels: Record<string, string> = {
      activation: "Ativação",
      "fidelity-ended": "Fidelidade",
      "fidelity-upcoming": "Fidelidade",
      "annual-adjustment-count": "Reajuste",
      "age-adjustment-count": "Faixa etária",
      adjustment: "Reajuste",
      commission: "Comissão",
      bonus: "Bônus",
    };
    const badges = getContractManagerHighlightBadges(contract, participants).map((badge) => {
      const badgeElement = (
        <Badge
          tone={badge.tone}
          size="sm"
          className={compact ? "px-3 py-1 text-xs" : "max-w-full whitespace-normal break-words px-3 py-1 text-left text-xs"}
        >
          {compact ? shortLabels[badge.key] ?? badge.label : badge.label}
        </Badge>
      );

      return compact ? (
        <Tooltip key={`${contract.id}-${badge.key}`} content={badge.label} size="sm">
          {badgeElement}
        </Tooltip>
      ) : (
        <span key={`${contract.id}-${badge.key}`}>{badgeElement}</span>
      );
    });

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
  const sortedContracts = useSortedTableRows(filteredContracts, sorting, (contract, key) => {
    switch (key) {
      case "contract": return contract.codigo_contrato ?? "";
      case "status": return contract.status ?? "";
      case "plan": return `${contract.operadora ?? ""} ${contract.produto_plano ?? ""}`;
      case "monthly": return contract.mensalidade_total ?? null;
      case "start": return contract.data_inicio ?? null;
      case "renewal": return contract.data_renovacao ?? null;
      case "owner": return contract.responsavel ?? "";
    }
  });
  const paginatedContracts = sortedContracts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const portfolioSummary = useMemo(() => {
    const implementationStatuses = new Set([
      'rascunho',
      'em análise',
      'documentos pendentes',
      'proposta enviada',
      'aguardando assinatura',
      'emitido',
    ]);
    return contracts.reduce(
      (summary, contract) => {
        const status = contract.status.trim().toLocaleLowerCase('pt-BR');
        if (status === 'ativo') summary.active += 1;
        if (implementationStatuses.has(status)) summary.implementation += 1;
        if (hasUpcomingImportantDate(contract)) summary.upcoming += 1;
        summary.monthlyTotal += contract.mensalidade_total ?? 0;
        return summary;
      },
      { active: 0, implementation: 0, upcoming: 0, monthlyTotal: 0 },
    );
  }, [contracts]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      filterStatus !== 'todos' ||
      filterResponsavel !== 'todos' ||
      filterOperadora !== 'todas' ||
      dateProximityFilter !== 'todos',
  );

  const handleExportContracts = () => {
    const headers = [
      'Contrato',
      'Cliente',
      'Status',
      'Operadora',
      'Plano',
      'Modalidade',
      'Mensalidade',
      'Comissão prevista',
      'Responsável',
      'Início',
      'Fim da fidelidade',
    ];
    const rows = filteredContracts.map((contract) => [
      contract.codigo_contrato,
      getContractDisplayName(contract),
      contract.status,
      normalizeOperadoraLabel(contract.operadora),
      formatContractPlanLabel(contract.produto_plano) ?? contract.produto_plano,
      formatContractModalityLabel(contract.modalidade) ?? contract.modalidade,
      contract.mensalidade_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '',
      contract.comissao_prevista?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '',
      contract.responsavel,
      contract.data_inicio ? formatDate(contract.data_inicio) ?? '' : '',
      contract.data_renovacao ? formatDate(contract.data_renovacao, 'monthYear') ?? '' : '',
    ]);
    const today = new Date().toISOString().slice(0, 10);
    downloadXlsx(`contratos-${today}.xlsx`, headers, rows, 'Contratos');
  };

  const getContractActions = (contract: Contract) => [
    {
      label: 'Abrir contrato',
      icon: Eye,
      onClick: () => setSelectedContract(contract),
    },
    ...(canEditContracts
      ? [{
          label: 'Excluir contrato',
          icon: Trash2,
          onClick: () => void handleDeleteContract(contract),
          destructive: true,
          loading: deletingContractIds.has(contract.id),
        }]
      : []),
  ];

  const getStatusTone = (status: string): PanelTone => {
    const tones: Record<string, PanelTone> = {
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
    };

    return tones[status] ?? "neutral";
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
      overlayLabel="Atualizando contratos..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={contractsRootRef}
        className="kds-contracts-page panel-dashboard-immersive panel-page-shell space-y-5"
      >
        {!showForm && <>
        <PageHeader
          className="kds-contracts-header"
          eyebrow="Kifer Saúde / Operação comercial"
          title="Gestão de contratos"
          description="Gerencie clientes, vigências, titulares e dependentes em um só lugar."
          actions={canEditContracts ? (
            <div className="kds-contracts-header-actions">
              <RecordActions
                actions={[{ label: 'Importar contratos em massa', icon: FileUp, onClick: () => setShowBulkImport(true) }]}
                visibleCount={1}
                label="Ações dos contratos"
              />
              <Button
                onClick={() => {
                  setEditingContract(null);
                  setShowForm(true);
                }}
              >
                <Plus className="kds-control-icon" />
                <span>Novo contrato</span>
              </Button>
            </div>
          ) : undefined}
          data-panel-animate
        />

        <div className="kds-kpi-grid kds-contracts-summary-grid grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo da carteira de contratos">
          <KpiCard
            padding="sm"
            title="Contratos ativos"
            value={<span className="tabular-nums">{portfolioSummary.active}</span>}
            trend="Contratos vigentes"
            className="h-full"
          />
          <KpiCard
            padding="sm"
            title="Em implantação"
            value={<span className="tabular-nums">{portfolioSummary.implementation}</span>}
            trend="Em análise ou emissão"
            className="h-full"
          />
          <KpiCard
            padding="sm"
            title="Próximos vencimentos"
            value={<span className="tabular-nums">{portfolioSummary.upcoming}</span>}
            trend="Nos próximos 30 dias"
            className="h-full"
          />
          <KpiCard
            padding="sm"
            title="Mensalidade total"
            value={<span className="tabular-nums">{portfolioSummary.monthlyTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
            trend="Soma dos valores informados"
            className="h-full"
          />
        </div>

        {contractsLoadError && (
          <Alert
            tone="danger"
            title="Não foi possível carregar os contratos"
            action={(
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadContracts()} loading={loading}>
                Tentar novamente
              </Button>
            )}
          >
            Os dados exibidos anteriormente foram preservados. Tente novamente para atualizar a carteira.
          </Alert>
        )}

        {contractsLoadWarning && (
          <Alert
            tone="warning"
            title="Dados complementares incompletos"
            action={(
              <Button type="button" variant="secondary" size="sm" onClick={() => void loadContracts()} loading={loading}>
                Tentar novamente
              </Button>
            )}
          >
            {contractsLoadWarning}
          </Alert>
        )}

        <Surface className="kds-record-filters space-y-3" data-panel-animate>
          <Toolbar className="kds-contracts-search-toolbar">
            <ToolbarSearch className="relative">
              <Input
                type="text"
                leftIcon={Search}
                placeholder="Buscar por cliente, contrato, CNPJ ou plano..."
                aria-label="Buscar contratos"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </ToolbarSearch>
            <ToolbarActions className="kds-contracts-toolbar-actions">
              {hasActiveFilters && (
                <Button
                  type="button"
                  onClick={resetFilters}
                  variant="secondary"
                  size="md"
                  className="whitespace-nowrap"
                >
                  Limpar filtros
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={handleExportContracts} className="kds-contract-export">
                <Download className="kds-control-icon" aria-hidden="true" />
                Exportar
              </Button>
            </ToolbarActions>
          </Toolbar>

          <div className="kds-contracts-filter-grid grid grid-cols-2 gap-3 xl:grid-cols-4">
            <FilterSelect
              icon={Filter}
              value={filterStatus}
              onChange={(value) => setFilterStatus(value)}
              placeholder="Todos os status"
              includePlaceholderOption={false}
              neutralValues={["todos"]}
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

            <FilterSelect
              icon={Users}
              value={filterResponsavel}
              onChange={(value) => setFilterResponsavel(value)}
              placeholder="Todos os responsáveis"
              includePlaceholderOption={false}
              neutralValues={["todos"]}
              options={[
                { value: "todos", label: "Todos os responsáveis" },
                ...responsavelFilterOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />

            <FilterSelect
              icon={Calendar}
              value={dateProximityFilter}
              onChange={(value) =>
                setDateProximityFilter(value as "todos" | "proximos-30")
              }
              placeholder="Todos os períodos"
              includePlaceholderOption={false}
              neutralValues={["todos"]}
              options={[
                { value: "todos", label: "Todos os períodos" },
                { value: "proximos-30", label: "Próximos 30 dias" },
              ]}
            />
            <Button
              type="button"
              variant={advancedFiltersOpen || filterOperadora !== 'todas' ? 'soft' : 'secondary'}
              aria-expanded={advancedFiltersOpen}
              aria-controls="contracts-advanced-filters"
              onClick={() => setAdvancedFiltersOpen((open) => !open)}
            >
              <Filter className="kds-control-icon" aria-hidden="true" />
              Mais filtros{filterOperadora !== 'todas' ? ' · 1' : ''}
            </Button>
          </div>
          {advancedFiltersOpen && (
            <div id="contracts-advanced-filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                icon={FileText}
                value={filterOperadora}
                onChange={(value) => setFilterOperadora(value)}
                placeholder="Todas as operadoras"
                includePlaceholderOption={false}
                neutralValues={["todas"]}
                options={[
                  { value: "todas", label: "Todas as operadoras" },
                  ...operadoraOptions.map((operadora) => ({
                    value: operadora,
                    label: operadora,
                  })),
                ]}
              />
            </div>
          )}
        </Surface>

        <Surface className="kds-record-results kds-contracts-results" padding="none" data-panel-animate>
          <SectionHeader
            eyebrow="Carteira contratual"
            title="Contratos em acompanhamento"
            description="Monitore vigência, reajustes, titulares e previsões financeiras sem perder o contexto do responsável comercial."
            as="h3"
            className="kds-contracts-results-header mb-4"
            action={(
              <div className="flex flex-wrap gap-2">
                <OperationalMetricChip value={filteredContracts.length} label="resultados" />
                <OperationalMetricChip value={`${currentPage}/${totalPages}`} label="páginas" />
              </div>
            )}
          />

          <div className="hidden lg:block">
            <Table size="sm" stickyHeader aria-label="Carteira de contratos" className="min-w-[75rem]" columnWidths={['18%', '12%', '18%', '16%', '15%', '10%', '11%']}>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Contrato" sortDirection={sorting.key === "contract" ? sorting.direction : null} onSort={() => sortBy("contract")} />
                  <SortableTableHead label="Status" sortDirection={sorting.key === "status" ? sorting.direction : null} onSort={() => sortBy("status")} />
                  <SortableTableHead label="Operadora e plano" sortDirection={sorting.key === "plan" ? sorting.direction : null} onSort={() => sortBy("plan")} />
                  <SortableTableHead label="Financeiro" sortDirection={sorting.key === "monthly" ? sorting.direction : null} onSort={() => sortBy("monthly")} />
                  <SortableTableHead label="Datas críticas" sortDirection={sorting.key === "renewal" ? sorting.direction : null} onSort={() => sortBy("renewal")} />
                  <SortableTableHead label="Responsável" sortDirection={sorting.key === "owner" ? sorting.direction : null} onSort={() => sortBy("owner")} />
                  <TableHead align="right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={<FileText className="h-8 w-8" />} title="Nenhum contrato encontrado" description="Tente ajustar os filtros ou adicione um novo contrato." />
                    </TableCell>
                  </TableRow>
                )}
                {paginatedContracts.map((contract) => {
                  const bonusValue = getBonusValue(contract);

                  return (
                    <TableRow key={contract.id} className="align-middle">
                    <TableCell className="overflow-hidden">
                      <ActionSurface variant="plain" padding="none"
                        type="button"
                        onClick={() => setSelectedContract(contract)}
                        className="block w-full min-w-0 overflow-hidden text-left transition-colors hover:text-[var(--brand-primary)]"
                        title={getContractDisplayName(contract)}
                      >
                        <span className="block max-w-full truncate font-semibold text-[var(--text-primary)]">{contract.codigo_contrato}</span>
                        <span className="mt-1 block max-w-full truncate text-xs text-[var(--text-muted)]">{getContractDisplayName(contract)}</span>
                      </ActionSurface>
                    </TableCell>
                    <TableCell>
                      <ContractStatusDropdown
                        status={contract.status}
                        code={contract.codigo_contrato}
                        tone={getStatusTone(contract.status)}
                        getOptionTone={getStatusTone}
                        canEdit={canEditContracts}
                        saving={savingIds.has(contract.id)}
                        options={statusOptions}
                        operators={productionOperators}
                        operatorError={productionOperatorsError}
                        onChange={(status, saleOperator) => canEditContracts ? changeStatus(contract, status, saleOperator) : Promise.resolve()}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-[var(--text-secondary)]">{normalizeOperadoraLabel(contract.operadora) || "Sem operadora"}</span>
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">{formatContractPlanLabel(contract.produto_plano) || "Sem plano"}{contract.modalidade ? ` · ${formatContractModalityLabel(contract.modalidade) ?? contract.modalidade}` : ""}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-[var(--text-primary)]">{contract.mensalidade_total != null ? `R$ ${contract.mensalidade_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Mensalidade não informada"}</span>
                      {contract.comissao_prevista != null && <span className="mt-1 block text-xs text-[var(--text-muted)]">Comissão: R$ {contract.comissao_prevista.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{bonusValue !== null ? ` · Bônus: R$ ${bonusValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</span>}
                    </TableCell>
                    <TableCell>
                      {renderDateBadges(contract, true) ?? <span className="text-[var(--text-muted)]">Sem destaque</span>}
                    </TableCell>
                    <TableCell>{formatContractEntityName(contract.responsavel) || "Não atribuído"}</TableCell>
                      <TableCell align="right">
                        <RecordActions actions={getContractActions(contract)} visibleCount={1} label={`Ações do contrato ${contract.codigo_contrato}`} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {filteredContracts.length === 0 && <EmptyState icon={<FileText className="h-8 w-8" />} title="Nenhum contrato encontrado" description="Tente ajustar os filtros ou adicione um novo contrato." />}
            {paginatedContracts.map((contract) => {
              const bonusValue = getBonusValue(contract);

              return (
                <Surface key={contract.id} variant="default" padding="sm" className="space-y-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <ActionSurface variant="plain" padding="none" onClick={() => setSelectedContract(contract)} className="block max-w-full text-left">
                        <Heading level={3} className="truncate text-base font-semibold text-[var(--text-primary)]">
                          {contract.codigo_contrato}
                        </Heading>
                        <Text className="mt-1 truncate text-sm text-[var(--text-secondary)]">{getContractDisplayName(contract)}</Text>
                      </ActionSurface>
                    </div>
                    <ContractStatusDropdown
                      status={contract.status}
                      code={contract.codigo_contrato}
                      tone={getStatusTone(contract.status)}
                      getOptionTone={getStatusTone}
                      canEdit={canEditContracts}
                      saving={savingIds.has(contract.id)}
                      options={statusOptions}
                      operators={productionOperators}
                      operatorError={productionOperatorsError}
                      onChange={(status, saleOperator) => canEditContracts ? changeStatus(contract, status, saleOperator) : Promise.resolve()}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="block text-xs text-[var(--text-muted)]">Operadora</span>
                      <span className="block truncate font-medium text-[var(--text-secondary)]">{normalizeOperadoraLabel(contract.operadora)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs text-[var(--text-muted)]">Plano</span>
                      <span className="block truncate font-medium text-[var(--text-secondary)]">{formatContractPlanLabel(contract.produto_plano) ?? contract.produto_plano}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs text-[var(--text-muted)]">Mensalidade</span>
                      <span className="block truncate font-semibold text-[var(--text-primary)]">{contract.mensalidade_total != null ? `R$ ${contract.mensalidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não informada'}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs text-[var(--text-muted)]">Responsável</span>
                      <span className="block truncate font-medium text-[var(--text-secondary)]">{formatContractEntityName(contract.responsavel) || 'Não atribuído'}</span>
                    </div>
                  </div>

                  {contract.data_renovacao && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span>Fim da fidelidade</span>
                      <Badge tone="neutral" size="sm">{formatDate(contract.data_renovacao, 'monthYear')}</Badge>
                    </div>
                  )}

                  <details className="kds-contract-card-details border-t border-[var(--border-subtle)] pt-2">
                    <summary className="cursor-pointer text-sm font-medium text-[var(--text-secondary)]">Mais informações</summary>
                    <div className="mt-3 space-y-3 text-sm text-[var(--text-secondary)]">
                      <div className="grid grid-cols-2 gap-3">
                        <span>Modalidade: {formatContractModalityLabel(contract.modalidade) ?? contract.modalidade}</span>
                        <span>Criado em: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</span>
                        {contract.comissao_prevista != null && <span>Comissão prevista: R$ {contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                        {bonusValue !== null && <span>Bônus: R$ {bonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                        {contract.mes_reajuste && <span>Mês de reajuste: {formatDate(contract.mes_reajuste.toString(), 'monthOnly')}</span>}
                        {contract.previsao_recebimento_comissao && <span>Prev. comissão: {formatDate(contract.previsao_recebimento_comissao)}</span>}
                        {contract.previsao_pagamento_bonificacao && <span>Prev. bonificação: {formatDate(contract.previsao_pagamento_bonificacao)}</span>}
                      </div>
                      {renderDateBadges(contract)}
                    </div>
                  </details>

                  <div className="flex justify-end border-t border-[var(--border-subtle)] pt-2">
                    <RecordActions actions={getContractActions(contract)} visibleCount={1} label={`Ações do contrato ${contract.codigo_contrato}`} />
                  </div>
                </Surface>
              );
            })}

          </div>

          {filteredContracts.length > 0 && (
            <Pagination
              className="kds-contracts-results-pagination"
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredContracts.length}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </Surface>

        </>}
        {showForm && (
          <ContractForm
            presentation="page"
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

        {showBulkImport && canEditContracts && (
          <ContractBulkJsonImportDialog
            onImport={handleBulkJsonImport}
            onClose={() => setShowBulkImport(false)}
          />
        )}

        {selectedContract && (
          <ContractDetails
            presentation="drawer"
            key={selectedContract.id}
            contract={selectedContract}
            onClose={() => setSelectedContract(null)}
            onUpdate={handleContractsUpdated}
            onDelete={handleDeleteContract}
            holderSectionAction={role === "admin" ? <HolderImportPreparation contract={selectedContract} /> : null}
          />
        )}
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
