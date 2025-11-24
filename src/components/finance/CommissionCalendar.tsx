import { useEffect, useMemo, useState } from 'react';
import { supabase, Contract } from '../../lib/supabase';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Gift,
  Loader2,
} from 'lucide-react';

type CommissionEvent = {
  id: string;
  date: string;
  type: 'comissao' | 'bonificacao';
  value: number;
  contract: Contract;
  installmentIndex?: number;
  installmentCount?: number;
};

const getDateKey = (date: Date) => date.toISOString().split('T')[0];

const toDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isSameMonth = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth();

const isSameDay = (date: Date, other: Date) =>
  isSameMonth(date, other) && date.getDate() === other.getDate();

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

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

  useEffect(() => {
    const fetchContracts = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('contracts')
          .select('*')
          .order('previsao_recebimento_comissao', { ascending: true });

        if (fetchError) throw fetchError;
        const activeContracts = (data || []).filter((contract) => contract.status === 'Ativo');
        setContracts(activeContracts);
      } catch (err) {
        console.error('Erro ao carregar comissões:', err);
        setError('Não foi possível carregar as informações financeiras.');
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
            0
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
          const installments: { value: number; date: Date }[] = [];
          let remaining = roundCurrency(totalCommission);
          let installmentIndex = 0;
          const MAX_INSTALLMENTS = 60;

          while (remaining > 0.009 && installmentIndex < MAX_INSTALLMENTS) {
            const value = roundCurrency(Math.min(monthlyCap, remaining));
            const installmentDate = new Date(commissionDate);
            installmentDate.setMonth(installmentDate.getMonth() + installmentIndex);

            installments.push({ value, date: installmentDate });

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
        const vidas = contract.vidas || 1;
        const totalBonus = contract.bonus_por_vida_aplicado
          ? contract.bonus_por_vida_valor * vidas
          : contract.bonus_por_vida_valor;
        const monthlyCap = contract.bonus_limite_mensal
          ? (contract.bonus_por_vida_aplicado ? contract.bonus_limite_mensal * vidas : contract.bonus_limite_mensal)
          : null;

        if (monthlyCap && monthlyCap > 0 && monthlyCap < totalBonus) {
          const installments: { value: number; date: Date }[] = [];
          let remaining = roundCurrency(totalBonus);
          let installmentIndex = 0;
          const MAX_INSTALLMENTS = 60;

          while (remaining > 0.009 && installmentIndex < MAX_INSTALLMENTS) {
            const value = roundCurrency(Math.min(monthlyCap, remaining));
            const installmentDate = new Date(bonusDate);
            installmentDate.setMonth(installmentDate.getMonth() + installmentIndex);

            installments.push({ value, date: installmentDate });

            remaining = roundCurrency(remaining - value);
            installmentIndex += 1;
          }

          if (installments.length === 0) {
            mappedEvents.push({
              id: `${contract.id}-bonus`,
              date: getDateKey(bonusDate),
              type: 'bonificacao',
              value: totalBonus,
              contract,
            });
          } else {
            installments.forEach((installment, index) => {
              mappedEvents.push({
                id: `${contract.id}-bonus-${index + 1}`,
                date: getDateKey(installment.date),
                type: 'bonificacao',
                value: installment.value,
                contract,
                installmentIndex: index + 1,
                installmentCount: installments.length,
              });
            });
          }
        } else {
          mappedEvents.push({
            id: `${contract.id}-bonus`,
            date: getDateKey(bonusDate),
            type: 'bonificacao',
            value: totalBonus,
            contract,
          });
        }
      }
    });

    return mappedEvents;
  }, [contracts]);

  const monthEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = toDate(event.date);
      return eventDate ? isSameMonth(eventDate, currentMonth) : false;
    });
  }, [events, currentMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CommissionEvent[]>();
    monthEvents.forEach((event) => {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list.sort((a, b) => a.value - b.value));
    });
    return map;
  }, [monthEvents]);

  const totals = useMemo(() => {
    return monthEvents.reduce(
      (acc, event) => {
        if (event.type === 'comissao') {
          acc.commission += event.value;
        } else {
          acc.bonus += event.value;
        }
        return acc;
      },
      { commission: 0, bonus: 0 }
    );
  }, [monthEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = getDateKey(selectedDate);
    return eventsByDay.get(key) || [];
  }, [selectedDate, eventsByDay]);

  const getDaysInMonth = () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const getFirstWeekday = () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const goToPreviousMonth = () => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(previous);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    setCurrentMonth(next);
    setSelectedDate(null);
  };

  const renderCalendarDays = () => {
    const days = [];
    const firstWeekday = getFirstWeekday();
    const totalDays = getDaysInMonth();
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 0; i < firstWeekday; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= totalDays; day++) {
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
          onClick={() => setSelectedDate(cellDate)}
          className={`aspect-square p-2 rounded-lg border transition-all text-left flex flex-col items-start justify-between ${
            isSelected
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg'
              : isToday
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
              : dayEvents.length > 0
              ? 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100'
              : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-sm font-semibold">{day}</span>
          <div className="flex flex-wrap gap-1 mt-auto">
            {hasCommission && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold">
                <DollarSign className="w-3 h-3 mr-1" />
                {dayEvents
                  .filter((event) => event.type === 'comissao')
                  .reduce((sum, event) => sum + event.value, 0)
                  .toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
            {hasBonus && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-[10px] font-semibold">
                <Gift className="w-3 h-3 mr-1" />
                {dayEvents
                  .filter((event) => event.type === 'bonificacao')
                  .reduce((sum, event) => sum + event.value, 0)
                  .toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            <span>Agenda de Comissões e Bonificações</span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Visualize as previsões de recebimento para o mês selecionado e organize o fluxo financeiro.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500 tracking-wide">Comissão prevista</p>
            <p className="text-lg font-semibold text-emerald-600">{formatCurrency(totals.commission)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500 tracking-wide">Bonificação prevista</p>
            <p className="text-lg font-semibold text-yellow-600">{formatCurrency(totals.bonus)}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 border rounded-xl border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg hover:bg-white transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h3 className="text-lg font-semibold text-slate-900 capitalize">
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg hover:bg-white transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Carregando informações financeiras...
            </div>
          ) : (
            <>
              {renderCalendarDays()}
              {monthEvents.length === 0 && (
                <div className="text-center text-sm text-slate-500 py-10">
                  Nenhuma previsão cadastrada para este mês.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            Destaques do mês
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-700">Total em comissões previstas</span>
              </div>
              <span className="font-semibold text-emerald-700">{formatCurrency(totals.commission)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50">
              <div className="flex items-center space-x-2">
                <Gift className="w-4 h-4 text-yellow-600" />
                <span className="text-slate-700">Total em bonificações previstas</span>
              </div>
              <span className="font-semibold text-yellow-700">{formatCurrency(totals.bonus)}</span>
            </div>
            <p className="text-xs text-slate-500">
              Os valores consideram apenas contratos ativos com previsões cadastradas para o período selecionado.
            </p>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            {selectedDate ? `Eventos de ${selectedDate.toLocaleDateString('pt-BR')}` : 'Selecione um dia'}
          </h4>

          {selectedDate ? (
            selectedDateEvents.length > 0 ? (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`border rounded-lg p-3 flex items-start justify-between ${
                      event.type === 'comissao'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-yellow-200 bg-yellow-50'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {event.type === 'comissao' ? 'Recebimento de comissão' : 'Pagamento de bonificação'}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Contrato {event.contract.codigo_contrato} • {event.contract.operadora}
                      </p>
                      {event.installmentCount && event.installmentIndex && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Parcela {event.installmentIndex} de {event.installmentCount}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        event.type === 'comissao' ? 'text-emerald-700' : 'text-yellow-700'
                      }`}
                    >
                      {formatCurrency(event.value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 py-10 text-center">
                Nenhum lançamento previsto para este dia.
              </div>
            )
          ) : (
            <div className="text-sm text-slate-500 py-10 text-center">
              Escolha um dia para visualizar os detalhes.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
