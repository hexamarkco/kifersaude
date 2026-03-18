import type { Contract } from "../../../lib/supabase";
import type {
  ContractDateDisplayType,
  ContractHolder,
  ContractManagerHighlightBadge,
} from "./contractsManagerTypes";

const CLOSED_CONTRACT_STATUSES = new Set(["Cancelado", "Encerrado"]);
const CONTRACT_AGE_ADJUSTMENT_MILESTONES = [19, 24, 29, 34, 39, 44, 49, 54, 59];

type ContractParticipantWithBirthDate = {
  data_nascimento?: string | null;
};

const normalizeContractReferenceDate = (referenceDate: Date = new Date()) => {
  const normalized = new Date(referenceDate);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getContractMonthKey = (date: Date) =>
  date.getFullYear() * 12 + date.getMonth();

const formatRelativeContractBadgeLabel = (
  label: string,
  days: number,
  formattedDate: string,
) => {
  if (days === 0) {
    return `${label} hoje (${formattedDate})`;
  }

  if (days > 0) {
    return `${label} em ${days} dia${days === 1 ? "" : "s"} (${formattedDate})`;
  }

  const elapsedDays = Math.abs(days);
  return `${label} há ${elapsedDays} dia${elapsedDays === 1 ? "" : "s"} (${formattedDate})`;
};

const getRelativeContractBadgeTone = (
  days: number,
): ContractManagerHighlightBadge["tone"] => {
  if (days < 0) {
    return "warning";
  }

  if (days <= 7) {
    return "danger";
  }

  if (days <= 15) {
    return "warning";
  }

  return "success";
};

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

export const getContractMonthDisplayDate = (monthNumber?: number | null) => {
  if (!monthNumber) {
    return null;
  }

  const monthDate = new Date(2000, monthNumber - 1, 1);
  monthDate.setHours(0, 0, 0, 0);
  return monthDate;
};

export const formatContractMonthLabel = (
  date?: Date | null,
  includeYear = false,
) => {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
};

export const getContractStartReferenceDate = (
  startDate?: string | null,
  fallbackDate?: string | null,
) => {
  const parsed =
    parseContractManagerDate(startDate) ?? parseContractManagerDate(fallbackDate);

  if (!parsed) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const getContractNextAdjustmentDate = (
  monthNumber?: number | null,
  referenceDate: Date = new Date(),
) => {
  if (!monthNumber) {
    return null;
  }

  const today = normalizeContractReferenceDate(referenceDate);
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();
  const adjustmentMonthIndex = monthNumber - 1;
  const targetYear =
    adjustmentMonthIndex < currentMonthIndex ? currentYear + 1 : currentYear;
  const nextDate = new Date(targetYear, adjustmentMonthIndex, 1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

export const getContractNextAnnualAdjustmentDate = (
  monthNumber?: number | null,
  contractStartDate?: string | null,
  fallbackStartDate?: string | null,
  referenceDate: Date = new Date(),
) => {
  if (!monthNumber) {
    return null;
  }

  const normalizedReference = normalizeContractReferenceDate(referenceDate);
  const startReference = getContractStartReferenceDate(
    contractStartDate,
    fallbackStartDate,
  );
  const adjustmentMonthIndex = monthNumber - 1;

  let targetYear = normalizedReference.getFullYear();
  if (adjustmentMonthIndex < normalizedReference.getMonth()) {
    targetYear += 1;
  }

  let nextDate = new Date(targetYear, adjustmentMonthIndex, 1);
  nextDate.setHours(0, 0, 0, 0);

  const startMonthKey = startReference ? getContractMonthKey(startReference) : null;

  while (startMonthKey !== null && getContractMonthKey(nextDate) <= startMonthKey) {
    nextDate = new Date(nextDate.getFullYear() + 1, adjustmentMonthIndex, 1);
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

  const today = normalizeContractReferenceDate(referenceDate);
  const diff = date.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

export const getContractMonthsUntilDate = (
  date?: Date | null,
  referenceDate: Date = new Date(),
) => {
  if (!date) {
    return null;
  }

  const normalizedReference = normalizeContractReferenceDate(referenceDate);
  return getContractMonthKey(date) - getContractMonthKey(normalizedReference);
};

export const getCompletedAnnualAdjustmentCount = (
  contract: Pick<Contract, "mes_reajuste" | "data_inicio" | "created_at">,
  referenceDate: Date = new Date(),
) => {
  if (!contract.mes_reajuste) {
    return 0;
  }

  const normalizedReference = normalizeContractReferenceDate(referenceDate);
  const startReference = getContractStartReferenceDate(
    contract.data_inicio,
    contract.created_at,
  );

  if (!startReference) {
    return 0;
  }

  const adjustmentMonthIndex = contract.mes_reajuste - 1;
  let firstEligibleYear = startReference.getFullYear();

  if (adjustmentMonthIndex <= startReference.getMonth()) {
    firstEligibleYear += 1;
  }

  const firstEligibleAdjustment = new Date(firstEligibleYear, adjustmentMonthIndex, 1);
  firstEligibleAdjustment.setHours(0, 0, 0, 0);

  const elapsedMonths =
    getContractMonthKey(normalizedReference) -
    getContractMonthKey(firstEligibleAdjustment);

  if (elapsedMonths < 0) {
    return 0;
  }

  return Math.floor(elapsedMonths / 12) + 1;
};

export const getCompletedAgeAdjustmentCount = (
  participants: ContractParticipantWithBirthDate[],
  contractStartDate?: string | null,
  fallbackStartDate?: string | null,
  referenceDate: Date = new Date(),
) => {
  const normalizedReference = normalizeContractReferenceDate(referenceDate);
  const startReference = getContractStartReferenceDate(
    contractStartDate,
    fallbackStartDate,
  );

  if (!startReference || participants.length === 0) {
    return 0;
  }

  return participants.reduce((total, participant) => {
    const birthDate = parseContractManagerDate(participant.data_nascimento);
    if (!birthDate) {
      return total;
    }

    birthDate.setHours(0, 0, 0, 0);

    const participantMilestones = CONTRACT_AGE_ADJUSTMENT_MILESTONES.reduce(
      (milestoneCount, age) => {
        const milestoneDate = new Date(birthDate);
        milestoneDate.setFullYear(birthDate.getFullYear() + age);
        milestoneDate.setHours(0, 0, 0, 0);

        return milestoneDate.getTime() > startReference.getTime() &&
          milestoneDate.getTime() <= normalizedReference.getTime()
          ? milestoneCount + 1
          : milestoneCount;
      },
      0,
    );

    return total + participantMilestones;
  }, 0);
};

export const hasUpcomingImportantContractDate = (
  contract: Pick<
    Contract,
    | "data_inicio"
    | "created_at"
    | "data_renovacao"
    | "mes_reajuste"
    | "previsao_recebimento_comissao"
    | "previsao_pagamento_bonificacao"
  >,
  referenceDate: Date = new Date(),
) => {
  const dates = [
    getContractStartReferenceDate(contract.data_inicio, contract.created_at),
    getContractFidelityEndDate(contract.data_renovacao),
    parseContractManagerDate(contract.previsao_recebimento_comissao),
    parseContractManagerDate(contract.previsao_pagamento_bonificacao),
  ];

  const hasNearbyDate = dates.some((date) => {
    const remaining = getDaysUntilContractDate(date, referenceDate);
    return remaining !== null && remaining >= 0 && remaining <= 30;
  });

  const adjustmentMonthsUntil = getContractMonthsUntilDate(
    getContractNextAnnualAdjustmentDate(
      contract.mes_reajuste,
      contract.data_inicio,
      contract.created_at,
      referenceDate,
    ),
    referenceDate,
  );

  return (
    hasNearbyDate ||
    (adjustmentMonthsUntil !== null && adjustmentMonthsUntil >= 0 && adjustmentMonthsUntil <= 1)
  );
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
  _referenceDate: Date = new Date(),
) => {
  const parsed =
    type === "monthYear"
      ? getContractFidelityEndDate(date)
      : type === "monthOnly"
        ? getContractMonthDisplayDate(date ? Number(date) : null)
        : parseContractManagerDate(date);

  if (!parsed) {
    return null;
  }

  if (type === "monthOnly") {
    return formatContractMonthLabel(parsed);
  }

  return parsed.toLocaleDateString("pt-BR");
};

export const getContractManagerHighlightBadges = (
  contract: Pick<
    Contract,
    | "status"
    | "data_inicio"
    | "created_at"
    | "data_renovacao"
    | "mes_reajuste"
    | "previsao_recebimento_comissao"
    | "previsao_pagamento_bonificacao"
    | "comissao_prevista"
    | "bonus_por_vida_configuracoes"
    | "bonus_por_vida_valor"
  >,
  participants: ContractParticipantWithBirthDate[] = [],
  referenceDate: Date = new Date(),
) => {
  if (CLOSED_CONTRACT_STATUSES.has(contract.status)) {
    return [];
  }

  const normalizedReference = normalizeContractReferenceDate(referenceDate);
  const badges: ContractManagerHighlightBadge[] = [];
  const startReference = getContractStartReferenceDate(
    contract.data_inicio,
    contract.created_at,
  );
  const startDays = getDaysUntilContractDate(startReference, normalizedReference);
  const isPreActivation = startDays !== null && startDays > 0;

  if (startReference && startDays !== null && startDays > 0 && startDays <= 90) {
    badges.push({
      key: "activation",
      label: formatRelativeContractBadgeLabel(
        "Ativa",
        startDays,
        startReference.toLocaleDateString("pt-BR"),
      ),
      tone: getRelativeContractBadgeTone(startDays),
      sortOrder: 0,
    });
  }

  const fidelityDate = getContractFidelityEndDate(contract.data_renovacao);
  const fidelityDays = getDaysUntilContractDate(fidelityDate, normalizedReference);
  const hasEndedFidelity = Boolean(
    fidelityDate && fidelityDays !== null && fidelityDays < 0,
  );

  if (fidelityDate && fidelityDays !== null) {
    if (hasEndedFidelity) {
      badges.push({
        key: "fidelity-ended",
        label: `Fidelidade encerrada (${fidelityDate.toLocaleDateString("pt-BR")})`,
        tone: "neutral",
        sortOrder: 5,
      });
    } else if (!isPreActivation && fidelityDays <= 180) {
      badges.push({
        key: "fidelity-upcoming",
        label: formatRelativeContractBadgeLabel(
          "Fidelidade acaba",
          fidelityDays,
          fidelityDate.toLocaleDateString("pt-BR"),
        ),
        tone: getRelativeContractBadgeTone(fidelityDays),
        sortOrder: Math.max(fidelityDays, 1),
      });
    }
  }

  if (hasEndedFidelity) {
    const annualAdjustmentCount = getCompletedAnnualAdjustmentCount(
      contract,
      normalizedReference,
    );
    if (annualAdjustmentCount > 0) {
      badges.push({
        key: "annual-adjustment-count",
        label:
          annualAdjustmentCount === 1
            ? "1 reajuste anual"
            : `${annualAdjustmentCount} reajustes anuais`,
        tone: "warning",
        sortOrder: 6,
      });
    }

    const ageAdjustmentCount = getCompletedAgeAdjustmentCount(
      participants,
      contract.data_inicio,
      contract.created_at,
      normalizedReference,
    );
    if (ageAdjustmentCount > 0) {
      badges.push({
        key: "age-adjustment-count",
        label:
          ageAdjustmentCount === 1
            ? "1 reajuste por idade"
            : `${ageAdjustmentCount} reajustes por idade`,
        tone: "success",
        sortOrder: 7,
      });
    }
  } else if (!isPreActivation) {
    const nextAdjustmentDate = getContractNextAnnualAdjustmentDate(
      contract.mes_reajuste,
      contract.data_inicio,
      contract.created_at,
      normalizedReference,
    );
    const adjustmentMonthsUntil = getContractMonthsUntilDate(
      nextAdjustmentDate,
      normalizedReference,
    );

    if (nextAdjustmentDate && adjustmentMonthsUntil !== null && adjustmentMonthsUntil <= 2) {
      const formattedMonth = formatContractMonthLabel(
        nextAdjustmentDate,
        nextAdjustmentDate.getFullYear() !== normalizedReference.getFullYear(),
      );

      if (formattedMonth) {
        badges.push({
          key: "adjustment",
          label:
            adjustmentMonthsUntil === 0
              ? `Reajuste anual neste mês (${formattedMonth})`
              : adjustmentMonthsUntil === 1
                ? `Reajuste anual no próximo mês (${formattedMonth})`
                : `Reajuste anual em ${formattedMonth}`,
          tone: adjustmentMonthsUntil <= 1 ? "warning" : "success",
          sortOrder: 15 + adjustmentMonthsUntil,
        });
      }
    }
  }

  const commissionDate = parseContractManagerDate(
    contract.previsao_recebimento_comissao,
  );
  const commissionDays = getDaysUntilContractDate(
    commissionDate,
    normalizedReference,
  );

  if (
    commissionDate &&
    commissionDays !== null &&
    (contract.comissao_prevista ?? 0) > 0 &&
    commissionDays >= 0 &&
    commissionDays <= 60
  ) {
    badges.push({
      key: "commission",
      label: formatRelativeContractBadgeLabel(
        "Recebe comissão",
        commissionDays,
        commissionDate.toLocaleDateString("pt-BR"),
      ),
      tone: getRelativeContractBadgeTone(commissionDays),
      sortOrder: Math.abs(commissionDays) + 1,
    });
  }

  const bonusDate = parseContractManagerDate(
    contract.previsao_pagamento_bonificacao,
  );
  const bonusDays = getDaysUntilContractDate(bonusDate, normalizedReference);
  const hasBonusValue =
    (contract.bonus_por_vida_valor ?? 0) > 0 ||
    (contract.bonus_por_vida_configuracoes?.length ?? 0) > 0;

  if (
    bonusDate &&
    bonusDays !== null &&
    hasBonusValue &&
    bonusDays >= 0 &&
    bonusDays <= 60
  ) {
    badges.push({
      key: "bonus",
      label: formatRelativeContractBadgeLabel(
        "Paga bônus",
        bonusDays,
        bonusDate.toLocaleDateString("pt-BR"),
      ),
      tone: getRelativeContractBadgeTone(bonusDays),
      sortOrder: Math.abs(bonusDays) + 2,
    });
  }

  return badges.sort((left, right) => left.sortOrder - right.sortOrder).slice(0, 4);
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
