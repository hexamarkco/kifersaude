import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  HeartPulse,
  Landmark,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';

type TrackProfile = 'pf' | 'pme' | 'adesao';

const trustSignals = [
  {
    value: '+3.200',
    label: 'jornadas orientadas',
    text: 'Comparativos conduzidos com leitura de rede, carencia, reajuste e rotina de uso.',
  },
  {
    value: 'Mesmo dia',
    label: 'primeiro retorno',
    text: 'Triagem rapida para transformar duvida em um recorte claro de possibilidades.',
  },
  {
    value: 'PF | PME | adesao',
    label: 'trilhas de contratacao',
    text: 'A recomendacao muda conforme o tipo de entrada, elegibilidade e composicao.',
  },
];

const heroChecklist = [
  'Rede validada pelo territorio onde a vida acontece, e nao por promessa generica.',
  'Custo total anual e impacto de coparticipacao antes de falar em mensalidade de vitrine.',
  'Leitura honesta de carencias, regras de entrada e suporte ate a ativacao.',
];

const manifestoCards: Array<{
  title: string;
  text: string;
  note: string;
  Icon: typeof BadgeCheck;
}> = [
  {
    title: 'Rede com territorio',
    text: 'Hospitais, laboratorios, bairros e cidades entram primeiro na analise.',
    note: 'Decisao pensada para uso real.',
    Icon: HeartPulse,
  },
  {
    title: 'Custo total, nao fachada',
    text: 'Mensalidade isolada nao basta; a conta inclui coparticipacao, reajuste e faixa etaria.',
    note: 'Mais previsibilidade para o medio prazo.',
    Icon: Landmark,
  },
  {
    title: 'Elegibilidade sem improviso',
    text: 'PF, PME e adesao seguem caminhos distintos e pedem estrategias diferentes.',
    note: 'Menos ruído e menos retrabalho.',
    Icon: Briefcase,
  },
  {
    title: 'Pos-venda como parte da entrega',
    text: 'Apoio em proposta, pendencias e primeiros passos para a contratacao virar uso.',
    note: 'A consultoria continua depois do sim.',
    Icon: ShieldCheck,
  },
];

const processChapters: Array<{
  step: string;
  title: string;
  text: string;
  deliverable: string;
  Icon: typeof ClipboardCheck;
}> = [
  {
    step: '01',
    title: 'Briefing com contexto',
    text: 'Mapeamos cidade, vidas, faixa de investimento, urgencia e historico de uso.',
    deliverable: 'Sai um recorte do que merece entrar ou sair da mesa.',
    Icon: ClipboardCheck,
  },
  {
    step: '02',
    title: 'Curadoria de opcoes',
    text: 'Filtramos produtos por modalidade, elegibilidade e coerencia de rede e custo.',
    deliverable: 'Voce recebe opcoes que fazem sentido para o seu cenario.',
    Icon: FileCheck2,
  },
  {
    step: '03',
    title: 'Comparativo guiado',
    text: 'A recomendacao principal vem acompanhada de alternativa de seguranca e leitura dos pontos sensiveis.',
    deliverable: 'A decisao fica clara, mesmo quando existem trocas de cobertura e preco.',
    Icon: BadgeCheck,
  },
  {
    step: '04',
    title: 'Contratacao assistida',
    text: 'Acompanhamos proposta, documentacao, pendencias e ativacao para reduzir atrito.',
    deliverable: 'Menos desgaste operacional e mais confianca no fechamento.',
    Icon: CheckCircle2,
  },
];

