import { canonicalCity, capitalState, locationKey } from './location.ts';
/** Persistent commercial facts. No model output is trusted without runtime validation. */
export const INTENTS = ['first_plan', 'replace_operator', 'reduce_cost', 'expand_network', 'upgrade', 'downgrade',
  'pf_to_mei', 'add_dependents', 'portability', 'defined_choice', 'guided_choice'] as const;
export type Intent = typeof INTENTS[number];
export type Beneficiary = { id: string; label: string; age: number | null };
export type Values = {
  intent: Intent;
  goal: string;
  beneficiaryCount: number;
  beneficiaries: Beneficiary[];
  city: string;
  neighborhood: string;
  state: string;
  companyPresence: 'yes' | 'no';
  companyType: 'mei' | 'cnpj';
  companyNumber: string;
  companyOpenedAt: string;
  hasCurrentPlan: 'yes' | 'no';
  currentOperator: string;
  cancelledPreviousPlan: 'yes' | 'no';
  previousOperator: string;
  cancellationReason: string;
  currentModality: 'pf' | 'company' | 'collective';
  targetModality: 'pf' | 'mei' | 'company' | 'collective';
  preferences: string[];
};
export type Field = keyof Values;
export type Evidence = { messageId: string; quote: string; at: string; source: 'conversation' | 'crm' | 'legacy' };
export type Fact = {
  value: Values[Field] | null;
  status: 'confirmed' | 'uncertain' | 'unknown' | 'declined' | 'conflict';
  evidence: Evidence[];
  updatedAt: string;
  conflictingValue?: Values[Field] | null;
  derivedFrom?: 'city';
};
export type V2Message = { id: string; role: 'lead' | 'ai'; content: string; messageAt: string; receivedAt?: string };
export type Observation = { field: Field; value: Values[Field] | null; status: Exclude<Fact['status'], 'conflict'>;
  messageId: string; quote: string; correction: boolean; removedBeneficiaryIds?: string[] };
export type Interpretation = {
  observations: Observation[];
  humanRequested: boolean;
  quoteDeclined: boolean;
  irritated: boolean;
  question: { text: string; topic: 'general' | 'waiting_period' | 'eligibility' | 'price' | 'network' } | null;
  suggestedField: Field | null;
  signals: { messageId: string; quote: string }[];
};
export type V2State = {
  version: 2;
  policyVersion: '2026-11-15.2';
  facts: Partial<Record<Field, Fact>>;
  cursor: { id: string; receivedAt: string } | null;
  lastQuestion: Field | null;
  asked: Partial<Record<Field, number>>;
  historyPartial: boolean;
};
export const FIELDS: Field[] = ['intent', 'goal', 'beneficiaryCount', 'beneficiaries', 'city', 'neighborhood', 'state', 'companyPresence',
  'companyType', 'companyNumber', 'companyOpenedAt', 'hasCurrentPlan', 'currentOperator', 'cancelledPreviousPlan', 'previousOperator',
  'cancellationReason', 'currentModality', 'targetModality', 'preferences'];
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 240;
const STATES = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function validValue(field: Field, value: unknown): boolean {
  if (field === 'intent') return INTENTS.includes(value as Intent);
  if (field === 'state') return typeof value === 'string' && STATES.has(value);
  if (field === 'beneficiaryCount') return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100;
  if (field === 'beneficiaries') return Array.isArray(value) && value.length > 0 && value.length <= 100
    && value.every((life) => isRecord(life) && text(life.id) && text(life.label)
      && (life.age === null || (Number.isInteger(life.age) && Number(life.age) >= 0 && Number(life.age) <= 120)))
    && new Set(value.map((life) => life.id)).size === value.length;
  if (field === 'preferences') return Array.isArray(value) && value.length <= 20 && value.every(text);
  if (field === 'companyPresence' || field === 'hasCurrentPlan' || field === 'cancelledPreviousPlan') return value === 'yes' || value === 'no';
  if (field === 'companyType') return value === 'mei' || value === 'cnpj';
  if (field === 'companyNumber') return text(value) && value.length <= 40;
  if (field === 'currentModality') return ['pf', 'company', 'collective'].includes(String(value));
  if (field === 'targetModality') return ['pf', 'mei', 'company', 'collective'].includes(String(value));
  return text(value);
}
export const initialState = (): V2State => ({ version: 2, policyVersion: '2026-11-15.2', facts: {}, cursor: null,
  lastQuestion: null, asked: {}, historyPartial: true });

