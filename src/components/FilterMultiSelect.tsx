import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button, Checkbox, FilterTrigger, Popover, PopoverContent, PopoverTrigger, type PanelInputSize } from '../design-system';

type Option = { value: string; label: string };

type FilterMultiSelectProps = {
  icon: LucideIcon;
  options: Option[];
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  size?: PanelInputSize;
};

export default function FilterMultiSelect({
  icon: Icon,
  options,
  placeholder,
  values,
  onChange,
  size = 'default',
}: FilterMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayText = useMemo(() => {
    const selected = options.filter((option) => values.includes(option.value));
    if (selected.length === 0) return placeholder;
    return selected.length <= 2 ? selected.map((option) => option.label).join(', ') : `${selected.length} selecionado(s)`;
  }, [options, placeholder, values]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger className="block">
        <FilterTrigger
          icon={Icon}
          value={displayText}
          active={values.length > 0}
          open={isOpen}
          size={size}
          aria-haspopup="listbox"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[min(18rem,calc(100vw-1rem))] p-2" role="listbox" aria-label={placeholder}>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="w-full justify-start">Limpar selecao</Button>
        <div className="my-1 border-t border-[var(--border-subtle)]" />
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => {
            const selected = values.includes(option.value);
            return <label key={option.value} className="flex cursor-pointer items-center gap-2 px-2 py-2 text-sm text-[var(--text-secondary)]">
              <Checkbox checked={selected} onChange={() => onChange(selected ? values.filter((item) => item !== option.value) : [...values, option.value])} />
              {option.label}
            </label>;
          })}
          {options.length === 0 && <p className="px-2 py-3 text-sm text-[var(--text-muted)]">Nenhuma opcao disponivel</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
