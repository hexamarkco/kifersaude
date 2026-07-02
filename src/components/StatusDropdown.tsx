import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { LeadStatusConfig } from '../lib/supabase';
import { cx } from '../lib/cx';
import { OperationalStatusDot } from '../design-system';
import { getDropdownMenuClass, isPanelDarkTheme } from './ui/dropdownStyles';

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

  const getStatusColor = (statusName: string) => {
    const status = getStatusInfo(statusName);
    return status?.cor ?? null;
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
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const statusColor = getStatusColor(displayStatus);
  const isDarkTheme = isPanelDarkTheme();

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        style={{ ...(statusColor ? { '--op-status-color': statusColor } : {}) } as CSSProperties}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-busy={isUpdating}
        title={isUpdating ? 'Atualizando status do lead' : 'Alterar status do lead'}
        className={cx(
          'kds-op-status-badge kds-op-status-trigger',
          disabled || isUpdating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
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
              className={cx(
                'painel-theme kifer-ds',
                isDarkTheme ? 'theme-dark' : 'theme-light',
                getDropdownMenuClass({
                  isDark: isDarkTheme,
                  className: 'fixed z-[70]',
                }),
              )}
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
                  className={cx(
                    'kds-dropdown-option w-full px-3 py-2 text-left text-sm transition-colors',
                    status.nome === currentStatus && 'is-selected font-medium',
                  )}
                >
                  <OperationalStatusDot statusColor={status.cor} className="mr-2" />
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
