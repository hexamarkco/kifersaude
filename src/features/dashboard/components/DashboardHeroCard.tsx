import { Text, Heading } from '../../../design-system';
import { TrendingUp } from 'lucide-react';

import {
  Surface,
} from '../../../design-system';

export function DashboardHeroCard() {
  return (
    <Surface variant="muted" padding="sm" data-panel-animate>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold-hover)]">
            Motivação do dia
          </Text>
          <Heading level={3} className="mt-1 font-[var(--font-display)] text-xl font-semibold text-[var(--text-primary)]">
            Continue crescendo!
          </Heading>
          <Text className="mt-1 text-sm text-[var(--text-secondary)]">
            Acompanhe as negociações em andamento e veja o que precisa da sua atenção
          </Text>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--kds-radius-md)] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
          <TrendingUp className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </div>
      </div>
    </Surface>
  );
}
