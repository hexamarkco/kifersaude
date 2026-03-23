import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  HeartPulse,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';

type RouteProfile = 'pf' | 'pme' | 'adesao';

const heroSignals = [
  {
    value: '+3.200',
    label: 'atendimentos consultivos',
    text: 'Jornadas conduzidas com comparativo tecnico e apoio ate a contratacao.',
  },
  {
    value: 'Mesmo dia',
    label: 'primeiro retorno',
    text: 'Triagem rapida para sair da duvida e entrar em um recorte viavel.',
  },
  {
    value: 'PF | PME | Adesao',
    label: 'frentes de atuacao',
    text: 'Cada modalidade pede uma leitura diferente de rede, regra e custo.',
  },
];

const decisionRows = [
  {
    title: 'Perfil',
    text: 'PF, familia, PME, socios ou adesao.',
  },
  {
    title: 'Territorio de uso',
    text: 'Bairro, cidade, hospitais e laboratorios que importam para sua rotina.',
  },
  {
    title: 'Conta real',
    text: 'Mensalidade, coparticipacao, reajuste e horizonte de medio prazo.',
  },
  {
    title: 'Entrega',
    text: 'Recomendacao principal, alternativa de seguranca e apoio na proposta.',
  },
];

const differenceCards: Array<{
  number: string;
  title: string;
  text: string;
  Icon: typeof BadgeCheck;
}> = [
  {
    number: '01',
    title: 'Rede antes da marca',
    text: 'Nao adianta comecar pela operadora se o produto nao encaixa no territorio onde voce realmente usa o plano.',
    Icon: HeartPulse,
  },
  {
    number: '02',
    title: 'Custo total antes do preco de entrada',
    text: 'Mensalidade bonita sozinha engana. A leitura precisa incluir coparticipacao, reajuste e faixa etaria.',
    Icon: Landmark,
  },
  {
    number: '03',
    title: 'Pos-venda como parte da entrega',
    text: 'Apoio em proposta, pendencias e ativacao para a decisao virar uso sem atrito desnecessario.',
    Icon: ShieldCheck,
  },
];

const processSteps: Array<{
  step: string;
  title: string;
  text: string;
  Icon: typeof ClipboardCheck;
}> = [
  {
    step: '01',
    title: 'Briefing',
    text: 'Mapeamos vidas, cidade, uso esperado e faixa de investimento.',
    Icon: ClipboardCheck,
  },
  {
    step: '02',
    title: 'Curadoria',
    text: 'Filtramos produtos por modalidade, elegibilidade e coerencia de rede.',
    Icon: FileCheck2,
  },
  {
    step: '03',
    title: 'Comparativo',
    text: 'Voce recebe leitura clara de vantagem, risco e ponto de atencao.',
    Icon: BadgeCheck,
  },
  {
    step: '04',
    title: 'Contratacao assistida',
    text: 'Acompanhamos proposta, documentacao e ativacao.',
    Icon: CheckCircle2,
  },
];

const routes: Array<{
  slug: string;
  profile: RouteProfile;
  title: string;
  text: string;
  bullets: string[];
  tone: 'light' | 'dark' | 'accent';
}> = [
  {
    slug: 'PF',
    profile: 'pf',
    title: 'Pessoa fisica e familia',
    text: 'Para quem quer previsibilidade sem cair na armadilha de fechar apenas pelo menor valor anunciado.',
    bullets: [
      'Comparativo por uso real e nao por ranking generico.',
      'Leitura clara de carencias, rede e coparticipacao.',
      'Recomendacao principal com alternativa de seguranca.',
    ],
    tone: 'light',
  },
  {
    slug: 'PME',
    profile: 'pme',
    title: 'PME, socios e CNPJ',
    text: 'Para empresas que querem estruturar beneficio de saude com mais criterio e menos improviso documental.',
    bullets: [
      'Triagem de elegibilidade e composicao do grupo.',
      'Leitura do custo total por perfil da equipe.',
      'Suporte do briefing ate a ativacao do beneficio.',
    ],
    tone: 'dark',
  },
  {
    slug: 'AD',
    profile: 'adesao',
    title: 'Coletivo por adesao',
    text: 'Para perfis elegiveis que precisam equilibrar regra de entrada, rede e custo com orientacao tecnica.',
    bullets: [
      'Checagem de entidade e documentacao de acesso.',
      'Comparativo tecnico entre opcoes de adesao.',
      'Acompanhamento da proposta ao uso inicial do plano.',
    ],
    tone: 'accent',
  },
];

