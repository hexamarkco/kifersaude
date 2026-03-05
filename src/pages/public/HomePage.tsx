import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Building2,
  CheckCircle2,
  Clock3,
  FileSearch,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicSeo from '../../components/public/PublicSeo';

const credibilityCards = [
  {
    title: '+3.200 familias orientadas',
    description: 'Historico de atendimentos consultivos em contratacao, revisao e migracao de plano.',
    Icon: Users,
  },
  {
    title: 'Retorno no mesmo dia util',
    description: 'Triagem agil para entender perfil, urgencia, territorio de uso e faixa de investimento.',
    Icon: Clock3,
  },
  {
    title: 'Comparativo tecnico e claro',
    description: 'Rede, carencia, coparticipacao e reajuste apresentados em linguagem objetiva.',
    Icon: FileSearch,
  },
  {
    title: 'Pos-venda de verdade',
    description: 'Acompanhamento operacional depois da assinatura para manter tranquilidade no uso.',
    Icon: ShieldCheck,
  },
];

const solutionCards = [
  {
    title: 'Guia de tipos de plano',
    description: 'Entenda quando vale PF, familiar, MEI ou empresarial e quais trade-offs observar.',
    to: '/planos',
    Icon: Stethoscope,
  },
  {
    title: 'Comparativo de operadoras',
    description: 'Visao pratica sobre rede, abrangencia e perfil indicado para cada operadora.',
    to: '/operadoras',
    Icon: Building2,
  },
  {
    title: 'Processo sem surpresa',
    description: 'Veja etapa por etapa da cotacao, envio de documentos, proposta e ativacao.',
    to: '/como-funciona',
    Icon: BadgeCheck,
  },
  {
    title: 'Conteudo educativo',
    description: 'Artigos e FAQ para tomar decisao com clareza, sem depender de achismo.',
    to: '/faq',
    Icon: BookOpenText,
  },
];

const journeySteps = [
  {
    title: 'Diagnostico do perfil',
    description:
      'Mapeamos faixa etaria, cidades de uso, historico recente, tipo de atendimento desejado e faixa de investimento mensal.',
  },
  {
    title: 'Curadoria de opcoes viaveis',
    description:
      'Filtramos planos que realmente fazem sentido para o perfil, evitando combinacoes que parecem baratas mas travam no uso.',
  },
  {
    title: 'Comparativo transparente',
    description:
      'Apresentamos rede, carencias, regras de coparticipacao, reajuste e pontos de atencao em linguagem simples.',
  },
  {
    title: 'Apoio na contratacao',
    description:
      'Acompanhamos proposta, assinatura e retorno de pendencias documentais para acelerar aprovacao com a operadora.',
  },
  {
    title: 'Suporte no pos-venda',
    description:
      'Continuamos no atendimento para duvidas de uso, orientacao de acesso e ajustes que surgem ao longo da vigencia.',
  },
];

const premiumPillars = [
  {
    title: 'Decisao guiada por contexto real',
    text: 'Cada recomendacao considera o seu comportamento de uso, cidade de atendimento e previsibilidade financeira.',
  },
  {
    title: 'Comunicacao transparente desde o inicio',
    text: 'Mostramos vantagens e limitacoes de cada alternativa antes da assinatura, sem letra miuda.',
  },
  {
    title: 'Relacao de longo prazo',
    text: 'Seguimos disponiveis no pos-venda para ajustes, orientacoes e manutencao da qualidade de atendimento.',
  },
];

