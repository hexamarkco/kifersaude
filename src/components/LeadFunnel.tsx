import { useMemo } from 'react';
import { ArrowDownRight, TrendingDown, Users } from 'lucide-react';
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
      <div>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Panorama"
            title="Funil comercial"
            description="Leitura do pipeline ativo e da conversao entre etapas."
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
            <Surface variant="muted" padding="sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <Users className="h-4 w-4 text-[var(--brand-primary)]" />
                Pipeline ativo
              </div>
              <p className="mt-2 font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                {totalLeads}
              </p>
            </Surface>

            <Surface variant="muted" padding="sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <TrendingDown className="h-4 w-4 text-[var(--accent-copper)]" />
                Etapas ativas
              </div>
              <p className="mt-2 font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                {stages.length}
              </p>
            </Surface>
          </div>
        </div>

        <Surface variant="muted" padding="sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">Funil</p>
                <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Volume por etapa ativa</p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
              {totalLeads.toLocaleString('pt-BR')} total
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.78fr)_minmax(0,1fr)] lg:items-center">
            <div className="mx-auto flex w-full max-w-[34rem] flex-col items-center gap-1.5 py-2">
              {stageSummaries.map((summary) => (
                <div
                  key={summary.stage.id}
                  className="h-8 rounded-[var(--kds-radius-xs)] transition-[width] duration-500 sm:h-9"
                  style={{
                    width: `${summary.funnelWidth}%`,
                    clipPath: 'polygon(4% 0%, 96% 0%, 88% 100%, 12% 100%)',
                    background: summary.color,
                  }}
                  title={`${summary.stage.nome}: ${summary.count.toLocaleString('pt-BR')}`}
                />
              ))}
            </div>

            <div className="space-y-3">
              {stageSummaries.map((summary, index) => (
                <Surface key={summary.stage.id} padding="sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: summary.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{summary.stage.nome}</p>
                        <p className="mt-0.5 text-xs font-medium text-[var(--text-muted)]">Etapa {index + 1}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                      {index > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1 leading-none">
                          <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {summary.conversionRate.toFixed(0)}%
                        </span>
                      )}
                      <span className="font-[var(--font-sans)] tabular-nums">{summary.count.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${summary.progressWidth}%`,
                          background: summary.color,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {summary.percentage.toFixed(1)}%
                    </span>
                  </div>
                </Surface>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </Surface>
  );
}
