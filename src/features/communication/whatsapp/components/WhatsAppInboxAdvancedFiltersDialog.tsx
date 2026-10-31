import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system';
import type { InboxOverlayPosition } from '../domain/inboxOverlayPosition';
import type { ChatActivityFilter } from '../domain/chatFilters';
import { InboxFilterGroup, InboxMultiFilterGroup } from './WhatsAppInboxList';

export type InboxAdvancedFilterValues = {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
};

type InboxAdvancedFiltersDialogProps = {
  isOpen: boolean;
  position: InboxOverlayPosition | null;
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
  position,
  activityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  statusOptions,
  responsavelOptions,
  onClose,
  onApply,
}: InboxAdvancedFiltersDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      size="sm"
      initialFocus="first-content"
      className="whatsapp-inbox-filter-dialog"
      style={position ? {
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      } : undefined}
    >
      {isOpen ? (
        <InboxAdvancedFiltersDialogContent
          activityFilter={activityFilter}
          leadStatusFilters={leadStatusFilters}
          leadResponsavelFilters={leadResponsavelFilters}
          statusOptions={statusOptions}
          responsavelOptions={responsavelOptions}
          onApply={onApply}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

type InboxAdvancedFiltersDialogContentProps = Omit<InboxAdvancedFiltersDialogProps, 'isOpen' | 'position'>;

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
        <DialogTitle>Filtros do inbox</DialogTitle>
      </DialogHeader>
      <DialogBody className="whatsapp-inbox-filter-dialog-body space-y-4">
        <InboxFilterGroup
          label="Atividade"
          value={activityFilter}
          onChange={setActivityFilter}
          compact
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'unread', label: 'Não lidas' },
          ]}
        />

        <InboxMultiFilterGroup
          label="Status do lead"
          values={leadStatusFilters}
          onChange={setLeadStatusFilters}
          compact
          variant="list"
          options={statusOptions}
        />

        <InboxMultiFilterGroup
          label="Agente responsável"
          values={leadResponsavelFilters}
          onChange={setLeadResponsavelFilters}
          compact
          variant="list"
          options={responsavelOptions}
        />
      </DialogBody>
      <DialogFooter className="whatsapp-inbox-filter-dialog-footer justify-between">
        {hasDraftFilters ? (
          <Button type="button" variant="secondary" size="md" onClick={clearDraftFilters}>
            Limpar filtros
          </Button>
        ) : <span aria-hidden="true" />}
        <Button type="button" variant="primary" size="md" onClick={applyDraftFilters}>
          Aplicar filtros
        </Button>
      </DialogFooter>
    </>
  );
}
