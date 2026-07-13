import { useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Checkbox, Popover, PopoverContent, PopoverTrigger } from '../../design-system';

type Option = {
  value: string;
  label: string;
};

type MultiSelectDropdownProps = {
  options: Option[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
};

export default function MultiSelectDropdown({
  options,
  values,
  onChange,
  placeholder = 'Selecione...',
  label,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleOption = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values]
  );

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((option) => option.label).join(', ');
    }
    return `${selectedOptions.length} selecionado(s)`;
  }, [placeholder, selectedOptions]);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-[11px] text-[var(--text-muted)]">
          {label}
        </label>
      )}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
      <button
        type="button"
        className="kds-select h-8 w-full rounded-[var(--kds-radius-md)] px-2.5 pr-8 text-left"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOptions.length === 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}>
          {displayText}
        </span>
        <ChevronDown
          className={cx(
            'h-4 w-4 transition-transform',
            'text-[var(--text-muted)]',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      </PopoverTrigger>

      {isOpen && (
        <PopoverContent align="start" className="max-h-48 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0">
          <button
            type="button"
            className={cx(
              'kds-button kds-button-text w-full justify-start rounded-none border-b border-[var(--border-subtle)] text-xs',
            )}
            onClick={() => {
              onChange([]);
              setIsOpen(false);
            }}
          >
            Limpar seleção
          </button>
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <label
                key={option.value}
                className={cx(
                  'kds-dropdown-option flex cursor-pointer items-center gap-2 px-3 py-2 text-xs',
                  isSelected && 'is-selected',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggleOption(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
              Nenhuma opção disponível
            </div>
          )}
        </PopoverContent>
      )}
      </Popover>
    </div>
  );
}
