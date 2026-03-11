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
    title: 'Pessoa f?sica',
    subtitle: 'Decis?o individual com previsibilidade e cobertura inteligente.',
    bullets: [
      'Comparativo com foco no seu uso real',
      'Valida??o de rede por regi?o de atendimento',
      'Leitura clara de car?ncias e reajustes',
    ],
  },
  {
    id: 'pme',
    title: 'PME e CNPJ',
    subtitle: 'Benef?cio de sa?de estruturado para empresas de pequeno e m?dio porte.',
    bullets: [
      'Apoio de elegibilidade e documenta??o',
      'An?lise de custo total por composi??o',
      'Curadoria por perfil da equipe',
    ],
  },
  {
    id: 'adesao',
    title: 'Coletivo por ades?o',
    subtitle: 'Alternativa para perfis eleg?veis que querem equil?brio entre custo e rede.',
    bullets: [
      'Triagem de regras de entrada',
      'Comparativo t?cnico de operadoras',
      'Acompanhamento do in?cio ao p?s-venda',
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
    title: 'Curadoria de op??es',
    text: 'Filtramos planos com foco em rede relevante, sustentabilidade financeira e seguran?a de uso.',
  },
  {
    step: '03',
    title: 'Comparativo guiado',
    text: 'Voc? recebe recomenda??o principal, alternativa de seguran?a e leitura honesta dos pontos sens?veis.',
  },
  {
    step: '04',
    title: 'Apoio na contrata??o',
    text: 'Acompanhamos proposta, pend?ncias e ativa??o para transformar escolha em resultado pr?tico.',
  },
];

const testimonials = [
  {
    name: 'Regina S.',
    context: 'Fam?lia com 3 vidas',
    quote: 'Consegui reduzir custo sem abrir m?o dos hospitais que j? us?vamos. A clareza no comparativo foi essencial.',
  },
  {
    name: 'Marcelo R.',
    context: 'PME de servi?os',
    quote: 'Estruturamos o plano empresarial com menos burocracia e mais previsibilidade para o caixa da empresa.',
  },
  {
    name: 'Ana Paula F.',
    context: 'Transi??o de benef?cio corporativo',
    quote: 'Atendimento consultivo de verdade. Entendi riscos e vantagens antes de tomar decis?o.',
  },
];

const faqItems = [
  {
    question: 'A consultoria da Kifer tem custo para o cliente final?',
    answer:
      'N?o. A orienta??o consultiva ? gratuita para o cliente final e inclui triagem, comparativo e apoio no processo de contrata??o.',
  },
  {
    question: 'Como voc?s garantem que a rede informada ? a correta?',
    answer:
      'A valida??o ? feita no produto espec?fico, por categoria e territ?rio de uso, evitando confirma??es gen?ricas por nome de operadora.',
  },
  {
    question: 'Atendem PF, PME e ades?o com a mesma metodologia?',
    answer:
      'Sim. O m?todo ? o mesmo, mas a estrat?gia muda conforme perfil, elegibilidade, objetivo de cobertura e realidade financeira.',
  },
  {
    question: 'Voc?s acompanham depois da assinatura?',
    answer:
      'Sim. O p?s-venda faz parte da entrega, com apoio em d?vidas operacionais, pend?ncias e primeiros passos de uso.',
  },
];

export default function HomePage() {
  return (
    <div className="clinic-theme kifer-ds kifer-home-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Kifer Sa?de | Site institucional</title>
        <meta
          name="description"
          content="Consultoria institucional da Kifer Sa?de para PF, PME e ades?o, com comparativo t?cnico e acompanhamento consultivo completo."
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
              <span className="clinic-heading block text-2xl font-semibold leading-none">Kifer Sa?de</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">institucional</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <a href="#metodo" className="transition hover:text-orange-700">
              M?todo
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
            className="ks-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white"
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
                Consultoria de sa?de com linguagem clara e decis?o segura.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Estruturamos comparativos para PF, PME e ades?o com crit?rio t?cnico, leitura honesta de risco e apoio
                humano em toda a jornada de contrata??o.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/lp"
                  className="ks-btn-primary inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
                >
                  Receber comparativo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/planos"
                  className="ks-btn-secondary inline-flex items-center rounded-2xl px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800"
                >
                  Explorar planos
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">+3.200 clientes orientados</div>
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Retorno no mesmo dia ?til</div>
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Acompanhamento no p?s-venda</div>
              </div>
            </div>

            <article className="clinic-card ks-card clinic-reveal clinic-delay-1 rounded-[2rem] p-7">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">sua consultora</p>
              <h2 className="clinic-heading mt-3 text-4xl font-semibold text-slate-900">Atendimento com rosto e responsabilidade</h2>

              <div className="clinic-photo-slot mt-6 aspect-[4/5] rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-100/60 to-white p-6">
                <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-300/90 text-center text-slate-600">
                  <BadgeCheck className="h-8 w-8 text-orange-600" />
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-orange-700">Espa?o para foto da corretora</p>
                  <p className="mt-2 max-w-[18rem] text-xs">Substituir por retrato profissional em plano m?dio, fundo claro e identidade visual da marca.</p>
                </div>
              </div>

              <ul className="mt-6 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Comparativo consultivo sem press?o de fechamento.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  An?lise de rede por uso real e n?o por vitrine comercial.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Suporte de documenta??o, proposta e ativa??o.
                </li>
              </ul>
            </article>
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-slate-900 px-8 py-11 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.92)] md:px-12">
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">m?todo institucional</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold leading-tight">Uma jornada de decis?o, n?o uma p?gina de oferta</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Nosso processo ? desenhado para reduzir risco de arrependimento e aumentar seguran?a de uso no curto e m?dio prazo.
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
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Trilhas espec?ficas para PF, PME e ades?o</h2>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {serviceProfiles.map((profile, index) => (
                <article
                  key={profile.id}
                  className={`clinic-card ks-card clinic-reveal rounded-2xl p-7 ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
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
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Quem passou pela consultoria descreve clareza e seguran?a</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`clinic-card ks-card clinic-reveal rounded-2xl p-7 ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
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
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">D?vidas que aparecem antes de contratar</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Reunimos respostas objetivas para os temas que mais influenciam sua decis?o.
              </p>
              <Link
                to="/lp"
                className="ks-btn-secondary mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-800"
              >
                Quero meu comparativo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              {faqItems.map((faq, index) => (
                <details
                  key={faq.question}
                  className={`clinic-card ks-card clinic-reveal rounded-2xl p-5 ${index === 1 ? 'clinic-delay-1' : ''} ${index >= 2 ? 'clinic-delay-2' : ''}`}
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
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">pr?ximo passo</p>
                <h2 className="clinic-heading mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Vamos construir seu comparativo com crit?rio t?cnico.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Se voc? quer decidir com mais seguran?a, nossa equipe inicia pelo briefing e organiza as melhores op??es para seu perfil.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  to="/lp"
                  className="ks-btn-secondary inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
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
                  retorno em hor?rio comercial
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white/85 px-4 py-7 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Kifer Sa?de - Consultoria institucional em sa?de suplementar no RJ.</p>
          <div className="flex items-center gap-4">
            <Link to="/planos" className="font-semibold text-slate-700 hover:text-orange-700">
              Planos
            </Link>
            <Link to="/lp" className="font-semibold text-slate-700 hover:text-orange-700">
              Cota??o
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
        className="ks-btn-primary fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full text-white"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
