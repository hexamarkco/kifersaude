import { BookOpen, MoreHorizontal, Plus } from "lucide-react";

import {
  Button,
  IconButton,
  LinkButton,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
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
      title={viewMode === 'kanban' ? 'Seu funil, em movimento.' : 'Cada contato, uma possibilidade.'}
      description={viewMode === 'kanban' ? 'Visualize oportunidades, prioridades e o próximo passo.' : 'Organize as conversas e acompanhe o próximo passo de cada negociação.'}
      actions={(
        <>
          <Popover>
            <PopoverTrigger><IconButton variant="ghost" aria-label="Mais ações de leads"><MoreHorizontal aria-hidden="true" /></IconButton></PopoverTrigger>
            <PopoverContent align="end" className="kds-workspace-action-menu">
              <LinkButton href="/painel/api" variant="ghost" className="kds-popover-menu-item"><BookOpen aria-hidden="true" />Documentação de integração</LinkButton>
            </PopoverContent>
          </Popover>
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
      <Tabs
        items={VIEW_MODE_TABS.map(({ id }) => ({ id, label: id === 'list' ? 'Lista' : 'Funil' }))}
        value={viewMode}
        onChange={onViewModeChange}
        size="sm"
        className="kds-leads-view-tabs"
        ariaLabel="Visões de leads"
      />
    </PageHeader>
  );
}
