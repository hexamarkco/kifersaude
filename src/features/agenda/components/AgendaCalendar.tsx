import { Fragment } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionSurface, Button, Heading, IconButton, Surface } from '../../../design-system';
import { formatTimeBR, getDateKey, isOverdue } from '../../../lib/dateUtils';
import type { ReminderListItem } from '../../reminders';
import { agendaDateKey, dateInAgendaMonth, mondayOffset } from '../agendaDates';

const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric' });
const eventTone = (item: ReminderListItem, index: number) => {
  if (item.lido) return 'success';
  if (isOverdue(item.data_lembrete)) return 'danger';
  return item.prioridade === 'alta' || index === 0 ? 'accent' : 'info';
};

type Props = {
  view: 'month' | 'week';
  selected: Date;
  remindersByDay: ReadonlyMap<string, ReminderListItem[]>;
  onSelect: (date: Date) => void;
  onMove: (direction: -1 | 1) => void;
  onToday: () => void;
  onCreate: (date: Date, time: string) => void;
  onDetail: (id: string) => void;
};

export function AgendaCalendar({ view, selected, remindersByDay, onSelect, onMove, onToday, onCreate, onDetail }: Props) {
  const monthView = view === 'month';
  const month = dateInAgendaMonth(selected, 1);
  const monday = dateInAgendaMonth(selected, selected.getDate() - mondayOffset(selected));
  const week = weekdays.map((_, index) => dateInAgendaMonth(monday, monday.getDate() + index));
  const todayKey = getDateKey(new Date());
  const selectedKey = agendaDateKey(selected);
  const getItems = (date: Date) => remindersByDay.get(agendaDateKey(date)) ?? [];
  const itemsByHour = monthView ? [] : week.map((date) => {
    const slots = new Map<number, ReminderListItem[]>();
    for (const item of getItems(date)) {
      const hour = Number(formatTimeBR(item.data_lembrete).slice(0, 2));
      const items = slots.get(hour) ?? [];
      items.push(item);
      slots.set(hour, items);
    }
    return slots;
  });
  const weekHours = itemsByHour.flatMap((slots) => [...slots.keys()]);
  const firstHour = Math.min(9, ...weekHours);
  const lastHour = Math.max(17, ...weekHours);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => firstHour + index);
  const weekEnd = week[week.length - 1];
  const weekStartLabel = monday.getMonth() === weekEnd.getMonth() ? monday.getDate() : dateLabel.format(monday);

  return (
    <Surface padding="none" className="kds-month-calendar kds-agenda-calendar">
      <div className="kds-month-header">
        <Heading level={2} size="sm">
          {monthView
            ? month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
            : `${weekStartLabel} – ${dateLabel.format(weekEnd)}`}
        </Heading>
        <div className="kds-month-nav">
          <Button variant="secondary" size="sm" onClick={onToday}>Hoje</Button>
          <IconButton size="sm" aria-label={monthView ? 'Mês anterior' : 'Semana anterior'} onClick={() => onMove(-1)}><ChevronLeft /></IconButton>
          <IconButton size="sm" aria-label={monthView ? 'Próximo mês' : 'Próxima semana'} onClick={() => onMove(1)}><ChevronRight /></IconButton>
        </div>
      </div>
      {monthView ? (
        <>
          <div className="kds-month-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="kds-month-grid">
            {Array.from({ length: 42 }, (_, index) => {
              const date = dateInAgendaMonth(month, 1 + index - mondayOffset(month));
              const key = agendaDateKey(date);
              const outside = date.getMonth() !== month.getMonth();
              const items = outside ? [] : getItems(date);
              return (
                <ActionSurface
                  key={key}
                  variant="plain"
                  padding="none"
                  className="kds-month-day"
                  disabled={outside}
                  aria-current={key === todayKey ? 'date' : undefined}
                  aria-pressed={key === selectedKey}
                  aria-label={`${dateLabel.format(date)}, ${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
                  onClick={() => onSelect(date)}
                >
                  <span className="kds-month-day-number">{date.getDate()}</span>
                  {items.slice(0, 2).map((item, itemIndex) => (
                    <span key={item.id} className="kds-month-event" data-tone={eventTone(item, itemIndex)} aria-hidden="true">
                      {formatTimeBR(item.data_lembrete)} {item.titulo}
                    </span>
                  ))}
                  {items.length > 2 && <small className="kds-month-overflow" aria-hidden="true">+{items.length - 2}</small>}
                </ActionSurface>
              );
            })}
          </div>
        </>
      ) : (
        <div className="kds-agenda-week-scroll" role="region" aria-label="Horários da semana" tabIndex={0}>
          <div className="kds-agenda-week-grid">
            <div className="kds-agenda-week-heading" aria-hidden="true" />
            {week.map((date) => (
              <div key={agendaDateKey(date)} className="kds-agenda-week-heading" aria-current={agendaDateKey(date) === todayKey ? 'date' : undefined}>
                {weekdayLabel.format(date)}
                <strong>{monthLabel.format(date)}</strong>
              </div>
            ))}
            {hours.map((hour) => {
              const label = `${String(hour).padStart(2, '0')}:00`;
              return (
                <Fragment key={hour}>
                  <div className="kds-agenda-week-hour">{label}</div>
                  {week.map((date, dayIndex) => {
                    const items = itemsByHour[dayIndex].get(hour) ?? [];
                    return (
                      <div key={agendaDateKey(date)} className="kds-agenda-week-slot">
                        {items.length > 0 ? items.map((item, index) => (
                          <ActionSurface variant="plain" padding="none" key={item.id} className="kds-month-event" data-tone={eventTone(item, index)} onClick={() => onDetail(item.id)}>
                            {formatTimeBR(item.data_lembrete)} · {item.titulo}
                          </ActionSurface>
                        )) : (
                          <ActionSurface
                            variant="plain"
                            padding="none"
                            className="kds-agenda-empty-slot"
                            aria-label={`Nova tarefa em ${dateLabel.format(date)}, às ${label}`}
                            onClick={() => onCreate(date, label)}
                          />
                        )}
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </Surface>
  );
}
