import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';

type Option = {
  value: string;
  label: string;
};

type FilterSingleSelectProps = {
  icon: LucideIcon;
  options: Option[];
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  includePlaceholderOption?: boolean;
  disabled?: boolean;
  size?: 'default' | 'compact';
};

export default function FilterSingleSelect({
  icon: Icon,
  options,
  placeholder,
  value,
  onChange,
  includePlaceholderOption = true,
  disabled = false,
  size = 'default',
}: FilterSingleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const optionsWithDefault = useMemo(() => {
    if (!includePlaceholderOption) {
      return options;
    }

    const hasDefault = options.some((option) => option.value === '');
    if (hasDefault) {
      return options;
    }

    return [{ value: '', label: placeholder }, ...options];
  }, [includePlaceholderOption, options, placeholder]);

  const selectedLabel = useMemo(() => {
    const selected = optionsWithDefault.find((option) => option.value === value);
    return selected?.label ?? placeholder;
  }, [optionsWithDefault, placeholder, value]);

  const isCompact = size === 'compact';

  const iconSizeClass = isCompact ? 'h-4 w-4' : 'h-5 w-5';
  const iconOffsetClass = isCompact ? 'left-2.5' : 'left-3';
  const chevronSizeClass = isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const buttonPaddingClass = isCompact ? 'pl-8 pr-8 h-8' : 'pl-10 pr-10 h-11';
  const labelTextClass = isCompact ? 'text-xs' : 'text-sm';
  const optionTextClass = isCompact ? 'text-xs py-1.5' : 'text-sm py-2';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen((current) => !current);
        }}
        className={`panel-glass-panel panel-interactive-glass relative w-full rounded-lg border border-slate-300 bg-white text-left transition-shadow focus:border-transparent focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60 ${buttonPaddingClass}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <Icon className={`absolute top-1/2 -translate-y-1/2 text-slate-400 ${iconOffsetClass} ${iconSizeClass}`} />
        <span className={`block truncate ${labelTextClass} ${value ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
          {selectedLabel}
        </span>
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${chevronSizeClass} ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="panel-glass-panel absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
          {optionsWithDefault.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 text-left transition-colors ${optionTextClass} ${
                  isSelected
                    ? 'bg-teal-50 font-medium text-teal-700'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
