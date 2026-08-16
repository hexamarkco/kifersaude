import { useMemo } from 'react';
import { ArrowDownRight, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { SectionHeader, Surface } from '../design-system';
import { DASHBOARD_CHART_PALETTE } from '../features/dashboard/shared/dashboardConstants';
import type { Lead } from '../lib/supabase';

type LeadFunnelProps = {
  leads: Lead[];
};

export default function LeadFunnel({ leads }: LeadFunnelProps) {
  const { leadStatuses } = useConfig();

  const stages = useMemo(
    () => leadStatuses.filter((status) => status.ativo).sort((a, b) => a.ordem - b.ordem),
    [leadStatuses],
  );

  const funnelLeads = useMemo(
    () =>
      leads.filter(
        (lead) => !lead.arquivado && lead.status && stages.some((stage) => stage.nome === lead.status),
      ),
    [leads, stages],
  );

  const getLeadsByStatus = (statusId: string) => {
    const statusObj = stages.find((stage) => stage.id === statusId);
    const statusName = statusObj?.nome;
    return funnelLeads.filter((lead) => lead.status === statusName);
  };

  const getStageCount = (index: number) => getLeadsByStatus(stages[index].id).length;

  const getTailCount = (startIndex: number) =>
    stages.slice(startIndex).reduce((total, _stage, indexOffset) => total + getStageCount(startIndex + indexOffset), 0);

  const calculateConversionRate = (index: number): number => {
    if (index === 0) return 100;
    const previousReachCount = getTailCount(index - 1);
    const currentReachCount = getTailCount(index);
    if (previousReachCount === 0) return 0;
    return (currentReachCount / previousReachCount) * 100;
  };

  const totalLeads = funnelLeads.length;
  const widestStageCount = Math.max(...stages.map((_stage, index) => getStageCount(index)), 0);
  const stageSummaries = stages.map((stage, index) => {
    const count = getStageCount(index);
    const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
    const conversionRate = calculateConversionRate(index);
    const color = DASHBOARD_CHART_PALETTE[index % DASHBOARD_CHART_PALETTE.length];
    const widthDrop = stages.length > 1 ? (index / (stages.length - 1)) * 46 : 0;
    const funnelWidth = Math.max(34, 100 - widthDrop);
    const progressWidth = widestStageCount > 0 ? Math.max((count / widestStageCount) * 100, count > 0 ? 8 : 0) : 0;

    return {
      stage,
      count,
      percentage,
      conversionRate,
      color,
      funnelWidth,
      progressWidth,
    };
  });

  if (stages.length === 0) {
    return (
      <Surface variant="muted" className="border-dashed p-12 text-center text-[var(--text-muted)]">
        Configure os status do funil para visualizar este grafico.
      </Surface>
    );
  }

  return (
    <Surface padding="sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          eyebrow="Panorama"
          title="Funil comercial"
          description="Leitura do pipeline ativo e da conversao entre etapas."
        />

        <div className="flex items-center gap-2 rounded-2xl bg-[var(--bg-hover)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
          <Users className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
          {totalLeads.toLocaleString('pt-BR')} no pipeline
          <span className="text-[var(--text-subtle)]">·</span>
          {stages.length} etapas
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(12rem,0.6fr)_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-1.5">
          {stageSummaries.map((summary) => (
            <div
              key={summary.stage.id}
              className="h-8 transition-[width] duration-500"
              style={{
                width: `${summary.funnelWidth}%`,
                clipPath: 'polygon(4% 0%, 96% 0%, 88% 100%, 12% 100%)',
                background: summary.color,
              }}
              title={`${summary.stage.nome}: ${summary.count.toLocaleString('pt-BR')}`}
            />
          ))}
        </div>

        <div className="space-y-2.5">
          {stageSummaries.map((summary, index) => (
            <div key={summary.stage.id} className="rounded-2xl bg-[var(--bg-hover)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: summary.color }} />
                  <span className="truncate text-sm font-semibold text-[var(--text-primary)]">{summary.stage.nome}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                  {index > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-0.5">
                      <ArrowDownRight className="h-3 w-3" strokeWidth={1.75} />
                      {summary.conversionRate.toFixed(0)}%
                    </span>
                  )}
                  <span className="tabular-nums">{summary.count.toLocaleString('pt-BR')}</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${summary.progressWidth}%`, background: summary.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
