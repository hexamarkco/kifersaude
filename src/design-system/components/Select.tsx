import { Children, forwardRef, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check, ChevronDown } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputSizeClasses, panelInputStateClasses, type PanelInputSize, type PanelInputState } from '../tokens';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export type SelectSize = PanelInputSize;
export type SelectState = PanelInputState;

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: SelectSize;
  invalid?: boolean;
  state?: SelectState;
  placeholder?: string;
  options?: readonly SelectOption[];
};

const normalizeValue = (value: SelectHTMLAttributes<HTMLSelectElement>['value']) => {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return value === undefined || value === null ? '' : String(value);
};

const getOptionsFromChildren = (children: ReactNode): SelectOption[] =>
  Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child) || child.type !== 'option') {
      return [];
    }

    return [{
      value: child.props.value === undefined ? String(child.props.children ?? '') : String(child.props.value),
      label: child.props.children,
      disabled: child.props.disabled,
    }];
  });

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = 'default',
    invalid = false,
    state = 'default',
    placeholder,
    options,
    className,
    children,
    value,
    defaultValue,
    onChange,
    onKeyDown,
    multiple,
    disabled,
    id,
    name,
    required,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...nativeProps
  },
  forwardedRef,
) {
  const resolvedState = invalid ? 'error' : state;
  const optionItems = useMemo(() => options ? [...options] : getOptionsFromChildren(children), [children, options]);
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => normalizeValue(defaultValue));
  const resolvedValue = isControlled ? normalizeValue(value) : uncontrolledValue;

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-options`;
  const selectedOption = optionItems.find((option) => option.value === resolvedValue);
  const displayValue = selectedOption?.label ?? placeholder ?? 'Selecione';

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = optionItems.findIndex((option) => option.value === resolvedValue && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : optionItems.findIndex((option) => !option.disabled));
  }, [isOpen, optionItems, resolvedValue]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  const assignHiddenSelectRef = (element: HTMLSelectElement | null) => {
    hiddenSelectRef.current = element;
    if (typeof forwardedRef === 'function') {
      forwardedRef(element);
    } else if (forwardedRef) {
      forwardedRef.current = element;
    }
  };

  const applyValue = (nextValue: string) => {
    if (!isControlled) setUncontrolledValue(nextValue);

    const nativeSelect = hiddenSelectRef.current;
    if (nativeSelect) {
      nativeSelect.value = nextValue;
      onChange?.({ target: nativeSelect, currentTarget: nativeSelect } as ChangeEvent<HTMLSelectElement>);
    }
  };

  const moveActiveOption = (direction: 1 | -1) => {
    const enabledIndices = optionItems.reduce<number[]>((indices, option, index) => {
      if (!option.disabled) indices.push(index);
      return indices;
    }, []);
    if (enabledIndices.length === 0) return;

    const currentPosition = Math.max(0, enabledIndices.indexOf(activeIndex));
    setActiveIndex(enabledIndices[(currentPosition + direction + enabledIndices.length) % enabledIndices.length]);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event as unknown as KeyboardEvent<HTMLSelectElement>);
    if (event.defaultPrevented || disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      const firstEnabled = optionItems.findIndex((option) => !option.disabled);
      const lastEnabled = optionItems.reduce((last, option, index) => (!option.disabled ? index : last), -1);
      setActiveIndex(event.key === 'ArrowDown' ? firstEnabled : lastEnabled);
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveOption(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveOption(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(optionItems.findIndex((option) => !option.disabled));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(optionItems.reduce((last, option, index) => (!option.disabled ? index : last), -1));
    }
  };

  // MultiSelect preserva a semântica de seleção múltipla do navegador.
  if (multiple) {
    return (
      <select
        ref={forwardedRef}
        multiple
        className={cx(
          'kds-select panel-ui-input w-full px-3 disabled:cursor-not-allowed',
          panelInputSizeClasses[size],
          panelInputStateClasses[resolvedState],
          className,
        )}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        id={id}
        name={name}
        required={required}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        {...nativeProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <select
        ref={assignHiddenSelectRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        value={resolvedValue}
        onChange={(event) => {
          if (!isControlled) setUncontrolledValue(event.target.value);
          onChange?.(event);
        }}
        disabled={disabled}
        name={name}
        required={required}
        {...nativeProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {optionItems.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <PopoverTrigger className="block w-full">
        <button
          id={id}
          type="button"
          className={cx(
            'kds-select kds-select-trigger panel-ui-input flex w-full items-center justify-between gap-3 px-3 text-left disabled:cursor-not-allowed',
            panelInputSizeClasses[size],
            panelInputStateClasses[resolvedState],
            className,
          )}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className={cx('min-w-0 flex-1 truncate', !selectedOption && 'text-[var(--text-muted)]')}>{displayValue}</span>
          <ChevronDown className={cx('h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent id={listboxId} className="kds-dropdown-menu max-h-72 w-[min(20rem,calc(100vw-1rem))] overflow-y-auto p-1" role="listbox" aria-label={ariaLabel || placeholder || 'Selecionar opção'}>
        {optionItems.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={option.value === resolvedValue}
            disabled={option.disabled}
            onKeyDown={handleOptionKeyDown}
            onClick={() => {
              applyValue(option.value);
              setIsOpen(false);
            }}
            className={cx('kds-dropdown-option flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50', option.value === resolvedValue && 'is-selected font-medium')}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.value === resolvedValue ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          </button>
        ))}
        {optionItems.length === 0 ? <p className="px-3 py-4 text-sm text-[var(--text-muted)]">Nenhuma opção disponível.</p> : null}
      </PopoverContent>
    </Popover>
  );
});

export type MultiSelectProps = Omit<SelectProps, 'multiple'>;

export const MultiSelect = forwardRef<HTMLSelectElement, MultiSelectProps>(function MultiSelect(
  { className, ...props },
  ref,
) {
  return <Select ref={ref} multiple className={cx('min-h-[7rem] py-2', className)} {...props} />;
});

export default Select;
