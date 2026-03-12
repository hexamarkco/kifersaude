import { Archive, BookOpen, Clock3, Plus, RefreshCw } from "lucide-react";

import Button from "../../../components/ui/Button";
import Tabs from "../../../components/ui/Tabs";
import { getPanelButtonClass } from "../../../components/ui/standards";
import { VIEW_MODE_TABS } from "../shared/leadsManagerConfig";
import { LEADS_PILL_STYLE } from "../shared/leadsManagerStyles";
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
    <div className="flex flex-col gap-4" data-panel-animate>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p
            className="text-[11px] font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--panel-text-muted,#876f5c)" }}
          >
            Operacao comercial
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2
              className="text-2xl font-bold sm:text-3xl"
              style={{ color: "var(--panel-text,#1c1917)" }}
            >
              Gestao de Leads
            </h2>
            {showArchived && (
              <span
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...LEADS_PILL_STYLE,
                  color: "var(--panel-accent-ink,#6f3f16)",
                }}
              >
                Arquivados
              </span>
            )}
          </div>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--panel-text-muted,#876f5c)" }}
          >
            Acompanhe a carteira, priorize retornos e mantenha o funil em ritmo
            constante.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              ...LEADS_PILL_STYLE,
              color: "var(--panel-text-soft,#5b4635)",
            }}
          >
            <span style={{ color: "var(--panel-text,#1c1917)" }}>
              {filteredLeadCount}
            </span>
            <span>leads no recorte</span>
          </span>
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              ...LEADS_PILL_STYLE,
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
              ...LEADS_PILL_STYLE,
              color: "var(--panel-text-soft,#5b4635)",
            }}
          >
            <span style={{ color: "var(--panel-text,#1c1917)" }}>
              {viewMode === "kanban" ? "Kanban" : "Lista"}
            </span>
            <span>modo atual</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            items={VIEW_MODE_TABS}
            value={viewMode}
            onChange={onViewModeChange}
            variant="panel"
            listClassName="w-full sm:w-auto"
            triggerClassName="flex-1 sm:flex-initial"
          />

          <div
            className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"
            style={{
              ...LEADS_PILL_STYLE,
              color: "var(--panel-text-soft,#5b4635)",
            }}
          >
            <Clock3
              className="h-4 w-4"
              style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
            />
            <span>{lastUpdatedLabel || "Aguardando atualizacao..."}</span>
          </div>
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
    </div>
  );
}
