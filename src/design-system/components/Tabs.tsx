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
  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={getPanelTabsListClass(variant, listClassName)}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === value;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={item.disabled}
              onClick={() => onChange(item.id)}
              className={getPanelTabsTriggerClass({
                variant,
                isActive,
                size,
                className: triggerClassName,
              })}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
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
