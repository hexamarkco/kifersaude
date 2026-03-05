import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Handshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

const institutionalPillars = [
  {
    title: 'Consultoria orientada por contexto',
    text: 'Nada de recomendacao generica. Cada comparativo nasce da sua realidade de uso, regiao e objetivo financeiro.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Leitura tecnica em linguagem simples',
    text: 'Traduzimos rede, carencia, coparticipacao e reajuste para voce decidir sem ruido comercial.',
    Icon: ShieldCheck,
  },
  {
    title: 'Atendimento humano ate a ativacao',
    text: 'Acompanhamos do briefing a proposta aprovada para a escolha certa virar operacao tranquila.',
    Icon: Handshake,
  },
];

const profileTracks = [
  {
    tag: 'pf',
    title: 'Pessoa fisica',
    subtitle: 'Para quem quer previsibilidade sem abrir mao de rede qualificada.',
    points: [
      'Comparativo com foco em custo anual real',
      'Validacao de hospitais e laboratorios por regiao',
      'Leitura clara de carencias e reajustes',
    ],
  },
  {
    tag: 'pme',
    title: 'PME e CNPJ',
    subtitle: 'Para empresas que buscam beneficio de saude com governanca e sustentabilidade.',
    points: [
      'Estruturacao de plano empresarial para equipes enxutas',
      'Apoio documental para reduzir retrabalho com operadora',
      'Analise de custo-beneficio para titular e dependentes',
    ],
  },
  {
    tag: 'adesao',
    title: 'Coletivo por adesao',
    subtitle: 'Para perfis elegiveis que precisam de alternativa com boa relacao cobertura x custo.',
    points: [
      'Triagem de elegibilidade e regras de entrada',
      'Comparativo de operadoras por perfil de uso',
      'Orientacao para evitar escolha por impulso de preco',
    ],
  },
];

const methodSteps = [
  {
    step: '01',
    title: 'Briefing consultivo',
    text: 'Mapeamos vidas, regiao de uso, faixa de investimento e prioridades clinicas.',
    output: 'Diagnostico inicial com recorte de opcoes viaveis.',
  },
  {
    step: '02',
    title: 'Curadoria tecnica',
    text: 'Filtramos planos e operadoras com base em rede, modelo financeiro e cobertura relevante.',
    output: 'Comparativo objetivo com recomendacao principal e alternativa de seguranca.',
  },
  {
    step: '03',
    title: 'Decisao e ativacao',
    text: 'Apoiamos em duvidas finais, documentacao e acompanhamento de proposta ate aprovacao.',
    output: 'Contratacao com mais clareza e menos risco operacional.',
  },
];

const testimonials = [
  {
    name: 'Regina S.',
    profile: 'Familia com 3 vidas',
    quote:
      'Saimos de um plano caro sem perder rede importante. O que mais ajudou foi a forma clara de comparar cada opcao.',
  },
  {
    name: 'Marcelo R.',
    profile: 'PME de servicos',
    quote: 'Consegui estruturar o beneficio da empresa sem burocracia excessiva. O suporte no processo fez toda diferenca.',
  },
  {
    name: 'Ana Paula F.',
    profile: 'Transicao de beneficio corporativo',
    quote: 'Atendimento consultivo de verdade, sem pressao para fechar. Entendi riscos e vantagens antes de decidir.',
  },
];

const faqItems = [
  {
    question: 'A Kifer cobra para fazer comparativo?',
    answer:
      'Nao. A consultoria de comparacao e orientacao e gratuita para o cliente final. Nosso trabalho e entregar clareza para a decisao.',
  },
  {
    question: 'Vocês atendem PF, PME e adesao na mesma metodologia?',
    answer:
      'Sim. A metodologia e a mesma, mas a estrategia muda por perfil, elegibilidade, rede desejada e modelo financeiro.',
  },
  {
    question: 'Como validar rede de hospital antes de assinar?',
    answer:
      'A validacao e feita no produto especifico da proposta, por cidade e categoria contratada, evitando informacao generica.',
  },
  {
    question: 'Depois da assinatura voces continuam acompanhando?',
    answer:
      'Sim. O pos-venda e parte da entrega: suporte em pendencias, duvidas de uso e orientacao operacional.',
  },
];

const operatorLogos = [
  { name: 'Amil', src: '/amil-logo-1-2.png' },
  { name: 'Bradesco Saude', src: '/bradesco-saude-logo-1-1.png' },
  { name: 'SulAmerica Saude', src: '/sulamerica-saude-logo.png' },
  { name: 'Porto', src: '/porto-logo.png' },
  { name: 'Assim Saude', src: '/assim-saude-logo.png' },
];

