import { useMemo } from 'react';
import { ArrowDownRight, CircleDot, TrendingDown, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { SectionHeader, Surface } from '../design-system';
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

        <div className="mb-7 overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-1">
          <div className="flex h-4 overflow-hidden rounded-full bg-[var(--bg-inset)]">
            {stages.map((stage, index) => {
              const count = getStageCount(index);
              const width = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
              const color = stage.cor || 'var(--brand-primary)';

              return (
                <div
                  key={stage.id}
                  className="h-full min-w-[2px] transition-all duration-500 ease-out"
                  style={{
                    width: `${width}%`,
                    background: count > 0 ? color : 'transparent',
                  }}
                  title={`${stage.nome}: ${count}`}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const stageLeads = getLeadsByStatus(stage.id);
            const count = stageLeads.length;
            const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            const conversionRate = calculateConversionRate(index);
            const color = stage.cor || 'var(--brand-primary)';
            const progressWidth = widestStageCount > 0 ? Math.max((count / widestStageCount) * 100, count > 0 ? 8 : 0) : 0;

            return (
              <div
                key={stage.id}
                className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border"
                        style={{
                          borderColor: `color-mix(in srgb, ${color} 42%, var(--border-subtle))`,
                          background: `color-mix(in srgb, ${color} 10%, var(--bg-surface))`,
                        }}
                      >
                        <CircleDot className="h-[18px] w-[18px]" strokeWidth={1.75} style={{ color }} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                            Etapa {index + 1}
                          </span>
                          {index > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1 text-xs font-semibold leading-none text-[var(--text-secondary)]">
                              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                              {conversionRate.toFixed(0)}% conversao
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-lg font-semibold leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
                          {stage.nome}
                        </h3>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progressWidth}%`,
                            background: `linear-gradient(90deg, ${color} 0%, color-mix(in srgb, ${color} 76%, var(--accent-gold)) 100%)`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-[var(--text-secondary)]">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Volume</p>
                      <p className="mt-1 font-[var(--font-sans)] text-2xl font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)] tabular-nums">
                        {count}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Participacao</p>
                      <p className="mt-1 font-[var(--font-sans)] text-2xl font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)] tabular-nums">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Conversao</p>
                      <p className="mt-1 font-[var(--font-sans)] text-2xl font-semibold leading-none tracking-[-0.03em] text-[var(--text-primary)] tabular-nums">
                        {index === 0 ? 'Base' : `${conversionRate.toFixed(0)}%`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