const criteriaRows = [
  {
    label: 'Rede credenciada',
    text: 'A validacao precisa acontecer no produto, na categoria e no territorio corretos.',
  },
  {
    label: 'Carencias e transicao',
    text: 'Mudanca de plano, saida de beneficio corporativo e historico recente alteram a estrategia.',
  },
  {
    label: 'Coparticipacao',
    text: 'Em baixo uso pode ajudar. Em rotina intensa, pode desorganizar a conta sem que isso fique obvio no inicio.',
  },
  {
    label: 'Faixa etaria',
    text: 'A decisao precisa considerar sustentabilidade de medio prazo, nao apenas o primeiro boleto.',
  },
  {
    label: 'Operacao e suporte',
    text: 'Tempo de resposta, clareza comercial e pos-venda tambem pesam no resultado final.',
  },
];

const operatorLogos = [
  { src: '/amil-logo-1-2.png', alt: 'Amil', height: 'h-7' },
  { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saude', height: 'h-9' },
  { src: '/sulamerica-saude-logo.png', alt: 'SulAmerica Saude', height: 'h-8' },
  { src: '/porto-logo.png', alt: 'Porto', height: 'h-6' },
  { src: '/assim-saude-logo.png', alt: 'Assim Saude', height: 'h-6' },
];

const faqItems: PublicFaqItem[] = [
  {
    question: 'A consultoria tem custo para quem esta buscando plano?',
    answer:
      'Nao. O atendimento consultivo para PF, PME e adesao e gratuito para o cliente final e inclui triagem, comparativo e apoio no processo de contratacao.',
  },
  {
    question: 'Como voces validam se a rede realmente atende minha regiao?',
    answer:
      'A confirmacao acontece no produto especifico, na categoria correta e no territorio informado. Isso evita resposta generica baseada apenas no nome da operadora.',
  },
  {
    question: 'Voces atendem apenas pessoa fisica?',
    answer:
      'Nao. A Kifer atende pessoa fisica, familia, PME/CNPJ e coletivo por adesao, com estrategia adaptada ao tipo de contratacao.',
  },
  {
    question: 'O apoio termina quando a proposta e assinada?',
    answer:
      'Nao. O pos-venda faz parte da entrega, com apoio em pendencias, ativacao e primeiros passos de uso.',
  },
];

const routeToneClasses: Record<(typeof routes)[number]['tone'], string> = {
  light: 'home-v2-card border-[color:var(--home-v2-line)] bg-white text-stone-950',
  dark: 'home-v2-dark-block border-white/10 text-white',
  accent: 'home-v2-accent-block border-[color:var(--home-v2-line-strong)] text-stone-950',
};

export default function HomePage() {
  return (
    <div className="home-v2-theme min-h-screen overflow-x-hidden">
      <PublicSeo
        title="Kifer Saude | Consultoria para planos de saude no RJ"
        description="Consultoria da Kifer Saude para PF, PME e adesao com comparativo tecnico, leitura de rede por territorio e apoio humano ate a contratacao."
        canonicalPath="/"
        faqItems={faqItems}
      />

      <a href="#conteudo" className="home-v2-skip-link">
        Pular para o conteudo
      </a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--home-v2-line)] bg-[rgba(247,243,236,0.9)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--home-v2-line-strong)] bg-white text-[color:var(--home-v2-accent)] shadow-[0_16px_30px_-20px_rgba(32,23,19,0.35)]">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span>
              <span className="home-v2-heading block text-[1.7rem] font-bold leading-none text-stone-950">Kifer Saude</span>
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.26em] text-[color:var(--home-v2-muted)]">
                consultoria em saude suplementar
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[color:var(--home-v2-muted)] lg:flex">
            <a href="#diferenciais" className="home-v2-link">
              Diferenciais
            </a>
            <a href="#metodo" className="home-v2-link">
              Metodo
            </a>
            <a href="#rotas" className="home-v2-link">
              Rotas
            </a>
            <a href="#faq" className="home-v2-link">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a href="tel:+5521979302389" className="hidden text-sm font-semibold text-stone-700 xl:inline-flex">
              (21) 97930-2389
            </a>
            <Link to="/lp" className="home-v2-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold">
              Quero cotar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="pb-20 pt-24 md:pt-28">
        <section className="px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-14 lg:pt-8">
          <div className="mx-auto max-w-7xl">
            <div className="home-v2-dark-block home-v2-shell relative overflow-hidden rounded-[2.5rem] border p-6 md:p-8 xl:p-10">
              <div aria-hidden="true" className="home-v2-orb home-v2-orb-primary absolute left-[-7rem] top-[-5rem] h-48 w-48 rounded-full" />
              <div aria-hidden="true" className="home-v2-orb home-v2-orb-secondary absolute right-[-5rem] top-10 h-64 w-64 rounded-full" />

              <div className="relative space-y-8 xl:space-y-10">
                <div className="home-v2-reveal max-w-5xl">
                  <span className="home-v2-kicker text-[color:var(--home-v2-accent-soft)]">consultoria forte, sem layout generico</span>
                  <h1 className="home-v2-heading mt-5 max-w-4xl text-5xl font-bold leading-[0.9] text-white sm:text-6xl xl:text-[4.8rem]">
                    Plano de saude com criterio, e nao com chute.
                  </h1>
                  <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-300">
                    A Kifer organiza a decisao do jeito certo: rede por territorio, regra de contratacao, custo total e apoio humano
                    do briefing ate a assinatura.
                  </p>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to="/lp"
                      className="home-v2-button-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
                    >
                      Receber comparativo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/planos"
                        className="home-v2-button-secondary-dark inline-flex items-center rounded-full px-6 py-3.5 text-sm font-semibold"
                    >
                      Ver guia de planos
                    </Link>
                  </div>

                  <div className="mt-8 grid gap-4 lg:grid-cols-3">
                    {heroSignals.map((signal, index) => (
                      <article
                        key={signal.label}
                        className={`rounded-[1.6rem] border border-white/10 bg-white/5 p-4 home-v2-reveal ${index === 1 ? 'home-v2-delay-1' : ''} ${index === 2 ? 'home-v2-delay-2' : ''}`}
                      >
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-stone-400">{signal.label}</p>
                        <p className="mt-3 text-2xl font-bold text-white">{signal.value}</p>
                        <p className="mt-2 text-sm leading-6 text-stone-300">{signal.text}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="home-v2-card home-v2-reveal home-v2-delay-1 mx-auto w-full max-w-5xl rounded-[2rem] p-5 md:p-6 lg:p-7">
                  <div className="max-w-3xl">
                    <span className="home-v2-kicker">mapa da decisao</span>
                    <h2 className="home-v2-heading mt-4 text-3xl font-bold leading-none text-stone-950 md:text-4xl">
                      O comparativo nasce do cruzamento certo.
                    </h2>
                    <p className="mt-4 text-base leading-8 text-[color:var(--home-v2-muted)]">
                      Antes de falar em operadora, a Kifer cruza modalidade, territorio, custo total e capacidade de suporte.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-3 lg:grid-cols-2">
                    {decisionRows.map((row) => (
                      <article key={row.title} className="rounded-[1.35rem] border border-[color:var(--home-v2-line)] bg-[rgba(247,243,236,0.88)] p-4">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--home-v2-muted)]">{row.title}</p>
                        <p className="mt-2 text-sm leading-7 text-stone-800">{row.text}</p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-6 rounded-[1.5rem] border border-[color:var(--home-v2-line)] bg-stone-950 px-4 py-4 text-sm text-stone-100">
                    <p className="flex items-center gap-2 font-semibold">
                      <Clock3 className="h-4 w-4 text-[color:var(--home-v2-accent-soft)]" />
                      Retorno inicial em horario comercial, normalmente no mesmo dia util.
                    </p>
                  </div>

                  <a
                    href="https://wa.me/5521979302389?text=Ola%2C%20quero%20um%20comparativo%20de%20plano%20de%20saude."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-v2-button-secondary-light mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Falar no WhatsApp
                  </a>
                </aside>
              </div>

              <div className="relative mt-8 rounded-[1.8rem] border border-white/10 bg-white/5 p-4 md:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-stone-400">operadoras acompanhadas</p>
                    <p className="mt-2 text-sm leading-7 text-stone-300">
                      A marca entra na analise depois do encaixe. O ponto de partida e o seu cenario.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 items-center gap-x-6 gap-y-4 sm:grid-cols-5">
                    {operatorLogos.map((logo) => (
                      <div key={logo.alt} className="flex items-center justify-center">
                        <img
                          src={logo.src}
                          alt={logo.alt}
                          loading="lazy"
                          className={`${logo.height} w-auto max-w-[7rem] object-contain opacity-80 brightness-0 invert`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="diferenciais" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="home-v2-reveal">
              <span className="home-v2-kicker">o que muda aqui</span>
              <h2 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-stone-950 md:text-6xl">
                O problema nao e falta de opcao. E excesso de opcao sem filtro.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--home-v2-muted)]">
                A home foi reposicionada para vender criterio. Em saude suplementar, o valor nao esta em mostrar muita coisa.
                Esta em mostrar o que realmente entra na decisao.
              </p>
            </div>

            <div className="grid gap-4">
              {differenceCards.map((card, index) => (
                <article
                  key={card.number}
                  className={`home-v2-card home-v2-reveal rounded-[1.8rem] p-5 md:p-6 ${index === 1 ? 'home-v2-delay-1' : ''} ${index === 2 ? 'home-v2-delay-2' : ''}`}
                >
                  <div className="grid gap-4 md:grid-cols-[5rem_1fr_auto] md:items-start">
                    <p className="home-v2-heading text-4xl font-bold leading-none text-[color:var(--home-v2-accent)] md:text-5xl">{card.number}</p>
                    <div>
                      <h3 className="text-xl font-bold text-stone-950 md:text-2xl">{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[color:var(--home-v2-muted)]">{card.text}</p>
                    </div>
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--home-v2-line)] bg-[rgba(239,228,212,0.75)] text-[color:var(--home-v2-accent)]">
                      <card.Icon className="h-5 w-5" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="home-v2-card rounded-[2.2rem] p-6 md:p-8">
              <div className="home-v2-reveal max-w-4xl">
                <span className="home-v2-kicker">metodo kifer</span>
                <h2 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-stone-950 md:text-6xl">
                  Quatro movimentos para tirar peso de uma decisao sensivel.
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-[color:var(--home-v2-muted)]">
                  Nada de empilhar tabela sem contexto. Primeiro a triagem, depois a curadoria, em seguida o comparativo e por fim a contratacao assistida.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {processSteps.map((step, index) => (
                  <article
                    key={step.step}
                    className={`rounded-[1.7rem] border border-[color:var(--home-v2-line)] bg-[rgba(247,243,236,0.8)] p-5 home-v2-reveal ${index === 1 ? 'home-v2-delay-1' : ''} ${index >= 2 ? 'home-v2-delay-2' : ''}`}
                  >
                    <div className="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)_auto] md:items-center">
                      <span className="home-v2-heading text-4xl font-bold leading-none text-[color:var(--home-v2-accent)] md:text-5xl">{step.step}</span>
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--home-v2-muted)]">etapa</p>
                        <h3 className="mt-2 text-xl font-bold text-stone-950 md:text-2xl">{step.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-[color:var(--home-v2-muted)]">{step.text}</p>
                      </div>
                      <step.Icon className="h-6 w-6 text-[color:var(--home-v2-accent)]" />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="rotas" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="max-w-3xl home-v2-reveal">
              <span className="home-v2-kicker">rotas de atendimento</span>
              <h2 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-stone-950 md:text-6xl">
                PF, PME e adesao nao podem receber a mesma resposta pronta.
              </h2>
              <p className="mt-5 text-base leading-8 text-[color:var(--home-v2-muted)]">
                Cada trilha tem regra propria, ponto de risco proprio e um jeito certo de montar o comparativo.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {routes.map((route, index) => {
                return (
                  <article
                    key={route.profile}
                    className={`${routeToneClasses[route.tone]} home-v2-reveal rounded-[2rem] border p-6 md:p-7 ${index === 1 ? 'home-v2-delay-1' : ''} ${index === 2 ? 'home-v2-delay-2' : ''}`}
                  >
                    <div className="space-y-6">
                      <div>
                        <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${route.tone === 'dark' ? 'text-stone-400' : 'text-[color:var(--home-v2-muted)]'}`}>
                          {route.slug}
                        </p>
                        <h3 className="mt-3 text-3xl font-bold leading-[0.95]">{route.title}</h3>
                      </div>

                      <div>
                        <p className={`text-base leading-8 ${route.tone === 'dark' ? 'text-stone-200' : 'text-stone-800'}`}>{route.text}</p>
                      </div>

                      <div>
                        <Link
                          to={`/lp?perfil=${route.profile}`}
                          className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${route.tone === 'dark' ? 'text-[color:var(--home-v2-accent-soft)] hover:text-white' : 'text-[color:var(--home-v2-accent)] hover:text-stone-950'}`}
                        >
                          Abrir triagem
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <ul className="space-y-3">
                          {route.bullets.map((bullet) => (
                            <li key={bullet} className={`flex gap-3 text-sm leading-7 ${route.tone === 'dark' ? 'text-stone-200' : 'text-stone-700'}`}>
                              <CheckCircle2 className={`mt-1 h-4 w-4 flex-shrink-0 ${route.tone === 'dark' ? 'text-[color:var(--home-v2-accent-soft)]' : 'text-[color:var(--home-v2-accent)]'}`} />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-4">
            <article className="home-v2-card home-v2-reveal rounded-[2rem] p-6 md:p-8">
              <span className="home-v2-kicker">o que entra na analise</span>
              <h2 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-stone-950 md:text-5xl">
                A recomendacao boa nasce de uma mesa organizada.
              </h2>

              <div className="mt-8 divide-y divide-[color:var(--home-v2-line)]">
                {criteriaRows.map((row) => (
                  <div key={row.label} className="grid gap-2 py-5 lg:grid-cols-[12rem_1fr] lg:gap-6">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--home-v2-muted)]">{row.label}</p>
                    <p className="text-sm leading-7 text-stone-700">{row.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="home-v2-card home-v2-reveal home-v2-delay-1 rounded-[2rem] p-6 md:p-7">
              <span className="home-v2-kicker">operadoras acompanhadas</span>
              <h3 className="home-v2-heading mt-5 max-w-3xl text-4xl font-bold leading-[0.95] text-stone-950">
                Marca forte ajuda. Encaixe certo decide.
              </h3>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-[color:var(--home-v2-muted)]">
                Produtos de nomes conhecidos podem entrar no comparativo, mas o ponto de partida continua sendo rede, modalidade, territorio e custo total.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {operatorLogos.map((logo) => (
                  <div key={logo.alt} className="home-v2-logo-tile flex min-h-[5.25rem] items-center justify-center rounded-[1.4rem] p-4">
                    <img src={logo.src} alt={logo.alt} loading="lazy" className={`${logo.height} w-auto max-w-[7rem] object-contain`} />
                  </div>
                ))}
              </div>
            </aside>

            <aside className="home-v2-dark-block home-v2-reveal home-v2-delay-2 rounded-[2rem] border p-6 md:p-7 text-white">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-stone-400">diretriz da casa</p>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-100">
                A Kifer nao tenta empurrar o plano mais chamativo. A consultoria filtra o que realmente fecha com o seu cenario.
              </p>
            </aside>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="max-w-3xl home-v2-reveal">
              <span className="home-v2-kicker">faq</span>
              <h2 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-stone-950 md:text-6xl">
                Perguntas que precisam estar resolvidas antes de assinar.
              </h2>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <article
                  key={item.question}
                  className={`home-v2-card home-v2-reveal rounded-[1.7rem] p-5 md:p-6 ${index === 1 ? 'home-v2-delay-1' : ''} ${index >= 2 ? 'home-v2-delay-2' : ''}`}
                >
                  <p className="text-base font-bold leading-7 text-stone-950">{item.question}</p>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--home-v2-muted)]">{item.answer}</p>
                </article>
              ))}
            </div>

            <aside className="home-v2-dark-block home-v2-reveal home-v2-delay-1 rounded-[2.2rem] border p-7 md:p-8 text-white">
              <span className="home-v2-kicker text-[color:var(--home-v2-accent-soft)]">proximo passo</span>
              <h3 className="home-v2-heading mt-5 text-4xl font-bold leading-[0.95] text-white md:text-5xl">
                Vamos montar o comparativo que faz sentido para o seu caso.
              </h3>
              <p className="mt-5 text-sm leading-8 text-stone-300">
                Se a ideia e decidir com mais seguranca, o melhor movimento agora e abrir o briefing. A partir dele, a Kifer organiza as opcoes certas e conduz a leitura com criterio tecnico.
              </p>

              <div className="mt-8 space-y-3">
                <Link
                  to="/lp"
                  className="home-v2-button-cream inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
                >
                  Receber comparativo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="https://wa.me/5521979302389?text=Ola%2C%20quero%20um%20comparativo%20de%20plano%20de%20saude."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-v2-button-outline inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </a>
              </div>

              <p className="mt-5 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-stone-300">
                <Clock3 className="h-4 w-4 text-[color:var(--home-v2-accent-soft)]" />
                retorno em horario comercial
              </p>
            </aside>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-8 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[color:var(--home-v2-line)] pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="home-v2-heading text-2xl font-bold text-stone-950">Kifer Saude</p>
            <p className="mt-2 text-sm text-[color:var(--home-v2-muted)]">Consultoria em saude suplementar para PF, PME e adesao no RJ.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-stone-700">
            <Link to="/planos" className="home-v2-link">
              Planos
            </Link>
            <Link to="/lp" className="home-v2-link">
              Cotacao
            </Link>
            <a href="tel:+5521979302389" className="home-v2-link">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/5521979302389?text=Ola%2C%20quero%20um%20comparativo%20de%20plano%20de%20saude."
        target="_blank"
        rel="noopener noreferrer"
        className="home-v2-fab fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_26px_46px_-24px_rgba(32,23,19,0.6)]"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
