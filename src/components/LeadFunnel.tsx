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
    <Surface className="overflow-hidden">
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            'radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--brand-primary) 14%, transparent) 0%, transparent 34%), radial-gradient(circle at 92% 10%, color-mix(in srgb, var(--accent-gold) 10%, transparent) 0%, transparent 32%)',
        }}
      />

      <div className="relative">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Panorama"
            title="Funil comercial"
            description="Leitura do pipeline ativo e da conversao entre etapas."
          />

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <Users className="h-4 w-4 text-[var(--brand-primary)]" />
                Pipeline ativo
              </div>
              <p className="mt-2 font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                {totalLeads}
              </p>
            </div>

            <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                <TrendingDown className="h-4 w-4 text-[var(--accent-copper)]" />
                Etapas ativas
              </div>
              <p className="mt-2 font-[var(--font-sans)] text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] tabular-nums">
                {stages.length}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1fr)] xl:items-stretch">
          <div className="rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">Funil</p>
                <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Volume por etapa ativa</p>
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                {totalLeads.toLocaleString('pt-BR')} total
              </span>
            </div>

            <div className="space-y-1.5">
              {stageSummaries.map((summary, index) => (
                <div
                  key={summary.stage.id}
                  className="mx-auto flex h-12 items-center justify-between gap-3 px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-[0_14px_28px_-22px_rgba(0,0,0,0.75)] transition-all duration-500"
                  style={{
                    width: `${summary.funnelWidth}%`,
                    clipPath: 'polygon(5% 0%, 95% 0%, 87% 100%, 13% 100%)',
                    background: `linear-gradient(180deg, color-mix(in srgb, ${summary.color} 94%, white) 0%, color-mix(in srgb, ${summary.color} 72%, black) 100%)`,
                  }}
                  title={`${summary.stage.nome}: ${summary.count}`}
                >
                  <span className="font-[var(--font-sans)] tabular-nums">{index + 1}</span>
                  <span className="font-[var(--font-sans)] tabular-nums">{summary.count.toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">Ranking por etapa</p>
              <span className="text-xs font-medium text-[var(--text-muted)]">participação e conversão</span>
            </div>

            <div className="space-y-3">
              {stageSummaries.map((summary, index) => (
                <div key={summary.stage.id} className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{
                          background: summary.color,
                          boxShadow: `0 0 0 6px color-mix(in srgb, ${summary.color} 13%, transparent)`,
                        }}
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
                          background: `linear-gradient(90deg, ${summary.color} 0%, color-mix(in srgb, ${summary.color} 76%, var(--accent-gold)) 100%)`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                      {summary.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}
