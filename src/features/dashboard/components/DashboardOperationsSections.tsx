import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Filter, ListTodo, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge, Button, Card, EmptyState, SectionHeader, Surface } from '../../../design-system';
import type { Lead } from '../../leads';
import type { DashboardOperationsAnalysis } from '../shared/dashboardTypes';

type OperationsProps = {
  analysis: DashboardOperationsAnalysis;
  leadsById: Map<string, Lead>;
  onNavigateToLead: (leadId: string) => void;
  onNavigateToStatus: (status: string) => void;
};

const formatDelta = (current: number, previous: number | null, suffix = '') => {
  if (previous === null) return 'Sem período comparável';
  const difference = current - previous;
  if (difference === 0) return `Sem variação${suffix}`;
  return `${difference > 0 ? '+' : ''}${difference.toLocaleString('pt-BR')}${suffix} vs. período anterior`;
};

function Delta({ current, previous, inverse = false, suffix = '' }: { current: number; previous: number | null; inverse?: boolean; suffix?: string }) {
  const difference = previous === null ? 0 : current - previous;
  const positive = inverse ? difference <= 0 : difference >= 0;
  const Icon = difference === 0 ? Clock3 : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${difference === 0 ? 'text-[var(--text-muted)]' : positive ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}`}>
      <Icon aria-hidden="true" />
      {formatDelta(current, previous, suffix)}
    </span>
  );
}

export function DashboardPerformanceOverview({ analysis }: Pick<OperationsProps, 'analysis'>) {
  const periodName = analysis.currentRange?.label ?? 'todo o histórico disponível';
  return (
    <section data-panel-animate className="space-y-4" aria-labelledby="dashboard-performance-title">
      <SectionHeader
        eyebrow="Leitura do período"
        title="O que mudou na operação"
        description={`Comparação automática: ${periodName}.`}
        as="h2"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card padding="sm" className="space-y-2">
          <p className="kds-card-subtitle">Novas oportunidades</p>
          <p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.leadsCreated.toLocaleString('pt-BR')}</p>
          <Delta current={analysis.leadsCreated} previous={analysis.leadsCreatedPrevious} />
        </Card>
        <Card padding="sm" className="space-y-2">
          <p className="kds-card-subtitle">Contratos iniciados</p>
          <p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.contractsCreated.toLocaleString('pt-BR')}</p>
          <Delta current={analysis.contractsCreated} previous={analysis.contractsCreatedPrevious} />
        </Card>
        <Card padding="sm" className="space-y-2">
          <p className="kds-card-subtitle">Ganhos × perdas</p>
          <p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.won} <span className="text-base font-medium text-[var(--text-muted)]">/ {analysis.lost}</span></p>
          <Delta current={analysis.lost} previous={analysis.lostPrevious} inverse />
        </Card>
        <Card padding="sm" className="space-y-2">
          <p className="kds-card-subtitle">Conversão decidida</p>
          <p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.conversion === null ? '—' : `${analysis.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}</p>
          {analysis.conversion === null ? <span className="text-xs text-[var(--text-muted)]">Ainda não há decisões no período</span> : <Delta current={analysis.conversion} previous={analysis.conversionPrevious} suffix=" p.p." />}
        </Card>
      </div>
    </section>
  );
}

