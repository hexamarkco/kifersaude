import { useState } from 'react';
import {
  Field,
  getPanelToneStyle,
  OperationalStatusBadge,
  OperationalStatusSelect,
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
  const [saleOperator, setSaleOperator] = useState('');
  const label = normalizeSentenceCase(status) ?? status;
  const statusColor = getPanelToneStyle(tone).color ?? 'var(--text-muted)';
  if (!canEdit) return <OperationalStatusBadge statusColor={statusColor}>{label}</OperationalStatusBadge>;

  const contextualContent = (
    <>
      {operatorError && <Text role="alert" className="p-2 text-xs">{operatorError}</Text>}
      {operators.length > 0 && (
        <Field label="Responsável pela venda" className="p-2">
          <Select
            value={saleOperator}
            onChange={(event) => setSaleOperator(event.target.value)}
            options={[
              { value: '', label: 'Escolher responsável' },
              ...operators.map((operator) => ({
                value: operator.user_id,
                label: operator.display_name,
              })),
            ]}
          />
        </Field>
      )}
    </>
  );

  return (
    <OperationalStatusSelect
      value={status}
      triggerLabel={label}
      statusColor={statusColor}
      options={options.map((option) => ({
        ...option,
        color:
          getPanelToneStyle(getOptionTone?.(option.value) ?? 'neutral').color ??
          null,
      }))}
      onValueChange={(nextStatus) =>
        void onChange(nextStatus, saleOperator || undefined)
      }
      triggerAriaLabel={`Alterar status do contrato ${code}: ${label}`}
      menuAriaLabel={`Status do contrato ${code}`}
      beforeOptions={operators.length > 0 || operatorError ? contextualContent : undefined}
      menuSize={operators.length > 0 || operatorError ? 'contextual' : 'compact'}
      disabled={options.length === 0}
      loading={saving}
    />
  );
}
