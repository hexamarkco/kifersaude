import { ActionSurface } from '../../../design-system';
import { COMMISSION_WEEK_DAYS } from '../shared/commissionCalendarConstants';
import { formatCommissionCurrency, getCommissionDateKey, isCommissionSameDay } from '../shared/commissionCalendarUtils';
import type { CommissionEvent } from '../shared/commissionCalendarTypes';

type CommissionMonthGridProps = {
  currentMonth: Date;
  eventsByDay: ReadonlyMap<string, CommissionEvent[]>;
  onSelectDate: (date: Date) => void;
  selectedDate: Date;
};

const dayLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

export default function CommissionMonthGrid({ currentMonth, eventsByDay, onSelectDate, selectedDate }: CommissionMonthGridProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = new Date();

  return (
    <>
      <div className="kds-month-weekdays" aria-hidden="true">
        {COMMISSION_WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="kds-month-grid">
        {Array.from({ length: 42 }, (_, index) => {
          const date = new Date(year, month, 1 + index - firstWeekday);
          const key = getCommissionDateKey(date);
          const outside = date.getMonth() !== month;
          const events = outside ? [] : eventsByDay.get(key) ?? [];
          const count = events.length;

          return (
            <ActionSurface
              key={key}
              variant="plain"
              padding="none"
              className="kds-month-day"
              disabled={outside}
              aria-current={isCommissionSameDay(date, today) ? 'date' : undefined}
              aria-pressed={isCommissionSameDay(date, selectedDate)}
              aria-label={`${dayLabel.format(date)}, ${count} ${count === 1 ? 'previsão' : 'previsões'}`}
              onClick={() => onSelectDate(date)}
            >
              <span className="kds-month-day-number">{date.getDate()}</span>
              {events.slice(0, 2).map((event) => (
                <span
                  key={event.id}
                  className="kds-month-event"
                  data-tone={event.type === 'comissao' ? 'cyan' : 'purple'}
                  aria-hidden="true"
                >
                  {formatCommissionCurrency(event.value)}
                </span>
              ))}
              {count > 2 && <small className="kds-month-overflow" aria-hidden="true">+{count - 2}</small>}
            </ActionSurface>
          );
        })}
      </div>
    </>
  );
}
