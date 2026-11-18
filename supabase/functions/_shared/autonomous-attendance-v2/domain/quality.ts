import type { AutonomousMessageRow } from './types.ts';

/** Evaluation criteria for the V2 sandbox, never a second attendance decision engine. */
export const V2_QUALITY_GUIDELINES = [
  'O atendimento autônomo usa somente V2, para leads de qualquer DDD e qualquer estado; DDD 21 foi critério de amostra humana de estilo, nunca de atendimento.',
  'Preserve o número de pessoas, todas as idades e idades iguais como beneficiários distintos. Não invente pessoas a partir de menções ao plano anterior.',
  'Coleta mínima: número e idades dos beneficiários, cidade de residência e existência ou não de CNPJ/MEI. Bairro é necessário nas capitais; fora delas é opcional. Não pergunte UF separadamente só porque falta um campo: use a informação geográfica confirmada, sem deduzir pelo DDD.',
  'Plano atual, operadora, objetivo e número do CNPJ são informações úteis porém opcionais. Não repita pergunta respondida e não prenda o atendimento nesses campos.',
  'Menor de 12 anos precisa de adulto titular e entra como dependente. Adolescente de 13 a 17 anos com residência confirmada no RJ pode seguir a qualificação individual, sem garantir aceitação. Para 12 anos ou outras localidades, não extrapole regras e encaminhe a análise humana.',
  'A IA coleta informações e não faz cotação, análise definitiva de elegibilidade, preço, rede, portabilidade, cobertura ou carências. Dúvidas específicas vão para a corretora; perguntas gerais podem ser respondidas sem promessas.',
  'No máximo uma pergunta por resposta e no máximo três frases curtas. Respeite correções, mensagens consecutivas, pedido de humano e avisos de que a pessoa já está sendo atendida.',
  'QUALIFICACAO_COMPLETA exige coleta validada; RECUSOU_COTACAO exige recusa inequívoca; PRECISA_HUMANO é transferência sem inventar perda ou conclusão.',
  'Mantenha voz próxima e respeitosa, sem se apresentar como humana caso o cliente pergunte sobre automação, sem scripts técnicos ou mensagens com tags internas.',
].join('\n');

export function collectV2DeterministicViolations(history: readonly AutonomousMessageRow[]): string[] {
  const violations: string[] = [];
  for (const row of history) {
    if (row.role !== 'ai') continue;
    const text = row.content.trim();
    if (!text || text.length > 600) violations.push('Mensagem vazia ou acima do limite de 600 caracteres.');
    if ((text.match(/\?/g) ?? []).length > 1) violations.push('Mais de uma pergunta na mesma mensagem.');
    if (/[：:—–]|\[\[HANDOFF/i.test(text)) violations.push('Texto visível contém separador proibido ou tag interna de handoff.');
  }
  return [...new Set(violations)];
}
