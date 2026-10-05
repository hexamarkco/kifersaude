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
    key: 'family-two-regions',
    history: [
      { role: 'lead', content: 'Para mim, esposa e filhos. Eu 46, esposa 44, filhos 24, 18 e 10.' },
      { role: 'ai', content: 'Em qual cidade sua família pretende usar o plano?' },
      { role: 'lead', content: 'Campos e Vitória.' },
    ],
    candidate: 'Vocês precisam de atendimento nas duas cidades. Algum dos adultos que vai entrar no plano tem CNPJ ou MEI? Dependendo do caso, isso pode permitir opções mais em conta.',
    handoff: null,
    review: 'Preservar as duas regiões e avançar para CNPJ/MEI entre adultos sem criar obrigação de bairro.',
  },
  {
    key: 'relatives-location-after-neighborhood-question',
    history: [
      { role: 'lead', content: 'Para mim e minha esposa, 46 e 44 anos. Campos e Vitória.' },
      { role: 'ai', content: 'Em qual bairro de Vitória vocês precisam de atendimento?' },
      { role: 'lead', content: 'Nós moramos em Campos dos Goytacazes.' },
      { role: 'lead', content: 'Vitória capital por conta de nossos pais morarem lá.' },
    ],
    candidate: 'É importante ter opções de atendimento também quando visitam seus pais. Vocês ou algum outro adulto que vai entrar no plano têm CNPJ ou MEI? Dependendo do caso, o plano pode ficar mais em conta.',
    handoff: null,
    review: 'Não perguntar bairro novamente nem incluir os pais como beneficiários. Interpretar as mensagens seguidas em conjunto.',
  },
  {
    key: 'corrects-secondary-region',
    history: [
      { role: 'lead', content: 'Para mim e minha esposa, 46 e 44 anos. Moramos em Campos dos Goytacazes e precisamos de atendimento em Vitória por causa dos nossos pais.' },
      { role: 'ai', content: 'Em qual bairro de Vitória eles moram?' },
      { role: 'lead', content: 'Moram na verdade em Vila Velha, na Praia da Costa.' },
    ],
    candidate: 'Vou verificar opções que contemplem atendimento em Campos e Vila Velha. Você ou sua esposa têm CNPJ ou MEI? Dependendo do caso, o plano pode ficar mais em conta.',
    handoff: null,
    review: 'Aceitar a correção para Vila Velha, preservar Campos e avançar sem nova pergunta de bairro ou garantia de rede.',
  },
  {
    key: 'multi-region-completion-without-neighborhood',
    history: [
      { role: 'lead', content: 'Só para mim, 46 anos. Preciso de atendimento em Campos dos Goytacazes e Vitória. Não tenho CNPJ nem MEI.' },
      { role: 'ai', content: 'Você já tem plano hoje?' },
      { role: 'lead', content: 'Não tenho plano.' },
    ],
    candidate: 'Vou verificar opções para atendimento nas duas regiões e te enviar a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
    handoff: 'QUALIFICACAO_COMPLETA',
    review: 'Concluir com base completa, sem exigir bairro em cada região nem garantir cobertura.',
  },
  {
    key: 'single-capital-neighborhood',
    history: [
      { role: 'lead', content: 'Só para mim, tenho 46 anos e vou usar o plano em Vitória.' },
    ],
    candidate: 'Em qual bairro de Vitória você pretende usar o plano?',
    handoff: null,
    review: 'Preservar a coleta de bairro quando existe uma única capital principal de utilização.',
  },
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