const serviceTracks: Array<{
  profile: TrackProfile;
  slug: string;
  title: string;
  summary: string;
  fit: string;
  bullets: string[];
  Icon: typeof Users;
}> = [
  {
    profile: 'pf',
    slug: 'PF',
    title: 'Pessoa fisica e familia',
    summary: 'Para quem quer previsibilidade sem cair na tentacao de fechar pelo menor valor anunciado.',
    fit: 'Faz mais sentido quando a rotina de uso, a rede desejada e a leitura de reajuste precisam entrar na mesma conta.',
    bullets: [
      'Comparativo por uso real e nao por ranking generico.',
      'Leitura clara de carencias, coparticipacao e faixa etaria.',
      'Recomendacao principal com alternativa de seguranca.',
    ],
    Icon: Users,
  },
  {
    profile: 'pme',
    slug: 'PME',
    title: 'PME, socios e CNPJ',
    summary: 'Para empresas que querem estruturar beneficio de saude com equilibrio entre cobertura e caixa.',
    fit: 'Ideal quando a elegibilidade documental e a composicao do grupo influenciam diretamente no custo-beneficio.',
    bullets: [
      'Triagem de elegibilidade e desenho de composicao.',
      'Leitura do custo total por perfil da equipe.',
      'Suporte na proposta e na ativacao do beneficio.',
    ],
    Icon: Briefcase,
  },
  {
    profile: 'adesao',
    slug: 'AD',
    title: 'Coletivo por adesao',
    summary: 'Para perfis elegiveis que precisam equilibrar rede, entrada e regra de contratacao.',
    fit: 'Funciona melhor quando a entidade correta, a cobertura esperada e o territorio de uso sao avaliados juntos.',
    bullets: [
      'Checagem de regra de entrada e documentacao.',
      'Comparativo tecnico entre opcoes de adesao.',
      'Acompanhamento do inicio ao uso inicial do plano.',
    ],
    Icon: Building2,
  },
];

const criteriaRows = [
  {
    label: 'Rede por territorio',
    text: 'A validacao precisa acontecer no produto especifico, no bairro, cidade e categoria onde voce realmente vai usar.',
  },
  {
    label: 'Carencias e reentrada',
    text: 'Mudanca de plano, transicao de beneficio e historico recente de contratacao alteram bastante o desenho ideal.',
  },
  {
    label: 'Coparticipacao',
    text: 'Em baixo uso ela pode ajudar; em uso recorrente, pode virar custo invisivel e desorganizar a conta.',
  },
  {
    label: 'Faixa etaria e horizonte',
    text: 'A escolha precisa considerar a sustentabilidade nos proximos anos, e nao so o primeiro boleto.',
  },
  {
    label: 'Suporte operacional',
    text: 'Tempo de resposta, fluxo de proposta e clareza no pos-venda tambem pesam na experiencia final.',
  },
];

