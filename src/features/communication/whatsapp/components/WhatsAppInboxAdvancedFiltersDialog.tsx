import { useState } from 'react';
import { ListFilter, UsersRound, type LucideIcon } from 'lucide-react';

import {
  Button,
  Checkbox,
  DisclosureTrigger,
  FieldLabel,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  Text,
  type SegmentedControlItem,
} from '../../../../design-system';
import type { ChatActivityFilter } from '../domain/chatFilters';

const ACTIVITY_OPTIONS: SegmentedControlItem<ChatActivityFilter>[] = [
  { id: 'all', label: 'Todas' },
  { id: 'unread', label: 'Não lidas' },
];

function InboxFilterOptions({ label, icon, options, values, onChange }: {
  label: string;
  icon: LucideIcon;
  options: InboxAdvancedFiltersDialogProps['statusOptions'];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const normalizedValues = values.map((value) => value.toLowerCase());
  const selectionLabel = values.length ? `${values.length} ${values.length === 1 ? 'selecionado' : 'selecionados'}` : 'Todos';

  return (
    <details className="whatsapp-inbox-filter-options">
      <DisclosureTrigger icon={icon} className="whatsapp-inbox-filter-options-trigger" aria-label={`${label}, ${selectionLabel}`}>
        {label} <span className="whatsapp-inbox-filter-selection">· {values.length || 'Todos'}</span>
      </DisclosureTrigger>
      <div className="whatsapp-inbox-filter-option-list" role="group" aria-label={label}>
        {options.map(({ value, label: optionLabel }) => {
          const normalizedValue = value.toLowerCase();
          const selected = normalizedValues.includes(normalizedValue);
          return (
            <FieldLabel key={value} className="whatsapp-inbox-filter-option">
              <Checkbox
                checked={selected}
                onChange={() => onChange(selected ? values.filter((item) => item.toLowerCase() !== normalizedValue) : [...values, value])}
              />
              <span>{optionLabel}</span>
            </FieldLabel>
          );
        })}
        {options.length === 0 && <Text size="sm" tone="muted" className="whatsapp-inbox-filter-option">Nenhuma opção disponível</Text>}
      </div>
    </details>
  );
}

export type InboxAdvancedFilterValues = {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
};

type InboxAdvancedFiltersDialogProps = {
  isOpen: boolean;
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  statusOptions: Array<{ value: string; label: string }>;
  responsavelOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onApply: (filters: InboxAdvancedFilterValues) => void;
};

export function WhatsAppInboxAdvancedFiltersDialog({
  isOpen,
  activityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  statusOptions,
  responsavelOptions,
  onClose,
  onApply,
}: InboxAdvancedFiltersDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} size="md" aria-label="Filtrar conversas" className="whatsapp-inbox-dialog comm-whatsapp-overlay whatsapp-inbox-filter-modal">
      {isOpen && <InboxAdvancedFiltersDialogContent
        activityFilter={activityFilter}
        leadStatusFilters={leadStatusFilters}
        leadResponsavelFilters={leadResponsavelFilters}
        statusOptions={statusOptions}
        responsavelOptions={responsavelOptions}
        onApply={onApply}
        onClose={onClose}
      />}
    </Dialog>
  );
}

type InboxAdvancedFiltersDialogContentProps = Omit<InboxAdvancedFiltersDialogProps, 'isOpen'>;

function InboxAdvancedFiltersDialogContent({
  activityFilter: appliedActivityFilter,
  leadStatusFilters: appliedLeadStatusFilters,
  leadResponsavelFilters: appliedLeadResponsavelFilters,
  statusOptions,
  responsavelOptions,
  onClose,
  onApply,
}: InboxAdvancedFiltersDialogContentProps) {
  const [activityFilter, setActivityFilter] = useState(appliedActivityFilter);
  const [leadStatusFilters, setLeadStatusFilters] = useState(appliedLeadStatusFilters);
  const [leadResponsavelFilters, setLeadResponsavelFilters] = useState(appliedLeadResponsavelFilters);
  const hasDraftFilters = activityFilter !== 'all' || leadStatusFilters.length > 0 || leadResponsavelFilters.length > 0;

  const clearDraftFilters = () => {
    setActivityFilter('all');
    setLeadStatusFilters([]);
    setLeadResponsavelFilters([]);
  };

  const applyDraftFilters = () => {
    onApply({ activityFilter, leadStatusFilters, leadResponsavelFilters });
    onClose();
  };

  return (
    <>
      <DialogHeader onClose={onClose}>
        <div className="kds-dialog-eyebrow">Inbox</div>
        <DialogTitle>Filtrar conversas</DialogTitle>
      </DialogHeader>
      <DialogBody className="whatsapp-inbox-filter-dialog-body">
        <div className="whatsapp-inbox-filter-activity">
          <Text size="sm" weight="medium">Atividade</Text>
          <SegmentedControl items={ACTIVITY_OPTIONS} value={activityFilter} onChange={setActivityFilter} size="sm" ariaLabel="Atividade" />
        </div>
        <InboxFilterOptions
          label="Status do lead"
          icon={ListFilter}
          values={leadStatusFilters}
          onChange={setLeadStatusFilters}
          options={statusOptions}
        />

        <InboxFilterOptions
          label="Agente responsável"
          icon={UsersRound}
          values={leadResponsavelFilters}
          onChange={setLeadResponsavelFilters}
          options={responsavelOptions}
        />
      </DialogBody>
      <DialogFooter className="whatsapp-inbox-filter-dialog-footer justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={clearDraftFilters} disabled={!hasDraftFilters}>
          Limpar filtros
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="primary" size="sm" onClick={applyDraftFilters}>
          Aplicar filtros
        </Button>
      </DialogFooter>
    </>
  );
}