const cityGroups = [
  {
    region: 'Capital e Zona Sul',
    areas: 'Copacabana, Botafogo, Tijuca, Barra, Recreio e bairros adjacentes.',
    path: '/rio-de-janeiro',
  },
  {
    region: 'Zona Norte e Oeste',
    areas: 'Meier, Madureira, Campo Grande, Bangu, Jacarepagua e entorno.',
    path: '/rio-de-janeiro',
  },
  {
    region: 'Niteroi',
    areas: 'Comparativo local com foco em rede regional e deslocamento entre Niteroi e capital.',
    path: '/niteroi',
  },
  {
    region: 'Sao Goncalo',
    areas: 'Analise orientada para uso intermunicipal e cobertura aderente ao cotidiano da regiao.',
    path: '/sao-goncalo',
  },
  {
    region: 'Baixada Fluminense',
    areas: 'Duque de Caxias, Nova Iguacu, Belford Roxo, Nilopolis e cidades proximas.',
    path: '/baixada-fluminense',
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Kifer Saude | Consultoria completa em planos de saude no RJ"
        description="Site oficial multipaginas da Kifer Saude. Compare planos, operadoras, etapas de contratacao e tire duvidas com atendimento consultivo no Rio de Janeiro."
        canonicalPath="/"
        breadcrumbs={[{ name: 'Inicio', path: '/' }]}
      />

      <section className="relative overflow-hidden px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="public-fade-up">
              <p className="public-kicker">Consultoria premium no Rio de Janeiro</p>
              <h1 className="public-display mt-5 text-5xl font-semibold leading-tight text-slate-900 md:text-6xl">
                Um novo nivel de clareza para escolher seu plano de saude.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                A Kifer Saude evoluiu para uma experiencia completa: conteudo aprofundado, comparativo tecnico e
                atendimento consultivo para quem quer decidir com seguranca, sem improviso e sem discurso comercial vazio.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/cotacao"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-700 to-orange-600 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-amber-900/25 transition hover:from-amber-800 hover:to-orange-700"
                >
                  Quero minha consultoria
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/como-funciona"
                  className="inline-flex items-center rounded-2xl border border-amber-900/20 bg-white/90 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-white"
                >
                  Conhecer o metodo
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-amber-900/15 bg-white/85 p-4 text-sm font-semibold text-slate-700">
                  Rede por territorio
                </div>
                <div className="rounded-2xl border border-amber-900/15 bg-white/85 p-4 text-sm font-semibold text-slate-700">
                  Custo anual projetado
                </div>
                <div className="rounded-2xl border border-amber-900/15 bg-white/85 p-4 text-sm font-semibold text-slate-700">
                  Suporte no pos-venda
                </div>
              </div>
            </div>

            <article className="public-surface-card public-fade-up public-fade-up-delay-2 rounded-[2rem] p-8">
              <p className="public-kicker">Diagnostico estrategico</p>
              <h2 className="public-display mt-3 text-4xl font-semibold text-slate-900">Decisao premium, com criterio.</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Nosso papel nao e vender o plano mais caro. E desenhar a escolha mais inteligente entre cobertura,
                rede, previsibilidade e objetivo real de uso da sua familia ou empresa.
              </p>

              <ul className="mt-6 space-y-4">
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Explicacao clara de carencia, coparticipacao e reajuste, sem jargao tecnico.
                </li>
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Comparativo orientado por perfil de uso, e nao por preco de entrada.
                </li>
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Acompanhamento de proposta, pendencias e ativacao com suporte continuo.
                </li>
              </ul>

              <div className="mt-7 grid grid-cols-3 gap-3 border-t border-amber-900/15 pt-5 text-center">
                <div>
                  <p className="text-2xl font-black text-slate-900">98%</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Aderencia de rede</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">4.9</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Avaliacao media</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">24h</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Primeiro retorno</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {credibilityCards.map(({ title, description, Icon }, index) => (
            <article
              key={title}
              className={`public-surface-card public-fade-up rounded-2xl p-6 ${index === 1 ? 'public-fade-up-delay-1' : ''} ${index === 2 ? 'public-fade-up-delay-2' : ''} ${index === 3 ? 'public-fade-up-delay-3' : ''}`}
            >
              <span className="mb-4 inline-flex rounded-xl bg-amber-100 p-3 text-amber-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-black text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] bg-slate-950 px-8 py-12 text-white shadow-[0_40px_80px_-52px_rgba(15,23,42,0.9)] md:px-12">
          <div className="max-w-3xl public-fade-up">
            <p className="public-kicker text-amber-200">Navegacao por necessidade</p>
            <h2 className="public-display mt-4 text-4xl font-semibold leading-tight md:text-5xl">
              Explore paginas estrategicas para cada tipo de decisao.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Estruturamos o site por dores reais de contratacao. Assim, voce aprofunda apenas o que importa para o seu contexto.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {solutionCards.map(({ title, description, to, Icon }, index) => (
              <Link
                key={title}
                to={to}
                className={`group rounded-2xl border border-white/15 bg-white/5 p-6 transition hover:border-amber-200/45 hover:bg-white/10 public-fade-up ${index === 1 ? 'public-fade-up-delay-1' : ''} ${index === 2 ? 'public-fade-up-delay-2' : ''} ${index === 3 ? 'public-fade-up-delay-3' : ''}`}
              >
                <span className="inline-flex rounded-xl bg-amber-200/10 p-3 text-amber-200">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{description}</p>
                <span className="mt-5 inline-flex items-center text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                  Acessar pagina
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr]">
          <div className="public-fade-up">
            <p className="public-kicker">Metodo concierge</p>
            <h2 className="public-display mt-4 text-5xl font-semibold text-slate-900">Como conduzimos cada etapa da sua decisao.</h2>
            <p className="mt-4 text-slate-600">
              O processo foi desenhado para reduzir incerteza, eliminar comparacoes rasas e elevar a qualidade da sua escolha.
              Voce entende o que esta contratando antes de assinar.
            </p>
            <Link
              to="/como-funciona"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-amber-900/25 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-slate-50"
            >
              Ver o processo detalhado
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {journeySteps.map((step, index) => (
              <article
                key={step.title}
                className={`public-surface-card public-fade-up rounded-2xl p-6 ${index === 1 ? 'public-fade-up-delay-1' : ''} ${index >= 2 ? 'public-fade-up-delay-2' : ''}`}
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Etapa {index + 1}</p>
                <h3 className="mt-2 text-lg font-black text-slate-900">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="public-kicker">Inteligencia regional</p>
              <h2 className="public-display mt-3 text-5xl font-semibold text-slate-900">Regioes com maior demanda no RJ</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Atendemos clientes em todo o estado, com foco especial nas regioes onde comparativo de rede hospitalar e
              deslocamento fazem mais diferenca na rotina.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {cityGroups.map((city, index) => (
              <Link
                key={city.region}
                to={city.path}
                className={`group public-surface-card public-fade-up rounded-2xl p-6 transition hover:-translate-y-1 ${index === 1 ? 'public-fade-up-delay-1' : ''} ${index === 2 ? 'public-fade-up-delay-2' : ''} ${index >= 3 ? 'public-fade-up-delay-3' : ''}`}
              >
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <MapPin className="h-4 w-4 text-amber-700" />
                  {city.region}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{city.areas}</p>
                <span className="mt-4 inline-flex items-center text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                  Ver guia da regiao
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl public-fade-up">
            <p className="public-kicker">Padrao de atendimento</p>
            <h2 className="public-display mt-3 text-5xl font-semibold text-slate-900">O que voce encontra em uma consultoria premium</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {premiumPillars.map((pillar, index) => (
              <article
                key={pillar.title}
                className={`public-surface-card public-fade-up rounded-2xl p-7 ${index === 1 ? 'public-fade-up-delay-1' : ''} ${index === 2 ? 'public-fade-up-delay-2' : ''}`}
              >
                <h3 className="text-xl font-black text-slate-900">{pillar.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{pillar.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-amber-700 via-orange-600 to-amber-500 p-10 text-white shadow-[0_32px_70px_-42px_rgba(131,83,26,0.72)] md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="public-kicker text-amber-100">Pronto para elevar o padrao da sua escolha?</p>
              <h2 className="public-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                Receba um comparativo estrategico para o seu perfil.
              </h2>
              <p className="mt-4 max-w-2xl text-orange-50">
                Se voce ja sabe o que precisa ou ainda esta no inicio, nossa equipe organiza sua analise e explica as
                melhores opcoes de forma objetiva. Sem pressa comercial, com criterio tecnico e humano.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-amber-800 transition hover:bg-orange-50"
              >
                Solicitar cotacao personalizada
              </Link>
              <Link
                to="/contato"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
              >
                Ver canais de contato
              </Link>
              <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
                <HeartHandshake className="h-4 w-4" />
                Atendimento humano de ponta a ponta
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
