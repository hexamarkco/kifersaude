import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

const serviceProfiles = [
  {
    id: 'pf',
    title: 'Pessoa fisica',
    subtitle: 'Decisao individual com previsibilidade e cobertura inteligente.',
    bullets: [
      'Comparativo com foco no seu uso real',
      'Validacao de rede por regiao de atendimento',
      'Leitura clara de carencias e reajustes',
    ],
  },
  {
    id: 'pme',
    title: 'PME e CNPJ',
    subtitle: 'Beneficio de saude estruturado para empresas de pequeno e medio porte.',
    bullets: [
      'Apoio de elegibilidade e documentacao',
      'Analise de custo total por composicao',
      'Curadoria por perfil da equipe',
    ],
  },
  {
    id: 'adesao',
    title: 'Coletivo por adesao',
    subtitle: 'Alternativa para perfis elegiveis que querem equilibrio entre custo e rede.',
    bullets: [
      'Triagem de regras de entrada',
      'Comparativo tecnico de operadoras',
      'Acompanhamento do inicio ao pos-venda',
    ],
  },
];

const methodSteps = [
  {
    step: '01',
    title: 'Briefing consultivo',
    text: 'Entendemos vidas, cidade, rotina de uso e faixa de investimento para montar o recorte certo.',
  },
  {
    step: '02',
    title: 'Curadoria de opcoes',
    text: 'Filtramos planos com foco em rede relevante, sustentabilidade financeira e seguranca de uso.',
  },
  {
    step: '03',
    title: 'Comparativo guiado',
    text: 'Voce recebe recomendacao principal, alternativa de seguranca e leitura honesta dos pontos sensiveis.',
  },
  {
    step: '04',
    title: 'Apoio na contratacao',
    text: 'Acompanhamos proposta, pendencias e ativacao para transformar escolha em resultado pratico.',
  },
];

const testimonials = [
  {
    name: 'Regina S.',
    context: 'Familia com 3 vidas',
    quote: 'Consegui reduzir custo sem abrir mao dos hospitais que ja usavamos. A clareza no comparativo foi essencial.',
  },
  {
    name: 'Marcelo R.',
    context: 'PME de servicos',
    quote: 'Estruturamos o plano empresarial com menos burocracia e mais previsibilidade para o caixa da empresa.',
  },
  {
    name: 'Ana Paula F.',
    context: 'Transicao de beneficio corporativo',
    quote: 'Atendimento consultivo de verdade. Entendi riscos e vantagens antes de tomar decisao.',
  },
];

const faqItems = [
  {
    question: 'A consultoria da Kifer tem custo para o cliente final?',
    answer:
      'Nao. A orientacao consultiva e gratuita para o cliente final e inclui triagem, comparativo e apoio no processo de contratacao.',
  },
  {
    question: 'Como voces garantem que a rede informada e a correta?',
    answer:
      'A validacao e feita no produto especifico, por categoria e territorio de uso, evitando confirmacoes genericas por nome de operadora.',
  },
  {
    question: 'Atendem PF, PME e adesao com a mesma metodologia?',
    answer:
      'Sim. O metodo e o mesmo, mas a estrategia muda conforme perfil, elegibilidade, objetivo de cobertura e realidade financeira.',
  },
  {
    question: 'Voces acompanham depois da assinatura?',
    answer:
      'Sim. O pos-venda faz parte da entrega, com apoio em duvidas operacionais, pendencias e primeiros passos de uso.',
  },
];

