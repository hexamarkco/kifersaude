import { cx } from "../../../lib/cx";
import { COMMISSION_WEEK_DAYS } from "../shared/commissionCalendarConstants";
import {
  getCommissionDateKey,
  isCommissionSameDay,
} from "../shared/commissionCalendarUtils";
import type { CommissionEvent } from "../shared/commissionCalendarTypes";

type CommissionMonthGridProps = {
  currentMonth: Date;
  eventsByDay: Map<string, CommissionEvent[]>;
  onSelectDate: (date: Date) => void;
  selectedDate: Date | null;
};

export default function CommissionMonthGrid({
  currentMonth,
  eventsByDay,
  onSelectDate,
  selectedDate,
}: CommissionMonthGridProps) {
  const firstWeekday = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1,
  ).getDay();
  const totalDays = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0,
  ).getDate();
  const today = new Date();
  const days = [];

  for (let emptyIndex = 0; emptyIndex < firstWeekday; emptyIndex += 1) {
    days.push(<div key={`empty-${emptyIndex}`} className="aspect-square" />);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const cellDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const dateKey = getCommissionDateKey(cellDate);
    const dayEvents = eventsByDay.get(dateKey) || [];
    const hasCommission = dayEvents.some((event) => event.type === "comissao");
    const isToday = isCommissionSameDay(cellDate, today);
    const isSelected = selectedDate
      ? isCommissionSameDay(cellDate, selectedDate)
      : false;

    const stateClass = isSelected
      ? "border-transparent !bg-[var(--text-primary)] text-[var(--text-inverse)]"
      : isToday
        ? "border-[var(--brand-primary-border)] !bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"
        : dayEvents.length > 0
          ? "border-transparent !bg-[var(--bg-hover)] text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-secondary)]";

    days.push(
      <button
        key={day}
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelectDate(cellDate)}
        className={cx(
          "kds-action-surface relative flex aspect-square items-center justify-center rounded-full border transition-colors",
          stateClass,
        )}
      >
        <span className="text-sm font-bold sm:text-base">{day}</span>
        {dayEvents.length > 0 && (
          <span
            className={cx(
              "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none sm:h-5 sm:min-w-5 sm:text-[10px]",
              isSelected
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : hasCommission
                  ? "bg-[var(--accent-gold-hover)] text-[var(--text-on-brand)]"
                  : "bg-[var(--brand-primary)] text-[var(--text-on-brand)]",
            )}
            title={`${dayEvents.length} evento(s)`}
          >
            {dayEvents.length}
          </span>
        )}
      </button>,
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {COMMISSION_WEEK_DAYS.map((day) => (
        <div
          key={day}
          className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
        >
          {day}
        </div>
      ))}
      {days}
    </div>
  );
}
