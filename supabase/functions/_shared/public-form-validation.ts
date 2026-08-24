export const PUBLIC_FORM_GEO_PERMISSIONS = ['granted', 'denied', 'unavailable', 'not_requested'] as const;
export type PublicFormGeoPermission = (typeof PUBLIC_FORM_GEO_PERMISSIONS)[number];

export type PublicFormStepDefinition = {
  id: string;
  step_type: 'single_choice' | 'multi_choice' | 'short_text' | 'contact';
  is_required: boolean;
  options: Array<{ id: string; label: string }>;
};

export type ValidatedPublicFormAnswer = string | string[];

export type ValidatedPublicFormSubmission = {
  answers: Record<string, ValidatedPublicFormAnswer>;
  contact: {
    name: string;
    phone: string;
    email: string | null;
  };
  geo: {
    permission: PublicFormGeoPermission;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  };
  honeypotFilled: boolean;
};

const PAYLOAD_KEYS = ['formSlug', 'answers', 'contact', 'geo', 'website'] as const;
const CONTACT_KEYS = ['name', 'phone', 'email'] as const;
const GEO_KEYS = ['permission', 'latitude', 'longitude', 'accuracyMeters'] as const;
const HUMAN_TEXT_PATTERN = /^[\p{L}][\p{L}\p{M} .'-]*$/u;
const SHORT_TEXT_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .,'\-/º°]*$/u;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

const normalizeHumanText = (value: unknown, minLength: number, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length < minLength || normalized.length > maxLength || !HUMAN_TEXT_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const normalizeShortText = (value: unknown, minLength: number, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length < minLength || normalized.length > maxLength || !SHORT_TEXT_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const normalizeEmail = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return null;
  if (normalized.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return undefined;
  return normalized;
};

const isFiniteNumberInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export const isValidFormSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 2 && value.length <= 80 && SLUG_PATTERN.test(value);

export const extractFormSlug = (value: unknown): string | null => {
  if (!isRecord(value)) return null;
  return isValidFormSlug(value.formSlug) ? value.formSlug : null;
};

const validateGeo = (value: unknown): ValidatedPublicFormSubmission['geo'] | null => {
  if (!isRecord(value) || !hasExactKeys(value, GEO_KEYS)) return null;

  const permission = PUBLIC_FORM_GEO_PERMISSIONS.includes(value.permission as PublicFormGeoPermission)
    ? (value.permission as PublicFormGeoPermission)
    : null;
  if (!permission) return null;

  if (permission !== 'granted') {
    if (value.latitude !== null || value.longitude !== null || value.accuracyMeters !== null) return null;
    return { permission, latitude: null, longitude: null, accuracyMeters: null };
  }

  if (!isFiniteNumberInRange(value.latitude, -90, 90) || !isFiniteNumberInRange(value.longitude, -180, 180)) {
    return null;
  }
  const accuracyMeters =
    value.accuracyMeters === null ? null : isFiniteNumberInRange(value.accuracyMeters, 0, 200_000) ? value.accuracyMeters : undefined;
  if (accuracyMeters === undefined) return null;

  return { permission, latitude: value.latitude, longitude: value.longitude, accuracyMeters };
};

const validateContact = (value: unknown): ValidatedPublicFormSubmission['contact'] | null => {
  if (!isRecord(value) || !hasExactKeys(value, CONTACT_KEYS)) return null;

  const name = normalizeHumanText(value.name, 3, 120);
  const phone = typeof value.phone === 'string' && /^\d{10,11}$/.test(value.phone) ? value.phone : null;
  const email = normalizeEmail(value.email);

  if (!name || !phone || email === undefined) return null;

  return { name, phone, email };
};

const validateAnswerForStep = (
  step: PublicFormStepDefinition,
  rawAnswer: unknown,
): ValidatedPublicFormAnswer | null | undefined => {
  const isEmpty = rawAnswer === undefined || rawAnswer === null;

  if (step.step_type === 'single_choice') {
    if (isEmpty) return step.is_required ? undefined : null;
    if (typeof rawAnswer !== 'string') return undefined;
    return step.options.some((option) => option.id === rawAnswer) ? rawAnswer : undefined;
  }

  if (step.step_type === 'multi_choice') {
    if (isEmpty) return step.is_required ? undefined : null;
    if (!Array.isArray(rawAnswer) || rawAnswer.length === 0 || rawAnswer.length > step.options.length) {
      return undefined;
    }
    const optionIds = new Set(step.options.map((option) => option.id));
    const unique = new Set(rawAnswer);
    if (unique.size !== rawAnswer.length) return undefined;
    for (const entry of rawAnswer) {
      if (typeof entry !== 'string' || !optionIds.has(entry)) return undefined;
    }
    return rawAnswer as string[];
  }

  // short_text
  if (isEmpty) return step.is_required ? undefined : null;
  return normalizeShortText(rawAnswer, 1, 300) ?? undefined;
};

export const validatePublicFormSubmission = (
  value: unknown,
  steps: PublicFormStepDefinition[],
): ValidatedPublicFormSubmission | null => {
  if (!isRecord(value) || !hasExactKeys(value, PAYLOAD_KEYS)) return null;
  if (!isValidFormSlug(value.formSlug)) return null;

  const website = typeof value.website === 'string' && value.website.length <= 200 ? value.website : null;
  if (website === null) return null;

  const contact = validateContact(value.contact);
  if (!contact) return null;

  const geo = validateGeo(value.geo);
  if (!geo) return null;

  if (!isRecord(value.answers)) return null;
  const answerableSteps = steps.filter((step) => step.step_type !== 'contact');
  if (Object.keys(value.answers).length > answerableSteps.length) return null;

  const answers: Record<string, ValidatedPublicFormAnswer> = {};
  for (const step of answerableSteps) {
    const validated = validateAnswerForStep(step, value.answers[step.id]);
    if (validated === undefined) return null;
    if (validated !== null) {
      answers[step.id] = validated;
    }
  }

  return {
    answers,
    contact,
    geo,
    honeypotFilled: website.trim().length > 0,
  };
};
