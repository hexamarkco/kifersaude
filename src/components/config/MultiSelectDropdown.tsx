import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from '../../lib/cx';
import {
  getDropdownActionClass,
  getDropdownMenuClass,
  getDropdownTriggerClass,
  isPanelDarkTheme,
} from '../ui/dropdownStyles';

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values]
  );
  const isDarkTheme = isPanelDarkTheme();

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
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={getDropdownTriggerClass({
          isDark: isDarkTheme,
          compact: true,
          className: 'h-8 rounded-md pl-2.5 pr-8',
        })}
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

      {isOpen && (
        <div
          className={getDropdownMenuClass({
            isDark: isDarkTheme,
            position: 'absolute',
            className: 'left-0 right-0 mt-1 max-h-48 z-[100]',
          })}
        >
          <button
            type="button"
            className={cx(
              getDropdownActionClass(isDarkTheme),
              'border-b text-xs',
              'border-[var(--border-subtle)]',
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
                  <span
                    className={cx(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      isSelected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
                        : 'border-[var(--border-strong)]',
                    )}
                  >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOption(option.value)}
                  className="sr-only"
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
        </div>
      )}
    </div>
  );
}
