import { BookOpen, Plus } from "lucide-react";

import { Button, PageHeader, Tabs, getPanelButtonClass } from "../../../design-system";
import { VIEW_MODE_TABS } from "../shared/leadsManagerConfig";
import type { LeadsViewMode } from "../shared/leadsManagerTypes";

type LeadsHeaderProps = {
  viewMode: LeadsViewMode;
  canEditLeads: boolean;
  onViewModeChange: (value: LeadsViewMode) => void;
  onCreateLead: () => void;
};

export function LeadsHeader({
  viewMode,
  canEditLeads,
  onViewModeChange,
  onCreateLead,
}: LeadsHeaderProps) {
  return (
    <PageHeader
      eyebrow="Operacao comercial"
      title="Gestao de Leads"
      description="Acompanhe a carteira, priorize retornos e mantenha o funil em ritmo constante."
      actions={(
        <a
          href="/api-docs.html"
          target="_blank"
          rel="noopener noreferrer"
          className={getPanelButtonClass({
            variant: "text",
            size: "sm",
            className: "h-auto min-h-0 w-auto px-0 py-1 text-sm",
          })}
          title="Abrir documentacao da API"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>API Docs</span>
        </a>
      )}
      data-panel-animate
    >
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Tabs
            items={VIEW_MODE_TABS}
            value={viewMode}
            onChange={onViewModeChange}
            variant="pill"
            size="sm"
            className="kds-leads-view-tabs w-full md:w-auto"
            listClassName="w-full min-w-[17rem] max-w-full flex-nowrap md:w-auto md:min-w-0"
            triggerClassName="min-w-0 flex-1 whitespace-nowrap px-3 md:flex-initial md:px-4"
          />

        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
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