const operatorLogos = [
  { src: '/amil-logo-1-2.png', alt: 'Amil', height: 'h-8' },
  { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saude', height: 'h-10' },
  { src: '/sulamerica-saude-logo.png', alt: 'SulAmerica Saude', height: 'h-9' },
  { src: '/porto-logo.png', alt: 'Porto', height: 'h-7' },
  { src: '/assim-saude-logo.png', alt: 'Assim Saude', height: 'h-7' },
];

const faqItems: PublicFaqItem[] = [
  {
    question: 'A consultoria da Kifer tem custo para quem esta buscando plano?',
    answer:
      'Nao. O atendimento consultivo para PF, PME e adesao e gratuito para o cliente final e inclui triagem, comparativo e apoio no processo de contratacao.',
  },
  {
    question: 'Como voces validam se a rede credenciada atende mesmo minha regiao?',
    answer:
      'A confirmacao acontece no produto especifico, na categoria correta e no territorio de uso informado. Isso evita respostas genericas baseadas apenas no nome da operadora.',
  },
  {
    question: 'Vocês atendem so pessoa fisica?',
    answer:
      'Nao. A Kifer atende pessoa fisica, familia, PME/CNPJ e coletivo por adesao, adaptando a estrategia conforme elegibilidade e objetivo de cobertura.',
  },
  {
    question: 'O apoio termina quando a proposta e assinada?',
    answer:
      'Nao. O pos-venda faz parte da entrega, com acompanhamento de pendencias, ativacao e duvidas operacionais dos primeiros passos.',
  },
];

export default function HomePage() {
  return (
    <div className="root-redesign-theme relative isolate min-h-screen overflow-x-hidden">
      <PublicSeo
        title="Kifer Saude | Consultoria para planos de saude no RJ"
        description="Consultoria da Kifer Saude para PF, PME e adesao com comparativo tecnico, leitura de rede por territorio e apoio humano ate a contratacao."
        canonicalPath="/"
        faqItems={faqItems}
      />

      <a href="#conteudo" className="root-skip-link">
        Pular para o conteudo
      </a>

      <header className="sticky top-0 z-50 border-b border-[color:var(--root-line)] bg-[rgba(246,239,229,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1.4rem] border border-[color:var(--root-line-strong)] bg-white/80 text-[color:var(--root-accent-deep)] shadow-[0_18px_28px_-22px_rgba(44,25,14,0.44)] transition-transform duration-300 group-hover:-translate-y-0.5">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span>
              <span className="root-heading block text-[2rem] font-semibold leading-none text-stone-950">Kifer Saude</span>
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--root-muted)]">
                consultoria em saude suplementar
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[color:var(--root-muted)] lg:flex">
            <a href="#diferencial" className="root-nav-link">
              Diferencial
            </a>
            <a href="#metodo" className="root-nav-link">
              Metodo
            </a>
            <a href="#trilhas" className="root-nav-link">
              Trilhas
            </a>
            <a href="#faq" className="root-nav-link">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="tel:+5521979302389"
              className="hidden rounded-full border border-[color:var(--root-line-strong)] px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-[color:var(--root-accent)] hover:text-stone-950 xl:inline-flex"
            >
              (21) 97930-2389
            </a>
            <Link to="/lp" className="root-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold">
              Quero cotar
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main id="conteudo" className="pb-20">
        <section className="relative px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
          <div aria-hidden="true" className="root-orb root-orb-primary absolute left-[-8rem] top-[-5rem] h-72 w-72" />
          <div aria-hidden="true" className="root-orb root-orb-secondary absolute right-[-6rem] top-16 h-80 w-80" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
              <div className="grid gap-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] xl:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="root-reveal">
                    <span className="root-kicker">home institucional repensada do zero</span>
                    <h1 className="root-heading mt-5 max-w-4xl text-[3.5rem] leading-[0.86] text-stone-950 sm:text-[4.5rem] lg:text-[5.3rem] xl:text-[6.15rem]">
                      Plano de saude nao se escolhe por vitrine. Se escolhe por encaixe.
                    </h1>
                    <p className="mt-5 max-w-2xl text-base leading-8 text-[color:var(--root-muted)] sm:text-lg">
                      A Kifer transforma uma decisao confusa em um comparativo com contexto: rede por territorio, carencias,
                      reajustes, coparticipacao e apoio humano ate a contratacao.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link
                        to="/lp"
                        className="root-button-primary inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold"
                      >
                        Receber comparativo
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/planos"
                        className="root-button-secondary inline-flex items-center rounded-full px-6 py-3.5 text-sm font-semibold"
                      >
                        Explorar guia de planos
                      </Link>
                    </div>
                  </div>

                  <aside className="root-note root-reveal root-delay-1 flex flex-col justify-between gap-4 rounded-[1.75rem] p-5 lg:mt-10">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[color:var(--root-accent-deep)]">
                        ponto de vista
                      </p>
                      <p className="mt-4 text-sm leading-7 text-stone-700">
                        No nicho de saude, a escolha certa quase nunca e a mais anunciada. Ela e a que fecha com cidade,
                        faixa de investimento, rotina de uso e suporte que voce realmente vai precisar.
                      </p>
                    </div>
                    <p className="border-t border-[color:var(--root-line)] pt-4 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--root-muted)]">
                      decisao com menos ruido
                    </p>
                  </aside>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {trustSignals.map((signal, index) => (
                    <article
                      key={signal.label}
                      className={`root-paper root-reveal rounded-[1.7rem] p-5 ${index === 1 ? 'root-delay-1' : ''} ${index === 2 ? 'root-delay-2' : ''}`}
                    >
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-muted)]">
                        {signal.label}
                      </p>
                      <p className="root-heading mt-3 text-4xl font-semibold leading-none text-stone-950">{signal.value}</p>
                      <p className="mt-3 text-sm leading-7 text-[color:var(--root-muted)]">{signal.text}</p>
                    </article>
                  ))}
                </div>

                <section className="root-paper root-reveal root-delay-2 rounded-[2rem] p-5 md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="max-w-xl">
                      <span className="root-kicker">operadoras no radar</span>
                      <p className="mt-3 text-sm leading-7 text-[color:var(--root-muted)]">
                        A recomendacao parte do encaixe do seu cenario. A bandeira vem depois, como consequencia da analise.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-5 sm:items-center">
                      {operatorLogos.map((logo) => (
                        <div key={logo.alt} className="flex items-center justify-center">
                          <img
                            src={logo.src}
                            alt={logo.alt}
                            loading="lazy"
                            className={`${logo.height} w-auto max-w-[8rem] object-contain opacity-80 grayscale [filter:grayscale(1)_contrast(1.05)_brightness(0.42)]`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <aside className="root-paper root-reveal root-delay-2 overflow-hidden rounded-[2.2rem] p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="root-kicker">mesa de decisao kifer</span>
                    <h2 className="root-heading mt-4 text-4xl font-semibold leading-none text-stone-950 sm:text-5xl">
                      Seu comparativo nasce daqui.
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--root-line-strong)] bg-white/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--root-accent-deep)]">
                    <BadgeCheck className="h-4 w-4" />
                    atendimento humano
                  </span>
                </div>

                <figure className="mt-6 overflow-hidden rounded-[1.85rem] border border-[color:var(--root-line)] bg-[#ddc4a9]">
                  <img
                    src="/freepik__portrait-of-a-natural-redhaired-woman-about-158-me__96601.png"
                    alt="Representacao de uma consultoria humana em saude"
                    className="h-[24rem] w-full object-cover object-top sm:h-[29rem]"
                    loading="eager"
                  />
                </figure>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-[color:var(--root-line)] bg-white/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--root-muted)]">
                      perfis atendidos
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-800">PF, familias, PME, socios e adesao com leitura adaptada ao tipo de contratacao.</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-[color:var(--root-line)] bg-white/70 p-4">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--root-muted)]">
                      foco geografico
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-800">RJ e entorno com validacao de rede pelo territorio onde a rotina realmente acontece.</p>
                  </div>
                </div>

                <div className="root-note mt-5 rounded-[1.7rem] p-5">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-accent-deep)]">
                    o que entra na triagem
                  </p>
                  <ul className="mt-4 space-y-3">
                    {heroChecklist.map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-7 text-stone-800">
                        <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-[color:var(--root-accent)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-[1.5rem] bg-stone-950 px-5 py-4 text-sm text-stone-50 shadow-[0_24px_48px_-34px_rgba(12,10,9,0.9)]">
                  <Clock3 className="h-5 w-5 flex-shrink-0 text-[color:var(--root-accent-soft)]" />
                  <span>Primeiro retorno em horario comercial, normalmente no mesmo dia util.</span>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section id="diferencial" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 xl:grid-cols-[0.42fr_0.58fr]">
            <div className="root-reveal">
              <span className="root-kicker">capitulo 01</span>
              <h2 className="root-heading mt-5 text-5xl font-semibold leading-[0.92] text-stone-950 md:text-6xl">
                Quando a analise e consultiva, o plano deixa de ser vitrine e vira estrategia.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[color:var(--root-muted)]">
                A funcao da Kifer e reduzir arrependimento. Por isso, a pagina conversa mais com criterio do que com propaganda:
                o que importa e o encaixe entre uso, rede, modalidade e horizonte financeiro.
              </p>

              <div className="root-note mt-8 rounded-[1.85rem] p-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-accent-deep)]">
                  o que voce recebe
                </p>
                <p className="mt-3 text-lg leading-8 text-stone-800">
                  Uma recomendacao principal, uma alternativa de seguranca e uma leitura clara dos pontos sensiveis antes da assinatura.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:pt-6">
              {manifestoCards.map((card, index) => (
                <article
                  key={card.title}
                  className={`root-paper root-reveal rounded-[1.9rem] p-6 ${index % 2 === 1 ? 'md:mt-10' : ''} ${index === 1 ? 'root-delay-1' : ''} ${index >= 2 ? 'root-delay-2' : ''}`}
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-[color:var(--root-line)] bg-[rgba(244,226,199,0.56)] text-[color:var(--root-accent-deep)]">
                    <card.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="root-heading mt-5 text-4xl font-semibold leading-none text-stone-950">{card.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-stone-700">{card.text}</p>
                  <p className="mt-6 border-t border-[color:var(--root-line)] pt-4 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--root-muted)]">
                    {card.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.35rem] bg-stone-950 px-6 py-10 text-stone-50 shadow-[0_42px_90px_-54px_rgba(12,10,9,0.92)] md:px-10 md:py-12">
            <div className="grid gap-8 xl:grid-cols-[0.38fr_0.62fr] xl:items-start">
              <div className="root-reveal">
                <span className="root-kicker text-[color:var(--root-accent-soft)]">
                  capitulo 02
                </span>
                <h2 className="root-heading mt-5 text-5xl font-semibold leading-[0.94] text-white md:text-6xl">
                  Quatro etapas para tirar peso de uma decisao sensivel.
                </h2>
                <p className="mt-5 max-w-md text-base leading-8 text-stone-300">
                  Em vez de empilhar ofertas, o processo organiza contexto, corta ruído e chega a uma recomendacao com argumento tecnico.
                </p>

                <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-white/5 p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-accent-soft)]">
                    principio
                  </p>
                  <p className="mt-3 text-sm leading-7 text-stone-300">
                    Cada etapa reduz uma camada de incerteza: primeiro o contexto, depois a filtragem, em seguida o comparativo e por fim a contratacao assistida.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {processChapters.map((chapter, index) => (
                  <article
                    key={chapter.step}
                    className={`rounded-[1.9rem] border border-white/10 bg-white/5 p-6 root-reveal ${index === 1 ? 'root-delay-1' : ''} ${index >= 2 ? 'root-delay-2' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-accent-soft)]">
                        etapa {chapter.step}
                      </span>
                      <chapter.Icon className="h-5 w-5 text-[color:var(--root-accent-soft)]" />
                    </div>
                    <h3 className="root-heading mt-5 text-4xl font-semibold leading-none text-white">{chapter.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-stone-300">{chapter.text}</p>
                    <p className="mt-6 border-t border-white/10 pt-4 text-sm leading-7 text-[color:var(--root-accent-soft)]">
                      {chapter.deliverable}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="trilhas" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl root-reveal">
              <span className="root-kicker">capitulo 03</span>
              <h2 className="root-heading mt-5 text-5xl font-semibold leading-[0.92] text-stone-950 md:text-6xl">
                Trilhas diferentes para quem contrata de jeitos diferentes.
              </h2>
              <p className="mt-5 text-base leading-8 text-[color:var(--root-muted)]">
                A home institucional deixa claro que PF, PME e adesao nao recebem a mesma resposta pronta. Cada trilha muda o recorte da analise e o que precisa ser validado primeiro.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {serviceTracks.map((track, index) => (
                <article
                  key={track.profile}
                  className={`root-paper root-reveal rounded-[2rem] p-6 md:p-7 ${index === 1 ? 'root-delay-1' : ''} ${index === 2 ? 'root-delay-2' : ''}`}
                >
                  <div className="grid gap-6 lg:grid-cols-[0.24fr_0.43fr_0.33fr] lg:items-start lg:gap-8">
                    <div className="flex items-start gap-4">
                      <span className="inline-flex h-14 w-14 items-center justify-center rounded-[1.35rem] border border-[color:var(--root-line)] bg-[rgba(244,226,199,0.56)] text-[color:var(--root-accent-deep)]">
                        <track.Icon className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-muted)]">{track.slug}</p>
                        <h3 className="root-heading mt-2 text-4xl font-semibold leading-none text-stone-950">{track.title}</h3>
                      </div>
                    </div>

                    <div>
                      <p className="text-base leading-8 text-stone-800">{track.summary}</p>
                      <p className="mt-5 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-muted)]">
                        quando faz sentido
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[color:var(--root-muted)]">{track.fit}</p>
                    </div>

                    <div>
                      <ul className="space-y-3">
                        {track.bullets.map((item) => (
                          <li key={item} className="flex gap-3 text-sm leading-7 text-stone-700">
                            <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-[color:var(--root-accent)]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <Link
                        to={`/lp?perfil=${track.profile}`}
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--root-accent-deep)] transition hover:text-stone-950"
                      >
                        Abrir trilha de atendimento
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="criterios" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.58fr_0.42fr] xl:items-start">
            <article className="root-paper root-reveal rounded-[2rem] p-6 md:p-8">
              <span className="root-kicker">capitulo 04</span>
              <h2 className="root-heading mt-5 text-5xl font-semibold leading-[0.94] text-stone-950 md:text-6xl">
                O que a Kifer coloca na mesa antes de recomendar.
              </h2>
              <div className="mt-8 divide-y divide-[color:var(--root-line)]">
                {criteriaRows.map((row) => (
                  <div key={row.label} className="grid gap-2 py-5 md:grid-cols-[13rem_1fr] md:gap-6">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-muted)]">{row.label}</p>
                    <p className="text-sm leading-7 text-stone-700">{row.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="root-paper root-reveal root-delay-1 rounded-[2rem] p-6 md:p-8">
              <span className="root-kicker">ecossistema analisado</span>
              <h3 className="root-heading mt-5 text-5xl font-semibold leading-[0.94] text-stone-950">
                Operadora e variavel. O ponto de partida e o seu cenario.
              </h3>
              <p className="mt-5 text-sm leading-8 text-[color:var(--root-muted)]">
                Produtos de nomes fortes podem entrar no comparativo, mas a escolha final depende do encaixe entre rede, modalidade, territorio e custo total. A marca so faz sentido quando fecha com a sua realidade.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {operatorLogos.map((logo) => (
                  <div key={logo.alt} className="root-logo-tile flex min-h-[5.5rem] items-center justify-center rounded-[1.45rem] p-4">
                    <img src={logo.src} alt={logo.alt} loading="lazy" className={`${logo.height} w-auto max-w-[7rem] object-contain`} />
                  </div>
                ))}
              </div>

              <div className="root-note mt-8 rounded-[1.7rem] p-5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[color:var(--root-accent-deep)]">importante</p>
                <p className="mt-3 text-sm leading-7 text-stone-800">
                  Validar hospital ou laboratorio so pelo nome da operadora e pouco. A confirmacao precisa acontecer no produto, na categoria e no territorio corretos.
                </p>
              </div>

              <Link
                to="/planos"
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--root-accent-deep)] transition hover:text-stone-950"
              >
                Ver o guia de planos e operadoras
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.58fr_0.42fr] xl:items-start">
            <div>
              <div className="max-w-3xl root-reveal">
                <span className="root-kicker">capitulo 05</span>
                <h2 className="root-heading mt-5 text-5xl font-semibold leading-[0.94] text-stone-950 md:text-6xl">
                  Duvidas que precisam ser respondidas antes de fechar.
                </h2>
                <p className="mt-5 text-base leading-8 text-[color:var(--root-muted)]">
                  Em plano de saude, boa pergunta evita erro caro. Por isso a home termina esclarecendo as objecoes que mais pesam na decisao.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {faqItems.map((item, index) => (
                  <article
                    key={item.question}
                    className={`root-paper root-reveal rounded-[1.8rem] p-6 ${index === 1 ? 'root-delay-1' : ''} ${index >= 2 ? 'root-delay-2' : ''}`}
                  >
                    <p className="text-base font-semibold leading-7 text-stone-950">{item.question}</p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--root-muted)]">{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="root-cta-panel root-reveal root-delay-1 overflow-hidden rounded-[2.2rem] p-7 text-white md:p-8">
              <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,208,166,0.14),transparent_34%)]" />
              <div className="relative">
                <span className="root-kicker text-[color:var(--root-accent-soft)]">
                  proximo passo
                </span>
                <h3 className="root-heading mt-5 text-5xl font-semibold leading-[0.94] text-white md:text-6xl">
                  Vamos montar o comparativo que faz sentido para o seu cenario.
                </h3>
                <p className="mt-5 text-sm leading-8 text-stone-200">
                  Se a ideia e decidir com mais seguranca, o melhor proximo movimento e abrir o briefing. A partir dele, a Kifer organiza as opcoes e conduz a leitura com criterio tecnico.
                </p>

                <div className="mt-8 space-y-3">
                  <Link
                    to="/lp"
                    className="root-button-cream inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
                  >
                    Receber comparativo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="https://wa.me/5521979302389?text=Ola%2C%20quero%20um%20comparativo%20de%20plano%20de%20saude."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="root-button-outline inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Falar no WhatsApp
                  </a>
                </div>

                <p className="mt-5 flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-stone-200/90">
                  <Clock3 className="h-4 w-4 text-[color:var(--root-accent-soft)]" />
                  retorno em horario comercial
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-8 pt-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[color:var(--root-line)] pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="root-heading text-3xl font-semibold leading-none text-stone-950">Kifer Saude</p>
            <p className="mt-2 text-sm text-[color:var(--root-muted)]">Consultoria em saude suplementar para PF, PME e adesao no RJ.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-stone-700">
            <Link to="/planos" className="root-nav-link">
              Planos
            </Link>
            <Link to="/lp" className="root-nav-link">
              Cotacao
            </Link>
            <a href="tel:+5521979302389" className="root-nav-link">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/5521979302389?text=Ola%2C%20quero%20um%20comparativo%20de%20plano%20de%20saude."
        target="_blank"
        rel="noopener noreferrer"
        className="root-fab fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_24px_46px_-24px_rgba(12,10,9,0.76)]"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </div>
  );
}
