import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Gift,
} from "lucide-react";

import {
  Alert,
  Button,
  OperationalMetricChip,
  PageHeader,
  Surface,
} from "../../design-system";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { CommissionCalendarSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { type Contract, supabase } from "../../lib/supabase";
import CommissionMonthGrid from "./components/CommissionMonthGrid";
import CommissionMonthHighlights from "./components/CommissionMonthHighlights";
import CommissionSelectedDatePanel from "./components/CommissionSelectedDatePanel";
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
    <div className="panel-page-shell space-y-6">
      <PageHeader
        eyebrow="Financeiro"
        title="Agenda de comissoes e bonificacoes"
        description="Visualize as previsoes de recebimento para o mes selecionado e organize o fluxo financeiro."
        actions={(
          <div className="flex flex-wrap gap-2">
            <OperationalMetricChip
              tone="gold"
              icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
              label="Comissao prevista"
              value={formatCommissionCurrency(totals.commission)}
            />
            <OperationalMetricChip
              tone="accent"
              icon={<Gift className="h-4 w-4" aria-hidden="true" />}
              label="Bonificacao prevista"
              value={formatCommissionCurrency(totals.bonus)}
            />
          </div>
        )}
      />

      <PanelAdaptiveLoadingFrame
        loading={loading}
        phase={loadingUi.phase}
        hasContent={hasContractsSnapshot}
        skeleton={<CommissionCalendarSkeleton />}
        stageLabel="Carregando agenda de comissoes..."
        overlayLabel="Atualizando agenda de comissoes..."
        stageClassName="min-h-[560px]"
      >
        <Surface className="space-y-6">
          <Surface variant="muted" padding="none" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
              <Button
                onClick={goToPreviousMonth}
                variant="icon"
                size="icon"
                className="h-9 w-9"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <h3 className="font-[var(--font-display)] text-lg font-semibold capitalize text-[var(--text-primary)]">
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
                    <div className="py-10 text-center text-sm text-[var(--text-muted)]">
                      Nenhuma previsao cadastrada para este mes.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Surface>

          {error && (
            <Alert tone="danger" className="mt-4">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {error}
              </span>
            </Alert>
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
        </Surface>
      </PanelAdaptiveLoadingFrame>
    </div>
  );
}
