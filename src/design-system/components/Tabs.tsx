import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  getPanelTabsListClass,
  getPanelTabsTriggerClass,
  panelTabsBadgeClass,
  type PanelTabsVariant,
  type PanelTabsSize,
} from '../tokens';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
};

export type TabsVariant = PanelTabsVariant;
export type TabsSize = PanelTabsSize;

export type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  variant?: TabsVariant;
  size?: TabsSize;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  className,
  listClassName,
  triggerClassName,
}: TabsProps<T>) {
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = items.map((item, itemIndex) => item.disabled ? -1 : itemIndex).filter((itemIndex) => itemIndex >= 0);
    if (enabled.length === 0) return;
    const current = Math.max(0, enabled.indexOf(index));
    const nextIndex = event.key === 'Home'
      ? enabled[0]
      : event.key === 'End'
        ? enabled[enabled.length - 1]
        : enabled[(current + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    const nextItem = items[nextIndex];
    triggerRefs.current[nextIndex]?.focus();
    if (nextItem) onChange(nextItem.id);
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={getPanelTabsListClass(variant, listClassName)}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.id === value;

          return (
            <button
              ref={(element) => { triggerRefs.current[index] = element; }}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              tabIndex={isActive ? 0 : -1}
              className={getPanelTabsTriggerClass({
                variant,
                isActive,
                size,
                className: triggerClassName,
              })}
            >
              {Icon && <Icon className="kds-control-icon" aria-hidden="true" />}
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={panelTabsBadgeClass}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
