import { Archive, BookOpen, Clock3, Filter, LayoutList, Plus, RefreshCw, Users } from "lucide-react";

import { Badge, Button, OperationalMetricChip, PageHeader, Tabs, getPanelButtonClass } from "../../../design-system";
import { VIEW_MODE_TABS } from "../shared/leadsManagerConfig";
import type { LeadsViewMode } from "../shared/leadsManagerTypes";

type LeadsHeaderProps = {
  showArchived: boolean;
  viewMode: LeadsViewMode;
  loading: boolean;
  lastUpdatedLabel: string;
  filteredLeadCount: number;
  activeFilterCount: number;
  canEditLeads: boolean;
  onViewModeChange: (value: LeadsViewMode) => void;
  onRefresh: () => void;
  onToggleArchived: () => void;
  onCreateLead: () => void;
};

export function LeadsHeader({
  showArchived,
  viewMode,
  loading,
  lastUpdatedLabel,
  filteredLeadCount,
  activeFilterCount,
  canEditLeads,
  onViewModeChange,
  onRefresh,
  onToggleArchived,
  onCreateLead,
}: LeadsHeaderProps) {
  return (
    <PageHeader
      eyebrow="Operacao comercial"
      title="Gestao de Leads"
      description="Acompanhe a carteira, priorize retornos e mantenha o funil em ritmo constante."
      data-panel-animate
      actions={(
        <>
          {showArchived && <Badge tone="accent">Arquivados</Badge>}
          <OperationalMetricChip
            icon={<Users className="h-3.5 w-3.5" />}
            value={filteredLeadCount}
            label="leads no recorte"
          />
          <OperationalMetricChip
            icon={<Filter className="h-3.5 w-3.5" />}
            value={activeFilterCount}
            label={activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}
            active={activeFilterCount > 0}
          />
          <OperationalMetricChip
            icon={<LayoutList className="h-3.5 w-3.5" />}
            value={viewMode === "kanban" ? "Kanban" : "Lista"}
            label="modo atual"
          />
        </>
      )}
    >
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            items={VIEW_MODE_TABS}
            value={viewMode}
            onChange={onViewModeChange}
            variant="panel"
            listClassName="w-full sm:w-auto"
            triggerClassName="flex-1 sm:flex-initial"
          />

          <OperationalMetricChip
            icon={<Clock3 className="h-3.5 w-3.5" />}
            value={lastUpdatedLabel || "Aguardando atualizacao..."}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className={getPanelButtonClass({
              variant: "secondary",
              size: "sm",
              className: "w-full sm:w-auto",
            })}
            title="Documentacao da API"
          >
            <BookOpen className="h-4 w-4" />
            <span>API Docs</span>
          </a>

          <Button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            type="button"
            onClick={onToggleArchived}
            variant={showArchived ? "warning" : "soft"}
            size="sm"
            className="w-full sm:w-auto"
            aria-pressed={showArchived}
          >
            <Archive className="h-4 w-4" />
            <span>{showArchived ? "Ver ativos" : "Ver arquivados"}</span>
          </Button>

          <Button
            type="button"
            onClick={onCreateLead}
            disabled={!canEditLeads}
            size="sm"
            className="w-full sm:w-auto"
            title={
              !canEditLeads
                ? "Voce nao tem permissao para criar leads"
                : "Criar novo lead"
            }
          >
            <Plus className="h-4 w-4" />
            <span>Novo Lead</span>
          </Button>
        </div>
      </div>
    </PageHeader>
  );
}
