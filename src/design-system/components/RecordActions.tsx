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
  menuGroup?: string;
  compactLabel?: string;
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
  const groups: { label?: string; compact: boolean; actions: RecordAction[] }[] = [];
  for (const action of more) {
    const compact = action.compactLabel !== undefined;
    const last = groups[groups.length - 1];
    if (last && last.label === action.menuGroup && last.compact === compact) last.actions.push(action);
    else groups.push({ label: action.menuGroup, compact, actions: [action] });
  }
  const grouped = groups.some((group) => group.label || group.compact);
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
      {quick.map(({ label: actionLabel, icon: Icon, destructive, disabled, loading, onClick }) => (
        <IconButton key={actionLabel} disabled={disabled} loading={loading} onClick={onClick} size="sm" variant={destructive ? 'danger' : 'secondary'} aria-label={actionLabel} title={actionLabel}>
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
          <PopoverContent role="menu" aria-label={label} align="end" className={grouped ? 'kds-record-action-menu kds-record-action-menu-grouped' : 'kds-record-action-menu'}>
            <div ref={menuRef} onKeyDownCapture={(event) => {
              if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
              if (!items.length) return;
              const current = items.findIndex((item) => item === document.activeElement);
              const previous = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (previous ? -1 : 1) + items.length) % items.length;
              event.preventDefault();
              items[next].focus();
            }}>
              {groups.map((group, index) => {
                const options = group.actions.map(({ label: actionLabel, icon: Icon, destructive, disabled, loading, onClick, compactLabel }) => (
                  <DropdownOption key={actionLabel} role="menuitem" aria-label={compactLabel ? actionLabel : undefined} title={compactLabel ? actionLabel : undefined} disabled={disabled || loading} className={destructive ? 'kds-record-action-danger' : undefined} onClick={() => { setOpen(false); triggerRef.current?.focus(); onClick(); }}>
                    {compactLabel ?? <><Icon className="kds-control-icon" aria-hidden="true" />{actionLabel}</>}
                  </DropdownOption>
                ));
                if (!grouped) return options;
                return (
                  <div key={index} role="group" aria-label={group.label} className="kds-record-action-section">
                    {group.label && <div className="kds-record-action-section-label" aria-hidden="true">{group.label}</div>}
                    <div className={group.compact ? 'kds-record-action-grid' : undefined}>{options}</div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </ButtonGroup>
  );
}
