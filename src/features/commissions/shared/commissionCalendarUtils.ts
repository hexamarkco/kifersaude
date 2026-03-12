import type { Contract } from "../../../lib/supabase";
import { getContractBonusSummary } from "../../../lib/contractBonus";
import { getCommissionInstallmentSummary } from "../../../lib/contractCommission";
import type {
  CommissionEvent,
  CommissionEventType,
} from "./commissionCalendarTypes";

export const getCommissionDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseCommissionDate = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const isCommissionSameMonth = (date: Date, other: Date) =>
  date.getFullYear() === other.getFullYear() &&
  date.getMonth() === other.getMonth();

export const isCommissionSameDay = (date: Date, other: Date) =>
  isCommissionSameMonth(date, other) && date.getDate() === other.getDate();

export const formatCommissionCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const roundCommissionCurrency = (value: number) =>
  Math.round(value * 100) / 100;

const buildSingleCommissionEvent = ({
  contract,
  date,
  installmentCount,
  installmentIndex,
  value,
}: {
  contract: Contract;
  date: Date;
  installmentCount?: number;
  installmentIndex?: number;
  value: number;
}): CommissionEvent => ({
  id: installmentIndex
    ? `${contract.id}-comissao-${installmentIndex}`
    : `${contract.id}-comissao`,
  date: getCommissionDateKey(date),
  type: "comissao",
  value,
  contract,
  installmentIndex,
  installmentCount,
});

export const buildCommissionEvents = (
  contracts: Contract[],
): CommissionEvent[] => {
  const mappedEvents: CommissionEvent[] = [];

  contracts.forEach((contract) => {
    const commissionDate = parseCommissionDate(
      contract.previsao_recebimento_comissao,
    );

    if (commissionDate && contract.comissao_prevista) {
      const totalCommission = contract.comissao_prevista;
      const isUpfront = contract.comissao_recebimento_adiantado ?? true;
      const customInstallments =
        getCommissionInstallmentSummary(contract).installments;

      if (!isUpfront && customInstallments.length > 0) {
        customInstallments.forEach((parcel, index) => {
          const parcelDate =
            parseCommissionDate(parcel.data_pagamento) || commissionDate;
          const parcelValue = roundCommissionCurrency(
            parcel.resolvedValue || totalCommission,
          );

          mappedEvents.push(
            buildSingleCommissionEvent({
              contract,
              date: parcelDate,
              installmentCount: customInstallments.length,
              installmentIndex: index + 1,
              value: parcelValue,
            }),
          );
        });
      } else if (
        !isUpfront &&
        contract.mensalidade_total &&
        contract.mensalidade_total > 0
      ) {
        const monthlyCap = contract.mensalidade_total;
        const installments: Array<{ date: Date; value: number }> = [];
        let remaining = roundCommissionCurrency(totalCommission);
        let installmentIndex = 0;
        const maxInstallments = 60;

        while (remaining > 0.009 && installmentIndex < maxInstallments) {
          const value = roundCommissionCurrency(
            Math.min(monthlyCap, remaining),
          );
          const installmentDate = new Date(commissionDate);
          installmentDate.setMonth(
            installmentDate.getMonth() + installmentIndex,
          );

          installments.push({ date: installmentDate, value });

          remaining = roundCommissionCurrency(remaining - value);
          installmentIndex += 1;
        }

        if (installments.length === 0) {
          mappedEvents.push(
            buildSingleCommissionEvent({
              contract,
              date: commissionDate,
              value: totalCommission,
            }),
          );
        } else {
          installments.forEach((installment, index) => {
            mappedEvents.push(
              buildSingleCommissionEvent({
                contract,
                date: installment.date,
                installmentCount: installments.length,
                installmentIndex: index + 1,
                value: installment.value,
              }),
            );
          });
        }
      } else {
        mappedEvents.push(
          buildSingleCommissionEvent({
            contract,
            date: commissionDate,
            value: totalCommission,
          }),
        );
      }
    }

    const bonusDate = parseCommissionDate(
      contract.previsao_pagamento_bonificacao,
    );
    const bonusSummary = getContractBonusSummary(contract);

    if (bonusDate && bonusSummary.total > 0) {
      mappedEvents.push({
        id: `${contract.id}-bonus`,
        date: getCommissionDateKey(bonusDate),
        type: "bonificacao",
        value: bonusSummary.total,
        contract,
      });
    }
  });

  return mappedEvents;
};

export const groupCommissionEventsByDay = (events: CommissionEvent[]) => {
  const map = new Map<string, CommissionEvent[]>();

  events.forEach((event) => {
    const dayEvents = map.get(event.date) || [];
    dayEvents.push(event);
    map.set(
      event.date,
      dayEvents.sort((left, right) => left.value - right.value),
    );
  });

  return map;
};

export const sumCommissionTotals = (events: CommissionEvent[]) =>
  events.reduce(
    (accumulator, event) => {
      if (event.type === "comissao") {
        accumulator.commission += event.value;
      } else {
        accumulator.bonus += event.value;
      }

      return accumulator;
    },
    { bonus: 0, commission: 0 },
  );

export const getCommissionEventTone = (type: CommissionEventType) =>
  type === "comissao"
    ? {
        badgeClass:
          "inline-flex items-center rounded-full border border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)] px-2 py-0.5 text-[10px] font-semibold text-[var(--panel-accent-ink,#6f3f16)]",
        iconClass: "text-[var(--panel-accent-ink,#6f3f16)]",
        cardClass:
          "border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-soft,#f6e4c7)]",
        titleClass: "text-[var(--panel-accent-ink-strong,#4a2411)]",
        valueClass: "text-[var(--panel-accent-ink-strong,#4a2411)]",
      }
    : {
        badgeClass:
          "inline-flex items-center rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)] px-2 py-0.5 text-[10px] font-semibold text-[var(--panel-text-soft,#5b4635)]",
        iconClass: "text-[var(--panel-text-soft,#5b4635)]",
        cardClass:
          "border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f8f2e8)]",
        titleClass: "text-[var(--panel-text,#1c1917)]",
        valueClass: "text-[var(--panel-text,#1c1917)]",
      };
