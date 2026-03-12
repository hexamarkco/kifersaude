import { DollarSign, Gift } from "lucide-react";

import { cx } from "../../../lib/cx";
import {
  BONUS_ROW_CLASS,
  COMMISSION_CALENDAR_BODY_CLASS,
  COMMISSION_CALENDAR_CARD_CLASS,
  COMMISSION_CALENDAR_LABEL_CLASS,
  COMMISSION_CALENDAR_MUTED_TEXT_CLASS,
  COMMISSION_CALENDAR_TITLE_CLASS,
  COMMISSION_ROW_CLASS,
} from "../shared/commissionCalendarConstants";
import { formatCommissionCurrency } from "../shared/commissionCalendarUtils";

type CommissionMonthHighlightsProps = {
  bonusTotal: number;
  commissionTotal: number;
};

export default function CommissionMonthHighlights({
  bonusTotal,
  commissionTotal,
}: CommissionMonthHighlightsProps) {
  return (
    <div className={COMMISSION_CALENDAR_CARD_CLASS}>
      <h4 className={cx("mb-3", COMMISSION_CALENDAR_LABEL_CLASS)}>
        Destaques do mes
      </h4>

      <div className="space-y-3">
        <div
          className={cx(
            "flex items-center justify-between rounded-xl border p-3",
            COMMISSION_ROW_CLASS,
          )}
        >
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[var(--panel-accent-ink,#6f3f16)]" />
            <span className={COMMISSION_CALENDAR_BODY_CLASS}>
              Total em comissoes previstas
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--panel-accent-ink-strong,#4a2411)]">
            {formatCommissionCurrency(commissionTotal)}
          </span>
        </div>

        <div
          className={cx(
            "flex items-center justify-between rounded-xl border p-3",
            BONUS_ROW_CLASS,
          )}
        >
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[var(--panel-text-soft,#5b4635)]" />
            <span className={COMMISSION_CALENDAR_BODY_CLASS}>
              Total em bonificacoes previstas
            </span>
          </div>
          <span
            className={cx(
              "text-sm font-semibold",
              COMMISSION_CALENDAR_TITLE_CLASS,
            )}
          >
            {formatCommissionCurrency(bonusTotal)}
          </span>
        </div>

        <p
          className={cx(
            "text-xs leading-5",
            COMMISSION_CALENDAR_MUTED_TEXT_CLASS,
          )}
        >
          Os valores consideram apenas contratos ativos com previsoes
          cadastradas para o periodo selecionado.
        </p>
      </div>
    </div>
  );
}
