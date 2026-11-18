import { confirmed, FIELDS, type Field, type Interpretation, type V2State } from './state.ts';
import { capitalState } from './location.ts';

export type Decision = { action: 'ask' | 'clarify' | 'answer' | 'handoff' | 'complete'; field: Field | null;
  reason: string; missing: Field[]; handoffCode: 'QUALIFICACAO_COMPLETA' | 'PRECISA_HUMANO' | 'RECUSOU_COTACAO' | null };

/**
 * A named hospital, maternity hospital, clinic or lab is already a concrete
 * network target. In that case, the customer's residence city is still needed
 * for quotations, but a capital-city neighborhood is not a prerequisite.
 * Only confirmed client goals/preferences qualify; generic "hospitals nearby" do not.
 */
export function hasNamedCareFacility(state: V2State): boolean {
  const descriptions = [...(confirmed(state, 'preferences') ?? []), confirmed(state, 'goal') ?? ''];
  return descriptions.some((preference) => {
    const namedFacility = /(?:^|\s)(?:[Hh]ospital|[Mm]aternidade|[Ll]aborat[oó]rio|[Cc]l[ií]nica)\s+(?!(?:perto|pr[oó]xim[oa]|bom|boa|qualquer|credenciad[oa]|barat[oa])\b)[A-ZÀ-Ý][\p{L}-]{2,}/u;
    const namedPreference = /(?:^|\s)(?:[Ii]ncluir|[Ii]nclua|[Tt]er|[Tt]enha|[Aa]tenda|[Aa]tendimento\s+(?:no|na)|[Cc]ubra|[Rr]ede\s+(?:do|da))\s+(?:(?:o|a|no|na|do|da|um|uma)\s+)?[A-ZÀ-Ý][\p{L}-]{2,}\s+[A-ZÀ-Ý][\p{L}-]{2,}/u;
    return namedFacility.test(preference) || namedPreference.test(preference);
  });
}

export function requirements(state: V2State): Field[] {
  const required: Field[] = ['beneficiaryCount', 'beneficiaries', 'city', 'companyPresence'];
  if (capitalState(confirmed(state, 'city') ?? '') && !hasNamedCareFacility(state)) required.push('neighborhood');
  const lives = confirmed(state, 'beneficiaries');
  if (!lives?.length || lives.some((life) => life.age === null) || lives.length !== confirmed(state, 'beneficiaryCount')) {
    // A confirmed list with missing ages is still incomplete.
    required.push('beneficiaries');
  }
  return [...new Set(required)].filter((field) => confirmed(state, field) === null
    || (field === 'city' && state.facts.state?.status === 'conflict')
    || (field === 'beneficiaries' && (!lives?.length || lives.some((life) => life.age === null)
      || lives.length !== confirmed(state, 'beneficiaryCount'))));
}

/** Useful commercial context is offered once and never becomes a completion prerequisite. */
function optionalQuestions(state: V2State): Field[] {
  const fields: Field[] = ['hasCurrentPlan'];
  if (confirmed(state, 'cancelledPreviousPlan') === 'yes') fields.push('previousOperator', 'cancellationReason');
  fields.push('goal');
  if (confirmed(state, 'hasCurrentPlan') === 'yes') fields.push('currentOperator');
  if (confirmed(state, 'companyPresence') === 'yes') fields.push('companyNumber');
  return fields.filter((field) => !state.facts[field] && (state.asked[field] ?? 0) === 0);
}