export default function HomePage() {
  return (
    <div className="marketing-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Kifer Saude | Consultoria institucional em planos de saude</title>
        <meta
          name="description"
          content="Site institucional da Kifer Saude. Consultoria especializada para PF, PME e adesao com comparativo tecnico e acompanhamento completo."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/" />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-900/20">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <span>
              <span className="marketing-display block text-2xl font-semibold leading-none">Kifer Saude</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">institucional</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <a href="#perfis" className="transition hover:text-orange-700">
              Perfis
            </a>
            <a href="#metodo" className="transition hover:text-orange-700">
              Metodo
            </a>
            <a href="#faq" className="transition hover:text-orange-700">
              FAQ
            </a>
            <Link to="/planos" className="transition hover:text-orange-700">
              Planos
            </Link>
          </nav>

          <Link
            to="/lp"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Quero cotar
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="pb-24">
        <section className="relative overflow-hidden px-4 pb-16 pt-16 sm:px-6 lg:px-8">
          <div className="marketing-glow pointer-events-none absolute left-[-9rem] top-[-6rem] h-80 w-80 rounded-full bg-orange-300/35 blur-3xl" />
          <div className="marketing-glow pointer-events-none absolute bottom-[-8rem] right-[-10rem] h-96 w-96 rounded-full bg-orange-200/35 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">site principal</p>
              <h1 className="marketing-display mt-4 text-5xl font-semibold leading-[0.94] text-slate-900 md:text-7xl">
                Consultoria de saude com criterio, clareza e responsabilidade.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Somos uma consultoria institucional especializada em decisao de plano de saude. Atuamos com foco em PF,
                PME e adesao para reduzir risco de escolha e aumentar previsibilidade do uso real.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/lp"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-orange-900/20 transition hover:from-orange-700 hover:to-orange-600"
                >
                  Solicitar comparativo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/planos"
                  className="inline-flex items-center rounded-2xl border border-orange-200 bg-white/90 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-white"
                >
                  Ver guia de planos
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="marketing-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]">PF</span>
                <span className="marketing-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]">PME</span>
                <span className="marketing-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]">Adesao</span>
                <span className="marketing-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em]">Grande Rio</span>
              </div>
            </div>

            <article className="marketing-surface marketing-reveal marketing-delay-1 rounded-[2rem] p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">institucional kifer</p>
              <h2 className="marketing-display mt-3 text-4xl font-semibold text-slate-900">Compromisso com decisao segura</h2>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-2xl font-black text-slate-900">+3.200</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">clientes orientados</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-2xl font-black text-slate-900">4.9/5</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">avaliacao media</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-2xl font-black text-slate-900">24h</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">primeiro retorno</p>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-2xl font-black text-slate-900">RJ</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">foco regional</p>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Atendimento consultivo, nao empurro comercial.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Leitura tecnica de contrato com linguagem simples.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Suporte de proposta ate ativacao do plano.
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {institutionalPillars.map(({ title, text, Icon }, index) => (
              <article
                key={title}
                className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
              >
                <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-xl font-black text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="perfis" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">trilhas de atendimento</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Uma proposta para cada perfil de contratacao</h2>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {profileTracks.map((track, index) => (
                <article
                  key={track.tag}
                  className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">{track.tag}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{track.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{track.subtitle}</p>
                  <ul className="mt-5 space-y-3">
                    {track.points.map((point) => (
                      <li key={point} className="flex gap-3 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/lp"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-orange-700 hover:text-orange-800"
                  >
                    Falar com especialista
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-slate-900 px-8 py-11 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.92)] md:px-12">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">como funciona</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight">Metodo consultivo para decidir melhor</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                O conteudo de como funciona, depoimentos e FAQ foi consolidado aqui na home institucional para dar visao
                completa da nossa proposta.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {methodSteps.map((item, index) => (
                <article
                  key={item.step}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-6 marketing-reveal ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-200">etapa {item.step}</p>
                  <h3 className="mt-3 text-2xl font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.text}</p>
                  <p className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm text-orange-100">Entrega: {item.output}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-center justify-between gap-4 marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">operadoras analisadas</p>
              <p className="text-sm font-semibold text-slate-500">Rede avaliada por produto e regiao de uso</p>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-orange-100 bg-white/90 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {operatorLogos.map((operator) => (
                <div key={operator.name} className="flex h-14 items-center justify-center rounded-xl border border-orange-100 bg-orange-50/40 px-3">
                  <img src={operator.src} alt={`Logo ${operator.name}`} className="max-h-10 w-auto object-contain" loading="lazy" />
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3" id="depoimentos">
              {testimonials.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <div className="flex items-center gap-1 text-orange-500">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">"{testimonial.quote}"</p>
                  <p className="mt-5 text-sm font-black text-slate-900">{testimonial.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{testimonial.profile}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">faq institucional</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Duvidas comuns antes de contratar</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                As perguntas abaixo resumem os principais pontos que esclarecemos antes de qualquer decisao.
              </p>
              <Link
                to="/lp"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-orange-50"
              >
                Quero meu comparativo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {faqItems.map((item, index) => (
                <details
                  key={item.question}
                  className={`marketing-surface marketing-reveal rounded-2xl p-5 ${index === 1 ? 'marketing-delay-1' : ''} ${index >= 2 ? 'marketing-delay-2' : ''}`}
                >
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-orange-600" />
                      {item.question}
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-orange-700 via-orange-600 to-orange-500 p-10 text-white shadow-[0_40px_80px_-48px_rgba(124,45,18,0.65)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">proximo passo</p>
                <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Construa seu comparativo com apoio consultivo.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Nossa equipe responde no mesmo dia util para iniciar triagem, definir perfil e montar as melhores opcoes.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  to="/lp"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
                >
                  Solicitar cotacao
                </Link>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </a>
                <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
                  <Clock3 className="h-4 w-4" />
                  primeiro retorno no mesmo dia util
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white/85 px-4 py-7 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Kifer Saude - Consultoria institucional em saude suplementar no RJ.</p>
          <div className="flex items-center gap-4">
            <Link to="/planos" className="font-semibold text-slate-700 hover:text-orange-700">
              Planos
            </Link>
            <Link to="/lp" className="font-semibold text-slate-700 hover:text-orange-700">
              Cotacao
            </Link>
            <a href="tel:+5521979302389" className="font-semibold text-slate-700 hover:text-orange-700">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/5521979302389"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-2xl shadow-orange-900/30 transition hover:scale-105"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
