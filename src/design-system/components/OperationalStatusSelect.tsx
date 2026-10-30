import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from '../../lib/cx';
import { ActionSurface } from './Surface';
import DropdownOption from './DropdownOption';
import { OperationalStatusDot } from './Operational';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export type OperationalStatusSelectOption = {
  value: string;
  label: ReactNode;
  color?: string | null;
  disabled?: boolean;
};

export type OperationalStatusSelectProps = {
  value: string;
  options: readonly OperationalStatusSelectOption[];
  onValueChange: (value: string) => void;
  triggerAriaLabel: string;
  menuAriaLabel: string;
  optionsAriaLabel?: string;
  triggerLabel?: ReactNode;
  statusColor?: string | null;
  beforeOptions?: ReactNode;
  menuSize?: 'compact' | 'contextual';
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: ReactNode;
  className?: string;
};

/** Shared single-select status menu. Contextual content is kept outside its listbox. */
export function OperationalStatusSelect({
  value,
  options,
  onValueChange,
  triggerAriaLabel,
  menuAriaLabel,
  optionsAriaLabel = 'Status disponíveis',
  triggerLabel,
  statusColor,
  beforeOptions,
  menuSize = 'compact',
  disabled = false,
  loading = false,
  loadingLabel = 'Atualizando...',
  className,
}: OperationalStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const menuId = `${id}-menu`;
  const listboxId = `${id}-options`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasContext = beforeOptions !== undefined && beforeOptions !== null;
  const selectedOption = options.find((option) => option.value === value);
  const isDisabled = disabled || loading || options.length === 0;
  const currentColor = statusColor ?? selectedOption?.color ?? null;
  const currentLabel = loading
    ? loadingLabel
    : triggerLabel ?? selectedOption?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const menu = document.getElementById(menuId);
    const initialOption = menu?.querySelector<HTMLElement>(
      `[role="option"][aria-selected="true"]:not(:disabled), [role="option"]:not(:disabled)`,
    );
    initialOption?.focus();
  }, [menuId, open]);

  const selectOption = (option: OperationalStatusSelectOption) => {
    if (option.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    onValueChange(option.value);
  };

  return (
    <Popover open={open && !isDisabled} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex">
        <ActionSurface
          ref={triggerRef}
          id={`${id}-trigger`}
          variant="plain"
          padding="none"
          type="button"
          disabled={isDisabled}
          style={
            currentColor
              ? ({ '--op-status-color': currentColor } as CSSProperties)
              : undefined
          }
          className={cx(
            'kds-op-status-badge kds-op-status-trigger',
            isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            className,
          )}
          aria-label={triggerAriaLabel}
          aria-haspopup={hasContext ? 'dialog' : 'listbox'}
          aria-controls={menuId}
          aria-expanded={open && !isDisabled}
          aria-busy={loading || undefined}
        >
          <span>{currentLabel}</span>
          {!isDisabled && <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        </ActionSurface>
      </PopoverTrigger>
      <PopoverContent
        id={menuId}
        role={hasContext ? 'dialog' : 'listbox'}
        aria-label={menuAriaLabel}
        style={{ maxHeight: 'var(--op-status-menu-max-height)' }}
        className={cx(
          'kds-op-status-menu',
          menuSize === 'contextual'
            ? 'kds-op-status-menu-contextual'
            : 'kds-op-status-menu-compact',
        )}
      >
        {hasContext && <div className="kds-op-status-context">{beforeOptions}</div>}
        {hasContext && (
          <div
            id={listboxId}
            role="listbox"
            aria-label={optionsAriaLabel}
            className="kds-op-status-options"
          >
            {options.map((option) => (
              <StatusOption
                key={option.value}
                option={option}
                selected={option.value === value}
                onSelect={selectOption}
              />
            ))}
          </div>
        )}
        {!hasContext && options.map((option) => (
            <StatusOption
              key={option.value}
              option={option}
              selected={option.value === value}
              onSelect={selectOption}
            />
          ))}
      </PopoverContent>
    </Popover>
  );
}

function StatusOption({
  option,
  selected,
  onSelect,
}: {
  option: OperationalStatusSelectOption;
  selected: boolean;
  onSelect: (option: OperationalStatusSelectOption) => void;
}) {
  return (
    <DropdownOption
      type="button"
      disabled={option.disabled}
      aria-selected={selected}
      className={cx('kds-op-status-option', selected && 'is-selected font-medium')}
      onClick={() => onSelect(option)}
    >
      <OperationalStatusDot
        statusColor={option.color}
        className="kds-op-status-option-dot"
        aria-hidden="true"
      />
      <span className="kds-op-status-option-label">{option.label}</span>
    </DropdownOption>
  );
}
