import { useMemo } from 'react';
import { TrendingDown, Users } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { Lead } from '../lib/supabase';

type LeadFunnelProps = {
  leads: Lead[];
};

const shellStyle = {
  borderColor: 'var(--panel-border,#d4c0a7)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, var(--panel-surface-soft,#efe6d8) 8%) 100%)',
  boxShadow: '0 26px 50px -38px rgba(26,18,13,0.38)',
} as const;

const insetStyle = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 90%, transparent)',
} as const;

const summaryPillStyle = {
  borderColor: 'var(--panel-border-subtle,#e4d5c0)',
  background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)',
  color: 'var(--panel-text-soft,#5b4635)',
} as const;

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

  const calculateConversionRate = (index: number): number => {
    if (index === 0) return 100;
    const previousCount = getLeadsByStatus(stages[index - 1].id).length;
    const currentCount = getLeadsByStatus(stages[index].id).length;
    if (previousCount === 0) return 0;
    return (currentCount / previousCount) * 100;
  };

  const totalLeads = funnelLeads.length;

  if (stages.length === 0) {
    return (
      <div
        className="panel-glass-panel rounded-[2rem] border border-dashed p-12 text-center"
        style={{
          ...shellStyle,
          borderStyle: 'dashed',
          color: 'var(--panel-text-muted,#876f5c)',
        }}
      >
        Configure os status do funil para visualizar este grafico.
      </div>
    );
  }

  return (
    <div
      className="panel-glass-panel relative overflow-hidden rounded-[2rem] border p-6 sm:p-7"
      style={shellStyle}
    >
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            'radial-gradient(circle at top right, rgba(212,120,42,0.12), transparent 34%), radial-gradient(circle at bottom left, rgba(120,72,34,0.1), transparent 40%)',
        }}
      />

      <div className="relative">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className="text-[11px] font-black uppercase tracking-[0.24em]"
              style={{ color: 'var(--panel-text-muted,#876f5c)' }}
            >
              Panorama
            </p>
            <h3 className="mt-3 text-xl font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
              Funil comercial
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
              Leitura do pipeline ativo e da conversao entre etapas.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
            style={summaryPillStyle}
          >
            <Users className="h-4 w-4" style={{ color: 'var(--panel-accent-strong,#b85c1f)' }} />
            <span style={{ color: 'var(--panel-text,#1c1917)' }}>{totalLeads}</span>
            <span>leads ativos</span>
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
              <div key={stage.id} className="rounded-[1.5rem] border p-4 sm:p-5" style={insetStyle}>
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
                      <span className="text-base font-semibold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                        {stage.nome}
                      </span>
                    </div>

                    <div
                      className="mt-4 h-3 overflow-hidden rounded-full"
                      style={{ background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 78%, transparent)' }}
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
                    <div
                      className="rounded-2xl border px-3 py-2"
                      style={{
                        borderColor: 'var(--panel-border-subtle,#e4d5c0)',
                        background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, transparent)',
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--panel-text-muted,#876f5c)' }}
                      >
                        Volume
                      </p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                        {count}
                      </p>
                    </div>

                    <div
                      className="rounded-2xl border px-3 py-2"
                      style={{
                        borderColor: 'var(--panel-border-subtle,#e4d5c0)',
                        background: 'color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, transparent)',
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--panel-text-muted,#876f5c)' }}
                      >
                        Participacao
                      </p>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--panel-text,#1c1917)' }}>
                        {percentage.toFixed(1)}%
                      </p>
                    </div>

                    <div
                      className="rounded-2xl border px-3 py-2"
                      style={{
                        borderColor: index === 0 ? 'var(--panel-border-subtle,#e4d5c0)' : color,
                        background:
                          index === 0
                            ? 'color-mix(in srgb, var(--panel-surface,#fffdfa) 94%, transparent)'
                            : `color-mix(in srgb, ${color} 12%, var(--panel-surface,#fffdfa))`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingDown
                          className="h-3.5 w-3.5"
                          style={{ color: index === 0 ? 'var(--panel-text-muted,#876f5c)' : color }}
                        />
                        <p
                          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: 'var(--panel-text-muted,#876f5c)' }}
                        >
                          Conversao
                        </p>
                      </div>
                      <p className="mt-1 text-xl font-bold" style={{ color: 'var(--panel-text,#1c1917)' }}>
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
