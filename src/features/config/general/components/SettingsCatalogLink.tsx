import { ArrowRight } from 'lucide-react';

import { ActionSurface, Badge } from '../../../../design-system';

type SettingsCatalogLinkProps = {
  title: string;
  description: string;
  ariaLabel: string;
  onClick: () => void;
  count?: number;
};

export function SettingsCatalogLink({
  title,
  description,
  ariaLabel,
  onClick,
  count,
}: SettingsCatalogLinkProps) {
  return (
    <ActionSurface
      variant="plain"
      padding="sm"
      className="flex w-full items-center justify-between gap-3 text-left"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{description}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {count !== undefined && <Badge tone="neutral">{count}</Badge>}
        <ArrowRight className="kds-control-icon text-[var(--text-secondary)]" aria-hidden="true" />
      </span>
    </ActionSurface>
  );
}
