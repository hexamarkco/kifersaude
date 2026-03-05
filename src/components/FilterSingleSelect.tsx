import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import {
  getDropdownMenuClass,
  getDropdownOptionClass,
  getDropdownTriggerClass,
  isPanelDarkTheme,
} from './ui/dropdownStyles';

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

type DropdownPos = { top: number; left: number; width: number };

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const calcPos = () => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const openDropdown = () => {
    if (disabled) return;
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

    const handleSync = () => calcPos();

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleSync, true);
    window.addEventListener('resize', handleSync);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleSync, true);
      window.removeEventListener('resize', handleSync);
    };
  }, [isOpen, listboxId]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  const optionsWithDefault = useMemo(() => {
    if (!includePlaceholderOption) return options;
    const hasDefault = options.some((option) => option.value === '');
    if (hasDefault) return options;
    return [{ value: '', label: placeholder }, ...options];
  }, [includePlaceholderOption, options, placeholder]);

  const selectedLabel = useMemo(() => {
    const selected = optionsWithDefault.find((option) => option.value === value);
    return selected?.label ?? placeholder;
  }, [optionsWithDefault, placeholder, value]);

  const selectedIndex = useMemo(
    () => optionsWithDefault.findIndex((option) => option.value === value),
    [optionsWithDefault, value],
  );

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const selectOptionByIndex = (index: number) => {
    const option = optionsWithDefault[index];
    if (!option || disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'Tab') { setIsOpen(false); return; }
    if (event.key === 'Escape') { setIsOpen(false); return; }

    const lastIndex = optionsWithDefault.length - 1;
    if (lastIndex < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) { openDropdown(); return; }
      setHighlightedIndex((c) => (c >= lastIndex ? 0 : c + 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) { openDropdown(); return; }
      setHighlightedIndex((c) => (c <= 0 ? lastIndex : c - 1));
      return;
    }

    if (event.key === 'Home' && isOpen) { event.preventDefault(); setHighlightedIndex(0); return; }
    if (event.key === 'End' && isOpen) { event.preventDefault(); setHighlightedIndex(lastIndex); return; }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) { openDropdown(); return; }
      if (highlightedIndex >= 0) selectOptionByIndex(highlightedIndex);
    }
  };

  const isCompact = size === 'compact';
  const iconSizeClass = isCompact ? 'h-4 w-4' : 'h-5 w-5';
  const iconOffsetClass = isCompact ? 'left-2.5' : 'left-3';
  const chevronSizeClass = isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const labelTextClass = isCompact ? 'text-xs' : 'text-sm';
  const isDarkTheme = isPanelDarkTheme();

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        className={getDropdownTriggerClass({
          isDark: isDarkTheme,
          compact: isCompact,
        })}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        onKeyDown={handleKeyDown}
      >
        <Icon
          className={cx(
            'absolute top-1/2 -translate-y-1/2',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
            iconOffsetClass,
            iconSizeClass,
          )}
        />
        <span
          className={cx(
            'block truncate',
            labelTextClass,
            value
              ? isDarkTheme
                ? 'font-medium text-slate-100'
                : 'font-medium text-slate-700'
              : isDarkTheme
                ? 'text-slate-100'
                : 'text-slate-500',
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={cx(
            'absolute right-3 top-1/2 -translate-y-1/2 transition-transform',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
            chevronSizeClass,
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && pos && typeof document !== 'undefined' && createPortal(
        <div
          id={listboxId}
          ref={dropdownRef}
          className={getDropdownMenuClass({
            isDark: isDarkTheme,
            className: 'max-h-72',
          })}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          role="listbox"
        >
          {optionsWithDefault.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = highlightedIndex === index;

            return (
              <button
                key={`${option.value}-${option.label}`}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                ref={(element) => { optionRefs.current[index] = element; }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOptionByIndex(index)}
                className={getDropdownOptionClass({
                  isDark: isDarkTheme,
                  selected: isSelected,
                  highlighted: isHighlighted,
                  compact: isCompact,
                })}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <Check
                    className={cx(
                      'h-4 w-4 flex-shrink-0',
                      isDarkTheme ? 'text-teal-300' : 'text-teal-700',
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