export function decide(state: V2State, interpretation: Interpretation, options: { customerAlreadyAssisted?: boolean; customerNeedResolved?: boolean } = {}): Decision {
  const missing = requirements(state);
  const make = (action: Decision['action'], reason: string, field: Field | null = null): Decision => ({
    action, field: action === 'ask' || action === 'clarify' ? field : null, reason, missing,
    handoffCode: action === 'complete' ? 'QUALIFICACAO_COMPLETA' : action === 'handoff' ? 'PRECISA_HUMANO' : null,
  });
  // A courteous "I'm already talking to someone" ends the bot's questioning,
  // but must not mark the lead as Perdido or invent a quotation refusal.
  if (options.customerAlreadyAssisted) return make('handoff', 'customer_already_assisted');
  // A resolved need ends the automated conversation, but is not proof of a lost sale.
  if (options.customerNeedResolved) return make('handoff', 'customer_need_resolved');
  if (interpretation.humanRequested) return make('handoff', 'customer_requested_human');
  if (interpretation.quoteDeclined) {
    // Only unambiguous refusal evidence may mark a commercial loss. Ambiguity goes to a person.
    const explicit = interpretation.signals.some(({ quote }) => /\b(?:nao quero (?:a |uma )?cotacao|nao tenho interesse (?:na cotacao|em contratar)|desisti (?:da cotacao|de contratar))\b/.test(
      quote.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    const optionalFieldRefusal = interpretation.observations.some((item) => ['declined', 'unknown'].includes(item.status)
      && ['hasCurrentPlan', 'goal', 'currentOperator', 'previousOperator', 'cancellationReason', 'companyNumber'].includes(item.field));
    if (explicit || !optionalFieldRefusal) return { ...make('handoff', explicit ? 'customer_declined_quotation' : 'refusal_needs_review'), handoffCode: explicit ? 'RECUSOU_COTACAO' : 'PRECISA_HUMANO' };
  }
  if (interpretation.irritated) return make('handoff', 'conversation_friction');
  const lives = confirmed(state, 'beneficiaries');
  const declaredCount = confirmed(state, 'beneficiaryCount');
  // For under-12s, an adult must be the policyholder and the child a dependent.
  // Individual plans for ages 13-17 are confirmed only in RJ. Do not extrapolate
  // to other states, to age 12, or to a group of minors on a single contract.
  if (lives?.length && lives.length === declaredCount && lives.every((life) => life.age !== null && life.age < 18)) {
    if (lives.some((life) => life.age! < 12)) return make('handoff', 'child_requires_adult_holder');
    if (lives.some((life) => life.age === 12)) return make('handoff', 'age_twelve_needs_review');
    if (declaredCount !== 1) return make('handoff', 'multiple_minor_contract_needs_review');
    const residenceState = confirmed(state, 'state');
    if (residenceState !== 'RJ' && (residenceState !== null || confirmed(state, 'city') !== null)) {
      return make('handoff', 'minor_individual_region_not_verified');
    }
    // When residence is still unknown, collect city before checking eligibility.
    // A single 13-17-year-old in confirmed RJ follows ordinary qualification.
  }
  const productQuestion = interpretation.question !== null && interpretation.question.topic !== 'general';
  if (state.facts.state?.status === 'conflict') return (state.asked.city ?? 0) >= 2
    ? make('handoff', 'unresolved_conflict') : make('clarify', 'conflicting_evidence', 'city');
  const conflict = missing.find((field) => state.facts[field]?.status === 'conflict');
  if (conflict) return (state.asked[conflict] ?? 0) >= 2 ? make('handoff', 'unresolved_conflict') : make('clarify', 'conflicting_evidence', conflict);
  const unavailable = missing.find((field) => ['unknown', 'declined'].includes(state.facts[field]?.status ?? ''));
  if (unavailable) return (state.asked[unavailable] ?? 0) >= 2
    ? make('handoff', 'essential_information_unavailable') : make('clarify', 'essential_information_needed', unavailable);
  if (interpretation.question && !productQuestion) return make('answer', 'general_guidance');
  if (missing.length > 0) {
    // Semantics chooses priority inside backend-calculated needs, never adds arbitrary questions.
    const unasked = missing.filter((field) => (state.asked[field] ?? 0) === 0);
    const candidates = unasked.length ? unasked : missing;
    const field = candidates.includes('neighborhood') ? 'neighborhood' : interpretation.suggestedField && candidates.includes(interpretation.suggestedField)
      ? interpretation.suggestedField : candidates[0];
    if ((state.asked[field] ?? 0) >= 2) return make('handoff', 'question_attempts_exhausted', field);
    if ((state.asked[field] ?? 0) > 0) return make('clarify', 'previous_question_unresolved', field);
    return make('ask', 'required_information', field);
  }
  // Product questions belong to the broker. Once essentials are collected, pass the qualified lead on.
  if (productQuestion) return make('complete', 'initial_qualification_validated');
  const optional = optionalQuestions(state);
  if (optional.length) {
    const cancellationFollowup = optional.find((field) => field === 'previousOperator' || field === 'cancellationReason');
    return make('ask', 'optional_information', cancellationFollowup ?? (interpretation.suggestedField && optional.includes(interpretation.suggestedField)
      ? interpretation.suggestedField : optional[0]));
  }
  return make('complete', 'initial_qualification_validated');
}

export function assertDecision(state: V2State, decision: Decision): void {
  if (decision.handoffCode === 'QUALIFICACAO_COMPLETA'
    && (decision.action !== 'complete' || requirements(state).length)) throw new Error('Conclusão bloqueada por pendências reais.');
  if ((decision.action === 'ask' || decision.action === 'clarify') && (!decision.field
    || (decision.action === 'ask' && !requirements(state).includes(decision.field)
      && !(decision.reason === 'optional_information' && optionalQuestions(state).includes(decision.field))))) throw new Error('Pergunta sem pendência válida.');
}

export const internalBriefing = (state: V2State, decision: Decision) => ({
  intent: confirmed(state, 'intent'), confirmed: Object.fromEntries(FIELDS.filter((field) => confirmed(state, field) !== null)
    .map((field) => [field, confirmed(state, field)])), pending: requirements(state),
  conflicts: requirements(state).filter((field) => state.facts[field]?.status === 'conflict'),
  optionalConflicts: FIELDS.filter((field) => state.facts[field]?.status === 'conflict' && !requirements(state).includes(field)),
  review: [] as string[], reason: decision.reason, handoffCode: decision.handoffCode,
});

/** Telemetry deliberately contains field names, never quotes, ages, names or locations. */
export const decisionTrace = (state: V2State, decision: Decision, configVersion: number) => ({
  engine: 'v2', policyVersion: state.policyVersion, configVersion, intent: confirmed(state, 'intent'),
  usedFields: FIELDS.filter((field) => confirmed(state, field) !== null), missing: decision.missing,
  action: decision.action, field: decision.field, reason: decision.reason, handoffCode: decision.handoffCode,
  historyPartial: state.historyPartial,
});