export function DashboardPipelineHealth({ analysis, onNavigateToStatus }: Pick<OperationsProps, 'analysis' | 'onNavigateToStatus'>) {
  return (
    <Surface padding="md" data-panel-animate className="space-y-5" aria-labelledby="dashboard-pipeline-title">
      <SectionHeader
        eyebrow="Saúde do pipeline"
        title="Onde as oportunidades estão parando"
        description={analysis.bottleneck ? `${analysis.bottleneck.status} concentra ${analysis.bottleneck.count} leads com média de ${Math.round(analysis.bottleneck.averageDays)} dias na etapa.` : 'Ainda não há etapas ativas suficientes para avaliar um gargalo.'}
        as="h2"
      />
      <div className="flex flex-wrap gap-2" aria-label="Indicadores complementares do pipeline">
        <Badge tone="neutral" size="sm">{analysis.activePipeline} oportunidades abertas</Badge>
        <Badge tone="neutral" size="sm">{analysis.activeContracts} contratos ativos</Badge>
        <Badge tone="neutral" size="sm">{analysis.averageCycleDays === null ? 'Ciclo sem base suficiente' : `Ciclo médio: ${Math.round(analysis.averageCycleDays)} dias`}</Badge>
      </div>
      {analysis.stageHealth.some((stage) => stage.count > 0) ? (
        <div className="space-y-2">
          {analysis.stageHealth.filter((stage) => stage.count > 0).map((stage) => (
            <button
              key={stage.status}
              type="button"
              onClick={() => onNavigateToStatus(stage.status)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="min-w-0">
                <span className="flex items-center justify-between gap-3 text-sm font-medium text-[var(--text-primary)]"><span className="truncate">{stage.status}</span><span className="tabular-nums">{stage.count}</span></span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"><span className="block h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${Math.max(stage.share, stage.count ? 3 : 0)}%` }} /></span>
              </span>
              <span className="text-right text-xs text-[var(--text-muted)]"><strong className="block font-medium text-[var(--text-secondary)]">{Math.round(stage.averageDays)} dias</strong>na etapa</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Filter aria-hidden="true" />} title="Pipeline sem oportunidades ativas" description="Quando houver leads em etapas abertas, a distribuição e o tempo por etapa aparecerão aqui." className="py-8" />
      )}
    </Surface>
  );
}

export function DashboardAttentionQueue({ analysis, leadsById, onNavigateToLead }: Pick<OperationsProps, 'analysis' | 'leadsById' | 'onNavigateToLead'>) {
  return (
    <Surface padding="md" data-panel-animate className="space-y-5" aria-labelledby="dashboard-attention-title">
      <SectionHeader eyebrow="Ação recomendada" title="Fila que merece atenção agora" description="Prioridades calculadas com retornos, lembretes, interações e estágio atual." as="h2" />
      {analysis.attention.length ? (
        <div className="space-y-3">
          {analysis.attention.map((item) => {
            const Icon = item.tone === 'danger' ? AlertTriangle : item.tone === 'success' ? CheckCircle2 : item.tone === 'warning' ? Clock3 : ListTodo;
            return (
              <Card key={item.kind} padding="sm" className="space-y-3 border-l-2 border-l-[var(--border-strong)]">
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3><Badge tone={item.tone} size="sm">{item.count}</Badge></div><p className="mt-1 text-sm text-[var(--text-secondary)]">{item.description}</p></div>
                </div>
                {item.leadIds.length > 0 && <div className="flex flex-wrap gap-2">{item.leadIds.map((leadId) => {
                  const lead = leadsById.get(leadId);
                  return lead ? <Button key={leadId} variant="secondary" size="sm" onClick={() => onNavigateToLead(leadId)}>{lead.nome_completo}<ArrowRight aria-hidden="true" /></Button> : null;
                })}</div>}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<CheckCircle2 aria-hidden="true" />} title="Nenhuma prioridade crítica" description="Não encontramos retornos vencidos, leads sem próximo passo ou atividade parada na base atual." className="py-8" />
      )}
      {(!analysis.dataCoverage.interactions || !analysis.dataCoverage.reminders) && (
        <p className="text-xs text-[var(--text-muted)]">A leitura usa os registros disponíveis. Itens sem interação ou lembrete histórico aparecem como prioridade até que a operação registre esses dados.</p>
      )}
    </Surface>
  );
}

export function DashboardSourcePerformance({ analysis }: Pick<OperationsProps, 'analysis'>) {
  return (
    <Surface padding="md" data-panel-animate className="space-y-5" aria-labelledby="dashboard-source-title">
      <SectionHeader eyebrow="Qualidade da entrada" title="Origens que movem o funil" description="Leads gerados e contratos iniciados no período selecionado. A conversão só é exibida quando há leads na origem." as="h2" />
      {analysis.sourcePerformance.length ? <div className="space-y-1">{analysis.sourcePerformance.slice(0, 6).map((source) => <div key={source.origin} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-[var(--border-subtle)] py-3 last:border-0"><span className="truncate text-sm font-medium text-[var(--text-primary)]">{source.origin}</span><span className="text-right text-xs text-[var(--text-muted)]"><strong className="block text-sm font-semibold text-[var(--text-primary)]">{source.leads}</strong>leads</span><span className="text-right text-xs text-[var(--text-muted)]"><strong className="block text-sm font-semibold text-[var(--text-primary)]">{source.contracts}</strong>{source.conversion === null ? 'sem base' : `${source.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}</span></div>)}</div> : <EmptyState icon={<TrendingUp aria-hidden="true" />} title="Sem origem no período" description="Quando entrarem leads ou contratos no período, a performance por origem será detalhada aqui." className="py-8" />}
    </Surface>
  );
}
