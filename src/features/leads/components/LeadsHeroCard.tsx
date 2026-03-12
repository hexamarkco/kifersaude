import { BarChart3, Layers3, Sparkles, Users } from "lucide-react";

import { LEADS_HERO_STYLE, LEADS_PILL_STYLE } from "../shared/leadsManagerStyles";

type LeadsHeroCardProps = {
  showArchived: boolean;
  filteredLeadCount: number;
  baseLeadCount: number;
  activeFilterCount: number;
  scheduledCount: number;
  viewModeLabel: string;
};

export function LeadsHeroCard({
  showArchived,
  filteredLeadCount,
  baseLeadCount,
  activeFilterCount,
  scheduledCount,
  viewModeLabel,
}: LeadsHeroCardProps) {
  return (
    <div
      className="panel-glass-hero rounded-[2rem] border p-7 sm:p-8"
      style={LEADS_HERO_STYLE}
      data-panel-animate
    >
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              ...LEADS_PILL_STYLE,
              color: "var(--panel-accent-ink,#6f3f16)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{showArchived ? "Base historica" : "Pipeline em foco"}</span>
          </div>
          <h3
            className="mt-4 text-2xl font-bold sm:text-[2rem]"
            style={{ color: "var(--panel-text,#1c1917)" }}
          >
            {showArchived
              ? "Arquivos organizados para reativacao inteligente"
              : "Uma visao comercial mais refinada para agir rapido"}
          </h3>
          <p
            className="mt-2 text-sm sm:text-base"
            style={{ color: "var(--panel-text-soft,#5b4635)" }}
          >
            {showArchived
              ? "Revise historicos, filtre oportunidades antigas e recupere negocios sem perder contexto."
              : "Busque, distribua e acompanhe retornos com a mesma linguagem premium que ja elevou o Dashboard."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {[
              {
                icon: Users,
                label: `${filteredLeadCount} no recorte`,
              },
              {
                icon: Layers3,
                label: `${baseLeadCount} na base visivel`,
              },
              {
                icon: BarChart3,
                label: `${scheduledCount} retornos mapeados`,
              },
              {
                icon: Sparkles,
                label: `${activeFilterCount} filtros ativos`,
              },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  ...LEADS_PILL_STYLE,
                  color: "var(--panel-text-soft,#5b4635)",
                }}
              >
                <Icon
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                />
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex lg:flex-col lg:items-end lg:gap-3">
          <div
            className="flex h-28 w-28 items-center justify-center rounded-[2rem] border"
            style={{
              ...LEADS_PILL_STYLE,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
            }}
          >
            <Users
              className="h-14 w-14 opacity-80"
              style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
            />
          </div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--panel-text-muted,#876f5c)" }}
          >
            {viewModeLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
