import { Archive, BookOpen, Clock3, Plus, RefreshCw } from "lucide-react";

import { Badge, Button, PageHeader, Tabs, getPanelButtonClass } from "../../../design-system";
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
          <Badge tone="neutral" className="gap-2">
            <span style={{ color: "var(--panel-text)" }}>{filteredLeadCount}</span>
            <span>leads no recorte</span>
          </Badge>
          <Badge tone={activeFilterCount > 0 ? "accent" : "neutral"} className="gap-2">
            <span style={{ color: "var(--panel-text)" }}>{activeFilterCount}</span>
            <span>{activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}</span>
          </Badge>
          <Badge tone="neutral" className="gap-2">
            <span style={{ color: "var(--panel-text)" }}>
              {viewMode === "kanban" ? "Kanban" : "Lista"}
            </span>
            <span>modo atual</span>
          </Badge>
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

          <Badge tone="neutral" className="h-11 gap-2 px-3 text-sm normal-case tracking-normal">
            <Clock3
              className="h-4 w-4"
              style={{ color: "var(--panel-accent-strong)" }}
            />
            <span>{lastUpdatedLabel || "Aguardando atualizacao..."}</span>
          </Badge>
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
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            type="button"
            onClick={onToggleArchived}
            variant={showArchived ? "warning" : "soft"}
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
