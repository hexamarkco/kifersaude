import type { Contract, ContractCommissionInstallment } from "./supabase";

export const normalizeCommissionInstallments = (
  installments: Contract["comissao_parcelas"],
): ContractCommissionInstallment[] => {
  if (!Array.isArray(installments)) return [];

  return installments.reduce<ContractCommissionInstallment[]>(
    (normalizedInstallments, item) => {
      const percentual =
        typeof item?.percentual === "number" && Number.isFinite(item.percentual)
          ? item.percentual
          : undefined;
      const valor =
        typeof item?.valor === "number" && Number.isFinite(item.valor)
          ? item.valor
          : undefined;

      if ((percentual ?? 0) <= 0 && (valor ?? 0) <= 0) {
        return normalizedInstallments;
      }

      const normalizedInstallment: ContractCommissionInstallment = {
        data_pagamento: item?.data_pagamento ?? null,
      };

      if (percentual !== undefined) {
        normalizedInstallment.percentual = percentual;
      }

      if (valor !== undefined) {
        normalizedInstallment.valor = valor;
      }

      normalizedInstallments.push(normalizedInstallment);
      return normalizedInstallments;
    },
    [],
  );
};

export const getCommissionInstallmentSummary = (
  contract: Pick<
    Contract,
    "comissao_prevista" | "comissao_parcelas" | "mensalidade_total"
  >,
) => {
  const installments = normalizeCommissionInstallments(
    contract.comissao_parcelas,
  );
  const totalCommission = contract.comissao_prevista || 0;
  const totalByValue = installments.reduce(
    (sum, item) => sum + (item.valor || 0),
    0,
  );
  const totalPercent = installments.reduce(
    (sum, item) => sum + (item.percentual || 0),
    0,
  );
  const usesValueMode = installments.some((item) => (item.valor || 0) > 0);

  const resolvedInstallments = installments.map((item) => {
    const resolvedValue = usesValueMode
      ? item.valor || 0
      : totalPercent > 0
        ? (totalCommission * (item.percentual || 0)) / totalPercent
        : 0;

    return {
      ...item,
      resolvedValue,
    };
  });

  return {
    installments: resolvedInstallments,
    usesValueMode,
    totalByValue,
    totalPercent,
    totalResolvedValue: resolvedInstallments.reduce(
      (sum, item) => sum + item.resolvedValue,
      0,
    ),
  };
};
