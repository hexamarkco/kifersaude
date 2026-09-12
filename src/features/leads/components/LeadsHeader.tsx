import { BookOpen, Plus } from "lucide-react";

import {
  Button,
  LinkButton,
  PageHeader,
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
        <>
          <LinkButton
            href="/api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            title="Abrir documentacao da API"
          >
            <BookOpen className="kds-control-icon" />
            <span>API Docs</span>
          </LinkButton>
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
        </>
      )}
      data-panel-animate
    >
      <SegmentedControl
        items={VIEW_MODE_TABS}
        value={viewMode}
        onChange={onViewModeChange}
        size="sm"
        className="kds-leads-view-tabs"
        listClassName="max-w-full flex-nowrap overflow-x-auto"
        triggerClassName="whitespace-nowrap px-3 md:px-4"
      />
    </PageHeader>
  );
}
