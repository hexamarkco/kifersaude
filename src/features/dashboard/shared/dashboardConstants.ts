import type { CSSProperties } from 'react';

import type { TabItem } from '../../../components/ui/Tabs';
import { PANEL_PILL_STYLE } from '../../../components/ui/panelStyles';
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

export const DASHBOARD_PILL_STYLE: CSSProperties = PANEL_PILL_STYLE;

export const CALENDAR_LEGEND_STYLES = {
  adjustment: {
    dot: 'var(--brand-primary)',
    background: 'var(--brand-primary-soft)',
    border: 'var(--brand-primary-border)',
    text: 'var(--accent-gold-hover)',
  },
  birthday: {
    dot: 'var(--border-strong)',
    background: 'color-mix(in srgb, var(--bg-elevated) 82%, white)',
    border: 'var(--border-default)',
    text: 'var(--text-secondary)',
  },
} as const;

export const DASHBOARD_METRIC_COLORS: Record<DashboardMetric, string> = {
  leads: '#cf7b32',
  contratos: '#8d6b4d',
  comissoes: '#b85c1f',
};

export const DASHBOARD_OPERADORA_COLORS = ['#cf7b32', '#9d7f5a', '#d5a25c', '#7a5a44', '#b85c1f'] as const;

export const mapOperadoraChartData = (
  items: Array<{ operadora: string; count: number }>,
): DashboardChartDatum[] =>
  items.map((item, index) => ({
    label: item.operadora,
    value: item.count,
    color: DASHBOARD_OPERADORA_COLORS[index % DASHBOARD_OPERADORA_COLORS.length],
  }));
