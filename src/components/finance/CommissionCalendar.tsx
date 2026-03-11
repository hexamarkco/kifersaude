import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, DollarSign, Gift } from 'lucide-react';

import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { cx } from '../../lib/cx';
import { Contract, supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';
import { CommissionCalendarSkeleton } from '../ui/panelSkeletons';

type CommissionEvent = {
  id: string;
  date: string;
  type: 'comissao' | 'bonificacao';
  value: number;
  contract: Contract;
  installmentIndex?: number;
  installmentCount?: number;
};

const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

const calendarSurfaceClass =
  'panel-glass-panel rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-6 shadow-sm';
const calendarShellClass =
  'overflow-hidden rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)]';
const calendarHeaderClass =
  'flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-4 py-3';
const calendarCardClass =
  'rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] p-4';
const calendarMutedCardClass =
  'rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] p-4';
const calendarLabelClass =
  'text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-text-muted,#876f5c)]';
const calendarTitleClass = 'text-[var(--panel-text,#1c1917)]';
const calendarBodyClass = 'text-sm text-[var(--panel-text-soft,#5b4635)]';
const calendarMutedTextClass = 'text-[var(--panel-text-muted,#876f5c)]';
const commissionBadgeClass =
  'inline-flex items-center rounded-full border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] px-2 py-0.5 text-[10px] font-semibold text-[var(--panel-accent-ink,#6f3f16)]';
const bonusBadgeClass =
  'inline-flex items-center rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)] px-2 py-0.5 text-[10px] font-semibold text-[var(--panel-text-soft,#5b4635)]';
const commissionRowClass =
  'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)]';
const bonusRowClass =
  'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)]';
const errorBannerClass =
  'mt-4 flex items-center gap-2 rounded-xl border border-[var(--panel-accent-red-border,#d79a8f)] bg-[color:var(--panel-accent-red-bg,#faecea)] px-4 py-3 text-sm text-[var(--panel-accent-red-text,#8a3128)]';
const emptyStateClass = 'py-10 text-center text-sm text-[var(--panel-text-muted,#876f5c)]';

const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDate = (value?: string | null) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const isSameMonth = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth();

const isSameDay = (date: Date, other: Date) => isSameMonth(date, other) && date.getDate() === other.getDate();

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

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
    'aspect-square rounded-xl border p-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-surface,#fffdfa)]',
    'flex flex-col items-start justify-between',
    isSelected
      ? 'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-hover,#e8c089)] text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm'
      : isToday
        ? 'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)]'
        : hasEvents
          ? 'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-surface-soft,#efe6d8)] text-[var(--panel-text,#1c1917)] hover:bg-[color:var(--panel-accent-soft,#f6e4c7)]'
          : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-text,#1c1917)] hover:bg-[color:var(--panel-surface-soft,#efe6d8)]',
  );

const getEventTone = (type: CommissionEvent['type']) =>
  type === 'comissao'
    ? {
        badgeClass: commissionBadgeClass,
        iconClass: 'text-[var(--panel-accent-ink,#6f3f16)]',
        cardClass: commissionRowClass,
        titleClass: 'text-[var(--panel-accent-ink-strong,#4a2411)]',
        valueClass: 'text-[var(--panel-accent-ink-strong,#4a2411)]',
      }
    : {
        badgeClass: bonusBadgeClass,
        iconClass: 'text-[var(--panel-text-soft,#5b4635)]',
        cardClass: bonusRowClass,
        titleClass: 'text-[var(--panel-text,#1c1917)]',
        valueClass: 'text-[var(--panel-text,#1c1917)]',
      };

