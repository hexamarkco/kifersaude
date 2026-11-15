export type AttendanceBriefing = { facts: { label: string; value: string }[]; pending: string[]; review: string[];
  reason: string; qualificationComplete: boolean; updatedAt: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const labels: Record<string, string> = { intent: 'Intenção principal', goal: 'Objetivo', beneficiaryCount: 'Quantidade de pessoas',
  beneficiaries: 'Pessoas e idades', city: 'Cidade de residência', neighborhood: 'Bairro de residência', state: 'Estado', companyPresence: 'Possui CNPJ ou MEI',
  companyType: 'Tipo de empresa', companyNumber: 'Número do CNPJ/MEI', companyOpenedAt: 'Abertura da empresa', hasCurrentPlan: 'Já possui plano', currentOperator: 'Operadora atual',
  currentModality: 'Modalidade atual', targetModality: 'Modalidade desejada', preferences: 'Preferências' };
const values: Record<string, string> = { yes: 'Sim', no: 'Não', pf: 'Pessoa física', company: 'Empresarial', collective: 'Coletivo por adesão',
  mei: 'MEI', cnpj: 'CNPJ', first_plan: 'Primeiro plano', replace_operator: 'Trocar de operadora', reduce_cost: 'Reduzir mensalidade',
  expand_network: 'Ampliar rede', upgrade: 'Ampliar o plano', downgrade: 'Reduzir o plano', pf_to_mei: 'Mudar de pessoa física para MEI',
  add_dependents: 'Incluir dependentes', portability: 'Portabilidade', defined_choice: 'Já sabe o que deseja', guided_choice: 'Precisa de orientação' };
const reasons: Record<string, string> = { customer_requested_human: 'O cliente pediu atendimento humano.', conversation_friction: 'O cliente demonstrou incômodo com o atendimento.',
  customer_declined_quotation: 'O cliente recusou a cotação.', refusal_needs_review: 'É necessário conferir se o cliente deseja encerrar a cotação.',
  product_eligibility: 'A elegibilidade depende da operadora e do produto.', portability_review: 'A portabilidade precisa de avaliação comercial.',
  preference_review: 'É necessário conferir as preferências antes da cotação.', minor_product_review: 'A contratação para menor precisa de conferência.',
  essential_information_unavailable: 'Uma informação essencial não pôde ser confirmada.', unresolved_conflict: 'Há informações conflitantes que precisam ser esclarecidas.',
  essential_information_needed: 'É necessário explicar a importância de um dado essencial e pedir novamente com delicadeza.',
  question_attempts_exhausted: 'O cliente ainda precisa de ajuda para responder.', initial_qualification_validated: 'Os dados da qualificação inicial foram reunidos.',
  required_information: 'Ainda há informações a coletar.', conflicting_evidence: 'É necessário esclarecer uma informação.', previous_question_unresolved: 'A última pergunta precisa de esclarecimento.',
  general_guidance: 'O cliente trouxe uma dúvida sobre o atendimento.', optional_information: 'Uma pergunta opcional pode ajudar a orientar a cotação.' };
const fieldNames = (value: unknown): string[] => Array.isArray(value) ? value.filter((field): field is string => typeof field === 'string')
  .map((field) => labels[field] ?? 'Informação a conferir') : [];
const reasonLabel = (value: string): string => reasons[value] ?? (value.startsWith('commercial_question_')
  ? 'O cliente fez uma pergunta comercial que exige conferência.' : 'A equipe precisa revisar o atendimento.');
function showValue(value: unknown): string {
  if (typeof value === 'string') return values[value] ?? value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => record(item) && typeof item.label === 'string'
    ? `${item.label} — ${typeof item.age === 'number' ? `${item.age} anos` : 'idade não informada'}` : typeof item === 'string' ? item : '').filter(Boolean).join('; ');
  return '';
}
export function presentAttendanceBriefing(state: unknown, updatedAt: string): AttendanceBriefing | null {
  if (!record(state) || !record(state.attendanceV2) || state.attendanceV2.version !== 2 || !record(state.briefing)
    || !record(state.briefing.confirmed) || !record(state.v2Decision)) return null;
  const briefing = state.briefing;
  const confirmedFacts = briefing.confirmed as Record<string, unknown>;
  const facts = Object.keys(labels).filter((key) => key in confirmedFacts).map((key) => ({ label: labels[key], value: showValue(confirmedFacts[key]) })).filter((fact) => fact.value);
  const reason = typeof briefing.reason === 'string' ? briefing.reason.split(',').map(reasonLabel).join(' ') : 'A equipe precisa revisar o atendimento.';
  return { facts, pending: [...fieldNames(briefing.pending), ...fieldNames(briefing.conflicts).map((field) => `${field} com informações conflitantes`)],
    review: Array.isArray(briefing.review) ? briefing.review.filter((item): item is string => typeof item === 'string').map(reasonLabel) : [], reason,
    qualificationComplete: state.v2Decision.handoffCode === 'QUALIFICACAO_COMPLETA'
      && Array.isArray(briefing.pending) && briefing.pending.length === 0 && Array.isArray(briefing.conflicts) && briefing.conflicts.length === 0
      && Array.isArray(briefing.review) && briefing.review.length === 0, updatedAt };
}
