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
    <Surface padding="sm">
      <h3 className="mb-3 font-[var(--font-display)] text-base font-semibold text-[var(--text-primary)]">
        Destaques do mes
      </h3>

      <div className="space-y-3">
        <Surface variant="muted" padding="sm" className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[var(--accent-gold-hover)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              Total em comissoes previstas
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--accent-gold-hover)]">
            {formatCommissionCurrency(commissionTotal)}
          </span>
        </Surface>

        <Surface variant="muted" padding="sm" className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[var(--brand-primary)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              Total em bonificacoes previstas
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--brand-primary)]">
            {formatCommissionCurrency(bonusTotal)}
          </span>
        </Surface>

        <p className="text-xs leading-5 text-[var(--text-muted)]">
          Os valores consideram apenas contratos ativos com previsoes
          cadastradas para o periodo selecionado.
        </p>
      </div>
    </Surface>
  );
}
