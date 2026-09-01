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
    const isToday = isCommissionSameDay(cellDate, today);
    const isSelected = selectedDate
      ? isCommissionSameDay(cellDate, selectedDate)
      : false;

    const stateClass = isSelected
      ? "kds-calendar-day-selected"
      : isToday
        ? "kds-calendar-day-today"
        : dayEvents.length > 0
          ? "kds-surface-muted"
          : "";

    days.push(
      <button
        key={day}
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelectDate(cellDate)}
        className={cx(
          "kds-action-surface kds-calendar-day border text-[var(--text-secondary)] transition-colors",
          stateClass,
        )}
      >
        <span className="text-sm font-bold sm:text-base">{day}</span>
        {dayEvents.length > 0 && (
          <span
            className={cx(
              "kds-calendar-event-count",
              isSelected
                ? "bg-[var(--bg-surface)] text-[var(--text-primary)]"
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
    <div className="kds-calendar-grid grid grid-cols-7 gap-1 sm:gap-2">
      {COMMISSION_WEEK_DAYS.map((day) => (
        <div
          key={day}
          className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
        >
          {day}
        </div>
      ))}
      {days}
    </div>
  );
}
