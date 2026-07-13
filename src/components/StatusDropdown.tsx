import { useEffect, useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';

import { OperationalStatusDot, Popover, PopoverContent, PopoverTrigger } from '../design-system';
import { cx } from '../lib/cx';
import { LeadStatusConfig } from '../lib/supabase';

type StatusDropdownProps = { currentStatus: string; leadId: string; onStatusChange: (leadId: string, newStatus: string) => Promise<void>; disabled?: boolean; statusOptions: LeadStatusConfig[] };

export default function StatusDropdown({ currentStatus, leadId, onStatusChange, disabled = false, statusOptions }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const displayStatus = isUpdating && pendingStatus ? pendingStatus : currentStatus;
  const statusColor = statusOptions.find((option) => option.nome === displayStatus)?.cor ?? null;

  useEffect(() => { if (!isUpdating && pendingStatus === currentStatus) setPendingStatus(null); }, [currentStatus, isUpdating, pendingStatus]);
  const selectStatus = async (status: string) => {
    if (status === currentStatus || disabled || isUpdating) return;
    setIsUpdating(true); setPendingStatus(status); setIsOpen(false);
    try { await onStatusChange(leadId, status); } catch (error) { console.error('Error updating status:', error); setPendingStatus(null); } finally { setIsUpdating(false); }
  };

  return <Popover open={isOpen} onOpenChange={setIsOpen}>
    <PopoverTrigger className="inline-block">
      <button type="button" disabled={disabled || isUpdating} style={{ ...(statusColor ? { '--op-status-color': statusColor } : {}) } as CSSProperties} aria-haspopup="listbox" aria-expanded={isOpen} aria-busy={isUpdating} className={cx('kds-op-status-badge kds-op-status-trigger', (disabled || isUpdating) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
        <span>{isUpdating ? 'Atualizando...' : displayStatus}</span>{!disabled && !isUpdating && <ChevronDown className="h-3 w-3" />}
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-52 p-1" role="listbox" aria-label="Alterar status do lead">
      {statusOptions.map((status) => <button type="button" key={status.id} onClick={() => void selectStatus(status.nome)} className={cx('kds-dropdown-option flex w-full items-center px-3 py-2 text-left text-sm', status.nome === currentStatus && 'is-selected font-medium')}>
        <OperationalStatusDot statusColor={status.cor} className="mr-2" />{status.nome}
      </button>)}
    </PopoverContent>
  </Popover>;
}
