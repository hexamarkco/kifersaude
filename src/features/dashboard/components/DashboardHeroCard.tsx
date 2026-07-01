import { TrendingUp } from 'lucide-react';

import { Surface } from '../../../design-system';

export function DashboardHeroCard() {
  return (
    <Surface variant="hero" padding="lg" data-panel-animate>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[var(--text-primary)]">
            Continue crescendo!
          </h3>
          <p className="mt-2 text-sm sm:text-base text-[var(--text-secondary)]">
            Mantenha seu pipeline ativo e acompanhe suas metricas em tempo real
          </p>
        </div>
        <div className="hidden lg:block">
          <TrendingUp className="h-32 w-32 opacity-25 text-[var(--brand-primary)]" />
        </div>
      </div>
    </Surface>
  );
}
