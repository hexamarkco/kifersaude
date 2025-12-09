import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { LeadStatusConfig } from '../lib/supabase';
import { getBadgeStyle } from '../lib/colorUtils';

type StatusDropdownProps = {
  currentStatus: string;
  leadId: string;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  disabled?: boolean;
  statusOptions: LeadStatusConfig[];
};

export default function StatusDropdown({
  currentStatus,
  leadId,
  onStatusChange,
  disabled = false,
  statusOptions,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateMenuPosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minWidth = 180;
    const maxWidth = 280;
    const desiredWidth = Math.min(Math.max(rect.width, minWidth), maxWidth);
    const rightBoundary = viewportWidth - 16;
    let left = rect.left;

    if (left + desiredWidth > rightBoundary) {
      left = Math.max(16, rightBoundary - desiredWidth);
    }

    left = Math.max(16, left);

    const estimatedMenuHeight = statusOptions.length * 36 + 8;
    const spaceBelow = viewportHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;

    const shouldOpenUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

    setMenuPosition({
      top: shouldOpenUpward ? rect.top - estimatedMenuHeight - 4 : rect.bottom + 4,
      left,
      width: desiredWidth,
    });
  };

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
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !(menuRef.current && menuRef.current.contains(target))
      ) {
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
    if (!isOpen) return;

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
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
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        style={buttonStyles}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-busy={isUpdating}
        title={isUpdating ? 'Atualizando status do lead' : 'Alterar status do lead'}
        className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 ${
          disabled || isUpdating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-md'
        }`}
      >
        <span>{isUpdating ? 'Atualizando...' : displayStatus}</span>
        {!disabled && !isUpdating && (
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {isOpen && !disabled && !isUpdating && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 overflow-y-auto"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: 'calc(100vh - 32px)',
              }}
            >
              {statusOptions.map((status) => (
                <button
                  type="button"
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
