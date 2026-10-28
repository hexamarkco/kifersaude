import { type CSSProperties, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  ActionSurface,
  DropdownOption,
  FieldLabel,
  getPanelToneStyle,
  OperationalStatusBadge,
  OperationalStatusDot,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Text,
  type PanelTone,
} from '../../../design-system';
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
  getOptionTone?: (status: string) => PanelTone;
  onChange: (status: string, saleOperator?: string) => Promise<void>;
};

export default function ContractStatusDropdown({ status, code, tone, canEdit, saving, options, operators = [], operatorError, getOptionTone, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saleOperator, setSaleOperator] = useState('');
  const label = normalizeSentenceCase(status) ?? status;
  const statusColor = getPanelToneStyle(tone).color ?? 'var(--text-muted)';
  if (!canEdit) return <OperationalStatusBadge statusColor={statusColor}>{label}</OperationalStatusBadge>;

  return (
    <Popover open={open && !saving} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex">
        <ActionSurface
          variant="plain"
          padding="none"
          type="button"
          style={{ '--op-status-color': statusColor } as CSSProperties}
          className={`kds-op-status-badge kds-op-status-trigger w-fit max-w-full ${saving || options.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          aria-haspopup="dialog"
          disabled={saving || options.length === 0}
          aria-label={`Alterar status do contrato ${code}: ${label}`}
          aria-expanded={open && !saving}
          aria-busy={saving}
        >
          <span>{saving ? 'Atualizando...' : label}</span>
          {!saving && <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        </ActionSurface>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" aria-label={`Status do contrato ${code}`}>
        {operatorError && <Text role="alert" className="p-2 text-xs">{operatorError}</Text>}
        {operators.length > 0 && <FieldLabel className="block p-2 text-xs">Responsável pela venda
          <Select value={saleOperator} onChange={(event) => setSaleOperator(event.target.value)} options={[{ value: '', label: 'Escolha no fechamento' }, ...operators.map((operator) => ({ value: operator.user_id, label: operator.display_name }))]} />
        </FieldLabel>}
        {options.map((option) => (
          <DropdownOption
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
            <OperationalStatusDot statusColor={getPanelToneStyle(getOptionTone?.(option.value) ?? 'neutral').color ?? null} className="mr-2" />{option.label}
          </DropdownOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}
