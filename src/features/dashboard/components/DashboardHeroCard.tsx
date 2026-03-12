import { TrendingUp } from 'lucide-react';

import { DASHBOARD_HERO_STYLE } from '../shared/dashboardConstants';

export function DashboardHeroCard() {
  return (
    <div className="panel-glass-hero rounded-[2rem] border p-7 sm:p-8" style={DASHBOARD_HERO_STYLE} data-panel-animate>
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--panel-text,#1c1917)' }}>
            Continue crescendo!
          </h3>
          <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
            Mantenha seu pipeline ativo e acompanhe suas metricas em tempo real
          </p>
        </div>
        <div className="hidden lg:block">
          <TrendingUp className="h-32 w-32 opacity-25" style={{ color: 'var(--panel-accent-strong,#b85c1f)' }} />
        </div>
      </div>
    </div>
  );
}