export default function CommissionCalendar() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const loadingUi = useAdaptiveLoading(loading);

  useEffect(() => {
    const fetchContracts = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('contracts')
          .select('*')
          .order('previsao_recebimento_comissao', { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setContracts((data || []).filter((contract) => contract.status === 'Ativo'));
      } catch (fetchContractsError) {
        console.error('Erro ao carregar comissoes:', fetchContractsError);
        setError('Nao foi possivel carregar as informacoes financeiras.');
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, []);

  const events = useMemo<CommissionEvent[]>(() => {
    const mappedEvents: CommissionEvent[] = [];

    contracts.forEach((contract) => {
      const commissionDate = toDate(contract.previsao_recebimento_comissao);

      if (commissionDate && contract.comissao_prevista) {
        const totalCommission = contract.comissao_prevista;
        const isUpfront = contract.comissao_recebimento_adiantado ?? true;
        const customInstallments = Array.isArray(contract.comissao_parcelas)
          ? contract.comissao_parcelas
          : [];

        if (!isUpfront && customInstallments.length > 0) {
          const totalPercentual = customInstallments.reduce(
            (sum, parcel) => sum + (parcel.percentual || 0),
            0,
          );

          customInstallments.forEach((parcel, index) => {
            const parcelDate = toDate(parcel.data_pagamento) || commissionDate;
            const parcelValue =
              totalPercentual > 0
                ? roundCurrency((totalCommission * (parcel.percentual || 0)) / totalPercentual)
                : roundCurrency(totalCommission);

            mappedEvents.push({
              id: `${contract.id}-comissao-${index + 1}`,
              date: getDateKey(parcelDate),
              type: 'comissao',
              value: parcelValue,
              contract,
              installmentIndex: index + 1,
              installmentCount: customInstallments.length,
            });
          });
        } else if (!isUpfront && contract.mensalidade_total && contract.mensalidade_total > 0) {
          const monthlyCap = contract.mensalidade_total;
          const installments: Array<{ date: Date; value: number }> = [];
          let remaining = roundCurrency(totalCommission);
          let installmentIndex = 0;
          const maxInstallments = 60;

          while (remaining > 0.009 && installmentIndex < maxInstallments) {
            const value = roundCurrency(Math.min(monthlyCap, remaining));
            const installmentDate = new Date(commissionDate);
            installmentDate.setMonth(installmentDate.getMonth() + installmentIndex);

            installments.push({ date: installmentDate, value });

            remaining = roundCurrency(remaining - value);
            installmentIndex += 1;
          }

          if (installments.length === 0) {
            mappedEvents.push({
              id: `${contract.id}-comissao`,
              date: getDateKey(commissionDate),
              type: 'comissao',
              value: totalCommission,
              contract,
            });
          } else {
            installments.forEach((installment, index) => {
              mappedEvents.push({
                id: `${contract.id}-comissao-${index + 1}`,
                date: getDateKey(installment.date),
                type: 'comissao',
                value: installment.value,
                contract,
                installmentIndex: index + 1,
                installmentCount: installments.length,
              });
            });
          }
        } else {
          mappedEvents.push({
            id: `${contract.id}-comissao`,
            date: getDateKey(commissionDate),
            type: 'comissao',
            value: totalCommission,
            contract,
          });
        }
      }

      const bonusDate = toDate(contract.previsao_pagamento_bonificacao);

      if (bonusDate && contract.bonus_por_vida_valor) {
        const vidas = contract.vidas_elegiveis_bonus ?? contract.vidas ?? 1;
        const totalBonus = contract.bonus_por_vida_aplicado
          ? contract.bonus_por_vida_valor * vidas
          : contract.bonus_por_vida_valor;

        mappedEvents.push({
          id: `${contract.id}-bonus`,
          date: getDateKey(bonusDate),
          type: 'bonificacao',
          value: totalBonus,
          contract,
        });
      }
    });

    return mappedEvents;
  }, [contracts]);

  const monthEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventDate = toDate(event.date);
        return eventDate ? isSameMonth(eventDate, currentMonth) : false;
      }),
    [currentMonth, events],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CommissionEvent[]>();

    monthEvents.forEach((event) => {
      const dayEvents = map.get(event.date) || [];
      dayEvents.push(event);
      map.set(
        event.date,
        dayEvents.sort((left, right) => left.value - right.value),
      );
    });

    return map;
  }, [monthEvents]);

  const totals = useMemo(
    () =>
      monthEvents.reduce(
        (accumulator, event) => {
          if (event.type === 'comissao') {
            accumulator.commission += event.value;
          } else {
            accumulator.bonus += event.value;
          }

          return accumulator;
        },
        { bonus: 0, commission: 0 },
      ),
    [monthEvents],
  );

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDay.get(getDateKey(selectedDate)) || [];
  }, [eventsByDay, selectedDate]);

  const getDaysInMonth = () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const getFirstWeekday = () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const renderCalendarDays = () => {
    const days = [];
    const firstWeekday = getFirstWeekday();
    const totalDays = getDaysInMonth();

    for (let emptyIndex = 0; emptyIndex < firstWeekday; emptyIndex += 1) {
      days.push(<div key={`empty-${emptyIndex}`} className="aspect-square" />);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateKey = getDateKey(cellDate);
      const dayEvents = eventsByDay.get(dateKey) || [];
      const hasCommission = dayEvents.some((event) => event.type === 'comissao');
      const hasBonus = dayEvents.some((event) => event.type === 'bonificacao');
      const isToday = isSameDay(cellDate, new Date());
      const isSelected = selectedDate ? isSameDay(cellDate, selectedDate) : false;

      days.push(
        <button
          key={day}
          type="button"
          aria-pressed={isSelected}
          onClick={() => setSelectedDate(cellDate)}
          className={getDayCellClass({
            hasEvents: dayEvents.length > 0,
            isSelected,
            isToday,
          })}
        >
          <span className="text-sm font-semibold">{day}</span>
          <div className="mt-auto flex flex-wrap gap-1">
            {hasCommission && (
              <span className={commissionBadgeClass}>
                <DollarSign className="mr-1 h-3 w-3" />
                {dayEvents
                  .filter((event) => event.type === 'comissao')
                  .reduce((sum, event) => sum + event.value, 0)
                  .toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
            {hasBonus && (
              <span className={bonusBadgeClass}>
                <Gift className="mr-1 h-3 w-3" />
                {dayEvents
                  .filter((event) => event.type === 'bonificacao')
                  .reduce((sum, event) => sum + event.value, 0)
                  .toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </button>,
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className={cx('text-center', calendarLabelClass)}>
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const hasContractsSnapshot = contracts.length > 0;
  const monthLabel = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const selectedDateLabel = selectedDate ? selectedDate.toLocaleDateString('pt-BR') : null;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasContractsSnapshot}
      skeleton={<CommissionCalendarSkeleton />}
      stageLabel="Carregando agenda de comissoes..."
      overlayLabel="Atualizando agenda de comissoes..."
      stageClassName="min-h-[560px]"
    >
      <section className={calendarSurfaceClass}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className={cx('flex items-center gap-3 text-xl font-bold', calendarTitleClass)}>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span>Agenda de Comissoes e Bonificacoes</span>
            </h2>
            <p className={calendarBodyClass}>
              Visualize as previsoes de recebimento para o mes selecionado e organize o fluxo financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <div className="min-w-[160px] text-right">
              <p className={calendarLabelClass}>Comissao prevista</p>
              <p className="text-lg font-semibold text-[var(--panel-accent-ink-strong,#4a2411)]">
                {formatCurrency(totals.commission)}
              </p>
            </div>
            <div className="min-w-[160px] text-right">
              <p className={calendarLabelClass}>Bonificacao prevista</p>
              <p className={cx('text-lg font-semibold', calendarTitleClass)}>{formatCurrency(totals.bonus)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className={calendarShellClass}>
            <div className={calendarHeaderClass}>
              <Button
                onClick={goToPreviousMonth}
                variant="icon"
                size="icon"
                className="h-9 w-9"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <h3 className={cx('text-lg font-semibold capitalize', calendarTitleClass)}>{monthLabel}</h3>

              <Button
                onClick={goToNextMonth}
                variant="icon"
                size="icon"
                className="h-9 w-9"
                aria-label="Proximo mes"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4">
              <div className="overflow-x-auto pb-2">
                <div className="min-w-[640px]">
                  {renderCalendarDays()}
                  {monthEvents.length === 0 && <div className={emptyStateClass}>Nenhuma previsao cadastrada para este mes.</div>}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className={errorBannerClass}>
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={calendarCardClass}>
              <h4 className={cx('mb-3', calendarLabelClass)}>Destaques do mes</h4>

              <div className="space-y-3">
                <div className={cx('flex items-center justify-between rounded-xl border p-3', commissionRowClass)}>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-[var(--panel-accent-ink,#6f3f16)]" />
                    <span className={calendarBodyClass}>Total em comissoes previstas</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--panel-accent-ink-strong,#4a2411)]">
                    {formatCurrency(totals.commission)}
                  </span>
                </div>

                <div className={cx('flex items-center justify-between rounded-xl border p-3', bonusRowClass)}>
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-[var(--panel-text-soft,#5b4635)]" />
                    <span className={calendarBodyClass}>Total em bonificacoes previstas</span>
                  </div>
                  <span className={cx('text-sm font-semibold', calendarTitleClass)}>{formatCurrency(totals.bonus)}</span>
                </div>

                <p className={cx('text-xs leading-5', calendarMutedTextClass)}>
                  Os valores consideram apenas contratos ativos com previsoes cadastradas para o periodo selecionado.
                </p>
              </div>
            </div>

            <div className={calendarCardClass}>
              <h4 className={cx('mb-3', calendarLabelClass)}>
                {selectedDateLabel ? `Eventos de ${selectedDateLabel}` : 'Escolha um dia'}
              </h4>

              {selectedDate ? (
                selectedDateEvents.length > 0 ? (
                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-2">
                    {selectedDateEvents.map((event) => {
                      const tone = getEventTone(event.type);

                      return (
                        <div
                          key={event.id}
                          className={cx('rounded-xl border p-3', tone.cardClass)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className={cx('text-sm font-semibold', tone.titleClass)}>
                                {event.type === 'comissao'
                                  ? 'Recebimento de comissao'
                                  : 'Pagamento de bonificacao'}
                              </p>
                              <p className={cx('mt-1 text-xs', calendarBodyClass)}>
                                Contrato {event.contract.codigo_contrato || 'Sem codigo'} -{' '}
                                {event.contract.operadora || 'Operadora nao informada'}
                              </p>
                              {event.installmentCount && event.installmentIndex && (
                                <p className={cx('mt-1 text-[11px]', calendarMutedTextClass)}>
                                  Parcela {event.installmentIndex} de {event.installmentCount}
                                </p>
                              )}
                            </div>

                            <span className={cx('shrink-0 text-sm font-semibold', tone.valueClass)}>
                              {formatCurrency(event.value)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={emptyStateClass}>Nenhum lancamento previsto para este dia.</div>
                )
              ) : (
                <div className={cx(emptyStateClass, calendarMutedCardClass)}>
                  Escolha um dia para visualizar os detalhes.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </PanelAdaptiveLoadingFrame>
  );
}
