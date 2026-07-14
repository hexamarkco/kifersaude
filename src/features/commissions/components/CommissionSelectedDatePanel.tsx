import { Surface } from "../../../design-system";
import { cx } from "../../../lib/cx";
import {
  formatCommissionCurrency,
} from "../shared/commissionCalendarUtils";
import type { CommissionEvent } from "../shared/commissionCalendarTypes";

type CommissionSelectedDatePanelProps = {
  selectedDate: Date | null;
  selectedDateEvents: CommissionEvent[];
  selectedDateLabel: string | null;
};

export default function CommissionSelectedDatePanel({
  selectedDate,
  selectedDateEvents,
  selectedDateLabel,
}: CommissionSelectedDatePanelProps) {
  return (
    <Surface padding="sm">
      <h3 className="mb-3 font-[var(--font-display)] text-base font-semibold text-[var(--text-primary)]">
        {selectedDateLabel
          ? `Eventos de ${selectedDateLabel}`
          : "Escolha um dia"}
      </h3>

      {selectedDate ? (
        selectedDateEvents.length > 0 ? (
          <div className="max-h-[260px] space-y-3 overflow-y-auto pr-2">
            {selectedDateEvents.map((event) => {
              const isCommission = event.type === "comissao";

              return (
                <Surface
                  key={event.id}
                  variant={isCommission ? "muted" : "default"}
                  padding="sm"
                  className="p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={cx(
                        "text-sm font-semibold",
                        isCommission
                          ? "text-[var(--accent-gold-hover)]"
                          : "text-[var(--text-primary)]",
                      )}>
                        {isCommission
                          ? "Recebimento de comissao"
                          : "Pagamento de bonificacao"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Contrato{" "}
                        {event.contract.codigo_contrato || "Sem codigo"} -{" "}
                        {event.contract.operadora || "Operadora nao informada"}
                      </p>
                      {event.installmentCount && event.installmentIndex && (
                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                          Parcela {event.installmentIndex} de{" "}
                          {event.installmentCount}
                        </p>
                      )}
                    </div>

                    <span className={cx(
                      "shrink-0 text-sm font-semibold",
                      isCommission
                        ? "text-[var(--accent-gold-hover)]"
                        : "text-[var(--text-primary)]",
                    )}>
                      {formatCommissionCurrency(event.value)}
                    </span>
                  </div>
                </Surface>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">
            Nenhum lancamento previsto para este dia.
          </div>
        )
      ) : (
        <Surface variant="muted" className="py-10 text-center text-sm text-[var(--text-muted)]">
          Escolha um dia para visualizar os detalhes.
        </Surface>
      )}
    </Surface>
  );
}
