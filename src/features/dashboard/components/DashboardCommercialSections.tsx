import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileWarning,
  Gauge,
  Hourglass,
  ListTodo,
  MoveRight,
  PackageOpen,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

import {
  ActionSurface,
  Badge,
  Button,
  Card,
  EmptyState,
  KpiCard,
  OperationalStatusBadge,
  Progress,
  SectionHeader,
  Surface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../design-system';
import type { TabNavigationOptions } from '../../../types/navigation';
import type {
  DashboardCommercialAnalysis,
  DashboardOpportunity,
  DashboardPerformanceRow,
} from '../shared/dashboardTypes';

type DashboardCommercialSectionsProps = {
  analysis: DashboardCommercialAnalysis;
  showFinancialMetrics: boolean;
  onNavigateToLead: (leadId: string) => void;
  onNavigateToStatus: (status: string) => void;
  onNavigateToTab?: (tab: string, options?: TabNavigationOptions) => void;
};

const currency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const compactCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  });

const percent = (value: number | null) =>
  value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

const date = (value: string | null) => {
  if (!value) return 'Sem registro';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Sem registro' : parsed.toLocaleDateString('pt-BR');
};

const dateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function KpiTrend({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'success' | 'warning' }) {
  const className = tone === 'success'
    ? 'text-[var(--success-text)]'
    : tone === 'warning'
      ? 'text-[var(--warning-text)]'
      : 'text-[var(--text-muted)]';
  return <span className={`text-xs font-medium ${className}`}>{children}</span>;
}

function OpportunitySignal({ opportunity }: { opportunity: DashboardOpportunity }) {
  const icon = opportunity.tone === 'danger'
    ? AlertTriangle
    : opportunity.tone === 'warning'
      ? Clock3
      : Target;
  return <Badge tone={opportunity.tone} size="sm" icon={icon}>{opportunity.signal}</Badge>;
}

