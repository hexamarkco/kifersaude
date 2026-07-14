import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';

import { Input, Popover, PopoverContent, PopoverTrigger } from '../design-system';
import { cx } from '../lib/cx';

type Option = { value: string; label: string };

type FilterSingleSelectProps = {
  icon: LucideIcon;
  options: Option[];
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  includePlaceholderOption?: boolean;
  neutralValues?: string[];
  disabled?: boolean;
  size?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

export default function FilterSingleSelect({
  icon: Icon,
  options,
  placeholder,
  value,
  onChange,
  includePlaceholderOption = true,
  neutralValues = [],
  disabled = false,
  size = 'default',
  searchable = false,
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhuma opcao encontrada.',
}: FilterSingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const optionsWithPlaceholder = useMemo(
    () => includePlaceholderOption && !options.some((option) => option.value === '') ? [{ value: '', label: placeholder }, ...options] : options,
    [includePlaceholderOption, options, placeholder],
  );
  const filteredOptions = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return searchable && search ? optionsWithPlaceholder.filter((option) => option.value === '' || option.label.toLocaleLowerCase('pt-BR').includes(search)) : optionsWithPlaceholder;
  }, [optionsWithPlaceholder, searchTerm, searchable]);
  const selected = optionsWithPlaceholder.find((option) => option.value === value);
  const isNeutral = !selected || selected.value === '' || neutralValues.includes(selected.value);
  const compact = size === 'compact';
  const displayLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filteredOptions, isOpen, value]);

  useEffect(() => {
    if (!isOpen || !optionRefs.current[activeIndex]) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  const moveActiveOption = (direction: 1 | -1) => {
    if (filteredOptions.length === 0) return;
    setActiveIndex((current) => (current + direction + filteredOptions.length) % filteredOptions.length);
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveOption(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveOption(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
    }
  };

  return <Popover open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setSearchTerm(''); }}>
    <PopoverTrigger className="block">
      <button type="button" disabled={disabled} title={displayLabel} onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setIsOpen(true);
          setActiveIndex(event.key === 'ArrowUp' ? Math.max(0, filteredOptions.length - 1) : 0);
        }
      }} className={cx('kds-select panel-ui-input relative w-full text-left', compact ? 'h-8 px-8 text-xs' : 'h-10 px-9 text-sm')} aria-haspopup="listbox" aria-expanded={isOpen}>
        <Icon className={cx('absolute top-1/2 -translate-y-1/2 text-[var(--text-muted)]', compact ? 'left-2 h-3 w-3' : 'left-3 h-4 w-4')} aria-hidden="true" />
        <span className={cx('block truncate whitespace-nowrap pr-5', isNeutral ? 'text-[var(--text-secondary)]' : 'font-medium text-[var(--text-primary)]')}>
          {displayLabel}
        </span>
        <ChevronDown className={cx('absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-[min(20rem,calc(100vw-1rem))] p-1" role="listbox" aria-label={placeholder}>
      {searchable && <div className="border-b border-[var(--border-subtle)] p-2"><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={searchPlaceholder} autoFocus /></div>}
      <div className="max-h-72 overflow-y-auto">
        {filteredOptions.map((option, index) => <button ref={(element) => { optionRefs.current[index] = element; }} key={`${option.value}-${option.label}`} type="button" role="option" aria-selected={option.value === value} onKeyDown={handleOptionKeyDown} onClick={() => { onChange(option.value); setIsOpen(false); }} className={cx('kds-dropdown-option flex w-full items-center justify-between px-3 py-2 text-left text-sm', option.value === value && 'is-selected font-medium')}>
          <span className="truncate">{option.label}</span>{option.value === value && <Check className="h-4 w-4 text-[var(--accent-gold)]" aria-hidden="true" />}
        </button>)}
        {filteredOptions.length === 0 && <p className="px-3 py-4 text-sm text-[var(--text-muted)]">{emptyMessage}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}
