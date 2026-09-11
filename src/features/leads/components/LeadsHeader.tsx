import { BookOpen, Plus } from "lucide-react";

import {
  Button,
  PageHeader,
  getPanelButtonClass,
  SegmentedControl,
} from "../../../design-system";
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
      eyebrow="Operação comercial"
      title="Gestão de leads"
      description="Acompanhe a carteira, priorize retornos e mantenha o funil em ritmo constante."
      actions={(
        <div className="flex w-full flex-wrap items-center justify-between gap-2 lg:w-auto lg:justify-end">
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
          <Button
            type="button"
            onClick={onCreateLead}
            disabled={!canEditLeads}
            size="md"
            title={
              !canEditLeads
                ? "Você não tem permissão para criar leads"
                : "Criar novo lead"
            }
          >
            <Plus className="kds-control-icon" />
            <span>Novo lead</span>
          </Button>
        </div>
      )}
      data-panel-animate
    >
      <SegmentedControl
        items={VIEW_MODE_TABS}
        value={viewMode}
        onChange={onViewModeChange}
        size="sm"
        className="kds-leads-view-tabs w-full md:w-auto"
        listClassName="w-full min-w-[17rem] max-w-full flex-nowrap md:w-auto md:min-w-0"
        triggerClassName="min-w-0 flex-1 whitespace-nowrap px-3 md:flex-initial md:px-4"
      />
    </PageHeader>
  );
}