function OpportunityTable({
  opportunities,
  onNavigateToLead,
}: {
  opportunities: DashboardOpportunity[];
  onNavigateToLead: (leadId: string) => void;
}) {
  if (opportunities.length === 0) {
    return <EmptyState icon={<CheckCircle2 aria-hidden="true" />} title="Nenhuma oportunidade crítica" description="A fila é formada por sinais reais de follow-up, etapa e atividade registrados no CRM." className="py-8" />;
  }

  return (
    <Table size="sm">
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead>Último contato</TableHead>
          <TableHead>Próximo passo</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead align="right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {opportunities.map((opportunity) => (
          <TableRow key={opportunity.leadId}>
            <TableCell>
              <Button variant="text" size="sm" className="justify-start truncate" onClick={() => onNavigateToLead(opportunity.leadId)}>
                {opportunity.name}<ArrowRight aria-hidden="true" />
              </Button>
              <div className="mt-1"><OpportunitySignal opportunity={opportunity} /></div>
            </TableCell>
            <TableCell>
              <OperationalStatusBadge statusColor={opportunity.statusColor}>{opportunity.status}</OperationalStatusBadge>
            </TableCell>
            <TableCell>
              <span className="text-sm text-[var(--text-secondary)]">{date(opportunity.lastContact)}</span>
              {opportunity.idleDays !== null && <span className="mt-1 block text-xs text-[var(--text-muted)]">{opportunity.idleDays}d sem interação</span>}
            </TableCell>
            <TableCell className="text-sm text-[var(--text-secondary)]">{opportunity.nextStep ? date(opportunity.nextStep) : 'Não definido'}</TableCell>
            <TableCell className="text-sm text-[var(--text-secondary)]">{opportunity.responsavel || 'Não informado'}</TableCell>
            <TableCell align="right" className="font-medium tabular-nums text-[var(--text-primary)]">{opportunity.monthlyValue === null ? '—' : compactCurrency(opportunity.monthlyValue)}/mês</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PerformanceTable({
  rows,
  label,
  showLeads = true,
  showProposals = false,
  showFinancialMetrics,
}: {
  rows: DashboardPerformanceRow[];
  label: string;
  showLeads?: boolean;
  showProposals?: boolean;
  showFinancialMetrics: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={<PackageOpen aria-hidden="true" />} title={`Sem dados de ${label.toLowerCase()}`} description="Os dados aparecem quando houver registros no período e nos filtros selecionados." className="py-8" />;
  }

  return (
    <Table size="sm">
      <TableHeader>
        <TableRow>
          <TableHead>{label}</TableHead>
          {showLeads && <TableHead align="right">Leads</TableHead>}
          {showProposals && <TableHead align="right">Propostas</TableHead>}
          <TableHead align="right">Vendas</TableHead>
          <TableHead align="right">Conversão</TableHead>
          {showFinancialMetrics && <TableHead align="right">Mensalidade</TableHead>}
          {showFinancialMetrics && <TableHead align="right">Comissão</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 8).map((row) => (
          <TableRow key={row.label}>
            <TableCell className="max-w-48 truncate font-medium text-[var(--text-primary)]">{row.label}</TableCell>
            {showLeads && <TableCell align="right" className="tabular-nums">{row.leads || '—'}</TableCell>}
            {showProposals && <TableCell align="right" className="tabular-nums">{row.proposals === null ? '—' : row.proposals}</TableCell>}
            <TableCell align="right" className="tabular-nums">{row.contracts || '—'}</TableCell>
            <TableCell align="right" className="tabular-nums">{percent(row.conversion)}</TableCell>
            {showFinancialMetrics && <TableCell align="right" className="tabular-nums">{row.monthlyValue > 0 ? compactCurrency(row.monthlyValue) : '—'}</TableCell>}
            {showFinancialMetrics && <TableCell align="right" className="tabular-nums">{row.commissionExpected > 0 ? compactCurrency(row.commissionExpected) : '—'}</TableCell>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DashboardCommercialSections({
  analysis,
  showFinancialMetrics,
  onNavigateToLead,
  onNavigateToStatus,
  onNavigateToTab,
}: DashboardCommercialSectionsProps) {
  const periodLabel = analysis.currentRange?.label ?? 'todo o histórico disponível';
  const attentionLead = analysis.opportunities[0]?.leadId;
  const openAgenda = () => onNavigateToTab?.('agenda');
  const openLeads = () => onNavigateToTab?.('leads');

  return (
    <div className="space-y-6">
      <section data-panel-animate aria-labelledby="dashboard-today-title">
        <SectionHeader eyebrow="Ação comercial" title="Hoje no CRM" description="Um resumo compacto do que pede movimento agora." as="h2" />
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ActionSurface variant="info" padding="sm" onClick={openAgenda} className="text-left">
            <CalendarClock className="h-4 w-4 text-[var(--info-text)]" aria-hidden="true" />
            <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.agenda.pending}</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Follow-ups pendentes</p>
          </ActionSurface>
          <ActionSurface variant="danger" padding="sm" onClick={openAgenda} className="text-left">
            <AlertTriangle className="h-4 w-4 text-[var(--danger-text)]" aria-hidden="true" />
            <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.agenda.overdue}</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Itens atrasados</p>
          </ActionSurface>
          <ActionSurface variant="warning" padding="sm" onClick={openLeads} className="text-left">
            <Target className="h-4 w-4 text-[var(--warning-text)]" aria-hidden="true" />
            <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.followUp.withoutNextStep}</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Sem próximo passo</p>
          </ActionSurface>
          <ActionSurface variant="strong" padding="sm" onClick={attentionLead ? () => onNavigateToLead(attentionLead) : openLeads} className="text-left">
            <WalletCards className="h-4 w-4 text-[var(--brand-primary)]" aria-hidden="true" />
            <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{analysis.stuck.valueAvailable ? compactCurrency(analysis.stuck.amount) : analysis.stuck.count}</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">{analysis.stuck.valueAvailable ? 'Parado no avançado' : 'Oportunidades paradas'}</p>
          </ActionSurface>
        </div>
      </section>

      <section data-panel-animate aria-labelledby="dashboard-kpi-title">
        <SectionHeader eyebrow="Resultado" title="Indicadores do período" description={`Recorte ativo: ${periodLabel}.`} as="h2" />
        <div className={`mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${showFinancialMetrics ? '2xl:grid-cols-6' : '2xl:grid-cols-4'}`}>
          <KpiCard padding="sm" icon={<Briefcase className="h-4 w-4" aria-hidden="true" />} title="Vendas" subtitle="Contratos fechados" value={<span className="tabular-nums">{analysis.salesCount}</span>} trend={<KpiTrend>{`${analysis.leadsReceived} leads recebidos`}</KpiTrend>} className="h-full" />
          <KpiCard padding="sm" icon={<DollarSign className="h-4 w-4" aria-hidden="true" />} title="Valor mensal vendido" subtitle="Contratos do período" value={<span className="tabular-nums">{showFinancialMetrics && analysis.dataCoverage.monthlyRevenue ? currency(analysis.monthlyRevenue) : '—'}</span>} trend={<KpiTrend>{showFinancialMetrics && analysis.dataCoverage.monthlyRevenue ? 'Mensalidade registrada' : 'Sem mensalidade cadastrada'}</KpiTrend>} className="h-full" />
          {showFinancialMetrics && <KpiCard padding="sm" icon={<WalletCards className="h-4 w-4" aria-hidden="true" />} title="Comissão prevista" subtitle="Vendas do período" value={<span className="tabular-nums">{analysis.dataCoverage.commissionExpected ? currency(analysis.commissionExpected) : '—'}</span>} trend={<KpiTrend tone={analysis.dataCoverage.commissionExpected ? 'neutral' : 'warning'}>{analysis.dataCoverage.commissionExpected ? 'Sem forecast adicional' : 'Sem comissão cadastrada'}</KpiTrend>} className="h-full" />}
          {showFinancialMetrics && <KpiCard padding="sm" icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />} title="Comissão recebida" subtitle="Parcelas pagas" value={<span className="tabular-nums">{analysis.commissionReceived === null ? '—' : currency(analysis.commissionReceived)}</span>} trend={<KpiTrend tone={analysis.commissionReceived === null ? 'warning' : 'success'}>{analysis.commissionReceived === null ? 'Sem parcelas pagas registradas' : 'Base de parcelas pagas'}</KpiTrend>} className="h-full" />}
          <KpiCard padding="sm" icon={<Gauge className="h-4 w-4" aria-hidden="true" />} title="Ticket médio" subtitle="Mensalidade por venda" value={<span className="tabular-nums">{showFinancialMetrics && analysis.averageTicket !== null ? currency(analysis.averageTicket) : '—'}</span>} trend={<KpiTrend>{showFinancialMetrics ? 'Sem meta configurada' : 'Restrito ao perfil'}</KpiTrend>} className="h-full" />
          <KpiCard padding="sm" icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} title="Conversão" subtitle="Leads → contratos" value={<span className="tabular-nums">{percent(analysis.conversion)}</span>} trend={<KpiTrend>{analysis.conversion === null ? 'Base insuficiente' : 'Contratos vinculados ao lead'}</KpiTrend>} className="h-full" />
        </div>
      </section>

      <section data-panel-animate aria-labelledby="dashboard-funnel-title">
        <Surface padding="md">
          <SectionHeader eyebrow="Pipeline" title="Funil comercial" description="Etapas e tempo médio calculados a partir do estágio atual e do histórico salvo." as="h2" />
          {analysis.stageMetrics.some((stage) => stage.count > 0) ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {analysis.stageMetrics.filter((stage) => stage.count > 0).map((stage) => (
                <button key={stage.status} type="button" onClick={() => onNavigateToStatus(stage.status)} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left transition hover:border-[var(--brand-primary-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  <div className="flex items-start justify-between gap-2">
                    <OperationalStatusBadge statusColor={stage.color}>{stage.status}</OperationalStatusBadge>
                    <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{stage.count}</span>
                  </div>
                  <Progress value={stage.share} size="sm" className="mt-3" />
                  <div className="mt-3 flex items-end justify-between gap-2 text-xs text-[var(--text-muted)]">
                    <span>{Math.round(stage.averageDays)}d médios</span>
                    <span>{stage.nextStageConversion === null ? 'Sem base de avanço' : `${percent(stage.nextStageConversion)} avançam`}</span>
                  </div>
                  {showFinancialMetrics && <p className="mt-2 text-xs font-medium text-[var(--text-secondary)]">{stage.monthlyValue === null ? 'Valor mensal não registrado' : `${compactCurrency(stage.monthlyValue)}/mês vinculado`}</p>}
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={<ListTodo aria-hidden="true" />} title="Funil sem oportunidades no recorte" description="A distribuição aparecerá quando houver leads abertos nas etapas configuradas." className="mt-5 py-8" />
          )}
        </Surface>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section data-panel-animate aria-labelledby="dashboard-attention-title" className="xl:col-span-2">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Próxima ação" title="Oportunidades que precisam de atenção" description="Prioridade baseada em follow-up vencido, etapa avançada, próximo passo e atividade real." as="h2" />
            <div className="mt-4"><OpportunityTable opportunities={analysis.opportunities} onNavigateToLead={onNavigateToLead} /></div>
          </Surface>
        </section>
        <section data-panel-animate aria-labelledby="dashboard-agenda-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Agenda comercial" title="Hoje" description="Lembretes pendentes, atrasados e concluídos." action={<Button variant="secondary" size="sm" onClick={openAgenda}>Abrir agenda <ArrowRight aria-hidden="true" /></Button>} as="h2" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Card padding="sm" className="text-center"><p className="text-xl font-semibold tabular-nums">{analysis.agenda.pending}</p><p className="text-xs text-[var(--text-muted)]">Pendentes</p></Card>
              <Card padding="sm" className="text-center"><p className="text-xl font-semibold tabular-nums text-[var(--danger-text)]">{analysis.agenda.overdue}</p><p className="text-xs text-[var(--text-muted)]">Atrasados</p></Card>
              <Card padding="sm" className="text-center"><p className="text-xl font-semibold tabular-nums text-[var(--success-text)]">{analysis.agenda.completed}</p><p className="text-xs text-[var(--text-muted)]">Concluídos</p></Card>
            </div>
            <div className="mt-4 space-y-2">
              {analysis.agenda.items.length > 0 ? analysis.agenda.items.slice(0, 5).map((item) => (
                <button key={item.id} type="button" onClick={() => item.leadId ? onNavigateToLead(item.leadId) : openAgenda()} className="flex w-full items-start gap-3 rounded-xl border border-[var(--border-subtle)] p-3 text-left transition hover:border-[var(--brand-primary-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                  <span className={`mt-0.5 rounded-full p-1.5 ${item.overdue ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]' : 'bg-[var(--info-soft)] text-[var(--info-text)]'}`}><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</span><span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{item.leadName || item.type} · {dateTime(item.date)}</span></span>
                  {item.overdue && <Badge tone="danger" size="sm">Atrasado</Badge>}
                </button>
              )) : <EmptyState icon={<CalendarClock aria-hidden="true" />} title="Agenda livre" description="Não há lembretes pendentes para hoje." className="py-8" />}
            </div>
          </Surface>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section data-panel-animate aria-labelledby="dashboard-pipeline-value-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Valor em aberto" title="Pipeline comercial" description="Valor mensal registrado em contratos vinculados às oportunidades abertas." as="h2" />
            <div className="mt-4 flex items-end justify-between gap-4"><p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{showFinancialMetrics && analysis.pipelineValueAvailable ? currency(analysis.pipelineValue) : '—'}</p><Badge tone={analysis.pipelineValueAvailable ? 'info' : 'neutral'}>{analysis.pipelineValueAvailable ? 'R$/mês' : 'Sem valor cadastrado'}</Badge></div>
            <div className="mt-5 space-y-3">{analysis.pipelineStages.length > 0 ? analysis.pipelineStages.map((stage) => <button key={stage.status} type="button" onClick={() => onNavigateToStatus(stage.status)} className="flex w-full items-center gap-3 text-left"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">{stage.status}</span><span className="text-xs tabular-nums text-[var(--text-muted)]">{stage.count}</span><span className="w-28 text-right text-sm font-medium tabular-nums text-[var(--text-primary)]">{showFinancialMetrics && stage.monthlyValue !== null ? compactCurrency(stage.monthlyValue) : '—'}</span></button>) : <EmptyState icon={<DollarSign aria-hidden="true" />} title="Sem valores em aberto" description="O modelo atual não registra valor potencial diretamente no lead." className="py-8" />}</div>
          </Surface>
        </section>
        <section data-panel-animate aria-labelledby="dashboard-conversion-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Gargalo" title="Conversão por etapa" description="Transições registradas no histórico; etapas sem base ficam sem percentual." as="h2" />
            <div className="mt-4 space-y-3">{analysis.stageConversions.length > 0 ? analysis.stageConversions.map((conversionItem) => <div key={`${conversionItem.from}-${conversionItem.to}`} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">{conversionItem.from}</span><MoveRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">{conversionItem.to}</span><span className="w-16 text-right text-sm font-semibold tabular-nums text-[var(--text-primary)]">{percent(conversionItem.rate)}</span></div>) : <EmptyState icon={<MoveRight aria-hidden="true" />} title="Sem transições registradas" description="O histórico de estágios ainda não tem base suficiente para calcular o avanço." className="py-8" />}</div>
          </Surface>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section data-panel-animate aria-labelledby="dashboard-follow-up-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Disciplina comercial" title="Saúde do follow-up" description="Cobertura de próximo passo para as oportunidades abertas no recorte." as="h2" />
            <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-4xl font-semibold tabular-nums text-[var(--text-primary)]">{percent(analysis.followUp.coverage)}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">Cobertura de próximo passo</p></div><Badge tone={analysis.followUp.coverage !== null && analysis.followUp.coverage >= 80 ? 'success' : 'warning'}>{analysis.followUp.withNextStep} de {analysis.followUp.openOpportunities}</Badge></div>
            <Progress value={analysis.followUp.coverage ?? 0} size="md" className="mt-4" />
            <div className="mt-5 grid grid-cols-2 gap-3"><ActionSurface variant="warning" padding="sm" onClick={openLeads} className="text-left"><p className="text-2xl font-semibold tabular-nums">{analysis.followUp.withoutNextStep}</p><p className="text-xs text-[var(--text-secondary)]">Oportunidades sem próximo movimento</p></ActionSurface><Card padding="sm"><p className="text-2xl font-semibold tabular-nums text-[var(--danger-text)]">{analysis.followUp.overdue}</p><p className="text-xs text-[var(--text-secondary)]">Follow-ups vencidos</p></Card></div>
          </Surface>
        </section>
        <section data-panel-animate aria-labelledby="dashboard-stuck-title">
          <Surface padding="md" variant={analysis.stuck.count > 0 ? 'warning' : 'default'} className="h-full">
            <SectionHeader eyebrow="Risco de receita" title="Dinheiro parado" description={`Oportunidades avançadas sem interação há mais de ${analysis.stuck.thresholdHours}h.`} as="h2" />
            <div className="mt-5 flex items-end justify-between gap-4"><div><p className="text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{showFinancialMetrics && analysis.stuck.valueAvailable ? currency(analysis.stuck.amount) : '—'}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{analysis.stuck.count} oportunidade(s) avançada(s)</p></div><Hourglass className="h-7 w-7 text-[var(--warning-text)]" aria-hidden="true" /></div>
            <Button variant="secondary" size="sm" className="mt-5" onClick={analysis.stuck.leadIds[0] ? () => onNavigateToLead(analysis.stuck.leadIds[0]) : openLeads}>Abrir oportunidades <ArrowRight aria-hidden="true" /></Button>
          </Surface>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section data-panel-animate aria-labelledby="dashboard-velocity-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Velocidade" title="Idade e tempo do funil" description="A idade usa a criação da oportunidade; tempos médios dependem do histórico disponível." as="h2" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
              ['Lead → proposta', analysis.velocity.leadToProposalDays],
              ['Proposta → decisão', analysis.velocity.proposalToDecisionDays],
              ['Decisão → fechado', analysis.velocity.decisionToClosedDays],
              ['Lead → fechado', analysis.velocity.leadToClosedDays],
            ].map(([label, value]) => <Card key={String(label)} padding="sm"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value === null ? '—' : `${Math.round(Number(value))}d`}</p></Card>)}</div>
            <div className="mt-5 space-y-2">{analysis.velocity.ageBuckets.map((bucket) => <button key={bucket.label} type="button" onClick={() => bucket.leadIds[0] && onNavigateToLead(bucket.leadIds[0])} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-[var(--surface-hover)]"><span className="w-20 text-xs text-[var(--text-muted)]">{bucket.label}</span><Progress value={bucket.count} max={Math.max(...analysis.velocity.ageBuckets.map((item) => item.count), 1)} size="sm" className="flex-1" /><span className="w-8 text-right text-sm font-medium tabular-nums">{bucket.count}</span></button>)}</div>
          </Surface>
        </section>
        <section data-panel-animate aria-labelledby="dashboard-loss-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Aprendizado" title="Motivos de perda" description="A base atual não possui um campo persistido de motivo de perda." as="h2" />
            <EmptyState icon={<FileWarning aria-hidden="true" />} title="Métrica indisponível" description="Nenhum motivo foi inventado. Quando o CRM registrar essa informação, esta área poderá detalhar quantidade, percentual e valor perdido." className="mt-4 py-10" />
          </Surface>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section data-panel-animate aria-labelledby="dashboard-origin-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Aquisição" title="Origem dos leads" description="Leads recebidos e contratos iniciados no período selecionado." as="h2" />
            <div className="mt-4"><PerformanceTable rows={analysis.origins} label="Origem" showProposals showFinancialMetrics={showFinancialMetrics} /></div>
          </Surface>
        </section>
        <section data-panel-animate aria-labelledby="dashboard-operator-title">
          <Surface padding="md" className="h-full">
            <SectionHeader eyebrow="Mix comercial" title="Performance por operadora" description="Vendas e mensalidade registrada; cotado × vendido exige uma entidade de proposta disponível." as="h2" />
            <div className="mt-4"><PerformanceTable rows={analysis.operators} label="Operadora" showLeads={false} showProposals showFinancialMetrics={showFinancialMetrics} /></div>
          </Surface>
        </section>
      </div>

      <section data-panel-animate aria-labelledby="dashboard-proposals-title">
        <Surface padding="md">
          <SectionHeader eyebrow="Carteira recente" title="Propostas recentes" description="Leads atualmente em etapas cujo nome contém proposta ou cotação. O CRM não possui uma entidade separada de proposta." as="h2" />
          {analysis.recentProposals.length > 0 ? <div className="mt-4"><Table size="sm"><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Estágio atual</TableHead><TableHead>Última atividade</TableHead><TableHead>Responsável</TableHead><TableHead align="right">Valor registrado</TableHead></TableRow></TableHeader><TableBody>{analysis.recentProposals.map((opportunity) => <TableRow key={opportunity.leadId}><TableCell><Button variant="text" size="sm" className="justify-start" onClick={() => onNavigateToLead(opportunity.leadId)}>{opportunity.name}<ArrowRight aria-hidden="true" /></Button></TableCell><TableCell><OperationalStatusBadge statusColor={opportunity.statusColor}>{opportunity.status}</OperationalStatusBadge></TableCell><TableCell className="text-sm text-[var(--text-secondary)]">{date(opportunity.lastContact)}</TableCell><TableCell className="text-sm text-[var(--text-secondary)]">{opportunity.responsavel || 'Não informado'}</TableCell><TableCell align="right" className="tabular-nums">{showFinancialMetrics && opportunity.monthlyValue !== null ? compactCurrency(opportunity.monthlyValue) : '—'}</TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState icon={<PackageOpen aria-hidden="true" />} title="Nenhuma proposta no recorte" description="A visualização depende de leads em estágios configurados com proposta ou cotação." className="mt-4 py-10" />}
        </Surface>
      </section>
    </div>
  );
}
