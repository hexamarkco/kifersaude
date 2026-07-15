export const PUBLIC_LEAD_AGE_RANGES = [
  '00-18',
  '19-23',
  '24-28',
  '29-33',
  '34-38',
  '39-43',
  '44-48',
  '49-53',
  '54-58',
  '59+',
] as const;

export const PUBLIC_LEAD_CONTRACT_TYPES = ['PF', 'MEI', 'CNPJ'] as const;

type PublicLeadAgeRange = (typeof PUBLIC_LEAD_AGE_RANGES)[number];
type PublicLeadContractType = (typeof PUBLIC_LEAD_CONTRACT_TYPES)[number];

type SingleAgeSummary = {
  type: 'single';
  age: number;
};

type RangeAgeSummary = {
  type: 'ranges';
  counts: Record<PublicLeadAgeRange, number>;
};

export type ValidatedPublicLeadPayload = {
  name: string;
  phone: string;
  city: string;
  contractType: PublicLeadContractType;
  totalLives: number;
  ageSummary: SingleAgeSummary | RangeAgeSummary;
  honeypotFilled: boolean;
};

const PAYLOAD_KEYS = ['name', 'phone', 'city', 'contractType', 'totalLives', 'ageSummary', 'website'] as const;
const HUMAN_TEXT_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]*$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

const normalizeHumanText = (value: unknown, minLength: number, maxLength: number): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length < minLength || normalized.length > maxLength || !HUMAN_TEXT_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
};

const isIntegerInRange = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;

const parseAgeSummary = (value: unknown, totalLives: number): SingleAgeSummary | RangeAgeSummary | null => {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  if (value.type === 'single') {
    if (totalLives !== 1 || !hasExactKeys(value, ['type', 'age']) || !isIntegerInRange(value.age, 0, 120)) {
      return null;
    }

    return { type: 'single', age: value.age };
  }

  if (value.type !== 'ranges' || totalLives === 1 || !hasExactKeys(value, ['type', 'counts']) || !isRecord(value.counts)) {
    return null;
  }

  if (!hasExactKeys(value.counts, PUBLIC_LEAD_AGE_RANGES)) {
    return null;
  }

  const counts = {} as Record<PublicLeadAgeRange, number>;
  let countTotal = 0;

  for (const range of PUBLIC_LEAD_AGE_RANGES) {
    const count = value.counts[range];
    if (!isIntegerInRange(count, 0, 99)) {
      return null;
    }

    counts[range] = count;
    countTotal += count;
  }

  return countTotal === totalLives ? { type: 'ranges', counts } : null;
};

export const validatePublicLeadPayload = (value: unknown): ValidatedPublicLeadPayload | null => {
  if (!isRecord(value) || !hasExactKeys(value, PAYLOAD_KEYS)) {
    return null;
  }

  const name = normalizeHumanText(value.name, 3, 120);
  const city = normalizeHumanText(value.city, 2, 100);
  const phone = typeof value.phone === 'string' && /^\d{10,11}$/.test(value.phone) ? value.phone : null;
  const contractType = PUBLIC_LEAD_CONTRACT_TYPES.includes(value.contractType as PublicLeadContractType)
    ? (value.contractType as PublicLeadContractType)
    : null;
  const totalLives = isIntegerInRange(value.totalLives, 1, 99) ? value.totalLives : null;
  const website = typeof value.website === 'string' && value.website.length <= 200 ? value.website : null;

  if (!name || !city || !phone || !contractType || !totalLives || website === null) {
    return null;
  }

  const ageSummary = parseAgeSummary(value.ageSummary, totalLives);
  if (!ageSummary) {
    return null;
  }

  return {
    name,
    phone,
    city,
    contractType,
    totalLives,
    ageSummary,
    honeypotFilled: website.trim().length > 0,
  };
};

export const formatPublicLeadAgeSummary = (summary: ValidatedPublicLeadPayload['ageSummary']): string => {
  if (summary.type === 'single') {
    return `1 vida - idade: ${summary.age}`;
  }

  return PUBLIC_LEAD_AGE_RANGES
    .filter((range) => summary.counts[range] > 0)
    .map((range) => `${range.replace('-', ' - ')}: ${summary.counts[range]}`)
    .join(', ');
};
