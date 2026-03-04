import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, BarChart3, CheckCircle2, HeartPulse, MessageSquareQuote, Star } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const testimonials = [
  {
    name: 'Regina S.',
    profile: 'Familia com 3 vidas',
    context:
      'Queria sair de um plano caro sem perder acesso aos hospitais que a familia ja utilizava no Rio de Janeiro.',
    result:
      'Conseguiu migracao com melhor custo total e manteve rede relevante para rotina de consultas e exames.',
  },
  {
    name: 'Marcelo R.',
    profile: 'MEI na area de servicos',
    context:
      'Precisava contratar plano empresarial com agilidade, sem conhecimento tecnico sobre regras de elegibilidade.',
    result:
      'Fechou contrato alinhado ao caixa da empresa e recebeu suporte completo de documentacao ate aprovacao.',
  },
  {
    name: 'Ana Paula F.',
    profile: 'Transicao de plano corporativo para individual',
    context:
      'Perdeu o beneficio do emprego e precisava de alternativa que preservasse previsibilidade financeira.',
    result:
      'Escolheu novo plano com orientacao de cobertura e carencia, evitando decisao por pressa.',
  },
  {
    name: 'Carlos E.',
    profile: 'Empresa com equipe enxuta',
    context:
      'Queria oferecer beneficio de saude para reter time, mas tinha receio de burocracia contratual.',
    result:
      'Estruturou contratacao com governanca cadastral e suporte para manutencao no pos-venda.',
  },
  {
    name: 'Juliana O.',
    profile: 'Familia em fase de planejamento',
    context:
      'Precisava entender diferencas entre opcoes familiares sem cair em comparativos rasos de preco.',
    result:
      'Recebeu analise por fase de vida e contratou plano aderente ao uso esperado dos proximos anos.',
  },
  {
    name: 'André L.',
    profile: 'Autonomo, uso frequente de exames',
    context:
      'Queria previsibilidade de custo e atendimento em rede especifica para acompanhamento recorrente.',
    result:
      'Escolheu modelo financeiro mais adequado ao seu perfil de uso, reduzindo variacao de gasto mensal.',
  },
];

const indicators = [
  {
    label: 'Clientes atendidos',
    value: '+3.200',
    detail: 'Historico de atendimentos com foco em consultoria e acompanhamento de ponta a ponta.',
    Icon: BadgeCheck,
  },
  {
    label: 'Avaliacao media percebida',
    value: '4.9/5',
    detail: 'Feedback recorrente sobre clareza no processo e atencao no pos-venda.',
    Icon: Star,
  },
  {
    label: 'Perfis atendidos',
    value: 'PF, familia, MEI e CNPJ',
    detail: 'Modelos de contratacao variados com recomendacoes ajustadas por objetivo de uso.',
    Icon: HeartPulse,
  },
  {
    label: 'Tempo de retorno inicial',
    value: 'Mesmo dia util',
    detail: 'Contato agil para triagem e definicao do melhor caminho de comparacao.',
    Icon: BarChart3,
  },
];

const reasons = [
  'Explicacao clara de vantagens e riscos de cada opcao, sem esconder pontos sensiveis do contrato.',
  'Comparativo orientado para uso real e nao para vitrine comercial de curto prazo.',
  'Acompanhamento em etapas criticas de proposta, pendencias e ativacao do plano.',
  'Suporte continuo no pos-venda para manter seguranca na jornada do cliente.',
];

export default function DepoimentosPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Depoimentos | Historias reais de clientes Kifer Saude"
        description="Veja relatos reais de familias e empresas atendidas pela Kifer Saude e entenda como nosso processo consultivo gera decisoes mais seguras."
        canonicalPath="/depoimentos"
        breadcrumbs={[{ name: 'Depoimentos', path: '/depoimentos' }]}
      />
      <PublicBreadcrumbs items={[{ name: 'Depoimentos', path: '/depoimentos' }]} />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Prova social</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Casos reais de quem precisou decidir plano com seguranca e suporte de verdade.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Cada cliente chega com uma realidade diferente. O que se repete e a necessidade de clareza, comparativo
            honesto e apoio durante toda a jornada. Aqui reunimos alguns cenarios que representam nosso dia a dia.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                <MessageSquareQuote className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-xl font-black text-slate-900">{testimonial.name}</h2>
              <p className="text-sm font-semibold text-orange-600">{testimonial.profile}</p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-900">Contexto: </strong>
                {testimonial.context}
              </p>
              <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-700">
                <strong className="text-orange-800">Resultado: </strong>
                {testimonial.result}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Indicadores</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Resultados percebidos pelos clientes</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {indicators.map(({ label, value, detail, Icon }) => (
              <article key={label} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-7">
                <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-slate-700">{label}</p>
                <h3 className="mt-2 text-3xl font-black text-slate-900">{value}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">Por que esses resultados se repetem</h2>
            <ul className="mt-6 space-y-4">
              {reasons.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">Atendimento com acompanhamento real</h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Nosso compromisso nao e apenas indicar uma opcao e seguir para o proximo atendimento. Acompanhamos a
              contratacao, ajudamos em pendencias e ficamos presentes no pos-venda para garantir que o plano funcione
              no cotidiano da familia ou empresa.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Esse cuidado operacional e um dos fatores que mais aparecem nos depoimentos de quem escolhe a Kifer Saude.
            </p>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Quer viver essa experiencia</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Vamos construir seu comparativo com o mesmo nivel de cuidado.
              </h2>
              <p className="mt-4 text-orange-50">
                Conte seu contexto e receba orientacao completa para contratar com seguranca.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar minha cotacao
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/contato"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Falar com a equipe
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
