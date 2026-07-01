import { TrendingUp } from 'lucide-react';

import { Surface } from '../../../design-system';

export function DashboardHeroCard() {
  return (
    <Surface variant="hero" padding="lg" data-panel-animate>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Motivacao do dia
          </p>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">
            Continue crescendo!
          </h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
            Mantenha seu pipeline ativo e acompanhe suas metricas em tempo real
          </p>
        </div>
        <div className="hidden flex-shrink-0 items-center justify-center lg:flex">
          <TrendingUp className="h-28 w-28 opacity-20 text-[var(--brand-primary)]" />
        </div>
      </div>
    </Surface>
  );
}
