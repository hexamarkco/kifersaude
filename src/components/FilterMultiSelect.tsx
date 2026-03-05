import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import {
  getDropdownActionClass,
  getDropdownMenuClass,
  getDropdownTriggerClass,
  isPanelDarkTheme,
} from './ui/dropdownStyles';

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

type DropdownPos = { top: number; left: number; width: number };

export default function FilterMultiSelect({
  icon: Icon,
  options,
  placeholder,
  values,
  onChange,
}: FilterMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const calcPos = () => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const open = () => {
    calcPos();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    const handleScroll = () => calcPos();
    const handleResize = () => calcPos();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const toggleOption = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values]
  );
  const isDarkTheme = isPanelDarkTheme();

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length <= 2) return selectedOptions.map((o) => o.label).join(', ');
    return `${selectedOptions.length} selecionado(s)`;
  }, [placeholder, selectedOptions]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className={getDropdownTriggerClass({ isDark: isDarkTheme })}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon
          className={cx(
            'absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
          )}
        />
        <span
          className={cx(
            'text-sm',
            selectedOptions.length === 0
              ? isDarkTheme
                ? 'text-slate-400'
                : 'text-slate-400'
              : isDarkTheme
                ? 'text-slate-100'
                : 'text-slate-700',
          )}
        >
          {displayText}
        </span>
        <ChevronDown
          className={cx(
            'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          className={getDropdownMenuClass({
            isDark: isDarkTheme,
            className: 'max-h-60',
          })}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <button
            type="button"
            className={getDropdownActionClass(isDarkTheme)}
            onClick={() => onChange([])}
          >
            Limpar seleção
          </button>
          <div className={cx('border-t', isDarkTheme ? 'border-slate-700' : 'border-slate-100')} />
          {options.map((option) => {
            const isSelected = values.includes(option.value);
            return (
              <label
                key={option.value}
                className={cx(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  isDarkTheme ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <span
                  className={cx(
                    'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border',
                    isSelected
                      ? 'border-teal-500 bg-teal-500'
                      : isDarkTheme
                        ? 'border-slate-600'
                        : 'border-slate-300',
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
            <div className={cx('px-3 py-2 text-sm', isDarkTheme ? 'text-slate-400' : 'text-slate-500')}>
              Nenhuma opção disponível
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
