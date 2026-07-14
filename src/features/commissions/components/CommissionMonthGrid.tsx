import { DollarSign, Gift } from "lucide-react";

import { ActionSurface, Badge } from "../../../design-system";
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
    const hasBonus = dayEvents.some((event) => event.type === "bonificacao");
    const isToday = isCommissionSameDay(cellDate, today);
    const isSelected = selectedDate
      ? isCommissionSameDay(cellDate, selectedDate)
      : false;

    days.push(
      <ActionSurface
        key={day}
        aria-pressed={isSelected}
        onClick={() => onSelectDate(cellDate)}
        variant={dayEvents.length > 0 || isToday ? "muted" : "default"}
        padding="none"
        selected={isSelected}
        className={cx(
          "aspect-square p-2",
          "flex flex-col items-start justify-between",
          isToday && !isSelected && "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]",
        )}
      >
        <span className="text-sm font-semibold">{day}</span>
        <div className="mt-auto flex flex-wrap gap-1">
          {hasCommission && (
            <Badge tone="accent" size="sm" className="px-2 py-0.5 text-[10px]">
              <DollarSign className="mr-1 h-3 w-3" />
              {dayEvents
                .filter((event) => event.type === "comissao")
                .reduce((sum, event) => sum + event.value, 0)
                .toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </Badge>
          )}
          {hasBonus && (
            <Badge tone="neutral" size="sm" className="px-2 py-0.5 text-[10px]">
              <Gift className="mr-1 h-3 w-3" />
              {dayEvents
                .filter((event) => event.type === "bonificacao")
                .reduce((sum, event) => sum + event.value, 0)
                .toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </Badge>
          )}
        </div>
      </ActionSurface>,
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
