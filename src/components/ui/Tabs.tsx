import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
};

export type TabsVariant = 'underline' | 'pill';

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  variant?: TabsVariant;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
};

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
  listClassName,
  triggerClassName,
}: TabsProps<T>) {
  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cx(
          'flex w-full flex-wrap gap-2',
          variant === 'underline' && 'gap-0 border-b border-slate-200 px-2 sm:px-4',
          variant === 'pill' && 'rounded-xl bg-slate-100 p-1',
          listClassName,
        )}
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
              className={cx(
                'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'underline' && 'rounded-none border-b-2 px-3 py-4',
                variant === 'underline' &&
                  (isActive
                    ? 'border-teal-600 bg-teal-50/70 text-teal-700'
                    : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'),
                variant === 'pill' &&
                  (isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'),
                triggerClassName,
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-teal-100 px-1.5 text-xs font-semibold text-teal-700">
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
