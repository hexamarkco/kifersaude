import { ArrowUpRight, CalendarClock, FileCheck, Heart, Sun, UserPlus, Users, Wallet } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import {
  ActionSurface, Avatar, Badge, Button, ChartCard, CrmCard, DonutChart, FilterSelect,
  IconButton, KpiCard, Surface, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text,
} from '../../../design-system';
import { formatDateTimeFullBR, formatTimeBR, getDateKey } from '../../../lib/dateUtils';
import type { Contract } from '../../contracts';
import type { Lead } from '../../leads';
import type {
  DashboardChartDatum, DashboardCommercialAnalysis, DashboardPeriodFilter,
  DashboardDateRange,
} from '../shared/dashboardTypes';
import { parseDashboardDateValue } from '../shared/dashboardUtils';

type DashboardTodayProps = {
  name?: string;
  analysis: DashboardCommercialAnalysis;
  funnel: DashboardChartDatum[];
  leads: Lead[];
  contracts: Contract[];
  activeContracts: Contract[];
  period: DashboardPeriodFilter;
  canViewAgenda: boolean;
  canViewLeads: boolean;
  canViewContracts: boolean;
  showFinancialMetrics: boolean;
  onPeriodChange: (period: DashboardPeriodFilter) => void;
  onOpenAgenda: () => void;
  onOpenLeads: () => void;
  onOpenLead: (id: string) => void;
  onOpenContract: (contract: Contract) => void;
  onOpenStage: (stage: string) => void;
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
const funnelColors = ['var(--brand-primary)', 'var(--info-text)', 'var(--cyan-text)', 'var(--purple-text)', 'var(--warning-text)'];
const periodOptions = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: 'mes-atual', label: 'Este mês' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes-anterior', label: 'Mês anterior' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'todo-periodo', label: 'Todo o período' },
  { value: 'personalizado', label: 'Período personalizado', disabled: true },
];

function getSeries(leads: Lead[], contracts: Contract[], range: DashboardDateRange | null) {
  const entries = [
    ...leads.map((lead) => ({ date: parseDashboardDateValue(lead.data_criacao || lead.created_at), key: 'leads' as const })),
    ...contracts.map((contract) => ({ date: parseDashboardDateValue(contract.data_inicio || contract.previsao_recebimento_comissao || contract.created_at), key: 'contracts' as const })),
  ];
  const byDay = Boolean(range && range.end.getTime() - range.start.getTime() <= 90 * 86400000);
  const bucket = (date: Date) => getDateKey(date).slice(0, byDay ? 10 : 7);
  const points = new Map<string, { label: string; leads: number; contracts: number }>();
  const getPoint = (date: Date) => {
    const key = bucket(date);
    const existing = points.get(key);
    if (existing) return existing;
    const point = { label: (byDay ? shortDate : shortMonth).format(date).replace(/\./g, ''), leads: 0, contracts: 0 };
    points.set(key, point);
    return point;
  };
  if (byDay && range) {
    for (const day = new Date(range.start); day <= range.end; day.setDate(day.getDate() + 1)) getPoint(day);
  }
  for (const { date, key } of entries) if (date) getPoint(date)[key] += 1;
  return Array.from(points).sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point);
}

function OperationChart({ series }: { series: ReturnType<typeof getSeries> }) {
  const chartHeight = 178;
  const chartWidth = 600;
  const max = Math.max(4, Math.ceil(Math.max(0, ...series.flatMap((point) => [point.leads, point.contracts])) / 4) * 4);
  const step = chartWidth / Math.max(1, series.length - 1);
  const y = (value: number) => chartHeight - value / max * chartHeight;
  const path = (key: 'leads' | 'contracts') => series.map((point, index) => {
    const x = step * index;
    if (!index) return `M 0 ${y(point[key])}`;
    const middle = x - step / 2;
    return `C ${middle} ${y(series[index - 1][key])} ${middle} ${y(point[key])} ${x} ${y(point[key])}`;
  }).join(' ');
  const leadPath = path('leads');
  const labels = Array.from({ length: Math.min(series.length, 6) }, (_, index) => series[Math.round(index * (series.length - 1) / Math.max(1, Math.min(series.length, 6) - 1))]);

  return <div className="kds-operation-chart">
    <div className="kds-operation-chart-legend"><span>Leads recebidos</span><span>Contratos fechados</span></div>
    {series.length ? <div className="kds-operation-chart-grid" role="img" aria-label="Evolução de leads e contratos no período">
      <div className="kds-operation-chart-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{tick * max / 4}</span>)}</div>
      <svg viewBox={`0 -4 ${chartWidth} ${chartHeight + 8}`} preserveAspectRatio="none" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((tick) => <line key={tick} x1={0} y1={y(tick * max / 4)} x2={chartWidth} y2={y(tick * max / 4)} />)}
        {series.length > 1 && <path d={`${leadPath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`} fill="var(--brand-primary-soft)" />}
        <path d={leadPath} fill="none" stroke="var(--brand-primary)" strokeWidth="2.3" vectorEffect="non-scaling-stroke" />
        <path d={path('contracts')} fill="none" stroke="var(--chart-comparison)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {series.length === 1 && <><circle cx={4} cy={y(series[0].leads)} r={3} fill="var(--brand-primary)" /><circle cx={4} cy={y(series[0].contracts)} r={2} fill="var(--chart-comparison)" /></>}
      </svg>
      <div className="kds-operation-chart-labels" aria-hidden="true">{labels.map((item, index) => <span key={index}>{item.label}</span>)}</div>
    </div> : <Text className="kds-dashboard-overview-empty">Sem registros no período.</Text>}
  </div>;
}

