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
  SectionHeader,
  Surface,
} from "../../design-system";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { CommissionCalendarSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { type Contract, supabase } from "../../lib/supabase";
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
        {error && (
          <Alert tone="danger" className="mb-4">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {error}
            </span>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
          <Surface padding="md" className="space-y-4 2xl:sticky 2xl:top-4 2xl:self-start">
            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={goToPreviousMonth}
                variant="icon"
                size="icon"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="text-center">
                <h3 className="font-[var(--font-display)] text-lg font-semibold capitalize text-[var(--text-primary)]">
                  {monthLabel}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {monthEvents.length} evento(s) no mes
                </p>
              </div>

              <Button
                onClick={goToNextMonth}
                variant="icon"
                size="icon"
                aria-label="Proximo mes"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <CommissionMonthGrid
              currentMonth={currentMonth}
              eventsByDay={eventsByDay}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
            />

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-[var(--accent-gold-hover)]" /> Comissao
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-[var(--brand-primary)]" /> Bonificacao
              </span>
            </div>
          </Surface>

          <Surface padding="none" className="overflow-hidden">
            <div className="space-y-3 border-b border-[var(--border-subtle)] p-4">
              <SectionHeader
                as="h3"
                title={selectedDateLabel ? `Eventos de ${selectedDateLabel}` : "Selecione um dia"}
                description={
                  selectedDate
                    ? `${selectedDateEvents.length} lancamento(s) previsto(s) para esta data.`
                    : "Escolha um dia no calendario para ver os detalhes."
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <OperationalMetricChip
                  tone="gold"
                  icon={<DollarSign className="h-4 w-4" aria-hidden="true" />}
                  label="comissao no mes"
                  value={formatCommissionCurrency(totals.commission)}
                  className="justify-center"
                />
                <OperationalMetricChip
                  tone="accent"
                  icon={<Gift className="h-4 w-4" aria-hidden="true" />}
                  label="bonificacao no mes"
                  value={formatCommissionCurrency(totals.bonus)}
                  className="justify-center"
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-22rem)] min-h-96 overflow-y-auto p-4">
              <CommissionSelectedDatePanel
                selectedDate={selectedDate}
                selectedDateEvents={selectedDateEvents}
              />
            </div>
          </Surface>
        </div>
      </PanelAdaptiveLoadingFrame>
    </div>
  );
}
