import { memo } from 'react';
import { InboxFilterChip } from './InboxFilterChip';

function InboxFilterGroupBase<T extends string>({
  label, value, options, onChange, compact = false,
}: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {options.map((option) => (
          <InboxFilterChip key={option.value as string} active={value === option.value} label={option.label} onClick={() => onChange(option.value)} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export const InboxFilterGroup = memo(InboxFilterGroupBase) as typeof InboxFilterGroupBase;
