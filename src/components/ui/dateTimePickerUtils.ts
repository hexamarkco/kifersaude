const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export const normalizeYearInput = (value: string) => value.replace(/\D/g, '').slice(0, 4);

export const getDateTimePickerYearBounds = (minDate: Date | null, maxDate: Date | null) => {
  const minYear = Math.max(YEAR_MIN, minDate?.getFullYear() ?? YEAR_MIN);
  const maxYear = Math.max(minYear, Math.min(YEAR_MAX, maxDate?.getFullYear() ?? YEAR_MAX));

  return {
    min: minYear,
    max: maxYear,
  };
};

export const parseCommittedYearInput = (value: string, minYear = YEAR_MIN, maxYear = YEAR_MAX) => {
  const digits = normalizeYearInput(value);
  if (digits.length !== 4) return null;

  return clampNumber(Number(digits), minYear, Math.max(minYear, maxYear));
};
