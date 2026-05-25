import { memo } from 'react';
import { InboxFilterChip } from './InboxFilterChip';

function InboxMultiFilterGroupBase({
  label, values, options, onChange, compact = false,
}: {
  label: string; values: string[]; options: Array<{ value: string; label: string }>; onChange: (value: string[]) => void; compact?: boolean;
}) {
  const normalizedValues = values.map((v) => v.toLowerCase());

  const toggleValue = (value: string) => {
    const normalized = value.toLowerCase();
    const next = normalizedValues.includes(normalized) ? values.filter((item) => item.toLowerCase() !== normalized) : [...values, value];
    onChange(next);
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#8a735f)]">{label}</p>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        <InboxFilterChip active={values.length === 0} label="Todos" onClick={() => onChange([])} compact={compact} />
        {options.map((option) => (
          <InboxFilterChip key={option.value} active={normalizedValues.includes(option.value.toLowerCase())} label={option.label} onClick={() => toggleValue(option.value)} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export const InboxMultiFilterGroup = memo(InboxMultiFilterGroupBase);
