import type { Interpretation, Values, V2Message } from '../../../ai-autonomous-reply-worker/domain/state.ts';
import type { Decision } from '../../../ai-autonomous-reply-worker/domain/decision.ts';

export const date = '2026-11-14T12:00:00.000Z';
export const message = (content: string, index = 1): V2Message => ({ id: `synthetic-${index}`, role: 'lead', content,
  messageAt: new Date(Date.parse(date) + index * 1000).toISOString() });
export function interpretation(values: Partial<Values>, messages: V2Message[], extras: Partial<Interpretation> = {}): Interpretation {
  return { observations: Object.entries(values).map(([field, value]) => ({ field: field as keyof Values, value,
    status: 'confirmed', correction: false, messageId: messages[0].id, quote: messages[0].content })),
  humanRequested: false, quoteDeclined: false, irritated: false, question: null, suggestedField: null, signals: [], ...extras };
}
const base: Partial<Values> = { intent: 'first_plan', goal: 'Primeira contratação', beneficiaryCount: 1,
  beneficiaries: [{ id: 'self', label: 'cliente', age: 35 }], city: 'Rio de Janeiro', state: 'RJ', neighborhood: 'Campo Grande', companyPresence: 'no', hasCurrentPlan: 'no' };
export type Scenario = { id: number; name: string; messages: V2Message[]; values: Partial<Values>; action: Decision['action'];
  reply: string; extras?: Partial<Interpretation>; unknown?: keyof Values };
