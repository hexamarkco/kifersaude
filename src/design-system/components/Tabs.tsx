import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
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
  ariaLabel?: string;
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
  ariaLabel,
}: TabsProps<T>) {
  const triggerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const activeTriggerRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const keepActiveTabVisible = () => {
      const activeTrigger = activeTriggerRef.current;
      if (!activeTrigger) return;

      const listRect = list.getBoundingClientRect();
      const triggerRect = activeTrigger.getBoundingClientRect();
      if (listRect.width === 0 || triggerRect.width === 0) return;

      const edgeGutter = 4;
      const leftOverflow = Math.max(0, listRect.left + edgeGutter - triggerRect.left);
      const rightOverflow = Math.max(0, triggerRect.right - listRect.right + edgeGutter);
      if (leftOverflow > 0) list.scrollLeft = Math.max(0, list.scrollLeft - leftOverflow);
      else if (rightOverflow > 0) list.scrollLeft += rightOverflow;
    };

    keepActiveTabVisible();
    window.addEventListener('resize', keepActiveTabVisible);
    return () => window.removeEventListener('resize', keepActiveTabVisible);
  }, [items, value]);

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
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={getPanelTabsListClass(variant, listClassName)}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.id === value;

          return (
            <button
              ref={(element) => {
                triggerRefs.current[index] = element;
                if (isActive) activeTriggerRef.current = element;
              }}
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
