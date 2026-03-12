import { cx } from "../../../lib/cx";
import {
  COMMISSION_CALENDAR_BODY_CLASS,
  COMMISSION_CALENDAR_CARD_CLASS,
  COMMISSION_CALENDAR_LABEL_CLASS,
  COMMISSION_CALENDAR_MUTED_CARD_CLASS,
  COMMISSION_CALENDAR_MUTED_TEXT_CLASS,
  COMMISSION_EMPTY_STATE_CLASS,
} from "../shared/commissionCalendarConstants";
import {
  formatCommissionCurrency,
  getCommissionEventTone,
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
    <div className={COMMISSION_CALENDAR_CARD_CLASS}>
      <h4 className={cx("mb-3", COMMISSION_CALENDAR_LABEL_CLASS)}>
        {selectedDateLabel
          ? `Eventos de ${selectedDateLabel}`
          : "Escolha um dia"}
      </h4>

      {selectedDate ? (
        selectedDateEvents.length > 0 ? (
          <div className="max-h-[260px] space-y-3 overflow-y-auto pr-2">
            {selectedDateEvents.map((event) => {
              const tone = getCommissionEventTone(event.type);

              return (
                <div
                  key={event.id}
                  className={cx("rounded-xl border p-3", tone.cardClass)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cx("text-sm font-semibold", tone.titleClass)}
                      >
                        {event.type === "comissao"
                          ? "Recebimento de comissao"
                          : "Pagamento de bonificacao"}
                      </p>
                      <p
                        className={cx(
                          "mt-1 text-xs",
                          COMMISSION_CALENDAR_BODY_CLASS,
                        )}
                      >
                        Contrato{" "}
                        {event.contract.codigo_contrato || "Sem codigo"} -{" "}
                        {event.contract.operadora || "Operadora nao informada"}
                      </p>
                      {event.installmentCount && event.installmentIndex && (
                        <p
                          className={cx(
                            "mt-1 text-[11px]",
                            COMMISSION_CALENDAR_MUTED_TEXT_CLASS,
                          )}
                        >
                          Parcela {event.installmentIndex} de{" "}
                          {event.installmentCount}
                        </p>
                      )}
                    </div>

                    <span
                      className={cx(
                        "shrink-0 text-sm font-semibold",
                        tone.valueClass,
                      )}
                    >
                      {formatCommissionCurrency(event.value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={COMMISSION_EMPTY_STATE_CLASS}>
            Nenhum lancamento previsto para este dia.
          </div>
        )
      ) : (
        <div
          className={cx(
            COMMISSION_EMPTY_STATE_CLASS,
            COMMISSION_CALENDAR_MUTED_CARD_CLASS,
          )}
        >
          Escolha um dia para visualizar os detalhes.
        </div>
      )}
    </div>
  );
}
