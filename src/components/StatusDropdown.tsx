import { useEffect, useState } from 'react';

import { OperationalStatusSelect } from '../design-system';
import type { LeadStatusConfig } from '../features/leads';

type StatusDropdownProps = { currentStatus: string; leadId: string; onStatusChange: (leadId: string, newStatus: string) => Promise<void>; disabled?: boolean; statusOptions: LeadStatusConfig[] };

export default function StatusDropdown({ currentStatus, leadId, onStatusChange, disabled = false, statusOptions }: StatusDropdownProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const displayStatus = isUpdating && pendingStatus ? pendingStatus : currentStatus;
  const statusColor = statusOptions.find((option) => option.nome === displayStatus)?.cor ?? null;

  useEffect(() => { if (!isUpdating && pendingStatus === currentStatus) setPendingStatus(null); }, [currentStatus, isUpdating, pendingStatus]);
  const selectStatus = async (status: string) => {
    if (status === currentStatus || disabled || isUpdating) return;
    setIsUpdating(true); setPendingStatus(status);
    try { await onStatusChange(leadId, status); } catch (error) { console.error('Error updating status:', error); setPendingStatus(null); } finally { setIsUpdating(false); }
  };

  return (
    <OperationalStatusSelect
      value={displayStatus}
      options={statusOptions.map((option) => ({
        value: option.nome,
        label: option.nome,
        color: option.cor,
      }))}
      statusColor={statusColor}
      onValueChange={(status) => void selectStatus(status)}
      triggerAriaLabel={`Alterar status do lead: ${displayStatus}`}
      menuAriaLabel="Alterar status do lead"
      disabled={disabled}
      loading={isUpdating}
    />
  );
}
