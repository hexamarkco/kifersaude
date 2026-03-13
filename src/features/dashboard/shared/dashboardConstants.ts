import type { CSSProperties } from 'react';

import type { TabItem } from '../../../components/ui/Tabs';
import {
  PANEL_EMPTY_STATE_STYLE,
  PANEL_HERO_STYLE,
  PANEL_INSET_STYLE,
  PANEL_MUTED_INSET_STYLE,
  PANEL_PILL_STYLE,
  PANEL_SECTION_STYLE,
} from '../../../components/ui/panelStyles';
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

export const DASHBOARD_SECTION_STYLE: CSSProperties = PANEL_SECTION_STYLE;

export const DASHBOARD_INSET_STYLE: CSSProperties = PANEL_INSET_STYLE;

export const DASHBOARD_MUTED_INSET_STYLE: CSSProperties = PANEL_MUTED_INSET_STYLE;

export const DASHBOARD_PILL_STYLE: CSSProperties = PANEL_PILL_STYLE;

export const DASHBOARD_HERO_STYLE: CSSProperties = PANEL_HERO_STYLE;

export const CALENDAR_LEGEND_STYLES = {
  adjustment: {
    dot: 'var(--panel-accent-strong,#b85c1f)',
    background: 'var(--panel-accent-soft,#f6e4c7)',
    border: 'var(--panel-accent-border,#d5a25c)',
    text: 'var(--panel-accent-ink,#6f3f16)',
  },
  birthday: {
    dot: 'var(--panel-border-strong,#9d7f5a)',
    background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 82%, white)',
    border: 'var(--panel-border,#d4c0a7)',
    text: 'var(--panel-text-soft,#5b4635)',
  },
} as const;

export const DASHBOARD_METRIC_COLORS: Record<DashboardMetric, string> = {
  leads: '#cf7b32',
  contratos: '#8d6b4d',
  comissoes: '#b85c1f',
};

export const DASHBOARD_OPERADORA_COLORS = ['#cf7b32', '#9d7f5a', '#d5a25c', '#7a5a44', '#b85c1f'] as const;

export const DASHBOARD_EMPTY_DONUT_STATE_STYLE: CSSProperties = PANEL_EMPTY_STATE_STYLE;

export const mapOperadoraChartData = (
  items: Array<{ operadora: string; count: number }>,
): DashboardChartDatum[] =>
  items.map((item, index) => ({
    label: item.operadora,
    value: item.count,
    color: DASHBOARD_OPERADORA_COLORS[index % DASHBOARD_OPERADORA_COLORS.length],
  }));
