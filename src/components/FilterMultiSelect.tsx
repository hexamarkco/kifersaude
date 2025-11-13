import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';

type Option = {
  value: string;
  label: string;
};

type FilterMultiSelectProps = {
  icon: LucideIcon;
  options: Option[];
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
};

const dropdownBaseClasses =
  'absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-30';

const optionBaseClasses =
  'flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer';

export default function FilterMultiSelect({
  icon: Icon,
  options,
  placeholder,
  values,
  onChange,
}: FilterMultiSelectProps) {
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

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= 2) {
      return selectedOptions.map((option) => option.label).join(', ');
    }
    return `${selectedOptions.length} selecionado(s)`;
  }, [placeholder, selectedOptions]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-left flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon className="absolute left-3 w-5 h-5 text-slate-400" />
        <span className={selectedOptions.length === 0 ? 'text-slate-400 text-sm' : 'text-slate-700 text-sm'}>
          {displayText}
        </span>
        <ChevronDown className={`absolute right-3 w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={dropdownBaseClasses} role="listbox">
          <button
            type="button"
            className="w-full text-left text-sm text-teal-600 px-3 py-2 hover:bg-slate-50"
            onClick={() => onChange([])}
          >
            Limpar seleção
          </button>
          <div className="border-t border-slate-100" />
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <label key={option.value} className={optionBaseClasses}>
                <span
                  className={`flex items-center justify-center w-4 h-4 border rounded ${
                    isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-300'
                  }`}
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
            <div className="px-3 py-2 text-sm text-slate-500">Nenhuma opção disponível</div>
          )}
        </div>
      )}
    </div>
  );
}
