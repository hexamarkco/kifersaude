import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  neutralValues?: string[];
  disabled?: boolean;
  size?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
};

type DropdownPos = { top: number; left: number; width: number; maxHeight: number };

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isCompact = size === 'compact';

  const optionsWithDefault = useMemo(() => {
    if (!includePlaceholderOption) return options;
    const hasDefault = options.some((option) => option.value === '');
    if (hasDefault) return options;
    return [{ value: '', label: placeholder }, ...options];
  }, [includePlaceholderOption, options, placeholder]);

  const calcPos = useCallback(() => {
    if (!buttonRef.current) return;

    const r = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 4;
    const estimatedOptionHeight = isCompact ? 32 : 40;
    const estimatedMenuHeight = Math.min(288, optionsWithDefault.length * estimatedOptionHeight + 8);
    const availableBelow = window.innerHeight - r.bottom - viewportPadding;
    const availableAbove = r.top - viewportPadding;
    const shouldOpenUpward = availableBelow < Math.min(estimatedMenuHeight, 180) && availableAbove > availableBelow;
    const maxHeight = Math.max(
      120,
      Math.min(288, shouldOpenUpward ? availableAbove - gap : availableBelow - gap),
    );
    const renderedMenuHeight = Math.min(estimatedMenuHeight, maxHeight);
    const unclampedLeft = r.left;
    const width = Math.min(r.width, window.innerWidth - viewportPadding * 2);
    const left = Math.max(viewportPadding, Math.min(unclampedLeft, window.innerWidth - width - viewportPadding));
    const top = shouldOpenUpward
      ? Math.max(viewportPadding, r.top - renderedMenuHeight - gap)
      : Math.min(window.innerHeight - renderedMenuHeight - viewportPadding, r.bottom + gap);

    setPos({ top, left, width, maxHeight });
  }, [isCompact, optionsWithDefault.length]);

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
  }, [calcPos, isOpen]);

  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false);
  }, [disabled, isOpen]);

  const selectedOption = useMemo(
    () => optionsWithDefault.find((option) => option.value === value) ?? null,
    [optionsWithDefault, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!searchable || !normalizedSearch) return optionsWithDefault;

    const defaultOption = includePlaceholderOption ? optionsWithDefault.find((option) => option.value === '') ?? null : null;
    const matchingOptions = options
      .filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(normalizedSearch));

    return defaultOption ? [defaultOption, ...matchingOptions] : matchingOptions;
  }, [includePlaceholderOption, options, optionsWithDefault, searchTerm, searchable]);

  const selectedLabel = useMemo(
    () => selectedOption?.label ?? placeholder,
    [placeholder, selectedOption],
  );

  const isNeutralSelection = useMemo(() => {
    if (!selectedOption) {
      return true;
    }

    return selectedOption.value === '' || neutralValues.includes(selectedOption.value);
  }, [neutralValues, selectedOption]);

  const selectedIndex = useMemo(
    () => filteredOptions.findIndex((option) => option.value === value),
    [filteredOptions, value],
  );

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      setSearchTerm('');
      return;
    }
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen || !searchable) return;
    searchInputRef.current?.focus();
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const selectOptionByIndex = (index: number) => {
    const option = filteredOptions[index];
    if (!option || disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'Tab') { setIsOpen(false); return; }
    if (event.key === 'Escape') { setIsOpen(false); return; }

    const lastIndex = filteredOptions.length - 1;
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

  const iconSizeClass = isCompact ? 'h-4 w-4' : 'h-5 w-5';
  const iconOffsetClass = isCompact ? 'left-2' : 'left-3';
  const chevronSizeClass = isCompact ? 'h-3 w-3' : 'h-4 w-4';
  const labelTextClass = isCompact ? 'text-xs' : 'text-sm';
  const isDarkTheme = isPanelDarkTheme();

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const lastIndex = filteredOptions.length - 1;

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (lastIndex < 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current >= lastIndex ? 0 : Math.max(current + 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current <= 0 ? lastIndex : current - 1));
      return;
    }

    if (event.key === 'Enter' && highlightedIndex >= 0) {
      event.preventDefault();
      selectOptionByIndex(highlightedIndex);
    }
  };

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
            'text-[var(--text-muted)]',
            iconOffsetClass,
            iconSizeClass,
          )}
        />
        <span
          className={cx(
            'block truncate',
            labelTextClass,
            !isNeutralSelection
              ? 'font-medium text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)]',
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={cx(
            isCompact
              ? 'absolute right-2 top-1/2 -translate-y-1/2 transition-transform'
              : 'absolute right-3 top-1/2 -translate-y-1/2 transition-transform',
            'text-[var(--text-muted)]',
            chevronSizeClass,
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && pos && typeof document !== 'undefined' && createPortal(
        <div
          id={listboxId}
          ref={dropdownRef}
          className={cx(
            'painel-theme kifer-ds',
            isDarkTheme ? 'theme-dark' : 'theme-light',
            getDropdownMenuClass({
              isDark: isDarkTheme,
              className: isCompact ? 'max-h-60' : 'max-h-72',
            }),
          )}
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          role="listbox"
        >
          {searchable && (
            <div className="border-b border-[var(--border-subtle)] p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className={cx(
                  'kds-input panel-ui-input h-10 w-full px-3 text-sm',
                )}
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className={cx(
              'px-3 py-4 text-sm',
              'text-[var(--text-muted)]',
            )}>
              {emptyMessage}
            </div>
          ) : filteredOptions.map((option, index) => {
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
                      'text-[var(--accent-gold-hover)]',
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
