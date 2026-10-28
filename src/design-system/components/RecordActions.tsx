import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { ButtonGroup, IconButton } from './Button';
import DropdownOption from './DropdownOption';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

export type RecordAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

export type RecordActionsProps = {
  actions: readonly RecordAction[];
  visibleCount?: number;
  label?: string;
};

/** Quick actions stay visible; additional actions use the same keyboard-accessible menu. */
export function RecordActions({ actions, visibleCount = 1, label = 'Ações do registro' }: RecordActionsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const quick = actions.slice(0, visibleCount);
  const more = actions.slice(visibleCount);
  const normalizedLabel = label.toLocaleLowerCase('pt-BR');
  const moreActionsLabel = normalizedLabel === 'ações'
    ? 'Mais ações'
    : normalizedLabel.startsWith('ações ')
      ? `Mais ${normalizedLabel}`
      : `Mais ações do ${normalizedLabel}`;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <ButtonGroup size="sm" className="kds-record-actions" aria-label={label}>
      {quick.map(({ label: actionLabel, icon: Icon, destructive, ...action }) => (
        <IconButton key={actionLabel} {...action} size="sm" variant={destructive ? 'danger' : 'secondary'} aria-label={actionLabel} title={actionLabel}>
          <Icon aria-hidden="true" />
        </IconButton>
      ))}
      {more.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <IconButton ref={triggerRef} size="sm" variant="secondary" aria-label={moreActionsLabel} aria-haspopup="menu" aria-expanded={open} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </PopoverTrigger>
          <PopoverContent role="menu" aria-label={label} align="end" className="kds-record-action-menu">
            <div ref={menuRef}>
              {more.map(({ label: actionLabel, icon: Icon, destructive, disabled, loading, onClick }) => (
                <DropdownOption key={actionLabel} role="menuitem" disabled={disabled || loading} className={destructive ? 'kds-record-action-danger' : undefined} onClick={() => { setOpen(false); triggerRef.current?.focus(); onClick(); }}>
                  <Icon className="kds-control-icon" aria-hidden="true" />{actionLabel}
                </DropdownOption>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </ButtonGroup>
  );
}
