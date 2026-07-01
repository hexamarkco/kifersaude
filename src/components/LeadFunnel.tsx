import { useMemo } from 'react';
import { TrendingDown, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { SectionHeader } from '../design-system';
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

  if (stages.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-muted)] shadow-lg">
        Configure os status do funil para visualizar este grafico.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-lg">
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            'radial-gradient(circle at top right, color-mix(in srgb, var(--brand-primary) 14%, transparent) 0%, transparent 34%), radial-gradient(circle at bottom left, color-mix(in srgb, var(--brand-primary) 9%, transparent) 0%, transparent 40%)',
        }}
      />

      <div className="relative">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            eyebrow="Panorama"
            title="Funil comercial"
            description="Leitura do pipeline ativo e da conversao entre etapas."
          />

          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
            <Users className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>{totalLeads}</span>
            <span className="text-[var(--text-muted)]">leads ativos</span>
          </div>
        </div>

        <div className="space-y-4">
          {stages.map((stage, index) => {
            const stageLeads = getLeadsByStatus(stage.id);
            const count = stageLeads.length;
            const percentage = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            const width = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            const conversionRate = calculateConversionRate(index);
            const color = stage.cor || '#cf7b32';
            const progressWidth = count > 0 ? Math.max(width, 8) : 0;

            return (
              <div
                key={stage.id}
                className="rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3.5 w-3.5 rounded-full"
                        style={{
                          backgroundColor: color,
                          boxShadow: `0 0 0 7px color-mix(in srgb, ${color} 16%, transparent)`,
                        }}
                      />
                      <span className="text-base font-semibold text-[var(--text-primary)]">
                        {stage.nome}
                      </span>
                    </div>

                    <div
                      className="mt-4 h-3 overflow-hidden rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--bg-surface) 78%, var(--border-default))' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${progressWidth}%`,
                          background: `linear-gradient(90deg, ${color} 0%, color-mix(in srgb, ${color} 78%, white) 100%)`,
                          boxShadow: `0 10px 18px -16px ${color}`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[320px]">
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Volume
                      </p>
                      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                        {count}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Participacao
                      </p>
                      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>

                    <div
                      className="rounded-2xl border px-3 py-2"
                      style={{
                        borderColor: index === 0 ? 'var(--border-default)' : color,
                        background:
                          index === 0
                            ? 'var(--bg-surface)'
                            : `color-mix(in srgb, ${color} 12%, var(--bg-surface))`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingDown
                          className="h-3.5 w-3.5"
                          style={{ color: index === 0 ? 'var(--text-muted)' : color }}
                        />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Conversao
                        </p>
                      </div>
                      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
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
    </div>
  );
}
