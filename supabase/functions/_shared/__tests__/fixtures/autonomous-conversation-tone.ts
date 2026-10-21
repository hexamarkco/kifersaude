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
    key: 'single-capital-without-neighborhood',
    history: [
      { role: 'lead', content: 'Só para mim, tenho 46 anos e vou usar o plano em Vitória.' },
    ],
    candidate: 'Você tem CNPJ ou MEI? Dependendo do caso, pode ficar mais em conta.',
    handoff: null,
    review: 'Avançar sem exigir bairro automaticamente em uma capital.',
  },
  {
    key: 'confused-by-neighborhood-with-landmark',
    history: [
      { role: 'lead', content: 'Sou eu e filha' },
      { role: 'lead', content: 'Ou só pra mim' },
      { role: 'lead', content: '54\n26' },
      { role: 'lead', content: 'Idades' },
      { role: 'ai', content: 'Podemos avaliar as duas possibilidades. Em qual cidade vocês precisam de atendimento?' },
      { role: 'lead', content: 'Porto Alegre' },
      { role: 'ai', content: 'Em qual bairro vocês precisam de atendimento?' },
      { role: 'lead', content: 'Como assim' },
      { role: 'lead', content: 'Eu moro na zona perto Iguatemi shopping' },
    ],
    candidate: 'Perguntei só para entender o que fica mais perto de vocês, mas essa referência já ajuda. Você ou sua filha têm CNPJ ou MEI? Dependendo do caso, pode ficar mais em conta.',
    handoff: null,
    review: 'Explicar com delicadeza, aceitar a referência, preservar as duas possibilidades e idades, sem inventar bairro, pedir UF ou repetir perguntas respondidas.',
  },
  {
    key: 'national-service-not-national-plan',
    history: [
      { role: 'lead', content: 'Vocês atendem Manaus? Todo plano de vocês atende no Brasil inteiro?' },
    ],
    candidate: 'Atendemos Manaus, sim. A cobertura depende do plano, então preciso verificar as opções para as regiões onde você quer usar. O plano seria só para você?',
    handoff: null,
    review: 'Acolher outra região sem prometer cobertura nacional de todos os produtos nem inventar disponibilidade local.',
  },
  {
    key: 'ambiguous-city-asks-state-once',
    history: [
      { role: 'lead', content: 'Só para mim, 38 anos, vou usar em Santa Helena.' },
    ],
    candidate: 'Em qual estado fica a Santa Helena onde você precisa de atendimento?',
    handoff: null,
    review: 'Esclarecer cidade homônima sem deduzir UF pelo DDD ou pedir endereço.',
  },
  {
    key: 'state-required-even-without-apparent-ambiguity',
    history: [
      { role: 'lead', content: 'Só para mim, 38 anos. Moro em Campinas. Não tenho CNPJ nem MEI e não tenho plano.' },
    ],
    candidate: 'Para verificar as opções nacionais e regionais, em qual estado você precisa de atendimento?',
    handoff: null,
    review: 'Pedir a UF ausente antes de concluir, sem repetir cidade, exigir bairro ou presumir estado pelo DDD.',
  },
  {
    key: 'capital-completion-without-neighborhood',
    history: [
      { role: 'lead', content: 'Só para mim, 54 anos, Porto Alegre. Não tenho CNPJ nem MEI e não tenho plano.' },
    ],
    candidate: 'Vou verificar as opções para atendimento em Porto Alegre e te enviar a cotação. [[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]',
    handoff: 'QUALIFICACAO_COMPLETA',
    review: 'Concluir em capital sem exigir bairro nem inventar cobertura ou preços.',
  },
  {
    key: 'neighborhood-only-for-explicit-proximity',
    history: [
      { role: 'lead', content: 'Tenho 54 anos e moro em Porto Alegre. Quero algo perto de casa porque tenho dificuldade de deslocamento.' },
    ],
    candidate: 'Vamos olhar essa proximidade com cuidado. Você tem algum bairro ou ponto de referência para eu verificar as opções por perto?',
    handoff: null,
    review: 'Perguntar localização mais específica quando há uma necessidade concreta, sem prometer rede ou usar intimidade forçada.',
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
