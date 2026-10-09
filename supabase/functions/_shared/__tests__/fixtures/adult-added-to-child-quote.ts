import type { QualificationMessage } from '../../ai-autonomous-qualification.ts';

// Synthetic regression based on a child-only quote that later includes a wife.
export const adultAddedToChildQuote: QualificationMessage[] = [
  { role: 'lead', content: 'Já temos plano da empresa, mas procuro um plano apenas para meu filho de 4 anos e oito meses. Um plano não caro.' },
  { role: 'ai', content: 'Algum adulto também entraria na cotação?' },
  { role: 'lead', content: 'Aí já vai ficar caro pois para mim e minha esposa nosso plano atende bem.' },
  { role: 'ai', content: 'Em qual cidade seu filho precisa de atendimento?' },
  { role: 'lead', content: 'Volta Redonda' },
  { role: 'ai', content: 'Qual é a operadora do plano atual?' },
  { role: 'lead', content: 'Liv Saúde, plano da empresa.' },
  { role: 'ai', content: 'Você gostaria de ver uma cotação incluindo um adulto?' },
  { role: 'lead', content: 'Pode ser' },
  { role: 'ai', content: 'Qual de vocês entraria na cotação junto com seu filho?' },
  { role: 'lead', content: 'Minha esposa tem 39 anos' },
];
