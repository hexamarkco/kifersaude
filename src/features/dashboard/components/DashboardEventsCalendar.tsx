import { CalendarDays, Cake, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

import { Badge, Button, EmptyState, SectionHeader, Surface, IconButton
} from '../../../design-system';
import { getDateKey, SAO_PAULO_TIMEZONE } from '../../../lib/dateUtils';
import type {
  AgeBand,
  CalendarEvent,
  DashboardCalendarView,
  DashboardContractNavigationHandler,
  DashboardLeadNavigationHandler,
  DashboardReminderRequestHandler,
  Holder,
} from '../shared/dashboardTypes';

type DashboardEventsCalendarProps = {
  calendarMonth: Date;
  calendarMonthLabel: string;
  calendarMonthEventCount: number;
  calendarEventsByDate: Map<string, CalendarEvent[]>;
  calendarView: DashboardCalendarView;
  calendarViewEvents: CalendarEvent[];
  calendarViewLabel: string;
  selectedCalendarKey: string | null;
  selectedCalendarDate: Date | null;
  ageBands: AgeBand[];
  holderByContractId: Map<string, Holder>;
  onCalendarMonthChange: (date: Date) => void;
  onCalendarViewChange: (view: DashboardCalendarView) => void;
  onSelectedCalendarDateChange: (date: Date) => void;
  onNavigateToContract: DashboardContractNavigationHandler;
  onNavigateToLead: DashboardLeadNavigationHandler;
  onCreateReminder: DashboardReminderRequestHandler;
};

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const getCalendarDateLabel = (date: Date) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

const formatAgeBandLabel = (band: AgeBand) =>
  band.max === null ? `${band.min}+` : `${band.min}-${band.max}`;

export function DashboardEventsCalendar({
  calendarMonth,
  calendarMonthLabel,
  calendarMonthEventCount,
  calendarEventsByDate,
  calendarView,
  calendarViewEvents,
  calendarViewLabel,
  selectedCalendarKey,
  selectedCalendarDate,
  ageBands,
  holderByContractId,
  onCalendarMonthChange,
  onCalendarViewChange,
  onSelectedCalendarDateChange,
  onNavigateToContract,
  onNavigateToLead,
  onCreateReminder,
}: DashboardEventsCalendarProps) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(today, SAO_PAULO_TIMEZONE);
  const monthAdjustmentCount = Array.from(calendarEventsByDate.values())
    .flat()
    .filter((event) => event.kind === 'adjustment').length;
  const monthBirthdayCount = calendarMonthEventCount - monthAdjustmentCount;

  const calendarCells = Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) {
      return <div key={`empty-${index}`} className="aspect-square min-h-0" aria-hidden="true" />;
    }

    const day = index - firstDay + 1;
    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    const dateKey = getDateKey(date, SAO_PAULO_TIMEZONE);
    const dayEvents = calendarEventsByDate.get(dateKey) ?? [];
    const isToday = dateKey === todayKey;
    const isSelected = selectedCalendarKey === dateKey;

    return (
      <button
        key={dateKey}
        type="button"
        onClick={() => onSelectedCalendarDateChange(date)}
        aria-pressed={isSelected}
        aria-label={`${day} de ${calendarMonthLabel}, ${dayEvents.length} evento${dayEvents.length === 1 ? '' : 's'}`}
        className={[
          'group kds-action-surface kds-calendar-day border text-[var(--text-secondary)] transition',
          isSelected
            ? 'kds-calendar-day-selected'
            : isToday
              ? 'kds-calendar-day-today'
              : dayEvents.length > 0
                ? 'kds-surface-muted text-[var(--text-primary)]'
                : '',
        ].join(' ')}
      >
        <span className="text-sm font-semibold leading-none tabular-nums">{day}</span>
        {dayEvents.length > 0 && (
          <span
            className={isSelected
              ? 'kds-calendar-event-count bg-[var(--bg-surface)] text-[var(--text-primary)]'
              : 'kds-calendar-event-count bg-[var(--brand-primary)] text-[var(--text-on-brand)]'}
            aria-hidden="true"
          >
            {dayEvents.length}
          </span>
        )}
      </button>
    );
  });

  const viewTabs: Array<{ id: DashboardCalendarView; label: string; onClick: () => void }> = [
    {
      id: 'day',
      label: 'Hoje',
      onClick: () => {
        onCalendarViewChange('day');
        onCalendarMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
        onSelectedCalendarDateChange(today);
      },
    },
    {
      id: 'week',
      label: 'Semana',
      onClick: () => {
        if (!selectedCalendarDate) {
          onSelectedCalendarDateChange(today);
        }
        onCalendarViewChange('week');
      },
    },
    {
      id: 'month',
      label: 'Mês',
      onClick: () => onCalendarViewChange('month'),
    },
  ];

  return (
    <Surface padding="sm" data-panel-animate className="space-y-5">
      <SectionHeader
        title="Calendário de eventos"
        description="Reajustes e aniversários organizados por mês, semana ou dia."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              <span className="text-[var(--text-primary)]">{calendarMonthEventCount}</span> no mês
            </Badge>
            <Badge tone="accent" size="sm" icon={<span className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" />}>
              {monthAdjustmentCount} reajustes
            </Badge>
            <Badge tone="neutral" size="sm" icon={<span className="h-2 w-2 rounded-full bg-[var(--accent-copper)]" />}>
              {monthBirthdayCount} aniversários
            </Badge>
          </div>
        )}
        as="h3"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)] xl:items-stretch">
        <div className="rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <IconButton
              type="button"
              onClick={() => onCalendarMonthChange(new Date(year, month - 1, 1))}
              variant="icon"
              
              aria-label="Mês anterior"
             size="sm">
              <ChevronLeft aria-hidden="true" />
            </IconButton>

            <div className="min-w-0 text-center">
              <h4 className="flex items-center justify-center gap-2 text-sm font-semibold capitalize leading-tight text-[var(--text-primary)]">
                <CalendarDays className="h-4 w-4 text-[var(--brand-primary)]" strokeWidth={1.75} />
                {calendarMonthLabel}
              </h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Visão operacional do mês</p>
            </div>

            <IconButton
              type="button"
              onClick={() => onCalendarMonthChange(new Date(year, month + 1, 1))}
              variant="icon"
              
              aria-label="Próximo mês"
             size="sm">
              <ChevronRight aria-hidden="true" />
            </IconButton>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1 rounded-full bg-[var(--bg-surface)] p-1">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={tab.onClick}
                className={
                  calendarView === tab.id
                    ? 'rounded-full bg-[var(--text-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-inverse)] transition'
                    : 'rounded-full px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="kds-calendar-grid grid grid-cols-7 gap-1 rounded-[var(--kds-radius-lg)] bg-[var(--bg-surface)] p-2 sm:gap-2">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]"
              >
                {day.slice(0, 1)}
              </div>
            ))}
            {calendarCells}
          </div>
        </div>

        <div className="flex min-h-[28rem] flex-col rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--kds-radius-md)] bg-[var(--bg-surface)] px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{calendarViewLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">Agenda comercial e relacional</p>
            </div>
            <Badge tone={calendarViewEvents.length > 0 ? 'accent' : 'neutral'} size="sm">
              {calendarViewEvents.length} evento{calendarViewEvents.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {calendarViewEvents.length === 0 ? (
            <EmptyState title="Nenhum evento no período selecionado." className="flex-1" />
          ) : (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {calendarViewEvents.map((event) => (
                <CalendarEventRow
                  key={event.id}
                  event={event}
                  ageBands={ageBands}
                  holderByContractId={holderByContractId}
                  onNavigateToContract={onNavigateToContract}
                  onNavigateToLead={onNavigateToLead}
                  onCreateReminder={onCreateReminder}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

type CalendarEventRowProps = {
  event: CalendarEvent;
  ageBands: AgeBand[];
  holderByContractId: Map<string, Holder>;
  onNavigateToContract: DashboardContractNavigationHandler;
  onNavigateToLead: DashboardLeadNavigationHandler;
  onCreateReminder: DashboardReminderRequestHandler;
};

function CalendarEventRow({
  event,
  ageBands,
  holderByContractId,
  onNavigateToContract,
  onNavigateToLead,
  onCreateReminder,
}: CalendarEventRowProps) {
  if (event.kind === 'adjustment') {
    const adjustment = event.adjustment;
    const holder = adjustment.contract ? holderByContractId.get(adjustment.contract.id) ?? null : null;
    const holderName = holder ? holder.nome_fantasia || holder.razao_social || holder.nome_completo : null;
    const ageBandIndex = adjustment.age
      ? ageBands.findIndex((band) => adjustment.age! >= band.min && (band.max === null || adjustment.age! <= band.max))
      : -1;
    const currentAgeBand = ageBandIndex >= 0 ? ageBands[ageBandIndex] : null;
    const previousAgeBand = ageBandIndex > 0 ? ageBands[ageBandIndex - 1] : null;
    const contractInfoParts = [
      holderName && `Titular: ${holderName}`,
      adjustment.contract?.modalidade && `Modalidade: ${adjustment.contract.modalidade}`,
      adjustment.contract?.responsavel && `Responsável: ${adjustment.contract.responsavel}`,
    ].filter(Boolean) as string[];
    const title = adjustment.tipo === 'idade'
      ? `${adjustment.personName ?? 'Beneficiário'}${adjustment.age ? ` - ${adjustment.age} anos` : ''}`
      : 'Reajuste contratual';

    return (
      <article className="group rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition hover:border-[var(--brand-primary-border)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-[var(--brand-primary-muted)] p-1 text-center text-[var(--brand-primary)]">
            <span className="text-[10px] font-semibold uppercase leading-none">{getCalendarDateLabel(event.date).split(' ')[1]}</span>
            <span className="mt-1 text-lg font-bold leading-none tabular-nums">{event.date.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent" size="sm" icon={Sparkles}>Reajuste</Badge>
              {adjustment.contract?.codigo_contrato && (
                <span className="text-xs font-semibold text-[var(--text-secondary)]">{adjustment.contract.codigo_contrato}</span>
              )}
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            {currentAgeBand && previousAgeBand && (
              <p className="truncate text-xs text-[var(--text-muted)]">
                {adjustment.role} - faixa {formatAgeBandLabel(previousAgeBand)} para {formatAgeBandLabel(currentAgeBand)}
              </p>
            )}
            {contractInfoParts.length > 0 && (
              <p className="truncate text-xs text-[var(--text-muted)]">{contractInfoParts.join(' - ')}</p>
            )}
            {adjustment.contract?.operadora && (
              <p className="truncate text-xs text-[var(--text-muted)]">{adjustment.contract.operadora}</p>
            )}
          </div>
        </div>

        <div className="dashboard-event-actions mt-3 flex flex-wrap items-center gap-1.5">
          <Button type="button" onClick={() => onNavigateToContract(adjustment.contract)} variant="secondary" size="sm">
            Ver contrato
          </Button>
          {adjustment.contract?.lead_id && (
            <Button type="button" onClick={() => onNavigateToLead(adjustment.contract?.lead_id)} variant="secondary" size="sm">
              Abrir lead
            </Button>
          )}
          <Button
            type="button"
            onClick={() =>
              onCreateReminder({
                contractId: adjustment.contract?.id,
                leadId: adjustment.contract?.lead_id,
                title: adjustment.tipo === 'idade'
                  ? `Reajuste por idade - ${adjustment.personName ?? 'beneficiário'}`
                  : `Reajuste anual - ${adjustment.contract?.operadora ?? ''}`,
                description: `Data: ${adjustment.date.toLocaleDateString('pt-BR')}`,
              })
            }
            variant="soft"
            size="sm"
          >
            Criar lembrete
          </Button>
        </div>
      </article>
    );
  }

  const birthday = event.birthday;

  return (
    <article className="group rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition hover:border-[var(--brand-primary-border)]">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-[var(--bg-elevated)] p-1 text-center text-[var(--accent-copper)]">
          <span className="text-[10px] font-semibold uppercase leading-none">{getCalendarDateLabel(event.date).split(' ')[1]}</span>
          <span className="mt-1 text-lg font-bold leading-none tabular-nums">{event.date.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm" icon={Cake}>Aniversário</Badge>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{birthday.tipo}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{birthday.nome}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {birthday.tipo === 'Dependente' && birthday.holder ? `Titular: ${birthday.holder.nome_completo}` : 'Titular do contrato'}
          </p>
          {birthday.isPJ && birthday.holder && (birthday.holder.razao_social || birthday.holder.nome_fantasia) && (
            <p className="truncate text-xs font-medium text-[var(--brand-primary)]">
              {birthday.holder.razao_social || birthday.holder.nome_fantasia}
            </p>
          )}
          {birthday.contract && (
            <p className="truncate text-xs text-[var(--text-muted)]">
              {birthday.contract.codigo_contrato} - {birthday.contract.operadora}
            </p>
          )}
        </div>
      </div>

      <div className="dashboard-event-actions mt-3 flex flex-wrap items-center gap-1.5">
        {birthday.contract && (
          <Button type="button" onClick={() => onNavigateToContract(birthday.contract)} variant="secondary" size="sm">
            Ver contrato
          </Button>
        )}
        {birthday.contract?.lead_id && (
          <Button type="button" onClick={() => onNavigateToLead(birthday.contract?.lead_id)} variant="secondary" size="sm">
            Abrir lead
          </Button>
        )}
        <Button
          type="button"
          onClick={() =>
            onCreateReminder({
              contractId: birthday.contract?.id,
              leadId: birthday.contract?.lead_id,
              title: `Aniversário de ${birthday.nome}`,
              description: `Data: ${birthday.nextBirthday.toLocaleDateString('pt-BR')}`,
            })
          }
          variant="soft"
          size="sm"
        >
          Criar lembrete
        </Button>
      </div>
    </article>
  );
}
