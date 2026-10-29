import { extractAutonomousQualificationState, type QualificationMessage } from './ai-autonomous-qualification.ts';

export type MemoryMessage = QualificationMessage & { id: string; messageAt: string };
type Evidence = { source_message_id: string; message_at: string; evidence: string };
type Fact = { value: unknown; status: 'confirmed' | 'uncertain' | 'negated' | 'not_asked'; evidence: Evidence[] };
export type AutonomousConversationMemory = {
  schemaVersion: 2;
  source_message_id: string | null;
  source_message_at: string | null;
  qualification: ReturnType<typeof extractAutonomousQualificationState>;
  facts: Record<string, Fact>;
  commercial: Record<string, Fact>;
  briefing: { facts: Record<string, unknown>; priorities: Record<string, unknown>; pending: string[]; cautions: string[] };
  control: { lastQuestion: string | null; phaseAtExtraction: 'active'; historyWindowComplete: boolean };
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Rebuilt from persisted conversation evidence; never from manually edited lead fields.
 * The extractor remains advisory. The transcript, not this projection, decides the next turn.
 */
export const deriveAutonomousConversationMemory = (
  messages: readonly MemoryMessage[], extractedAt: string, sourceMessageId?: string, previous?: unknown,
): AutonomousConversationMemory => {
  const facts: Record<string, Fact> = {};
  const commercial: Record<string, Fact> = {};
  const prefix: QualificationMessage[] = [];
  let lastQuestion: string | null = null;
  let lastInbound: MemoryMessage | undefined;
  for (const message of messages) {
    prefix.push(message);
    if (message.role === 'ai') {
      if (message.content.includes('?')) lastQuestion = message.content;
      continue;
    }
    lastInbound = message;
    const evidence = { source_message_id: message.id, message_at: message.messageAt, evidence: message.content };
    const state = extractAutonomousQualificationState(prefix, extractedAt);
    const values: Record<string, unknown> = {
      lives: state.lives, location: state.location, company: state.company, currentHealthPlan: state.currentHealthPlan,
    };
    for (const [key, value] of Object.entries(values)) {
      if (JSON.stringify(facts[key]?.value) === JSON.stringify(value)) continue;
      const hasKnownValue = key === 'lives' ? state.lives.compositionStatus === 'known'
        : key === 'location' ? state.location.cityStatus === 'known'
          : key === 'company' ? state.company.answerStatus === 'known' : state.currentHealthPlan.answerStatus === 'known';
      facts[key] = { value, status: !hasKnownValue ? 'not_asked'
        : (key === 'company' && state.company.hasCnpjOrMei === 'no')
          || (key === 'currentHealthPlan' && state.currentHealthPlan.hasPlan === 'no') ? 'negated' : 'confirmed',
      evidence: [...(facts[key]?.evidence ?? []), evidence] };
    }
    const text = normalize(message.content);
    const signals: Record<string, boolean> = {
      reduceCost: /\b(?:caro|cara|economizar|reduzir|baixar|reajuste)\b/.test(text),
      portability: /\bportabilidade\b/.test(text),
      nationalCoverage: /\bnacional\b/.test(text),
      cancellation: /\b(?:cancelar|cancelamento)\b/.test(text),
      originContract: /\b(?:plano|contrato)\b.*\bempresarial\b/.test(text),
      destinationCompanyLink: /\b(?:meu|nosso|proprio|propria)\s+(?:cnpj|mei|empresa)\b|\bempregador\b/.test(text),
      alternatives: /\bou\b/.test(text) && /\b(?:filh|mim|sozinh|incluir|ambos|nos dois)/.test(text),
      currentPremium: /\b(?:pago|pagamos|mensalidade|custa)\b[^.!?]{0,40}\d|r\$\s*\d/.test(text),
      networkPriority: /\b(?:hospital|rede|laboratorio)\b/.test(text),
    };
    for (const [key, present] of Object.entries(signals)) {
      if (!present) continue;
      // Store the statement as evidence, not an invented monetary/eligibility value.
      const uncertain = /\b(?:talvez|nao sei|acho que)\b/.test(text);
      const negated = /\bnao\s+(?:quero|preciso|vou|busco)\b/.test(text);
      commercial[key] = { value: message.content, status: uncertain ? 'uncertain' : negated ? 'negated' : 'confirmed',
        evidence: [...(commercial[key]?.evidence ?? []), evidence] };
    }
  }
  const source = messages.find((message) => message.id === sourceMessageId) ?? lastInbound;
  // Old v1 rows remain readable. v2 evidence survives a bounded history window.
  if (previous && typeof previous === 'object' && 'schemaVersion' in previous && previous.schemaVersion === 2) {
    for (const [key, target] of [['facts', facts], ['commercial', commercial]] as const) {
      const prior = key in previous ? (previous as Record<string, unknown>)[key] : null;
      if (!prior || typeof prior !== 'object' || Array.isArray(prior)) continue;
      for (const [field, value] of Object.entries(prior)) {
        if (!value || typeof value !== 'object' || !('status' in value) || !('evidence' in value)
          || !Array.isArray(value.evidence) || !('value' in value)) continue;
        if (!['confirmed', 'uncertain', 'negated', 'not_asked'].includes(String(value.status))) continue;
        const evidence = value.evidence.filter((item: unknown): item is Evidence => item !== null && typeof item === 'object'
          && 'source_message_id' in item && typeof item.source_message_id === 'string'
          && 'message_at' in item && typeof item.message_at === 'string'
          && 'evidence' in item && typeof item.evidence === 'string');
        if (!target[field] || target[field].status === 'not_asked') {
          target[field] = { value: value.value, status: value.status as Fact['status'], evidence };
        } else {
          const merged = [...evidence, ...target[field].evidence];
          target[field].evidence = merged.filter((item, index) => merged.findIndex((candidate) => candidate.source_message_id === item.source_message_id) === index);
        }
      }
    }
  }
  return {
    schemaVersion: 2, source_message_id: source?.id ?? null, source_message_at: source?.messageAt ?? null,
    qualification: extractAutonomousQualificationState([...messages], extractedAt), facts, commercial,
    briefing: {
      facts: Object.fromEntries(Object.entries(facts).filter(([, fact]) => fact.status !== 'not_asked').map(([key, fact]) => [key, fact.value])),
      priorities: Object.fromEntries(Object.entries(commercial).map(([key, fact]) => [key, { value: fact.value, status: fact.status }])),
      pending: extractAutonomousQualificationState([...messages], extractedAt).missingRequiredFields,
      cautions: [
        ...(commercial.portability ? ['Portabilidade e carências dependem de avaliação humana.'] : []),
        ...(commercial.cancellation ? ['Conferir nova contratação antes de cancelar o plano atual.'] : []),
        ...(commercial.originContract ? ['Contrato empresarial de origem não comprova vínculo elegível de destino.'] : []),
      ],
    },
    control: { lastQuestion, phaseAtExtraction: 'active', historyWindowComplete: false },
  };
};

export const buildAutonomousMemoryPrompt = (memory: AutonomousConversationMemory): string => [
  'MEMORIA DERIVADA DA CONVERSA. Use como apoio, nunca acima do historico explicito. Ausencia significa nao confirmado. Nao associe idades a pessoas por suposicao. Perguntas comerciais opcionais podem ser feitas uma vez quando uteis, sem bloquear o handoff.',
  JSON.stringify({ facts: Object.fromEntries(Object.entries(memory.facts).map(([key, fact]) => [key, { value: fact.value, status: fact.status }])),
    commercial: Object.fromEntries(Object.entries(memory.commercial).map(([key, fact]) => [key, { value: fact.value, status: fact.status }])),
    lastQuestion: memory.control.lastQuestion, partialHistory: !memory.control.historyWindowComplete }),
].join('\n');
