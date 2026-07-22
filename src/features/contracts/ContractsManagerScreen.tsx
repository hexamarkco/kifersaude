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
import {
  Badge,
  Button,
  Field,
  Input,
  OperationalMetricChip,
  PageHeader,
  SectionHeader,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  type PanelTone,
} from "../../design-system";
import { useConfirmationModal } from "../../hooks/useConfirmationModal";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { ContractsPageSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
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
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

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
      stageLabel="Carregando contratos..."
      overlayLabel="Atualizando contratos..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={contractsRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-5"
      >
        <PageHeader
          eyebrow="Operação contratual"
          title="Gestão de Contratos"
          description="Organize contratos ativos, datas críticas e responsáveis com a mesma leitura operacional do dashboard comercial."
          data-panel-animate
          actions={(
            <>
              <OperationalMetricChip value={filteredContracts.length} label="contratos no recorte" />
              <OperationalMetricChip
                icon={<AlertCircle className="h-3.5 w-3.5" />}
                value={upcomingImportantCount}
                label="com data sensivel"
                tone={upcomingImportantCount > 0 ? "warning" : "neutral"}
                active={upcomingImportantCount > 0}
              />
              <OperationalMetricChip
                icon={<Layers className="h-3.5 w-3.5" />}
                value={activeFilterCount}
                label={activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
                tone={activeFilterCount > 0 ? "accent" : "neutral"}
                active={activeFilterCount > 0}
              />
            </>
          )}
        >
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <OperationalMetricChip
              icon={<Clock3 className="h-3.5 w-3.5" />}
              value={lastUpdatedLabel}
            />

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
        </PageHeader>

        <Surface className="space-y-5" data-panel-animate>
          <Surface variant="muted" padding="none" className="kds-op-toolbar">
            <div className="kds-op-toolbar-search relative">
              <Input
                type="text"
                leftIcon={Search}
                placeholder="Buscar por codigo, empresa, CNPJ, beneficiario, operadora ou plano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="kds-op-toolbar-actions">
              <Button
                type="button"
                onClick={resetFilters}
                variant="soft"
                size="sm"
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4" />
                Limpar
              </Button>
              <OperationalMetricChip value={filteredContracts.length} label="contratos" />
            </div>
          </Surface>

          <div>
            <p className="kds-op-section-label mb-3">Filtros principais</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Status">
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
              </Field>

              <Field label="Responsável">
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
              </Field>

              <Field label="Operadora">
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
              </Field>

              <Field label="Datas importantes">
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
              </Field>
            </div>
          </div>
        </Surface>

        <Surface data-panel-animate>
          <SectionHeader
            eyebrow="Carteira contratual"
            title="Contratos em acompanhamento"
            description="Monitore vigencia, reajustes, titulares e previsoes financeiras sem perder contexto do responsavel comercial."
            as="h3"
            className="mb-4"
            action={(
              <div className="flex flex-wrap gap-2">
                <OperationalMetricChip value={filteredContracts.length} label="resultados" />
                <OperationalMetricChip value={`${currentPage}/${totalPages}`} label="paginas" />
              </div>
            )}
          />

          <div className="hidden lg:block">
            <Table size="sm" stickyHeader className="kds-table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Operadora e plano</TableHead>
                  <TableHead>Financeiro</TableHead>
                  <TableHead>Datas críticas</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead align="right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Surface variant="muted" className="py-12 text-center">
                        <FileText className="mx-auto mb-4 h-16 w-16 text-[var(--text-muted)]" />
                        <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">Nenhum contrato encontrado</h3>
                        <p className="text-[var(--text-secondary)]">Tente ajustar os filtros ou adicione um novo contrato.</p>
                      </Surface>
                    </TableCell>
                  </TableRow>
                )}
                {paginatedContracts.map((contract) => {
                  const bonusValue = getBonusValue(contract);

                  return (
                    <TableRow key={contract.id} className="align-middle">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedContract(contract)}
                        className="block max-w-64 text-left transition-colors hover:text-[var(--brand-primary)]"
                      >
                        <span className="block truncate font-semibold text-[var(--text-primary)]">{contract.codigo_contrato}</span>
                        <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{getContractDisplayName(contract)}</span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge tone={getStatusTone(contract.status)} size="sm">{contract.status}</Badge>
                      <span className="mt-2 block text-xs text-[var(--text-muted)]">{contract.modalidade}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-[var(--text-secondary)]">{normalizeOperadoraLabel(contract.operadora) || "Sem operadora"}</span>
                      <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{contract.produto_plano || "Sem plano"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-[var(--text-primary)]">{contract.mensalidade_total ? `R$ ${contract.mensalidade_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Mensalidade não informada"}</span>
                      {contract.comissao_prevista && <span className="mt-1 block text-xs text-[var(--text-muted)]">Comissão: R$ {contract.comissao_prevista.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{bonusValue !== null ? ` · Bônus: R$ ${bonusValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">{renderDateBadges(contract, true)}</div>
                    </TableCell>
                    <TableCell>{contract.responsavel || "Não atribuído"}</TableCell>
                      <TableCell align="right">
                        <div className="flex justify-end gap-1">
                          <Button onClick={() => setSelectedContract(contract)} variant="secondary" size="icon" title="Abrir contrato" aria-label="Abrir contrato"><Eye className="h-4 w-4" /></Button>
                          {canEditContracts && <Button onClick={() => handleDeleteContract(contract)} variant="danger" size="icon" title="Excluir contrato" aria-label="Excluir contrato"><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {paginatedContracts.map((contract) => {
              const bonusValue = getBonusValue(contract);

              return (
                <Surface
                  key={contract.id}
                  variant="muted"
                  padding="sm"
                  className="transition-colors sm:p-4"
                >
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                          {contract.codigo_contrato}
                        </h3>
                        <Badge tone={getStatusTone(contract.status)} size="sm" className="px-3 py-1 text-xs">
                          {contract.status}
                        </Badge>
                        <Badge tone="neutral" size="sm" className="px-3 py-1 text-xs">
                          {contract.modalidade}
                        </Badge>
                        {contract.comissao_multiplicador &&
                          contract.comissao_multiplicador !== 2.8 && (
                            <Badge tone="warning" size="sm" className="gap-1 px-3 py-1 text-xs">
                              <AlertCircle className="h-3 w-3" />
                              <span>{contract.comissao_multiplicador}x</span>
                            </Badge>
                          )}
                        {renderDateBadges(contract)}
                      </div>
                      <div className="mb-3">
                        <span className="font-medium text-[var(--text-secondary)]">
                          {getContractDisplayName(contract)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2 xl:grid-cols-5">
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
                              <Badge tone="warning" size="sm">
                                Parcelada
                              </Badge>
                            ) : contract.comissao_recebimento_adiantado ? (
                              <Badge tone="success" size="sm">
                                Adiantada
                              </Badge>
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
                    <div className="text-sm text-[var(--text-muted)] lg:text-right">
                      <div>
                        Responsável:{" "}
                        <span className="font-medium text-[var(--text-secondary)]">
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
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-4 sm:justify-start">
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
                </Surface>
              );
            })}

            {filteredContracts.length === 0 && (
              <Surface variant="muted" className="py-12 text-center" data-panel-animate>
                <FileText className="mx-auto mb-4 h-16 w-16 text-[var(--text-muted)]" />
                <h3 className="mb-2 text-lg font-medium text-[var(--text-primary)]">
                  Nenhum contrato encontrado
                </h3>
                <p className="text-[var(--text-secondary)]">
                  Tente ajustar os filtros ou adicione um novo contrato.
                </p>
              </Surface>
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
        </Surface>

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
