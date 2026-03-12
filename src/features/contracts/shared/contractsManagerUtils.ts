import type { Contract } from "../../../lib/supabase";
import type {
  ContractDateDisplayType,
  ContractHolder,
} from "./contractsManagerTypes";

export const parseContractManagerDate = (date?: string | null) => {
  if (!date) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getContractFidelityEndDate = (monthValue?: string | null) => {
  if (!monthValue) {
    return null;
  }

  const [year, month] = monthValue.split("-").map(Number);
  if (!year || !month) {
    return null;
  }

  const endOfMonth = new Date(year, month, 0);
  endOfMonth.setHours(0, 0, 0, 0);
  return endOfMonth;
};

export const getContractNextAdjustmentDate = (
  monthNumber?: number | null,
  referenceDate: Date = new Date(),
) => {
  if (!monthNumber) {
    return null;
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  const adjustmentMonthIndex = monthNumber - 1;
  let nextDate = new Date(currentYear, adjustmentMonthIndex, 1);
  nextDate.setHours(0, 0, 0, 0);

  if (nextDate.getTime() < today.getTime()) {
    nextDate = new Date(currentYear + 1, adjustmentMonthIndex, 1);
    nextDate.setHours(0, 0, 0, 0);
  }

  return nextDate;
};

export const getDaysUntilContractDate = (
  date?: Date | null,
  referenceDate: Date = new Date(),
) => {
  if (!date) {
    return null;
  }

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const hasUpcomingImportantContractDate = (
  contract: Pick<
    Contract,
    | "data_renovacao"
    | "mes_reajuste"
    | "previsao_recebimento_comissao"
    | "previsao_pagamento_bonificacao"
  >,
  referenceDate: Date = new Date(),
) => {
  const dates = [
    getContractFidelityEndDate(contract.data_renovacao),
    getContractNextAdjustmentDate(contract.mes_reajuste, referenceDate),
    parseContractManagerDate(contract.previsao_recebimento_comissao),
    parseContractManagerDate(contract.previsao_pagamento_bonificacao),
  ];

  return dates.some((date) => {
    const remaining = getDaysUntilContractDate(date, referenceDate);
    return remaining !== null && remaining >= 0 && remaining <= 30;
  });
};

export const getContractBadgeTone = (days: number) => {
  if (days < 0) {
    return "bg-slate-100 text-slate-600";
  }

  if (days <= 7) {
    return "bg-red-100 text-red-700";
  }

  if (days <= 15) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
};

export const formatContractManagerDate = (
  date?: string | null,
  type: ContractDateDisplayType = "default",
  referenceDate: Date = new Date(),
) => {
  const parsed =
    type === "monthYear"
      ? getContractFidelityEndDate(date)
      : type === "monthOnly"
        ? getContractNextAdjustmentDate(
            date ? Number(date) : null,
            referenceDate,
          )
        : parseContractManagerDate(date);

  return parsed ? parsed.toLocaleDateString("pt-BR") : null;
};

export const getContractDisplayName = (
  contract: Pick<Contract, "id" | "modalidade">,
  holdersByContractId: Record<string, ContractHolder[]>,
) => {
  const contractHolders = holdersByContractId[contract.id] || [];
  if (contractHolders.length === 0) {
    return "Sem titular";
  }

  const primaryHolder = contractHolders[0];
  if (contract.modalidade === "MEI" || contract.modalidade === "CNPJ") {
    return (
      primaryHolder.nome_fantasia ||
      primaryHolder.razao_social ||
      primaryHolder.nome_completo
    );
  }

  const additionalCount = contractHolders.length - 1;
  return additionalCount > 0
    ? `${primaryHolder.nome_completo} (+${additionalCount})`
    : primaryHolder.nome_completo;
};
