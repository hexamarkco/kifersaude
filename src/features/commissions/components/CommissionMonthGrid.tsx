import { DollarSign, Gift } from "lucide-react";

import { cx } from "../../../lib/cx";
import {
  BONUS_BADGE_CLASS,
  COMMISSION_BADGE_CLASS,
  COMMISSION_CALENDAR_LABEL_CLASS,
  COMMISSION_WEEK_DAYS,
} from "../shared/commissionCalendarConstants";
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

const getDayCellClass = ({
  hasEvents,
  isSelected,
  isToday,
}: {
  hasEvents: boolean;
  isSelected: boolean;
  isToday: boolean;
}) =>
  cx(
    "aspect-square rounded-xl border p-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-surface,#fffdfa)]",
    "flex flex-col items-start justify-between",
    isSelected
      ? "border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-hover,#e8c089)] text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm"
      : isToday
        ? "border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)]"
        : hasEvents
          ? "border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-surface-soft,#efe6d8)] text-[var(--panel-text,#1c1917)] hover:bg-[color:var(--panel-accent-soft,#f6e4c7)]"
          : "border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-text,#1c1917)] hover:bg-[color:var(--panel-surface-soft,#efe6d8)]",
  );

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
    const hasBonus = dayEvents.some((event) => event.type === "bonificacao");
    const isToday = isCommissionSameDay(cellDate, today);
    const isSelected = selectedDate
      ? isCommissionSameDay(cellDate, selectedDate)
      : false;

    days.push(
      <button
        key={day}
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelectDate(cellDate)}
        className={getDayCellClass({
          hasEvents: dayEvents.length > 0,
          isSelected,
          isToday,
        })}
      >
        <span className="text-sm font-semibold">{day}</span>
        <div className="mt-auto flex flex-wrap gap-1">
          {hasCommission && (
            <span className={COMMISSION_BADGE_CLASS}>
              <DollarSign className="mr-1 h-3 w-3" />
              {dayEvents
                .filter((event) => event.type === "comissao")
                .reduce((sum, event) => sum + event.value, 0)
                .toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          )}
          {hasBonus && (
            <span className={BONUS_BADGE_CLASS}>
              <Gift className="mr-1 h-3 w-3" />
              {dayEvents
                .filter((event) => event.type === "bonificacao")
                .reduce((sum, event) => sum + event.value, 0)
                .toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </button>,
    );
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {COMMISSION_WEEK_DAYS.map((day) => (
        <div
          key={day}
          className={cx("text-center", COMMISSION_CALENDAR_LABEL_CLASS)}
        >
          {day}
        </div>
      ))}
      {days}
    </div>
  );
}
