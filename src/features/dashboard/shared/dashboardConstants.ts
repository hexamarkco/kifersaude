import type { TabItem } from '../../../components/ui/Tabs';
import type { DashboardChartDatum, DashboardMetric } from './dashboardTypes';

export const DASHBOARD_METRIC_TABS: TabItem<DashboardMetric>[] = [
  { id: 'leads', label: 'Leads' },
  { id: 'contratos', label: 'Contratos' },
  { id: 'comissoes', label: 'Comissoes' },
];

export const DASHBOARD_PERIOD_OPTIONS = [
  { value: 'mes-atual', label: 'Mes atual' },
  { value: 'todo-periodo', label: 'Todo periodo' },
  { value: 'personalizado', label: 'Personalizado' },
] as const;

export const DASHBOARD_CHART_RANGE_OPTIONS = [
  { value: '6', label: 'Ultimos 6 meses' },
  { value: '12', label: 'Ultimos 12 meses' },
] as const;

export const DASHBOARD_CHART_PALETTE = [
  'var(--brand-primary)',
  'var(--accent-gold)',
  'var(--purple-text)',
  'var(--success-text)',
  'var(--accent-copper)',
  'var(--danger-text)',
  'var(--text-muted)',
] as const;

export const DASHBOARD_METRIC_COLORS: Record<DashboardMetric, string> = {
  leads: DASHBOARD_CHART_PALETTE[0],
  contratos: DASHBOARD_CHART_PALETTE[1],
  comissoes: DASHBOARD_CHART_PALETTE[4],
};

export const mapOperadoraChartData = (
  items: Array<{ operadora: string; count: number }>,
): DashboardChartDatum[] =>
  items.map((item, index) => ({
    label: item.operadora,
    value: item.count,
    color: DASHBOARD_CHART_PALETTE[index % DASHBOARD_CHART_PALETTE.length],
  }));
