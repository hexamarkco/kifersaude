import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import type { ControlSize } from '../tokens';
import Button from './Button';
import Checkbox from './Checkbox';
import DateTimePicker from './DateTimePicker';
import Field from './Field';
import FilterTrigger from './FilterTrigger';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import type { SelectOption } from './Select';

export type FilterSelectProps = {
  icon: LucideIcon;
  options: readonly SelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  includePlaceholderOption?: boolean;
  neutralValues?: string[];
  disabled?: boolean;
  size?: ControlSize;
};

export function FilterSelect({ icon, options, placeholder, value, onChange, includePlaceholderOption = true, neutralValues = [], disabled = false, size = 'md' }: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const items = useMemo(() => includePlaceholderOption && !options.some((option) => option.value === '') ? [{ value: '', label: placeholder }, ...options] : [...options], [includePlaceholderOption, options, placeholder]);
  const selected = items.find((option) => option.value === value);
  const active = Boolean(selected && selected.value !== '' && !neutralValues.includes(selected.value));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="block">
        <FilterTrigger icon={icon} value={selected?.label ?? placeholder} active={active} open={open} size={size} disabled={disabled} aria-haspopup="listbox" />
      </PopoverTrigger>
      <PopoverContent className="kds-dropdown-menu w-[min(20rem,calc(100vw-1rem))] p-1" role="listbox" aria-label={placeholder}>
        {items.map((option) => (
          <button key={option.value} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} onClick={() => { onChange(option.value); setOpen(false); }} className={`kds-dropdown-option flex w-full items-center px-3 py-2 text-left text-sm ${option.value === value ? 'is-selected font-medium' : ''}`}>
            <span className="truncate">{option.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export type FilterMultiSelectProps = {
  icon: LucideIcon;
  options: readonly SelectOption[];
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  size?: ControlSize;
};

export function FilterMultiSelect({ icon, options, placeholder, values, onChange, size = 'md' }: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => values.includes(option.value));
  const label = selected.length === 0 ? placeholder : selected.length <= 2 ? selected.map((option) => option.label).join(', ') : `${selected.length} selecionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="block">
        <FilterTrigger icon={icon} value={label} active={values.length > 0} open={open} size={size} aria-haspopup="listbox" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-2" role="listbox" aria-label={placeholder}>
        <Button variant="ghost" size="sm" onClick={() => onChange([])} fullWidth>Limpar seleção</Button>
        <div className="my-1 border-t border-[var(--border-subtle)]" />
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => {
            const checked = values.includes(option.value);
            return <label key={option.value} className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm text-[var(--text-secondary)]"><Checkbox checked={checked} onChange={() => onChange(checked ? values.filter((item) => item !== option.value) : [...values, option.value])} />{option.label}</label>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type DateRangeFilterProps = {
  icon: LucideIcon;
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
  size?: ControlSize;
};

export function DateRangeFilter({ icon, label, fromValue, toValue, onFromChange, onToChange, type = 'date', size = 'md' }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const format = (value: string) => {
    if (!value) return '';
    const date = new Date(type === 'date' ? `${value}T00:00:00` : value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
  };
  const display = fromValue && toValue ? `${format(fromValue)} — ${format(toValue)}` : fromValue ? `A partir de ${format(fromValue)}` : toValue ? `Até ${format(toValue)}` : 'Qualquer data';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="block"><FilterTrigger icon={icon} leadingLabel={label} value={display} active={Boolean(fromValue || toValue)} open={open} size={size} aria-haspopup="dialog" /></PopoverTrigger>
      <PopoverContent className="w-[min(20rem,calc(100vw-1rem))] space-y-3 p-4" aria-label={`Selecionar intervalo de ${label}`}>
        <Field label="De"><DateTimePicker type={type} value={fromValue} onChange={(event) => onFromChange(event.target.value)} size={size} /></Field>
        <Field label="Até"><DateTimePicker type={type} value={toValue} onChange={(event) => onToChange(event.target.value)} size={size} /></Field>
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
          <Button variant="text" size="sm" onClick={() => { onFromChange(''); onToChange(''); }}>Limpar</Button>
          <Button size="sm" onClick={() => setOpen(false)}>Concluído</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
