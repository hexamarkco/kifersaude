import type { Contract, ContractBonusConfiguration } from './supabase';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const normalizeBonusConfigurations = (
  value: Contract['bonus_por_vida_configuracoes']
): ContractBonusConfiguration[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry, index) => {
      const quantidade = Number(entry?.quantidade);
      const valor = Number(entry?.valor);

      if (!Number.isFinite(quantidade) || !Number.isFinite(valor)) {
        return null;
      }

      return {
        id: typeof entry?.id === 'string' && entry.id.trim() ? entry.id : `bonus-${index + 1}`,
        quantidade: Math.max(0, Math.trunc(quantidade)),
        valor: Math.max(0, valor),
      };
    })
    .filter((entry): entry is ContractBonusConfiguration => Boolean(entry && entry.quantidade > 0 && isFiniteNumber(entry.valor)));
};

export const getBonusConfigLives = (configurations: Contract['bonus_por_vida_configuracoes']) =>
  normalizeBonusConfigurations(configurations).reduce((total, item) => total + item.quantidade, 0);

export const getBonusConfigTotal = (configurations: Contract['bonus_por_vida_configuracoes']) =>
  normalizeBonusConfigurations(configurations).reduce((total, item) => total + (item.quantidade * item.valor), 0);

export const getContractBonusSummary = (
  contract: Pick<
    Contract,
    'bonus_por_vida_aplicado' | 'bonus_por_vida_configuracoes' | 'bonus_por_vida_valor' | 'vidas' | 'vidas_elegiveis_bonus'
  >,
  fallbackEligibleLives?: number
) => {
  const configurations = normalizeBonusConfigurations(contract.bonus_por_vida_configuracoes);
  const hasConfigurations = configurations.length > 0;
  const configLives = hasConfigurations
    ? configurations.reduce((total, item) => total + item.quantidade, 0)
    : 0;
  const eligibleLives = hasConfigurations
    ? configLives
    : contract.vidas_elegiveis_bonus ?? fallbackEligibleLives ?? contract.vidas ?? 1;
  const total = hasConfigurations
    ? configurations.reduce((sum, item) => sum + (item.quantidade * item.valor), 0)
    : contract.bonus_por_vida_valor
      ? (contract.bonus_por_vida_aplicado ? contract.bonus_por_vida_valor * eligibleLives : contract.bonus_por_vida_valor)
      : 0;

  return {
    configurations,
    hasConfigurations,
    eligibleLives,
    total,
    legacyValue: contract.bonus_por_vida_valor ?? null,
  };
};
