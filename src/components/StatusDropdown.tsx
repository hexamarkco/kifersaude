import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type StatusDropdownProps = {
  currentStatus: string;
  leadId: string;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onProposalSent?: (leadId: string) => void;
  disabled?: boolean;
};

const STATUS_OPTIONS = [
  'Novo',
  'Em contato',
  'Cotando',
  'Proposta enviada',
  'Fechado',
  'Perdido',
];

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'Novo': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    'Em contato': 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
    'Cotando': 'bg-purple-100 text-purple-700 hover:bg-purple-200',
    'Proposta enviada': 'bg-orange-100 text-orange-700 hover:bg-orange-200',
    'Fechado': 'bg-green-100 text-green-700 hover:bg-green-200',
    'Perdido': 'bg-red-100 text-red-700 hover:bg-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 hover:bg-gray-200';
};

export default function StatusDropdown({
  currentStatus,
  leadId,
  onStatusChange,
  onProposalSent,
  disabled = false,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        className={`
          flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium
          transition-all duration-200 cursor-pointer
          ${getStatusColor(displayStatus)}
          ${(disabled || isUpdating) ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
        `}
      >
        <span>{isUpdating ? 'Atualizando...' : displayStatus}</span>
        {!disabled && !isUpdating && (
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && !disabled && !isUpdating && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[160px]">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusClick(status)}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors
                ${status === currentStatus
                  ? 'bg-slate-100 font-medium text-slate-900'
                  : 'text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor(status).split(' ')[0]}`} />
              {status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
