import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

import { cx } from '../../lib/cx';
import type { ControlSize } from '../tokens';
import Input from './Input';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import type { SelectOption } from './Select';
import { panelInputSizeClasses } from '../tokens';

export type ComboboxProps = {
  id?: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  size?: ControlSize;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
};

export default function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhuma opção encontrada.',
  size = 'md',
  disabled = false,
  invalid = false,
  className,
  'aria-label': ariaLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-options`;
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return term ? options.filter((option) => String(option.label).toLocaleLowerCase('pt-BR').includes(term)) : options;
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((option) => option.value === value && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : Math.max(0, filtered.findIndex((option) => !option.disabled)));
  }, [filtered, open, value]);

  const move = (direction: 1 | -1) => {
    const enabled = filtered.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
    if (enabled.length === 0) return;
    const current = Math.max(0, enabled.indexOf(activeIndex));
    setActiveIndex(enabled[(current + direction + enabled.length) % enabled.length]);
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
      <PopoverTrigger className="block w-full">
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={invalid || undefined}
          className={cx('kds-select kds-select-trigger panel-ui-input flex w-full items-center justify-between text-left', panelInputSizeClasses[size], invalid && 'kds-input-invalid', className)}
        >
          <span className={cx('min-w-0 flex-1 truncate', !selected && 'text-[var(--text-muted)]')}>{selected?.label ?? placeholder}</span>
          <ChevronDown className="kds-control-icon shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listboxId} className="kds-dropdown-menu w-[min(20rem,calc(100vw-1rem))] p-1" role="listbox" aria-label={ariaLabel ?? placeholder}>
        <div className="border-b border-[var(--border-subtle)] p-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} leftIcon={Search} size="sm" autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {filtered.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onKeyDown={handleOptionKeyDown}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={cx('kds-dropdown-option flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm', option.value === value && 'is-selected font-medium')}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.value === value && <Check className="kds-control-icon shrink-0" aria-hidden="true" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-3 py-4 text-sm text-[var(--text-muted)]">{emptyMessage}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
