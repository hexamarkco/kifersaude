export type InputAutoFormat =
  | 'cep'
  | 'cns'
  | 'cpf'
  | 'cnpj'
  | 'currency'
  | 'phone';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatBrazilPhone = (digits: string) => {
  if (!digits) return '';

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const formatPhoneInput = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return '';

  if (digits.startsWith('55') && digits.length > 11) {
    return `+55 ${formatBrazilPhone(digits.slice(2, 13))}`.trim();
  }

  return formatBrazilPhone(digits.slice(0, 11));
};

export const formatCpf = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export const formatCep = (value: string) => {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

export const formatCns = (value: string) => {
  const digits = onlyDigits(value).slice(0, 15);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)} ${digits.slice(11)}`;
};

export const formatCurrencyInput = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return '';

  const cents = digits.padStart(3, '0');
  const integerPart = cents.slice(0, -2);
  const decimalPart = cents.slice(-2);
  const formattedInteger = Number(integerPart).toLocaleString('pt-BR');

  return `${formattedInteger},${decimalPart}`;
};

export const formatCurrencyFromNumber = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatCurrencyInput(String(Math.round(value * 100)));
};

export const formatInputValue = (value: string, autoFormat?: InputAutoFormat) => {
  if (!autoFormat) return value;

  switch (autoFormat) {
    case 'phone':
      return formatPhoneInput(value);
    case 'cpf':
      return formatCpf(value);
    case 'cnpj':
      return formatCnpj(value);
    case 'cep':
      return formatCep(value);
    case 'cns':
      return formatCns(value);
    case 'currency':
      return formatCurrencyInput(value);
    default:
      return value;
  }
};

export const parseFormattedNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
