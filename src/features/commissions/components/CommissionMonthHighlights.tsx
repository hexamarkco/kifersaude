import { DollarSign, Gift } from "lucide-react";

import { Surface } from "../../../design-system";
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
    <Surface variant="muted" padding="sm" className="p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-text-muted)]">
        Destaques do mes
      </h4>

      <div className="space-y-3">
        <Surface variant="warning" padding="sm" className="flex items-center justify-between rounded-xl p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[var(--panel-accent-ink)]" />
            <span className="text-sm text-[var(--panel-text-soft)]">
              Total em comissoes previstas
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--panel-accent-ink-strong)]">
            {formatCommissionCurrency(commissionTotal)}
          </span>
        </Surface>

        <Surface variant="default" padding="sm" className="flex items-center justify-between rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[var(--panel-text-soft)]" />
            <span className="text-sm text-[var(--panel-text-soft)]">
              Total em bonificacoes previstas
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--panel-text)]">
            {formatCommissionCurrency(bonusTotal)}
          </span>
        </Surface>

        <p className="text-xs leading-5 text-[var(--panel-text-muted)]">
          Os valores consideram apenas contratos ativos com previsoes
          cadastradas para o periodo selecionado.
        </p>
      </div>
    </Surface>
  );
}
