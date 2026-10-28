import { CalendarDays } from "lucide-react";

import { EmptyState, Surface, Text } from "../../../design-system";
import { cx } from "../../../lib/cx";
import { formatCommissionCurrency } from "../shared/commissionCalendarUtils";
import type { CommissionEvent } from "../shared/commissionCalendarTypes";

type CommissionSelectedDatePanelProps = {
  selectedDate: Date | null;
  selectedDateEvents: CommissionEvent[];
};

export default function CommissionSelectedDatePanel({
  selectedDate,
  selectedDateEvents,
}: CommissionSelectedDatePanelProps) {
  if (!selectedDate) {
    return (
      <EmptyState
        icon={<CalendarDays aria-hidden="true" />}
        title="Selecione uma data"
        description="Escolha um dia no calendário para consultar as previsões."
        className="min-h-48 border-0 bg-[var(--bg-hover)] px-4 py-8"
      />
    );
  }

  if (selectedDateEvents.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays aria-hidden="true" />}
        title="Nenhum lançamento previsto"
        description="Não há comissão nem bonificação prevista para esta data."
        className="min-h-48 border-0 bg-[var(--bg-hover)] px-4 py-8"
      />
    );
  }

  return (
    <div className="space-y-3">
      {selectedDateEvents.map((event) => {
        const isCommission = event.type === "comissao";

        return (
          <Surface key={event.id} padding="sm" className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Text
                  className={cx(
                    "text-sm font-semibold",
                    isCommission
                      ? "text-[var(--accent-gold-hover)]"
                      : "text-[var(--text-primary)]",
                  )}
                >
                  {isCommission
                    ? "Recebimento de comissão"
                    : "Pagamento de bonificação"}
                </Text>
                <Text className="mt-1 text-xs text-[var(--text-secondary)]">
                  Contrato{" "}
                  {event.contract.codigo_contrato || "Sem código"},{" "}
                  {event.contract.operadora || "Operadora não informada"}
                </Text>
                {event.installmentCount && event.installmentIndex && (
                  <Text className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Parcela {event.installmentIndex} de{" "}
                    {event.installmentCount}
                  </Text>
                )}
              </div>

              <span
                className={cx(
                  "shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums",
                  isCommission
                    ? "text-[var(--accent-gold-hover)]"
                    : "text-[var(--text-primary)]",
                )}
              >
                {formatCommissionCurrency(event.value)}
              </span>
            </div>
          </Surface>
        );
      })}
    </div>
  );
}