export default function HomePage() {
  return (
    <div className="clinic-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Kifer Saude | Site institucional</title>
        <meta
          name="description"
          content="Consultoria institucional da Kifer Saude para PF, PME e adesao, com comparativo tecnico e acompanhamento consultivo completo."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/" />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-900/20">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span>
              <span className="clinic-heading block text-2xl font-semibold leading-none">Kifer Saude</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">institucional</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <a href="#metodo" className="transition hover:text-orange-700">
              Metodo
            </a>
            <a href="#perfis" className="transition hover:text-orange-700">
              Perfis
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
        <section className="relative overflow-hidden px-4 pb-14 pt-16 sm:px-6 lg:px-8">
          <div className="clinic-glow pointer-events-none absolute left-[-9rem] top-[-6rem] h-80 w-80 rounded-full bg-orange-300/35 blur-3xl" />
          <div className="clinic-glow pointer-events-none absolute bottom-[-8rem] right-[-10rem] h-96 w-96 rounded-full bg-orange-200/35 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
            <div className="clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-700">site principal</p>
              <h1 className="clinic-heading mt-4 text-5xl font-semibold leading-[0.93] text-slate-900 md:text-7xl">
                Consultoria de saude com linguagem clara e decisao segura.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Estruturamos comparativos para PF, PME e adesao com criterio tecnico, leitura honesta de risco e apoio
                humano em toda a jornada de contratacao.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/lp"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-orange-900/20 transition hover:from-orange-700 hover:to-orange-600"
                >
                  Receber comparativo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/planos"
                  className="inline-flex items-center rounded-2xl border border-orange-200 bg-white/90 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-orange-50"
                >
                  Explorar planos
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="clinic-card rounded-2xl p-4 text-sm font-semibold text-slate-700">+3.200 clientes orientados</div>
                <div className="clinic-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Retorno no mesmo dia util</div>
                <div className="clinic-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Acompanhamento no pos-venda</div>
              </div>
            </div>

            <article className="clinic-card clinic-reveal clinic-delay-1 rounded-[2rem] p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">sua consultora</p>
              <h2 className="clinic-heading mt-3 text-4xl font-semibold text-slate-900">Atendimento com rosto e responsabilidade</h2>

              <div className="clinic-photo-slot mt-6 aspect-[4/5] rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-100/60 to-white p-6">
                <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-300/90 text-center text-slate-600">
                  <BadgeCheck className="h-8 w-8 text-orange-600" />
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-orange-700">Espaco para foto da corretora</p>
                  <p className="mt-2 max-w-[18rem] text-xs">Substituir por retrato profissional em plano medio, fundo claro e identidade visual da marca.</p>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Comparativo consultivo sem pressao de fechamento.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Analise de rede por uso real e nao por vitrine comercial.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Suporte de documentacao, proposta e ativacao.
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-slate-900 px-8 py-11 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.92)] md:px-12">
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">metodo institucional</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold leading-tight">Uma jornada de decisao, nao uma pagina de oferta</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Nosso processo e desenhado para reduzir risco de arrependimento e aumentar seguranca de uso no curto e medio prazo.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {methodSteps.map((step, index) => (
                <article
                  key={step.step}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-6 clinic-reveal ${index === 1 ? 'clinic-delay-1' : ''} ${index > 1 ? 'clinic-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-200">etapa {step.step}</p>
                  <h3 className="mt-3 text-2xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="perfis" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">frentes de atendimento</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Trilhas especificas para PF, PME e adesao</h2>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {serviceProfiles.map((profile, index) => (
                <article
                  key={profile.id}
                  className={`clinic-card clinic-reveal rounded-2xl p-7 ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">{profile.id}</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{profile.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{profile.subtitle}</p>

                  <ul className="mt-5 space-y-3">
                    {profile.bullets.map((item) => (
                      <li key={item} className="flex gap-3 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/lp"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-orange-700 hover:text-orange-800"
                  >
                    Iniciar atendimento
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">depoimentos</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Quem passou pela consultoria descreve clareza e seguranca</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`clinic-card clinic-reveal rounded-2xl p-7 ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
                >
                  <div className="flex items-center gap-1 text-orange-500">
                    <Sparkles className="h-4 w-4" />
                    <Sparkles className="h-4 w-4" />
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">"{testimonial.quote}"</p>
                  <p className="mt-5 text-sm font-black text-slate-900">{testimonial.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{testimonial.context}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">faq institucional</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Duvidas que aparecem antes de contratar</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Reunimos respostas objetivas para os temas que mais influenciam sua decisao.
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
              {faqItems.map((faq, index) => (
                <details
                  key={faq.question}
                  className={`clinic-card clinic-reveal rounded-2xl p-5 ${index === 1 ? 'clinic-delay-1' : ''} ${index >= 2 ? 'clinic-delay-2' : ''}`}
                >
                  <summary className="cursor-pointer list-none text-sm font-black text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-orange-600" />
                      {faq.question}
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-8 pt-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-orange-700 via-orange-600 to-orange-500 p-10 text-white shadow-[0_40px_80px_-48px_rgba(124,45,18,0.65)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">proximo passo</p>
                <h2 className="clinic-heading mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Vamos construir seu comparativo com criterio tecnico.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Se voce quer decidir com mais seguranca, nossa equipe inicia pelo briefing e organiza as melhores opcoes para seu perfil.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  to="/lp"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
                >
                  Iniciar atendimento
                </Link>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
                <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
                  <Clock3 className="h-4 w-4" />
                  retorno em horario comercial
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
