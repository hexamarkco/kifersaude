import { useState } from 'react';
import { Activity, Clock3, Edit3, Layers3, MessageSquareText, Search, Tag } from 'lucide-react';

import type { AutoContactFlow } from '../../../../lib/autoContactService';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FilterSelect,
  Input,
  Pagination,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
};

const triggerLabels: Record<AutoContactFlow['triggerType'], string> = {
  lead_created: 'Novo lead',
  status_changed: 'Mudança de status',
  status_duration: 'Tempo no status',
  inactivity_duration: 'Tempo sem contato',
};

function MetricCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <Card padding="md" className="flex min-h-[7.25rem] min-w-0 flex-col justify-between gap-4">
      <div className="flex items-center justify-between gap-3">
        <Text className="kds-card-subtitle">{label}</Text>
        <Icon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
      </div>
      <div>
        <Text className="text-2xl font-semibold leading-none tabular-nums text-[var(--text-primary)]">{value}</Text>
        <Text className="mt-2 text-xs">{detail}</Text>
      </div>
    </Card>
  );
}

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
      <section aria-label="Resumo das automações" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Fluxos ativos" value={activeFlows} detail={`${totalFlows} configurados`} icon={Activity} />
        <MetricCard label="Etapas configuradas" value={totalSteps} detail="Distribuídas entre os fluxos" icon={Layers3} />
        <MetricCard label="Templates" value={totalTemplates} detail="Disponíveis para as mensagens" icon={MessageSquareText} />
        <MetricCard label="Mensagens hoje" value={dailyCountValue} detail={dailyCountDetail} icon={Clock3} />
      </section>

      <Card padding="md" className="space-y-5">
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
                <ul className="grid gap-3 lg:hidden" aria-label="Fluxos de automação em cartões">
                  {visibleFlows.map((flow) => (
                    <li key={flow.id}>
                      <Card padding="md" className="space-y-3">
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Text className="break-words font-semibold text-[var(--text-primary)]">{flow.name || 'Fluxo sem nome'}</Text>
                            <Text className="mt-1 text-sm">{triggerLabels[flow.triggerType]}</Text>
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
                            variant="secondary"
                            size="sm"
                            onClick={() => onEditFlow(flow.id)}
                            aria-label={`Editar fluxo ${flow.name || 'sem nome'}`}
                          >
                            <Edit3 className="kds-control-icon" aria-hidden="true" />
                            Editar
                          </Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>

                <div className="hidden lg:block">
                  <Table
                    size="md"
                    aria-label="Fluxos de automação"
                    className="min-w-[60rem]"
                    columnWidths={['31%', '19%', '15%', '12%', '23%']}
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fluxo</TableHead>
                        <TableHead>Gatilho</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead align="right">Etapas</TableHead>
                        <TableHead align="right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleFlows.map((flow) => (
                        <TableRow key={flow.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <Text className="truncate font-semibold text-[var(--text-primary)]">{flow.name || 'Fluxo sem nome'}</Text>
                              <Text className="mt-1 max-w-[36rem] truncate text-xs text-[var(--text-muted)]" title={getConditionPreview(flow)}>
                                {getConditionPreview(flow)}
                              </Text>
                            </div>
                          </TableCell>
                          <TableCell>{triggerLabels[flow.triggerType]}</TableCell>
                          <TableCell>
                            <Badge tone={flow.ativo === false ? 'warning' : 'success'} size="sm">
                              {flow.ativo === false ? 'Pausado' : 'Ativo'}
                            </Badge>
                          </TableCell>
                          <TableCell align="right" className="whitespace-nowrap tabular-nums">
                            {flow.steps.length}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => onEditFlow(flow.id)}
                              aria-label={`Editar fluxo ${flow.name || 'sem nome'}`}
                            >
                              <Edit3 className="kds-control-icon" aria-hidden="true" />
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

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
      </Card>
    </div>
  );
}