export const confirmed = <K extends Field>(state: V2State, field: K): Values[K] | null => {
  const fact = state.facts[field];
  return fact?.status === 'confirmed' && validValue(field, fact.value) ? fact.value as Values[K] : null;
};

const IMPLIED_ANSWERS = [['companyType', 'companyPresence'], ['currentOperator', 'hasCurrentPlan']] as const;
function repairEmptyConflicts(state: V2State): V2State {
  for (const field of FIELDS) {
    const fact = state.facts[field];
    // Older merges could record unknown -> confirmed as a conflict. There are not two valid answers here.
    if (fact?.status === 'conflict' && !validValue(field, fact.value) && validValue(field, fact.conflictingValue)) {
      const { conflictingValue, ...rest } = fact;
      state.facts[field] = { ...rest, value: conflictingValue!, status: 'confirmed' };
    }
  }
  return state;
}
/**
 * A plural/aggregate placeholder is not another person. Keep all evidence, but
 * discard the placeholder only when exactly the declared number of *identified,
 * aged* people already exists. Never remove an unnamed person just to make the
 * counter fit, and never deduplicate equal ages (twins are separate lives).
 */
function repairAggregateBeneficiaries(state: V2State): V2State {
  const expected = confirmed(state, 'beneficiaryCount');
  const lives = confirmed(state, 'beneficiaries');
  if (!expected || !lives || lives.length <= expected) return state;
  const isAggregate = (life: Beneficiary): boolean => {
    if (life.age !== null) return false;
    const label = `${life.id} ${life.label}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return /(?:^|[^a-z])(?:familia|family|filhos|filhas|dependentes|beneficiarios|pessoas|membros|grupo|unspecified)(?:$|[^a-z])/.test(label);
  };
  const identified = lives.filter((life) => !isAggregate(life));
  if (identified.length !== expected || identified.some((life) => life.age === null)) return state;
  if (lives.length - identified.length !== lives.filter(isAggregate).length) return state;
  const fact = state.facts.beneficiaries!;
  state.facts.beneficiaries = { ...fact, value: identified };
  return state;
}

function restoreRelatedAnswers(state: V2State): V2State {
  for (const [source, target] of IMPLIED_ANSWERS) {
    const fact = state.facts[source];
    if (!state.facts[target] && confirmed(state, source) && fact?.evidence.some((item) => item.source === 'conversation' && item.quote.trim())) {
      state.facts[target] = { value: 'yes', status: 'confirmed', evidence: structuredClone(fact.evidence), updatedAt: fact.updatedAt };
    }
  }
  return state;
}

/** Validate persisted input too: a malformed snapshot must not restart qualification silently. */
export function readState(value: unknown): V2State | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value) || value.version !== 2 || !['2026-11-14', '2026-11-14.1', '2026-11-14.2', '2026-11-15.1', '2026-11-15.2'].includes(String(value.policyVersion)) || !isRecord(value.facts)
    || !isRecord(value.asked) || typeof value.historyPartial !== 'boolean'
    || (value.lastQuestion !== null && !FIELDS.includes(value.lastQuestion as Field))) throw new Error('Estado V2 inválido.');
  for (const [field, fact] of Object.entries(value.facts)) {
    if (!FIELDS.includes(field as Field) || !isRecord(fact)
      || !['confirmed', 'uncertain', 'unknown', 'declined', 'conflict'].includes(String(fact.status))
      || (fact.value !== null && !validValue(field as Field, fact.value)) || !Array.isArray(fact.evidence)
      || !fact.evidence.every((item) => isRecord(item) && text(item.messageId) && typeof item.quote === 'string'
        && typeof item.at === 'string' && ['conversation', 'crm', 'legacy'].includes(String(item.source)))
      || typeof fact.updatedAt !== 'string') throw new Error('Fato V2 inválido.');
    if (fact.derivedFrom !== undefined && (field !== 'state' || fact.derivedFrom !== 'city')) throw new Error('Origem geográfica inválida.');
  }
  if (value.cursor !== null && (!isRecord(value.cursor) || !text(value.cursor.id)
    || typeof value.cursor.receivedAt !== 'string' || !Number.isFinite(Date.parse(value.cursor.receivedAt)))) throw new Error('Cursor V2 inválido.');
  if (!Object.entries(value.asked).every(([field, count]) => FIELDS.includes(field as Field) && Number.isInteger(count) && Number(count) >= 0)) throw new Error('Perguntas V2 inválidas.');
  return resolveResidence(repairAggregateBeneficiaries(restoreRelatedAnswers(repairEmptyConflicts({ ...structuredClone(value), policyVersion: '2026-11-15.2' } as V2State))));
}

/** A uniquely identified capital supplies its UF with the city's evidence, never a guessed DDD. */
function resolveResidence(state: V2State, correction = false): V2State {
  const city = confirmed(state, 'city');
  if (!city) return state;
  const cityFact = state.facts.city!;
  cityFact.value = canonicalCity(city);
  const uf = capitalState(city);
  if (!uf) return state;
  const old = state.facts.state;
  if (old?.status === 'conflict' && !correction) return state;
  if (old?.status === 'confirmed' && old.value !== uf && old.derivedFrom !== 'city' && !correction) {
    state.facts.state = { ...old, status: 'conflict', conflictingValue: uf };
  } else if (old?.status !== 'confirmed' || old.derivedFrom === 'city' || correction) {
    state.facts.state = { value: uf, status: 'confirmed', derivedFrom: 'city',
      evidence: structuredClone(cityFact.evidence), updatedAt: cityFact.updatedAt };
  }
  return state;
}

export function parseInterpretation(raw: string, messages: readonly V2Message[]): Interpretation {
  const input: unknown = JSON.parse(raw);
  if (!isRecord(input) || !Array.isArray(input.observations) || input.observations.length > 60
    || typeof input.humanRequested !== 'boolean' || typeof input.quoteDeclined !== 'boolean' || typeof input.irritated !== 'boolean'
    || !Array.isArray(input.signals) || (input.suggestedField !== null && !FIELDS.includes(input.suggestedField as Field))) {
    throw new Error('Interpretação V2 inválida.');
  }
  const hasEvidence = (item: unknown) => isRecord(item) && typeof item.messageId === 'string'
    && typeof item.quote === 'string' && item.quote.trim().length > 0 && item.quote.length <= 800
    && messages.some((message) => message.role === 'lead' && message.id === item.messageId && message.content.includes(String(item.quote)));
  for (const item of input.observations) {
    if (!isRecord(item) || !FIELDS.includes(item.field as Field) || !hasEvidence(item)
      || !['confirmed', 'uncertain', 'unknown', 'declined'].includes(String(item.status)) || typeof item.correction !== 'boolean'
      || (item.removedBeneficiaryIds !== undefined && (item.field !== 'beneficiaries' || item.correction !== true
        || !Array.isArray(item.removedBeneficiaryIds) || !item.removedBeneficiaryIds.every(text)))
      || (item.status === 'confirmed' ? !validValue(item.field as Field, item.value)
        : item.value !== null && !validValue(item.field as Field, item.value))) throw new Error('Observação sem valor ou evidência válida.');
  }
  if (!input.signals.every(hasEvidence) || ((input.humanRequested || input.quoteDeclined || input.irritated || input.question !== null) && input.signals.length === 0)) throw new Error('Sinal comercial sem evidência.');
  if (input.question !== null && (!isRecord(input.question) || !text(input.question.text)
    || !['general', 'waiting_period', 'eligibility', 'price', 'network'].includes(String(input.question.topic)))) throw new Error('Dúvida comercial inválida.');
  return input as Interpretation;
}

export function mergeInterpretation(previous: V2State, interpretation: Interpretation, messages: readonly V2Message[], now: string): V2State {
  const state = repairEmptyConflicts(structuredClone(previous));
  state.policyVersion = '2026-11-15.2';
  const observations = [...interpretation.observations];
  // Confirmed ownership/type and a named current plan already answer the broader yes/no question.
  // Derive from interpreted meaning with its literal evidence, never from a keyword in the transcript.
  for (const [source, target] of IMPLIED_ANSWERS) {
    const fact = observations.findLast((item) => item.field === source && item.status === 'confirmed');
    if (fact && !observations.some((item) => item.field === target)) observations.push({ ...fact, field: target, value: 'yes' });
  }
  const formerCity = previous.facts.city?.value;
  const changedResidence = typeof formerCity === 'string' && observations.some((item) => item.field === 'city'
    && item.status === 'confirmed' && item.correction && typeof item.value === 'string'
    && locationKey(canonicalCity(formerCity)) !== locationKey(canonicalCity(item.value)));
  for (const observation of observations) {
    const { field, status } = observation;
    let value = observation.field === 'city' && typeof observation.value === 'string' ? canonicalCity(observation.value) : observation.value;
    const old = state.facts[field];
    const confirmsConflictAnswer = old?.status === 'conflict' && previous.facts[field]?.status === 'conflict'
      && previous.lastQuestion === field && (previous.asked[field] ?? 0) > 0 && status === 'confirmed'
      && [old.value, old.conflictingValue].some((candidate) => validValue(field, candidate) && JSON.stringify(candidate) === JSON.stringify(value));
    const correction = observation.correction || confirmsConflictAnswer || (changedResidence && (field === 'neighborhood' || field === 'state'));
    const message = messages.find((item) => item.id === observation.messageId && item.role === 'lead');
    if (!message || !message.content.includes(observation.quote) || (status === 'confirmed' && !validValue(field, value))) throw new Error('Evidência de atualização inválida.');
    const evidence: Evidence = { messageId: message.id, quote: observation.quote, at: message.messageAt, source: 'conversation' };
    const history = [...(old?.evidence ?? []), evidence].filter((item, index, all) => all.findIndex((other) =>
      other.messageId === item.messageId && other.quote === item.quote) === index).slice(-8);
    // Unknown is not no. A weaker inference cannot erase a confirmed answer or a conflict.
    if (old && ['confirmed', 'conflict'].includes(old.status) && status !== 'confirmed') {
      const partialAges = field === 'beneficiaries' && old.status === 'confirmed' && Array.isArray(old.value)
        && (old.value as Beneficiary[]).some((life) => life.age === null);
      if (partialAges && (status === 'unknown' || status === 'declined')) state.facts[field] = { ...old, status, evidence: history, updatedAt: now };
      continue;
    }
    if (old?.status === 'conflict' && !correction) {
      state.facts[field] = { ...old, evidence: history };
      continue;
    }
    if (field === 'beneficiaries' && status === 'confirmed' && Array.isArray(old?.value)
      && old.evidence.some((item) => item.source === 'conversation')) {
      const prior = old.value as Beneficiary[];
      const incoming = (value as Beneficiary[]).map((life) => {
        if (prior.some((known) => known.id === life.id) || life.age === null) return life;
        // A role supplied later ("eu tenho 54") can identify an already counted,
        // unnamed person. Never collapse different people sharing one age.
        const matches = prior.filter((known) => known.age === life.age &&
          /^(?:pessoa\s*\d+|familiar|membro\s*\d+)$/i.test(known.label.trim()));
        return matches.length === 1 ? { ...life, id: matches[0].id } : life;
      });
      const removed = correction ? observation.removedBeneficiaryIds ?? [] : [];
      if (removed.some((id) => !prior.some((life) => life.id === id) || incoming.some((life) => life.id === id))) throw new Error('Remoção de beneficiário inválida.');
      const conflict = !correction && incoming.some((life) => prior.some((known) => known.id === life.id && known.age !== null && life.age !== null && known.age !== life.age));
      if (!conflict) value = [...prior.map((life) => {
        const next = incoming.find((item) => item.id === life.id);
        return next ? { ...next, age: next.age ?? life.age } : life;
      }).filter((life) => !removed.includes(life.id)), ...incoming.filter((life) => !prior.some((item) => item.id === life.id))];
      else {
        state.facts[field] = { ...old, status: 'conflict', conflictingValue: value, evidence: history, updatedAt: now };
        continue;
      }
    }
    const changed = old && JSON.stringify(old.value) !== JSON.stringify(value);
    const trustedPrior = old?.evidence.some((item) => item.source === 'conversation');
    if (changed && old.status === 'confirmed' && validValue(field, old.value) && trustedPrior && status === 'confirmed' && !correction && field !== 'beneficiaries' && field !== 'preferences') {
      state.facts[field] = { ...old, status: 'conflict', conflictingValue: value, evidence: history, updatedAt: now };
    } else {
      if (field === 'preferences' && !correction && Array.isArray(old?.value)) value = [...new Set([...(old.value as string[]), ...(value as string[])])].slice(0, 20);
      state.facts[field] = { value, status, evidence: history, updatedAt: now };
    }
  }
  const oldCity = typeof formerCity === 'string' ? formerCity : null;
  const newCity = confirmed(state, 'city');
  if (oldCity && newCity && locationKey(canonicalCity(oldCity)) !== locationKey(canonicalCity(newCity))) {
    for (const field of ['neighborhood', 'state'] as const) {
      const updatedForNewCity = interpretation.observations.some((item) => item.field === field && item.status === 'confirmed');
      if (!updatedForNewCity && state.facts[field]) {
        // Preserve the former value/evidence but do not attach it to a different residence.
        state.facts[field] = { ...state.facts[field]!, status: 'uncertain', updatedAt: now };
        delete state.asked[field];
        if (state.lastQuestion === field) state.lastQuestion = null;
      }
    }
  }
  repairAggregateBeneficiaries(state);
  resolveResidence(restoreRelatedAnswers(state), observations.some((item) => item.field === 'city' && item.status === 'confirmed' && item.correction));
  const latest = messages.filter((message) => message.role === 'lead').sort((a, b) =>
    compareArrival(a.receivedAt ?? a.messageAt, a.id, b.receivedAt ?? b.messageAt, b.id)).at(-1);
  if (latest) state.cursor = { id: latest.id, receivedAt: latest.receivedAt ?? latest.messageAt };
  return state;
}
const compareArrival = (leftTime: string, leftId: string, rightTime: string, rightId: string): number => {
  const elapsed = Date.parse(leftTime) - Date.parse(rightTime);
  if (!Number.isFinite(elapsed)) throw new Error('Cursor V2 inválido.');
  return elapsed || (leftId === rightId ? 0 : leftId > rightId ? 1 : -1);
};
export const unseenMessages = (messages: readonly V2Message[], state: V2State): V2Message[] => messages.filter((message) =>
  message.role === 'lead' && (!state.cursor || compareArrival(message.receivedAt ?? message.messageAt, message.id, state.cursor.receivedAt, state.cursor.id) > 0));

/** CRM and legacy are lower priority sources; neither implies eligibility or company ownership. */
export function seedState(seed: Partial<Pick<Values, 'city' | 'state' | 'currentOperator'>>, now: string): V2State {
  const state = initialState();
  for (const field of ['city', 'state', 'currentOperator'] as const) {
    const value = seed[field];
    if (!value || !validValue(field, value)) continue;
    state.facts[field] = { value, status: 'confirmed', updatedAt: now,
      evidence: [{ messageId: `crm:${field}`, quote: '', at: now, source: 'crm' }] };
  }
  if (seed.currentOperator) state.facts.hasCurrentPlan = { value: 'yes', status: 'confirmed', updatedAt: now,
    evidence: [{ messageId: 'crm:currentOperator', quote: '', at: now, source: 'crm' }] };
  return resolveResidence(state);
}
