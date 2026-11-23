import { useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Layers3, MessageSquareText, Play, Search, Tag } from 'lucide-react';

import type { AutoContactFlow } from '../../../../lib/autoContactService';
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
  SectionHeader,
  Text,
} from '../../../../design-system';
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';

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
  onOpenTemplates?: () => void;
  onOpenSimulation?: (flowId: string) => void;
};

const triggerLabels: Record<AutoContactFlow['triggerType'], string> = {
  lead_created: 'Novo lead',
  status_changed: 'Mudança de status',
  status_duration: 'Tempo no status',
  inactivity_duration: 'Tempo sem contato',
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

      <section className="kds-automation-journeys space-y-5">
        <SectionHeader
          eyebrow="Automação comercial"
          title="Fluxos de automação"
          description={(
            <div className="space-y-3">
              <Text>Organize regras, horários e mensagens usadas no acompanhamento dos leads.</Text>
              <div>
                <Text className="font-semibold">Variáveis disponíveis nas mensagens</Text>
                <ul className="mt-2 space-y-1">
                  {AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS.map(({ key, label }) => (
                    <li key={key} className="flex items-baseline gap-2">
                      <code>{`{{${key}}}`}</code>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          as="h2"
        />

        {totalFlows === 0 ? (
          <EmptyState
            icon={<Activity aria-hidden="true" />}
            title="Nenhum fluxo configurado"
            description="Crie o primeiro fluxo para automatizar etapas do atendimento."
          />
        ) : (
          <>
            <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(20rem,2.5fr)_minmax(14rem,1fr)_auto] xl:items-center">
              <Input
                type="search"
                value={search}
                onChange={(event) => {
                  setCurrentPage(1);
                  onSearchChange(event.target.value);
                }}
                leftIcon={Search}
                placeholder="Buscar fluxo por nome, condição ou tag"
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
                  {visibleFlows.map((flow) => (
                    <li key={flow.id}>
                      <Card padding="md" className="kds-automation-journey-card space-y-4">
                        <CardIcon><MessageSquareText aria-hidden="true" /></CardIcon>
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Text className="kds-card-title">{flow.name || 'Fluxo sem nome'}</Text>
                            <Text className="kds-card-subtitle">{triggerLabels[flow.triggerType]}</Text>
                          </div>
                          <Badge tone={flow.ativo === false ? 'warning' : 'success'} size="sm">
                            {flow.ativo === false ? 'Pausado' : 'Ativo'}
                          </Badge>
                        </div>
                        <Text className="break-words text-xs text-[var(--text-muted)]">{getConditionPreview(flow)}</Text>
                        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
                          <Text className="text-sm tabular-nums text-[var(--text-secondary)]">
                            {flow.steps.length} {flow.steps.length === 1 ? 'etapa' : 'etapas'}
                          </Text>
                          <Button
                            variant="text"
                            size="sm"
                            onClick={() => onEditFlow(flow.id)}
                            aria-label={`Editar fluxo ${flow.name || 'sem nome'}`}
                          >
                            Ver jornada <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
                          </Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>

                <Pagination
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
                />
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
