import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

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
        <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white text-left flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedOptions.length === 0 ? 'text-slate-400' : 'text-slate-700'}>
          {displayText}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-[100]">
          <button
            type="button"
            className="w-full text-left text-xs text-orange-600 px-3 py-2 hover:bg-slate-50 border-b border-slate-100"
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
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span
                  className={`flex items-center justify-center w-4 h-4 border rounded ${
                    isSelected ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
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
            <div className="px-3 py-2 text-xs text-slate-500">Nenhuma opção disponível</div>
          )}
        </div>
      )}
    </div>
  );
}
