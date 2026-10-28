import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Gift,
} from "lucide-react";

import {
  Alert,
  CommissionCalendarSkeleton,
  Heading,
  IconButton,
  KpiCard,
  OperationalMetricChip,
  PageHeader,
  PanelAdaptiveLoadingFrame,
  SectionHeader,
  Surface,
  Text,
} from "../../design-system";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { listActiveCommissionContracts } from "./data/commissionRepository";
import type { CommissionContract } from "./domain/types";
import CommissionMonthGrid from "./components/CommissionMonthGrid";
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
  const [contracts, setContracts] = useState<CommissionContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const contractsRequestIdRef = useRef(0);
  const loadingUi = useAdaptiveLoading(loading);

  useEffect(() => {
    const requestId = ++contractsRequestIdRef.current;
    const fetchContracts = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextContracts = await listActiveCommissionContracts();
        if (requestId !== contractsRequestIdRef.current) return;
        setContracts(nextContracts);
      } catch (fetchContractsError) {
        if (requestId !== contractsRequestIdRef.current) return;
        console.error("Erro ao carregar comissoes:", fetchContractsError);
        setError("Não foi possível carregar as informações financeiras.");
      } finally {
        if (requestId === contractsRequestIdRef.current) {
          setLoading(false);
        }
      }
    };

    void fetchContracts();

    return () => {
      contractsRequestIdRef.current += 1;
    };
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
  const monthContractCount = useMemo(
    () => new Set(monthEvents.map((event) => event.contract.id)).size,
    [monthEvents],
  );

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return eventsByDay.get(getCommissionDateKey(selectedDate)) || [];
  }, [eventsByDay, selectedDate]);
  const selectedDateTotals = useMemo(
    () => sumCommissionTotals(selectedDateEvents),
    [selectedDateEvents],
  );
  const hasCommissionForecast = monthEvents.some(
    (event) => event.type === "comissao",
  );
  const hasBonusForecast = monthEvents.some(
    (event) => event.type === "bonificacao",
  );
  const selectedDateHasCommission = selectedDateEvents.some(
    (event) => event.type === "comissao",
  );
  const selectedDateHasBonus = selectedDateEvents.some(
    (event) => event.type === "bonificacao",
  );

  const goToPreviousMonth = () => {
    setCurrentMonth(
      (previousMonth) =>
        new Date(previousMonth.getFullYear(), previousMonth.getMonth() - 1, 1),
    );
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      (previousMonth) =>
        new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 1),
    );
    setSelectedDate(null);
  };

  const hasContractsSnapshot = contracts.length > 0;
  const monthLabel = currentMonth
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, (firstLetter) => firstLetter.toLocaleUpperCase("pt-BR"));
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="panel-page-shell space-y-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Comissões e produção"
        description="Acompanhe as previsões de comissão e bonificação no calendário financeiro."
      />

      <section
        aria-label="Resumo de previsões do mês"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <KpiCard
          padding="sm"
          title="Comissão prevista"
          value={(
            <span className="whitespace-nowrap text-sm min-[375px]:text-lg md:text-xl 2xl:text-2xl">
              {hasCommissionForecast ? formatCommissionCurrency(totals.commission) : "—"}
            </span>
          )}
        />
        <KpiCard
          padding="sm"
          title="Bonificação prevista"
          value={(
            <span className="whitespace-nowrap text-sm min-[375px]:text-lg md:text-xl 2xl:text-2xl">
              {hasBonusForecast ? formatCommissionCurrency(totals.bonus) : "—"}
            </span>
          )}
        />
        <KpiCard
          padding="sm"
          title="Contratos com previsão"
          value={String(monthContractCount)}
        />
        <KpiCard
          padding="sm"
          title="Eventos"
          value={String(monthEvents.length)}
        />
      </section>

      <PanelAdaptiveLoadingFrame
        loading={loading}
        phase={loadingUi.phase}
        hasContent={hasContractsSnapshot}
        skeleton={<CommissionCalendarSkeleton />}
        overlayLabel="Atualizando agenda de comissões..."
        stageClassName="min-h-[560px]"
      >
        {error && (
          <Alert tone="danger" className="mb-4">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </span>
          </Alert>
        )}

        <section aria-label="Calendário financeiro" className="space-y-4">
          <SectionHeader
            as="h2"
            title="Calendário financeiro"
            description="Selecione uma data para consultar os recebimentos previstos por contrato."
          />

          <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
            <Surface
              padding="md"
              className="min-w-0 space-y-4 2xl:sticky 2xl:top-4 2xl:self-start"
            >
              <div className="flex items-center justify-between gap-2">
                <IconButton
                  onClick={goToPreviousMonth}
                  variant="icon"
                  aria-label="Mês anterior"
                  size="md"
                >
                  <ChevronLeft className="kds-control-icon" />
                </IconButton>

                <div className="text-center">
                  <Heading
                    level={3}
                    className="text-sm font-semibold text-[var(--text-primary)] min-[375px]:text-base sm:text-lg"
                  >
                    {monthLabel}
                  </Heading>
                  <Text className="text-xs text-[var(--text-muted)]">
                    {monthEvents.length === 1
                      ? "1 lançamento previsto"
                      : `${monthEvents.length} lançamentos previstos`}
                  </Text>
                </div>

                <IconButton
                  onClick={goToNextMonth}
                  variant="icon"
                  aria-label="Próximo mês"
                  size="md"
                >
                  <ChevronRight className="kds-control-icon" />
                </IconButton>
              </div>

              <CommissionMonthGrid
                currentMonth={currentMonth}
                eventsByDay={eventsByDay}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
              />

              <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-[var(--accent-gold-hover)]" /> Comissão
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-[var(--brand-primary)]" /> Bonificação
                </span>
              </div>
            </Surface>

            <Surface padding="none" className="min-w-0 overflow-hidden">
              <div className="space-y-3 border-b border-[var(--border-subtle)] p-4">
                <SectionHeader
                  as="h3"
                  title={selectedDateLabel ? `Eventos de ${selectedDateLabel}` : "Selecione um dia"}
                  description={
                    selectedDate
                      ? selectedDateEvents.length === 1
                        ? "1 lançamento previsto para esta data."
                        : `${selectedDateEvents.length} lançamentos previstos para esta data.`
                      : "Escolha um dia no calendário para ver os detalhes."
                  }
                />
                {(selectedDateHasCommission || selectedDateHasBonus) && (
                  <div className="flex flex-wrap gap-2" aria-label="Totais da data selecionada">
                    {selectedDateHasCommission && (
                      <OperationalMetricChip
                        size="sm"
                        tone="gold"
                        icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
                        label="Comissão"
                        value={formatCommissionCurrency(selectedDateTotals.commission)}
                      />
                    )}
                    {selectedDateHasBonus && (
                      <OperationalMetricChip
                        size="sm"
                        tone="accent"
                        icon={<Gift className="h-4 w-4" aria-hidden="true" />}
                        label="Bonificação"
                        value={formatCommissionCurrency(selectedDateTotals.bonus)}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 2xl:max-h-[calc(100vh-22rem)] 2xl:min-h-96 2xl:overflow-y-auto">
                <CommissionSelectedDatePanel
                  selectedDate={selectedDate}
                  selectedDateEvents={selectedDateEvents}
                />
              </div>
            </Surface>
          </div>
        </section>
      </PanelAdaptiveLoadingFrame>
    </div>
  );
}
