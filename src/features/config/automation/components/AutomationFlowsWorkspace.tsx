import { useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Edit3, GitBranch, Layers3, MessageSquareText, Pause, Play, Search, Tag, Trash2, UserRoundPlus } from 'lucide-react';

import type { AutoContactFlow } from '../../../../lib/autoContactService';
import { automationTriggerLabels } from '../automationPresentation';
import {
  Badge,
  Button,
  Card,
  CardIcon,
  CrmCard,
  EmptyState,
  FilterSelect,
  Input,
  KpiCard,
  Pagination,
  Heading,
  RecordActions,
  Text,
} from '../../../../design-system';

type AutomationFlowsWorkspaceProps = {
  flows: AutoContactFlow[];
  totalFlows: number;
  activeFlows: number;
  totalSteps: number;
  totalTemplates: number;
  dailyAutomationCount: number | null;
  dailyAutomationLoading: boolean;
  dailyAutomationError: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  tagFilter: string;
  onTagFilterChange: (value: string) => void;
  availableTags: string[];
  getConditionPreview: (flow: AutoContactFlow) => string;
  onEditFlow: (flowId: string) => void;
  onToggleFlow?: (flowId: string) => void;
  onRemoveFlow?: (flowId: string) => void;
  onOpenTemplates?: () => void;
  onOpenSimulation?: (flowId: string) => void;
};

