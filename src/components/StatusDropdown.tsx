import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { LeadStatusConfig } from '../lib/supabase';
import { getBadgeStyle } from '../lib/colorUtils';

type StatusDropdownProps = {
  currentStatus: string;
  leadId: string;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onProposalSent?: (leadId: string) => void;
  disabled?: boolean;
  statusOptions: LeadStatusConfig[];
};

export default function StatusDropdown({
  currentStatus,
  leadId,
  onStatusChange,
  onProposalSent,
  disabled = false,
  statusOptions,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getStatusInfo = (statusName: string) => {
    return statusOptions.find(option => option.nome === statusName) || null;
  };

  const getButtonStyles = (statusName: string) => {
    const status = getStatusInfo(statusName);
    if (!status) {
      return {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
        color: '#475569',
        borderColor: 'rgba(148, 163, 184, 0.35)'
      };
    }
    const badge = getBadgeStyle(status.cor, 1);
    return {
      backgroundColor: badge.backgroundColor,
      color: badge.color,
      borderColor: badge.borderColor,
    };
  };

  const getOptionIndicatorStyle = (statusName: string) => {
    const status = getStatusInfo(statusName);
    return {
      backgroundColor: status ? status.cor : '#94a3b8',
    };
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isUpdating && pendingStatus && currentStatus === pendingStatus) {
      setPendingStatus(null);
    }
  }, [currentStatus, isUpdating, pendingStatus]);

  const handleStatusClick = async (newStatus: string) => {
    if (newStatus === currentStatus || disabled || isUpdating) return;

    setIsUpdating(true);
    setPendingStatus(newStatus);
    setIsOpen(false);

    try {
      await onStatusChange(leadId, newStatus);

      if (newStatus === 'Proposta enviada' && onProposalSent) {
        onProposalSent(leadId);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setPendingStatus(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const displayStatus = isUpdating && pendingStatus ? pendingStatus : currentStatus;
  const buttonStyles = getButtonStyles(displayStatus);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        style={buttonStyles}
        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 cursor-pointer ${(disabled || isUpdating) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
      >
        <span>{isUpdating ? 'Atualizando...' : displayStatus}</span>
        {!disabled && !isUpdating && (
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !disabled && !isUpdating && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[160px]">
          {statusOptions.map((status) => (
            <button
              key={status.id}
              onClick={() => handleStatusClick(status.nome)}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors
                ${status.nome === currentStatus
                  ? 'bg-slate-100 font-medium text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={getOptionIndicatorStyle(status.nome)}
              />
              {status.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
