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
};

export default function FilterSingleSelect({
  icon: Icon,
  options,
  placeholder,
  value,
  onChange,
  includePlaceholderOption = true,
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative h-11 w-full rounded-lg border border-slate-300 pl-10 pr-10 text-left focus:border-transparent focus:ring-2 focus:ring-teal-500"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <span className={`block truncate text-sm ${value ? 'font-medium text-slate-700' : 'text-slate-500'}`}>
          {selectedLabel}
        </span>
        <ChevronDown
          className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg" role="listbox">
          {optionsWithDefault.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
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