export function DashboardToday({
  name, analysis, funnel, leads, contracts, activeContracts, period, canViewAgenda, canViewLeads, canViewContracts,
  showFinancialMetrics, onPeriodChange, onOpenAgenda, onOpenLeads, onOpenLead, onOpenContract, onOpenStage,
}: DashboardTodayProps) {
  const series = useMemo(() => getSeries(leads, contracts, analysis.currentRange), [analysis.currentRange, contracts, leads]);
  const totalLeads = funnel.reduce((total, stage) => total + stage.value, 0);
  const agenda = analysis.agenda.items.filter((item) => !item.completed).slice(0, 4);
  const todayCount = analysis.agenda.pending;
  const recentLeads = canViewLeads ? [...leads].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 4) : [];
  const recentContracts = canViewContracts ? [...contracts].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 3) : [];
  const recentActivities = [
    ...recentLeads.map((lead) => ({ id: lead.id, title: lead.origem ? `${lead.nome_completo} chegou por ${lead.origem}.` : `${lead.nome_completo} entrou no funil.`, date: lead.created_at, icon: UserPlus, action: canViewLeads ? () => onOpenLead(lead.id) : undefined, tone: 'info' })),
    ...recentContracts.map((contract) => ({ id: contract.id, title: `Contrato ${contract.codigo_contrato} cadastrado.`, date: contract.created_at, icon: FileCheck, action: () => onOpenContract(contract), tone: 'brand' })),
  ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 3);
  const metrics = [
    { title: 'Leads em acompanhamento', value: totalLeads, description: 'No funil do período', icon: Users, tone: 'brand' },
    { title: 'Contratos ativos', value: activeContracts.length, description: 'Contratos vigentes', icon: FileCheck, tone: 'info' },
    { title: 'Mensalidades da carteira', value: showFinancialMetrics ? currency.format(activeContracts.reduce((sum, contract) => sum + (Number(contract.mensalidade_total) || 0), 0)) : '—', description: showFinancialMetrics ? 'Nos contratos vigentes' : 'Restrito ao perfil', icon: Wallet, tone: 'cyan' },
    { title: 'Vidas acompanhadas', value: activeContracts.reduce((sum, contract) => sum + (Number(contract.vidas) || 0), 0), description: 'Nos contratos vigentes', icon: Heart, tone: 'purple' },
  ];

  return <div className="kds-dashboard-today">
    <Surface className="kds-dashboard-welcome" padding="none">
      <span className="kds-dashboard-activity-icon" data-tone="brand"><Sun size={18} aria-hidden="true" /></span>
      <Text><strong>{name ? `Olá, ${name.split(' ')[0]}.` : 'Olá.'}</strong> {canViewAgenda && (todayCount === 1 ? 'Você tem 1 acompanhamento para hoje.' : `Você tem ${todayCount} acompanhamentos para hoje.`)}</Text>
      {canViewAgenda && <Button size="sm" variant="secondary" onClick={onOpenAgenda}>Organizar meu dia <ArrowUpRight aria-hidden="true" /></Button>}
    </Surface>

    <section className="kds-dashboard-today-metrics" aria-label="Indicadores da operação">
      {metrics.map(({ title, description, value, icon: Icon, tone }) => <KpiCard key={title} data-tone={tone} title={title} value={<span>{value}</span>} icon={<Icon aria-hidden="true" />} trend={description} />)}
    </section>

    <div className="kds-dashboard-today-columns">
      <ChartCard title="Uma operação que avança" subtitle="Evolução de leads e contratos no período." subtitlePlacement="visible" actions={<FilterSelect size="sm" value={period} options={periodOptions} neutralValues={[period]} onChange={(value) => onPeriodChange(value as DashboardPeriodFilter)} includePlaceholderOption={false} placeholder="Período do gráfico" />}>
        <OperationChart series={series} />
      </ChartCard>
      <ChartCard title="Seu funil, agora" subtitle="Oportunidades em cada momento da negociação." subtitlePlacement="visible" actions={canViewLeads && <IconButton variant="ghost" size="sm" aria-label="Abrir funil de leads" onClick={onOpenLeads}><ArrowUpRight aria-hidden="true" /></IconButton>}>
        <div className="kds-dashboard-funnel"><DonutChart data={funnel.map((item, index) => ({ ...item, color: funnelColors[index % funnelColors.length] }))} size={156} strokeWidth={16} centerLabel="leads ativos" onSegmentClick={canViewLeads ? onOpenStage : undefined} compact /></div>
        <div className="kds-dashboard-funnel-key">{funnel.map((stage, index) => (
          <ActionSurface key={stage.label} variant="plain" padding="none" disabled={!canViewLeads} onClick={() => onOpenStage(stage.label)} style={{ '--stage-color': funnelColors[index % funnelColors.length] } as CSSProperties}><span>{stage.label}</span><strong>{stage.value}</strong></ActionSurface>
        ))}</div>
      </ChartCard>
      {canViewAgenda && <CrmCard className="kds-dashboard-task-card" title="Atenção para os próximos passos" subtitle="Pequenas ações que mantêm o cuidado em dia." subtitlePlacement="visible" actions={<Button variant="text" size="sm" onClick={onOpenAgenda}>Ver agenda <ArrowUpRight aria-hidden="true" /></Button>}>
        {agenda.length ? <div>{agenda.map((item) => <div key={item.id} className="kds-dashboard-task-row">
          <CalendarClock size={16} aria-hidden="true" /><span><strong>{item.title}</strong><small>{[item.leadName, item.type].filter(Boolean).join(' · ')}</small></span><time dateTime={item.date}>{formatTimeBR(item.date)}</time>
        </div>)}</div> : <Text className="kds-dashboard-overview-empty">Nenhum acompanhamento pendente no período.</Text>}
      </CrmCard>}
      <CrmCard title="A operação em movimento" subtitle="O que aconteceu mais recentemente." subtitlePlacement="visible">
        {recentActivities.length ? <div>{recentActivities.map(({ id, title, date, icon: Icon, tone, action }) => <div className="kds-dashboard-activity-row" key={id}>
          <span className="kds-dashboard-activity-icon" data-tone={tone}><Icon size={14} aria-hidden="true" /></span><span><strong>{title}</strong><small>{formatDateTimeFullBR(date)}</small></span>
          {action && <IconButton variant="ghost" size="sm" aria-label={title} onClick={action}><ArrowUpRight aria-hidden="true" /></IconButton>}
        </div>)}</div> : <Text className="kds-dashboard-overview-empty">Sem atividades recentes no período.</Text>}
      </CrmCard>
    </div>

    {canViewLeads && <CrmCard className="kds-dashboard-recent-leads" title="Conversas que merecem continuidade" subtitle="Leads recentes para acompanhar com proximidade." subtitlePlacement="visible" padding="none" actions={<Button variant="text" size="sm" onClick={onOpenLeads}>Todos os leads <ArrowUpRight aria-hidden="true" /></Button>}>
      {recentLeads.length ? <Table aria-label="Leads recentes">
        <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Etapa</TableHead><TableHead>Responsável</TableHead><TableHead>Próximo acompanhamento</TableHead></TableRow></TableHeader>
        <TableBody>{recentLeads.map((lead) => <TableRow key={lead.id}><TableCell>
          <div className="kds-dashboard-lead-cell"><Avatar name={lead.nome_completo} size="sm" tone="brand" />
            <span><Button size="sm" variant="text" onClick={() => onOpenLead(lead.id)}>{lead.nome_completo}</Button><small>{lead.cidade || lead.origem || '—'}</small></span>
          </div></TableCell><TableCell><Badge tone="info">{lead.status || 'Sem etapa'}</Badge></TableCell><TableCell>{lead.responsavel || '—'}</TableCell><TableCell>{lead.proximo_retorno ? formatDateTimeFullBR(lead.proximo_retorno) : '—'}</TableCell></TableRow>)}</TableBody>
      </Table> : <Text className="kds-dashboard-overview-empty">Nenhum lead para mostrar no período.</Text>}
    </CrmCard>}
  </div>;
}
