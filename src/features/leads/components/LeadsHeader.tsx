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
      className="kds-leads-header"
      eyebrow="Operação comercial"
      title="Gestão de leads"
      description="Acompanhe a carteira, priorize follow-ups e mantenha o funil em ritmo constante."
      actions={(
        <>
          <LinkButton
            href="/painel/api"
            variant="secondary"
            size="md"
            aria-label="Documentação de integração"
            title="Abrir documentação para integrar outros sistemas"
          >
            <BookOpen className="kds-control-icon" />
            <span className="kds-leads-action-label">Documentação de integração</span>
          </LinkButton>
          <Button
            type="button"
            aria-label="Novo lead"
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
            <span className="kds-leads-action-label">Novo lead</span>
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
