import { memo } from 'react';
import Button from '../../../../components/ui/Button';

function InboxFilterChipBase({ active, label, onClick, compact = false }: { active: boolean; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <Button type="button" onClick={onClick} aria-pressed={active} variant={active ? 'soft' : 'secondary'} size="sm" className={compact ? 'h-8 rounded-xl px-3 text-[11px]' : 'h-9 rounded-xl px-3.5 text-xs'}>
      {label}
    </Button>
  );
}

export const InboxFilterChip = memo(InboxFilterChipBase);
