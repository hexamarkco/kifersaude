import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import Button from "../../components/ui/Button";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { CommissionCalendarSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { cx } from "../../lib/cx";
import { type Contract, supabase } from "../../lib/supabase";
import CommissionMonthGrid from "./components/CommissionMonthGrid";
import CommissionMonthHighlights from "./components/CommissionMonthHighlights";
import CommissionSelectedDatePanel from "./components/CommissionSelectedDatePanel";
import {
  COMMISSION_CALENDAR_BODY_CLASS,
  COMMISSION_CALENDAR_HEADER_CLASS,
  COMMISSION_CALENDAR_LABEL_CLASS,
  COMMISSION_CALENDAR_SHELL_CLASS,
  COMMISSION_CALENDAR_SURFACE_CLASS,
  COMMISSION_CALENDAR_TITLE_CLASS,
  COMMISSION_EMPTY_STATE_CLASS,
  COMMISSION_ERROR_BANNER_CLASS,
} from "./shared/commissionCalendarConstants";
import {
  buildCommissionEvents,
  formatCommissionCurrency,
  getCommissionDateKey,
  groupCommissionEventsByDay,
  isCommissionSameMonth,
  parseCommissionDate,
  sumCommissionTotals,
} from "./shared/commissionCalendarUtils";

export default function CommissionCalendarScreen() {
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
          .from("contracts")
          .select("*")
          .order("previsao_recebimento_comissao", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        setContracts(
          (data || []).filter((contract) => contract.status === "Ativo"),
        );
      } catch (fetchContractsError) {
        console.error("Erro ao carregar comissoes:", fetchContractsError);
        setError("Nao foi possivel carregar as informacoes financeiras.");
      } finally {
        setLoading(false);
      }
    };

    void fetchContracts();
  }, []);

  const events = useMemo(() => buildCommissionEvents(contracts), [contracts]);

  const monthEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventDate = parseCommissionDate(event.date);
        return eventDate
          ? isCommissionSameMonth(eventDate, currentMonth)
          : false;
      }),
    [currentMonth, events],
  );

  const eventsByDay = useMemo(
    () => groupCommissionEventsByDay(monthEvents),
    [monthEvents],
  );
  const totals = useMemo(() => sumCommissionTotals(monthEvents), [monthEvents]);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return eventsByDay.get(getCommissionDateKey(selectedDate)) || [];
  }, [eventsByDay, selectedDate]);

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
    setSelectedDate(null);
  };

  const hasContractsSnapshot = contracts.length > 0;
  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("pt-BR")
    : null;

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
      <section className={COMMISSION_CALENDAR_SURFACE_CLASS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2
              className={cx(
                "flex items-center gap-3 text-xl font-bold",
                COMMISSION_CALENDAR_TITLE_CLASS,
              )}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span>Agenda de Comissoes e Bonificacoes</span>
            </h2>
            <p className={COMMISSION_CALENDAR_BODY_CLASS}>
              Visualize as previsoes de recebimento para o mes selecionado e
              organize o fluxo financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <div className="min-w-[160px] text-right">
              <p className={COMMISSION_CALENDAR_LABEL_CLASS}>
                Comissao prevista
              </p>
              <p className="text-lg font-semibold text-[var(--panel-accent-ink-strong,#4a2411)]">
                {formatCommissionCurrency(totals.commission)}
              </p>
            </div>
            <div className="min-w-[160px] text-right">
              <p className={COMMISSION_CALENDAR_LABEL_CLASS}>
                Bonificacao prevista
              </p>
              <p
                className={cx(
                  "text-lg font-semibold",
                  COMMISSION_CALENDAR_TITLE_CLASS,
                )}
              >
                {formatCommissionCurrency(totals.bonus)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className={COMMISSION_CALENDAR_SHELL_CLASS}>
            <div className={COMMISSION_CALENDAR_HEADER_CLASS}>
              <Button
                onClick={goToPreviousMonth}
                variant="icon"
                size="icon"
                className="h-9 w-9"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <h3
                className={cx(
                  "text-lg font-semibold capitalize",
                  COMMISSION_CALENDAR_TITLE_CLASS,
                )}
              >
                {monthLabel}
              </h3>

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
                  <CommissionMonthGrid
                    currentMonth={currentMonth}
                    eventsByDay={eventsByDay}
                    onSelectDate={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                  {monthEvents.length === 0 && (
                    <div className={COMMISSION_EMPTY_STATE_CLASS}>
                      Nenhuma previsao cadastrada para este mes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className={COMMISSION_ERROR_BANNER_CLASS}>
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CommissionMonthHighlights
              bonusTotal={totals.bonus}
              commissionTotal={totals.commission}
            />
            <CommissionSelectedDatePanel
              selectedDate={selectedDate}
              selectedDateEvents={selectedDateEvents}
              selectedDateLabel={selectedDateLabel}
            />
          </div>
        </div>
      </section>
    </PanelAdaptiveLoadingFrame>
  );
}
