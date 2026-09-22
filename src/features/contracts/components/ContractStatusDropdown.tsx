import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge, Popover, PopoverContent, PopoverTrigger, type PanelTone } from '../../../design-system';
import { normalizeSentenceCase } from '../../../lib/textNormalization';

type Props = {
  status: string;
  code: string;
  tone: PanelTone;
  canEdit: boolean;
  saving: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (status: string) => Promise<void>;
};

export default function ContractStatusDropdown({ status, code, tone, canEdit, saving, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const label = normalizeSentenceCase(status) ?? status;
  if (!canEdit) return <Badge tone={tone} size="sm">{label}</Badge>;

  return (
    <Popover open={open && !saving} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          disabled={saving || options.length === 0}
          aria-label={`Alterar status do contrato ${code}: ${label}`}
          aria-expanded={open && !saving}
          aria-busy={saving}
          className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Badge tone={tone} size="sm" className="gap-1">
            {saving ? 'Atualizando...' : label}
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" aria-label={`Status do contrato ${code}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            aria-pressed={option.value === status}
            className={`kds-dropdown-option flex w-full items-center px-3 py-2 text-left text-sm ${option.value === status ? 'is-selected font-medium' : ''}`}
            onClick={() => {
              setOpen(false);
              void onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