export default function AutomationFlowsWorkspace({
  flows,
  totalFlows,
  activeFlows,
  totalSteps,
  totalTemplates,
  dailyAutomationCount,
  dailyAutomationLoading,
  dailyAutomationError,
  search,
  onSearchChange,
  tagFilter,
  onTagFilterChange,
  availableTags,
  getConditionPreview,
  onEditFlow,
  onToggleFlow,
  onRemoveFlow,
  onOpenTemplates,
  onOpenSimulation,
}: AutomationFlowsWorkspaceProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(flows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleFlows = flows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const dailyCountValue = dailyAutomationLoading
    ? '…'
    : dailyAutomationError || dailyAutomationCount === null
      ? '—'
      : dailyAutomationCount;
  const dailyCountDetail = dailyAutomationLoading
    ? 'Consultando os registros de hoje'
    : dailyAutomationError
      ? 'Não foi possível consultar os registros'
      : dailyAutomationCount === 0
        ? 'Nenhuma mensagem automática registrada'
        : 'Mensagens automáticas registradas hoje';

  return (
    <div className="space-y-6">
      <section aria-label="Resumo das automações" className="kds-workspace-record-metrics">
        <KpiCard title="Fluxos ativos" value={<span>{activeFlows}</span>} trend={`${totalFlows} configurados`} icon={<Activity aria-hidden="true" />} />
        <KpiCard title="Etapas configuradas" data-tone="info" value={<span>{totalSteps}</span>} trend="Distribuídas entre os fluxos" icon={<Layers3 aria-hidden="true" />} />
        <KpiCard title="Modelos de mensagem" data-tone="cyan" value={<span>{totalTemplates}</span>} trend="Disponíveis para as mensagens" icon={<MessageSquareText aria-hidden="true" />} />
        <KpiCard title="Mensagens hoje" data-tone="warning" value={<span>{dailyCountValue}</span>} trend={dailyCountDetail} icon={<Clock3 aria-hidden="true" />} />
      </section>

      <section className="kds-automation-journeys" aria-label="Fluxos de automação">
        {totalFlows === 0 ? (
          <EmptyState
            icon={<Activity aria-hidden="true" />}
            title="Nenhum fluxo configurado"
            description="Crie o primeiro fluxo para automatizar etapas do atendimento."
          />
        ) : (
          <>
            <div className="kds-automation-list-toolbar">
              <Input
                type="search"
                value={search}
                onChange={(event) => {
                  setCurrentPage(1);
                  onSearchChange(event.target.value);
                }}
                leftIcon={Search}
                placeholder="Buscar fluxo por nome, condição ou tag…"
                aria-label="Buscar fluxo por nome, condição ou tag"
              />
              <FilterSelect
                icon={Tag}
                value={tagFilter}
                onChange={(value) => {
                  setCurrentPage(1);
                  onTagFilterChange(value);
                }}
                placeholder="Todas as tags"
                includePlaceholderOption={false}
                neutralValues={['all']}
                options={[
                  { value: 'all', label: 'Todas as tags' },
                  ...availableTags.map((tag) => ({ value: tag, label: tag })),
                ]}
                aria-label="Filtrar fluxos por tag"
              />
              <Text className="text-sm tabular-nums text-[var(--text-muted)] xl:text-right">
                {flows.length} {flows.length === 1 ? 'fluxo encontrado' : 'fluxos encontrados'}
              </Text>
            </div>

            {flows.length === 0 ? (
              <EmptyState
                icon={<Search aria-hidden="true" />}
                title="Nenhum fluxo encontrado"
                description="Altere a busca ou remova o filtro de tags para ver outros fluxos."
              />
            ) : (
              <>
                <ul className="kds-automation-journey-grid" aria-label="Fluxos de automação em cartões">
                  {visibleFlows.map((flow) => {
                    const name = flow.name || 'Fluxo sem nome';
                    const active = flow.ativo !== false;
                    const Icon = flow.triggerType === 'lead_created' ? UserRoundPlus : flow.triggerType === 'status_changed' ? GitBranch : Clock3;
                    return (
                      <li key={flow.id}>
                        <Card padding="md" className="kds-automation-journey-card">
                          <div className="kds-automation-card-top">
                            <CardIcon data-trigger={flow.triggerType}><Icon aria-hidden="true" /></CardIcon>
                            <RecordActions label={`Ações do fluxo ${name}`} visibleCount={0} actions={[
                              { label: 'Editar jornada', icon: Edit3, onClick: () => onEditFlow(flow.id) },
                              ...(onOpenSimulation ? [{ label: 'Simular e testar', icon: Play, onClick: () => onOpenSimulation(flow.id) }] : []),
                              ...(onToggleFlow ? [{ label: active ? 'Pausar fluxo' : 'Revisar ativação', icon: active ? Pause : Play, onClick: () => onToggleFlow(flow.id) }] : []),
                              ...(onRemoveFlow ? [{ label: 'Remover fluxo', icon: Trash2, destructive: true, onClick: () => onRemoveFlow(flow.id) }] : []),
                            ]} />
                          </div>
                          <Heading level={2} size="sm" className="kds-card-title">{name}</Heading>
                          <Text size="sm" tone="muted" className="kds-automation-card-description">{getConditionPreview(flow)}</Text>
                          <div className="kds-automation-card-meta">
                            <Badge tone={active ? 'success' : 'warning'} size="sm">{active ? 'Ativo' : 'Pausado'}</Badge>
                            <Text as="span" size="sm" tone="muted">{flow.steps.length} {flow.steps.length === 1 ? 'etapa' : 'etapas'}</Text>
                          </div>
                          <div className="kds-automation-card-footer">
                            <Text as="span" size="sm" tone="muted">{automationTriggerLabels[flow.triggerType]}</Text>
                            <Button variant="text" size="sm" onClick={() => onEditFlow(flow.id)} aria-label={`Editar fluxo ${name}`}>
                              Ver jornada <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
                            </Button>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>

                {totalPages > 1 && <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  totalItems={flows.length}
                  itemsPerPage={pageSize}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                />}
              </>
            )}
          </>
        )}
      </section>
      {(onOpenTemplates || onOpenSimulation) && <div className="kds-automation-workspace-resources">
        {onOpenTemplates && <CrmCard title="Mensagens com contexto" subtitle="Uma base consistente para as rotinas da equipe." subtitlePlacement="visible">
          <Button variant="secondary" size="sm" onClick={onOpenTemplates}><MessageSquareText aria-hidden="true" />Explorar modelos</Button>
        </CrmCard>}
        {onOpenSimulation && visibleFlows.length > 0 && <CrmCard title="Antes de colocar no ar" subtitle="Confira cada caminho com uma simulação." subtitlePlacement="visible">
          <Button variant="secondary" size="sm" onClick={() => onOpenSimulation(visibleFlows[0].id)}><Play aria-hidden="true" />Simular uma jornada</Button>
        </CrmCard>}
      </div>}
    </div>
  );
}
