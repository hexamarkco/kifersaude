import type { CSSProperties } from 'react';

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

export const DASHBOARD_SECTION_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border,#d4c0a7)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, var(--panel-surface-soft,#efe6d8) 8%) 100%)',
  boxShadow: '0 26px 50px -38px rgba(26,18,13,0.38)',
};

export const DASHBOARD_INSET_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, transparent)',
};

export const DASHBOARD_MUTED_INSET_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 55%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)',
};

export const DASHBOARD_PILL_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)',
};

export const DASHBOARD_HERO_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border,#d4c0a7)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 90%, transparent) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 84%, transparent) 100%), radial-gradient(circle at top right, rgba(212,120,42,0.2), transparent 34%), radial-gradient(circle at bottom left, rgba(120,72,34,0.18), transparent 42%)',
  boxShadow: '0 30px 54px -40px rgba(26,18,13,0.4)',
};

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

export const DASHBOARD_EMPTY_DONUT_STATE_STYLE: CSSProperties = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 62%, transparent)',
  color: 'var(--panel-text-muted,#876f5c)',
};

export const mapOperadoraChartData = (
  items: Array<{ operadora: string; count: number }>,
): DashboardChartDatum[] =>
  items.map((item, index) => ({
    label: item.operadora,
    value: item.count,
    color: DASHBOARD_OPERADORA_COLORS[index % DASHBOARD_OPERADORA_COLORS.length],
  }));
