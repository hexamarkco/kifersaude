import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

import { Button, Checkbox, Popover, PopoverContent, PopoverTrigger, type PanelInputSize } from '../design-system';
import { cx } from '../lib/cx';

type Option = { value: string; label: string };

type FilterMultiSelectProps = {
  icon: LucideIcon;
  options: Option[];
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  size?: PanelInputSize;
};

export default function FilterMultiSelect({
  icon: Icon,
  options,
  placeholder,
  values,
  onChange,
  size = 'default',
}: FilterMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayText = useMemo(() => {
    const selected = options.filter((option) => values.includes(option.value));
    if (selected.length === 0) return placeholder;
    return selected.length <= 2 ? selected.map((option) => option.label).join(', ') : `${selected.length} selecionado(s)`;
  }, [options, placeholder, values]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="block">
        <button
          type="button"
          className={cx(
            'kds-select panel-ui-input relative w-full text-left',
            size === 'compact' && 'h-8 px-8 text-xs',
            size === 'default' && 'h-10 px-9 text-sm',
            size === 'large' && 'h-12 px-10 text-base',
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <Icon
            className={cx(
              'absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)]',
              size === 'compact' && 'left-2 h-3 w-3',
              size === 'default' && 'left-3 h-4 w-4',
              size === 'large' && 'left-3.5 h-5 w-5',
            )}
            aria-hidden="true"
          />
          <span className={values.length ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{displayText}</span>
          <ChevronDown
            className={cx(
              'absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-transform',
              size === 'compact' && 'right-2 h-3 w-3',
              size === 'default' && 'right-3 h-4 w-4',
              size === 'large' && 'right-3.5 h-5 w-5',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-2" role="listbox" aria-label={placeholder}>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="w-full justify-start">Limpar selecao</Button>
        <div className="my-1 border-t border-[var(--border-subtle)]" />
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => {
            const selected = values.includes(option.value);
            return <label key={option.value} className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm text-[var(--text-secondary)]">
              <Checkbox checked={selected} onChange={() => onChange(selected ? values.filter((item) => item !== option.value) : [...values, option.value])} />
              {option.label}
            </label>;
          })}
          {options.length === 0 && <p className="px-2 py-3 text-sm text-[var(--text-muted)]">Nenhuma opcao disponivel</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
