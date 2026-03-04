import { Helmet } from 'react-helmet';
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

const highlights = [
  {
    title: '+3.200 familias orientadas',
    description: 'Atendimento consultivo para contratacao nova, portabilidade e revisao de contrato.',
    Icon: Users,
  },
  {
    title: 'Resposta em minutos',
    description: 'Contato rapido no WhatsApp para triagem inicial e organizacao da cotacao.',
    Icon: Clock3,
  },
  {
    title: 'Rede e carencia explicadas',
    description: 'Traduzimos regras de cobertura, coparticipacao e reajuste de forma objetiva.',
    Icon: FileSearch,
  },
  {
    title: 'Pos-venda ativo',
    description: 'Suporte depois da assinatura para segunda via, ajuste e orientacoes de uso.',
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

const cityGroups = [
  {
    region: 'Capital e Zona Sul',
    areas: 'Copacabana, Botafogo, Tijuca, Barra, Recreio e bairros adjacentes.',
  },
  {
    region: 'Zona Norte e Oeste',
    areas: 'Meier, Madureira, Campo Grande, Bangu, Jacarepagua e entorno.',
  },
  {
    region: 'Niteroi e Sao Goncalo',
    areas: 'Atendimento remoto com foco em rede local e deslocamento intermunicipal.',
  },
  {
    region: 'Baixada Fluminense',
    areas: 'Duque de Caxias, Nova Iguacu, Belford Roxo, Nilopolis e cidades proximas.',
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Kifer Saude | Consultoria completa em planos de saude no RJ</title>
        <meta
          name="description"
          content="Site oficial multipaginas da Kifer Saude. Compare planos, operadoras, etapas de contratacao e tire duvidas com atendimento consultivo no Rio de Janeiro."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/" />
      </Helmet>

      <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -right-16 top-24 h-72 w-72 rounded-full bg-amber-200/50 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-orange-600">
                Atendimento consultivo no estado do RJ
              </span>
              <h1 className="mt-6 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
                Um portal completo para escolher seu plano de saude com seguranca.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                A Kifer Saude deixou de ser apenas uma landing page e passou a reunir conteudo aprofundado por tema,
                comparativos praticos e orientacao real para quem precisa contratar, revisar ou migrar plano de saude.
                Aqui voce encontra criterio tecnico e linguagem humana na mesma medida.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/cotacao"
                  className="inline-flex items-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
                >
                  Quero minha cotacao
                </Link>
                <Link
                  to="/como-funciona"
                  className="inline-flex items-center rounded-2xl border border-orange-200 bg-white px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
                >
                  Entender o processo
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-orange-100 bg-white/95 p-8 shadow-2xl shadow-orange-100">
              <p className="text-sm font-black uppercase tracking-[0.14em] text-orange-600">Foco da consultoria</p>
              <h2 className="mt-3 text-2xl font-black text-slate-900">Decisao certa antes da assinatura</h2>
              <p className="mt-4 text-slate-600">
                Nosso trabalho nao e empurrar o plano mais caro. E montar o melhor equilibrio entre rede, cobertura,
                previsibilidade de custo e objetivo de uso da sua familia ou empresa.
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  Explicacao clara de carencia, coparticipacao, reajuste e abrangencia sem jargao tecnico.
                </li>
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  Comparativos orientados por perfil de uso e nao apenas por preco de entrada.
                </li>
                <li className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  Acompanhamento durante proposta, pendencias documentais e ativacao do plano.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map(({ title, description, Icon }) => (
            <article key={title} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-lg shadow-orange-50">
              <span className="mb-4 inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-black text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Navegacao por necessidade</p>
            <h2 className="mt-4 text-3xl font-black leading-tight md:text-4xl">
              Explore as paginas do novo site e aprofunde o que realmente importa para sua decisao.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {solutionCards.map(({ title, description, to, Icon }) => (
              <Link
                key={title}
                to={to}
                className="group rounded-2xl border border-slate-700 bg-slate-800/80 p-6 transition hover:border-amber-300/60 hover:bg-slate-800"
              >
                <span className="inline-flex rounded-xl bg-amber-300/15 p-3 text-amber-200">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{description}</p>
                <span className="mt-5 inline-flex items-center text-sm font-black uppercase tracking-[0.12em] text-amber-200">
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
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Jornada completa</p>
            <h2 className="mt-4 text-3xl font-black text-slate-900 md:text-4xl">Como conduzimos cada atendimento</h2>
            <p className="mt-4 text-slate-600">
              Nosso metodo combina triagem objetiva com consultoria personalizada. Cada etapa existe para reduzir risco
              de arrependimento e evitar contratacao desalinhada com o uso real do plano.
            </p>
            <Link
              to="/como-funciona"
              className="mt-8 inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
            >
              Ver o processo detalhado
            </Link>
          </div>
          <div className="space-y-4">
            {journeySteps.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Etapa {index + 1}</p>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Cobertura de atendimento</p>
              <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Regioes com maior demanda no RJ</h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Atendemos clientes em todo o estado, com foco especial nas regioes onde comparativo de rede hospitalar e
              deslocamento fazem mais diferenca na rotina.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {cityGroups.map((city) => (
              <article key={city.region} className="rounded-2xl border border-orange-100 bg-orange-50/50 p-6">
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  {city.region}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{city.areas}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-100">Pronto para decidir com clareza?</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba um comparativo orientado para seu perfil e avance com seguranca.
              </h2>
              <p className="mt-4 max-w-2xl text-orange-50">
                Se voce ja sabe o que precisa ou ainda esta no inicio, nossa equipe organiza sua analise e explica as
                melhores opcoes de forma objetiva. Sem pressa comercial, com criterio tecnico e humano.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
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
