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
            listClassName="w-full flex-nowrap md:w-auto"
            triggerClassName="min-w-0 flex-1 whitespace-nowrap md:flex-initial"
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
