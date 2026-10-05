import type { AutonomousMessageRow, HandoffCode } from '../../ai-autonomous-helpers';

type ToneScenario = {
  key: string;
  history: AutonomousMessageRow[];
  candidate: string;
  handoff: HandoffCode | null;
  review: string;
};

// Synthetic, anonymized examples for validator tests and isolated model review.
// Candidates are examples to evaluate, not mocked evidence of generation quality.
export const autonomousToneScenarios: ToneScenario[] = [
  {
    key: 'family',
    history: [
      { role: 'lead', content: 'Para mim e minha família.' },
      { role: 'ai', content: 'Vamos buscar uma opção para vocês. Quem vai entrar e quais são as idades?' },
      { role: 'lead', content: 'Eu 46, esposa 44, filhos 24, 18 e 10.' },
    ],
    candidate: 'Em qual cidade vocês precisam de atendimento?',
    handoff: null,
    review: 'Avançar sem repetir a promessa genérica nem perguntar novamente pelas idades.',
  },
  {
    key: 'first-coverage',
    history: [
      { role: 'lead', content: 'Só para mim, 55 anos. Belford Roxo e Nova Iguaçu.' },
      { role: 'ai', content: 'Você tem CNPJ ou MEI?' },
      { role: 'lead', content: 'Tenho MEI há dois anos.' },
      { role: 'ai', content: 'Você já tem plano hoje?' },
      { role: 'lead', content: 'Busco minha primeira cobertura.' },
    ],
    candidate: 'Vou comparar as opções com atendimento nas regiões que você indicou e te enviar a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
    handoff: 'QUALIFICACAO_COMPLETA',
    review: 'Conectar o fechamento à região sem recapitular todos os dados ou garantir rede.',
  },
  {
    key: 'budget',
    history: [
      { role: 'lead', content: 'Quero um preço em conta. Só para mim, 72 anos, sem CNPJ, São Gonçalo.' },
    ],
    candidate: 'Entendo sua preocupação com o valor. Você já tem algum plano hoje?',
    handoff: null,
    review: 'Reconhecer orçamento, aproveitar dados recebidos e não garantir preço.',
  },
  {
    key: 'thanks-after-guidance',
    history: [
      { role: 'lead', content: 'Só para uma criança de 10 anos.' },
      { role: 'ai', content: 'É necessário incluir um adulto para contratar. Algum adulto também entrará no plano?' },
      { role: 'lead', content: 'Ok, obrigado.' },
    ],
    candidate: 'Por nada. Se decidir retomar a cotação, estou por aqui.',
    handoff: null,
    review: 'Não repetir a pergunta sobre adulto nem converter agradecimento em recusa ou qualificação completa.',
  },
  {
    key: 'objective-age',
    history: [
      { role: 'lead', content: 'Só para mim.' },
      { role: 'ai', content: 'Qual é a sua idade?' },
      { role: 'lead', content: '55' },
    ],
    candidate: 'Em qual cidade você pretende usar o plano?',
    handoff: null,
    review: 'Pergunta direta gentil é suficiente após dado objetivo.',
  },
  {
    key: 'accepts-alternative',
    history: [
      { role: 'lead', content: 'Tenho 40 anos e MEI há três meses.' },
      { role: 'ai', content: 'O MEI precisa completar seis meses. Podemos cotar pessoa física enquanto isso?' },
      { role: 'lead', content: 'Ok, pode ser.' },
    ],
    candidate: 'Em qual cidade você pretende usar o plano?',
    handoff: null,
    review: 'Reconhecer aceite da alternativa e continuar sem interpretar todo ok como despedida.',
  },
];
