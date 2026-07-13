import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../lib/cx';
import { Button, DateTimePicker, Popover, PopoverContent, PopoverTrigger } from '../design-system';

export type FilterDateRangeProps = {
  icon: LucideIcon;
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
};

export default function FilterDateRange({
  icon: Icon,
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  type = 'date',
}: FilterDateRangeProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatValue = (value: string) => {
    if (!value) return '';

    const baseDate = type === 'date' ? `${value}T00:00:00` : value;
    const parsed = new Date(baseDate);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (type === 'date') {
      return dateFormatter.format(parsed);
    }

    return `${dateFormatter.format(parsed)} ${timeFormatter.format(parsed)}`;
  };

  const displayValue = useMemo(() => {
    if (!fromValue && !toValue) {
      return 'Qualquer data';
    }

    if (fromValue && toValue) {
      return `${formatValue(fromValue)} — ${formatValue(toValue)}`;
    }

    if (fromValue) {
      return `A partir de ${formatValue(fromValue)}`;
    }

    return `Até ${formatValue(toValue)}`;
  }, [fromValue, toValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilter = Boolean(fromValue || toValue);

  const handleClear = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="block">
        <button
        type="button"
        className="kds-select panel-ui-input relative h-auto w-full py-2.5 pl-10 pr-9 text-left"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Icon
          className={cx(
            'absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2',
            'text-[var(--text-muted)]',
          )}
        />
        <div className="flex flex-col gap-0.5">
          <span
            className={cx(
              'text-xs font-semibold uppercase tracking-wide',
              'text-[var(--text-muted)]',
            )}
          >
            {label}
          </span>
          <span
            className={cx(
              'text-sm',
              hasActiveFilter
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)]',
            )}
          >
            {displayValue}
          </span>
        </div>
        <ChevronDown
          className={cx(
            'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform',
            'text-[var(--text-muted)]',
            isOpen && 'rotate-180',
          )}
        />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        className="w-[min(26.25rem,calc(100vw-1rem))] space-y-3 p-4"
        aria-label={`Selecionar intervalo de ${label}`}
      >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                De
              </span>
              <DateTimePicker
                type={type}
                value={fromValue}
                onChange={(event) => onFromChange(event.target.value)}
                placeholder={type === 'date' ? 'Selecionar data inicial' : 'Selecionar data e hora inicial'}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--text-secondary)]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Até
              </span>
              <DateTimePicker
                type={type}
                value={toValue}
                onChange={(event) => onToChange(event.target.value)}
                placeholder={type === 'date' ? 'Selecionar data final' : 'Selecionar data e hora final'}
              />
            </label>
          </div>
          <div
            className={cx(
              'flex items-center justify-between border-t pt-2',
              'border-[var(--border-subtle)]',
            )}
          >
            <Button
              variant="ghost"
              onClick={handleClear}
              className="h-auto px-0"
            >
              Limpar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Concluído
            </Button>
          </div>
      </PopoverContent>
    </Popover>
  );
}
