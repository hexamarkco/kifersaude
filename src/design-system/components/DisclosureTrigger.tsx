import type { ComponentPropsWithoutRef } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { getPanelButtonClass, type ControlSize } from '../tokens';

export type DisclosureTriggerProps = ComponentPropsWithoutRef<'summary'> & {
  icon?: LucideIcon;
  size?: ControlSize;
};

/** Native disclosure behavior with the same geometry as other filter controls. */
export default function DisclosureTrigger({ icon: Icon, size = 'md', className, children, ...props }: DisclosureTriggerProps) {
  return (
    <summary className={getPanelButtonClass({ variant: 'secondary', size, className: `kds-disclosure-trigger ${className ?? ''}` })} {...props}>
      {Icon && <Icon className="kds-control-icon" aria-hidden="true" />}
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDown className="kds-disclosure-chevron kds-control-icon" aria-hidden="true" />
    </summary>
  );
}
