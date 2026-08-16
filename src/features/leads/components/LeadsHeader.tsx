import { BookOpen, Clock3, Filter, LayoutList, Plus, RefreshCw, Users } from "lucide-react";

import { Button, OperationalMetricChip, PageHeader, getPanelButtonClass } from "../../../design-system";
import { VIEW_MODE_TABS } from "../shared/leadsManagerConfig";
import type { LeadsViewMode } from "../shared/leadsManagerTypes";

type LeadsHeaderProps = {
  viewMode: LeadsViewMode;
  loading: boolean;
  lastUpdatedLabel: string;
  filteredLeadCount: number;
  activeFilterCount: number;
  canEditLeads: boolean;
  onViewModeChange: (value: LeadsViewMode) => void;
  onRefresh: () => void;
  onCreateLead: () => void;
};

export function LeadsHeader({
  viewMode,
  loading,
  lastUpdatedLabel,
  filteredLeadCount,
  activeFilterCount,
  canEditLeads,
  onViewModeChange,
  onRefresh,
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
          <div className="flex items-center gap-1 rounded-full bg-[var(--bg-hover)] p-1">
            {VIEW_MODE_TABS.map((tab) => {
              const isActive = tab.id === viewMode;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onViewModeChange(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:flex-initial ${
                    isActive
                      ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  {tab.label}
                </button>
              );
            })}
          </div>

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
              size: "md",
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
            size="md"
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            type="button"
            onClick={onCreateLead}
            disabled={!canEditLeads}
            size="md"
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