export const scenarios: Scenario[] = [
  { id: 1, name: 'Migração de Leve PF para MEI', messages: [message('É para mim e minha esposa, duas vidas de 80 anos. Rio de Janeiro, bairro Campo Grande. Temos Leve Saúde PF e quero manter o plano mudando para MEI, já tenho MEI.')],
    values: { ...base, intent: 'pf_to_mei', goal: 'Manter Leve Saúde e mudar PF para MEI', beneficiaryCount: 2,
      beneficiaries: [{ id: 'self', label: 'cliente', age: 80 }, { id: 'spouse', label: 'esposa', age: 80 }], companyPresence: 'yes', companyType: 'mei',
      hasCurrentPlan: 'yes', currentOperator: 'Leve Saúde', currentModality: 'pf', targetModality: 'mei' },
    action: 'ask', reply: 'Você pode me passar o número do seu MEI? Isso ajuda a refinar a cotação, mas podemos continuar sem ele.' },
  { id: 2, name: 'primeiro plano', messages: [message('Quero meu primeiro plano, só para mim, 35 anos, Rio de Janeiro RJ, bairro Campo Grande. Não tenho CNPJ nem MEI.')], values: base,
    action: 'complete', reply: 'A equipe vai dar continuidade à sua cotação.' },
  { id: 3, name: 'família e idades iguais', messages: [message('Primeiro plano para nós quatro, eu e minha esposa com 35 anos cada, filhos de 8 e 12 anos. Rio de Janeiro RJ, bairro Campo Grande, sem CNPJ.')],
    values: { ...base, beneficiaryCount: 4, beneficiaries: [{ id: 'self', label: 'cliente', age: 35 }, { id: 'spouse', label: 'esposa', age: 35 },
      { id: 'child1', label: 'filho', age: 8 }, { id: 'child2', label: 'filha', age: 12 }] }, action: 'complete', reply: 'A equipe vai dar continuidade à cotação da família.' },
  { id: 4, name: 'sem CNPJ ou MEI', messages: [message('Quero meu primeiro plano, 35 anos, só para mim em Rio de Janeiro RJ, bairro Campo Grande. Não tenho empresa nem MEI.')], values: base,
    action: 'complete', reply: 'A equipe vai dar continuidade à sua cotação.' },
  { id: 5, name: 'MEI recém-aberto', messages: [message('Quero meu primeiro plano para mim, 35 anos, Rio de Janeiro RJ, bairro Campo Grande. Abri meu MEI ontem.')],
    values: { ...base, companyPresence: 'yes', companyType: 'mei', companyOpenedAt: 'ontem' }, action: 'ask', reply: 'Você pode me passar o número do seu MEI? Isso ajuda a refinar a cotação.' },
  { id: 6, name: 'mesma operadora e menos custo', messages: [message('Quero manter a Leve Saúde mas reduzir a mensalidade. Só eu, 35 anos, Rio de Janeiro RJ, bairro Campo Grande, não tenho CNPJ nem MEI.')],
    values: { ...base, intent: 'reduce_cost', goal: 'Reduzir mensalidade mantendo Leve Saúde', hasCurrentPlan: 'yes', currentOperator: 'Leve Saúde' },
    action: 'complete', reply: 'A equipe vai avaliar alternativas de cotação pensando no custo e na sua preferência pela operadora.' },
  { id: 7, name: 'hospital obrigatório', messages: [message('Quero meu primeiro plano, só para mim, 35 anos, Rio de Janeiro RJ, bairro Campo Grande, sem CNPJ. Preciso do Hospital Exemplo.')],
    values: { ...base, preferences: ['Hospital Exemplo obrigatório'] }, action: 'complete', reply: 'Obrigada pelas informações! A corretora vai seguir com seu atendimento considerando essa preferência.' },
  { id: 8, name: 'não sabe responder', messages: [message('Quero primeiro plano para mim, Rio de Janeiro RJ, bairro Campo Grande, sem CNPJ. Não sei informar minha idade agora.')],
    values: { ...base, beneficiaries: [{ id: 'self', label: 'cliente', age: null }] }, unknown: 'beneficiaries', action: 'clarify', reply: 'A idade é necessária para pesquisar os valores da cotação. Você consegue conferir sua idade para mim?' },
  { id: 9, name: 'todos os dados de uma vez', messages: [message('Primeiro plano, só para mim com 35 anos. Rio de Janeiro RJ, bairro Campo Grande. Sem CNPJ ou MEI e sem plano atual.')], values: base,
    action: 'complete', reply: 'A equipe vai dar continuidade à sua cotação.' },
  { id: 10, name: 'novo objetivo', messages: [message('Mudei de ideia, agora quero trocar de operadora, tenho Leve Saúde. Só eu com 35 anos, Rio de Janeiro RJ, bairro Campo Grande, sem CNPJ.')],
    values: { ...base, intent: 'replace_operator', goal: 'Trocar de operadora', hasCurrentPlan: 'yes', currentOperator: 'Leve Saúde' }, action: 'complete', reply: 'A equipe vai avaliar as alternativas para a troca na cotação.' },
  { id: 11, name: 'dúvida de carência', messages: [message('Quero primeiro plano. Tem carência?')], values: { intent: 'first_plan', goal: 'Primeiro plano' }, action: 'ask',
    extras: { question: { text: 'Tem carência?', topic: 'waiting_period' }, signals: [{ messageId: 'synthetic-1', quote: 'Tem carência?' }] },
    reply: 'A corretora vai conferir essa parte com você. O plano seria só para você ou para mais alguém?' },
  { id: 12, name: 'pedido de humano', messages: [message('Quero falar com uma pessoa agora.')], values: {}, action: 'handoff',
    extras: { humanRequested: true, signals: [{ messageId: 'synthetic-1', quote: 'Quero falar com uma pessoa agora.' }] }, reply: 'Vou encaminhar seu atendimento para a equipe.' },
  { id: 13, name: 'mensagens fragmentadas', messages: [message('Primeiro plano para mim, 35 anos, sem CNPJ ou MEI.'), message('Rio de Janeiro, bairro Campo Grande', 2), message('RJ, sem plano atual', 3)],
    values: base, action: 'complete', reply: 'A equipe vai dar continuidade à sua cotação.' },
  { id: 14, name: 'correção de idade', messages: [message('Corrigindo, minha esposa tem 80 anos e eu também, não 81. Primeiro plano para nós dois em Rio de Janeiro RJ, bairro Campo Grande, sem CNPJ.')],
    values: { ...base, beneficiaryCount: 2, beneficiaries: [{ id: 'self', label: 'cliente', age: 80 }, { id: 'spouse', label: 'esposa', age: 80 }] },
    action: 'complete', reply: 'A equipe vai dar continuidade à cotação de vocês.' },
  { id: 15, name: 'conclusão com obrigatórios ausentes', messages: [message('Quero primeiro plano para mim.')], values: { intent: 'first_plan', goal: 'Primeiro plano', beneficiaryCount: 1 }, action: 'ask',
    reply: 'Qual é a sua idade?' },
];
