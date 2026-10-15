import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge, Popover, PopoverContent, PopoverTrigger, type PanelTone } from '../../../design-system';
import { normalizeSentenceCase } from '../../../lib/textNormalization';
import type { ProductionOperator } from '../../production';

type Props = {
  status: string;
  code: string;
  tone: PanelTone;
  canEdit: boolean;
  saving: boolean;
  options: Array<{ value: string; label: string }>;
  operators?: ProductionOperator[];
  operatorError?: string | null;
  onChange: (status: string, saleOperator?: string) => Promise<void>;
};

export default function ContractStatusDropdown({ status, code, tone, canEdit, saving, options, operators = [], operatorError, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saleOperator, setSaleOperator] = useState('');
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
        {operatorError && <p role="alert" className="p-2 text-xs">{operatorError}</p>}
        {operators.length > 0 && <label className="block p-2 text-xs">Responsável pela venda
          <select className="kds-input mt-1 w-full" value={saleOperator} onChange={(event) => setSaleOperator(event.target.value)}>
            <option value="">Escolha no fechamento</option>
            {operators.map((operator) => <option key={operator.user_id} value={operator.user_id}>{operator.display_name}</option>)}
          </select>
        </label>}
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={saving}
            aria-pressed={option.value === status}
            className={`kds-dropdown-option flex w-full items-center px-3 py-2 text-left text-sm ${option.value === status ? 'is-selected font-medium' : ''}`}
            onClick={() => {
              setOpen(false);
              void onChange(option.value, saleOperator || undefined);
            }}
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
