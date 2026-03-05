import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';

const processSteps = [
  {
    title: 'Diagnostico em 15 minutos',
    text: 'Mapeamos regiao de uso, faixa de investimento, historico de uso e objetivo real da contratacao.',
  },
  {
    title: 'Comparativo sem enrolacao',
    text: 'Voce recebe um quadro claro de cobertura, carencias, coparticipacao e projecao de custo anual.',
  },
  {
    title: 'Apoio ate a ativacao',
    text: 'Acompanhamos proposta, pendencias e primeiros passos de uso para sua decisao virar tranquilidade.',
  },
];

const testimonials = [
  {
    name: 'Regina S.',
    profile: 'Familia com 3 vidas',
    quote:
      'Eu estava presa a um plano caro e achava que iria perder hospital. A consultoria encontrou uma opcao melhor e mais segura para nossa rotina.',
  },
  {
    name: 'Marcelo R.',
    profile: 'MEI em servicos',
    quote:
      'Foi rapido e objetivo. Em um dia eu entendi as regras do meu perfil, enviei documentos e ja sai com um caminho claro para contratar.',
  },
  {
    name: 'Ana Paula F.',
    profile: 'Transicao de beneficio corporativo',
    quote:
      'Sem pressao comercial. Me explicaram o que era bom para o meu caso e o que parecia barato, mas sairia caro depois.',
  },
];

const faqItems = [
  {
    question: 'Voces cobram taxa para fazer o comparativo?',
    answer:
      'Nao. A consultoria para orientacao e comparativo e gratuita para o cliente final. Nosso foco e ajudar voce a decidir com criterio.',
  },
  {
    question: 'Posso contratar mesmo sem CNPJ?',
    answer:
      'Sim. Existem caminhos para PF e familia. Quando houver elegibilidade para MEI/CNPJ, mostramos o impacto real de custo e cobertura.',
  },
  {
    question: 'Como saber se o hospital que eu uso esta na rede?',
    answer:
      'A validacao e feita no produto especifico da proposta, considerando cidade e categoria, e nao apenas o nome da operadora.',
  },
  {
    question: 'A Kifer ajuda depois da assinatura?',
    answer:
      'Sim. O pos-venda faz parte do metodo. Seguimos no suporte para duvidas de uso, ajustes e orientacao operacional.',
  },
];

const pillarCards = [
  {
    title: 'Consultoria real, nao empurro de tabela',
    text: 'Cada recomendacao nasce do seu contexto. O objetivo e acertar no plano que voce vai usar no dia a dia.',
    Icon: BadgeCheck,
  },
  {
    title: 'Leitura tecnica em linguagem simples',
    text: 'Traduzimos contrato, rede, carencia e reajuste para voce decidir com seguranca e sem adivinhar.',
    Icon: ShieldCheck,
  },
  {
    title: 'Foco no Rio de Janeiro e Grande Rio',
    text: 'Analise regional com criterio de deslocamento e disponibilidade real de atendimento onde voce circula.',
    Icon: MapPin,
  },
];

export default function HomePage() {
  return (
    <div className="marketing-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Kifer Saude | Consultoria em planos de saude no RJ</title>
        <meta
          name="description"
          content="Consultoria especializada para comparar planos de saude com clareza, criterio e acompanhamento no pos-venda."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/" />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-900/25">
              <HeartHandshake className="h-5 w-5" />
            </span>
            <span>
              <span className="marketing-display block text-2xl font-semibold leading-none">Kifer Saude</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">consultoria premium</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <a href="#metodo" className="transition hover:text-slate-900">
              Metodo
            </a>
            <a href="#depoimentos" className="transition hover:text-slate-900">
              Depoimentos
            </a>
            <a href="#faq" className="transition hover:text-slate-900">
              FAQ
            </a>
            <Link to="/planos" className="transition hover:text-slate-900">
              Planos
            </Link>
          </nav>

          <Link
            to="/lp"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Quero minha analise
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="pb-24">
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 lg:px-8">
          <div className="marketing-glow pointer-events-none absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-amber-300/40 blur-3xl" />
          <div className="marketing-glow pointer-events-none absolute bottom-[-6rem] right-[-9rem] h-96 w-96 rounded-full bg-cyan-300/25 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-700">institucional 2026</p>
              <h1 className="marketing-display mt-5 text-5xl font-semibold leading-[0.95] text-slate-900 md:text-7xl">
                Clareza para escolher o plano certo.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                A Kifer Saude nasceu para resolver o que mais trava uma contratacao: informacao confusa, comparacao rasa e
                decisao no impulso. Nosso metodo combina analise tecnica e atendimento humano para transformar duvida em
                escolha inteligente.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/lp"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-700 to-orange-600 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-amber-900/25 transition hover:from-amber-800 hover:to-orange-700"
                >
                  Receber comparativo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/planos"
                  className="inline-flex items-center rounded-2xl border border-slate-300 bg-white/90 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-white"
                >
                  Explorar planos
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">+3.200 familias orientadas</div>
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">Retorno no mesmo dia util</div>
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">Pos-venda ativo</div>
              </div>
            </div>

            <article className="marketing-surface marketing-reveal marketing-delay-1 rounded-[2rem] p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">o que voce ganha</p>
              <h2 className="marketing-display mt-3 text-4xl font-semibold text-slate-900">Decisao com criterio real</h2>
              <ul className="mt-6 space-y-4 text-sm text-slate-700">
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Recomendacao guiada por uso real e nao por preco de entrada.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Comparativo de rede, carencia, coparticipacao e reajuste em linguagem clara.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" />
                  Suporte na proposta e na ativacao para evitar retrabalho.
                </li>
              </ul>

              <div className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5 text-center">
                <div>
                  <p className="text-2xl font-black text-slate-900">98%</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">aderencia de rede</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">4.9</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">avaliacao media</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">24h</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">primeiro retorno</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {pillarCards.map(({ title, text, Icon }, index) => (
              <article
                key={title}
                className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
              >
                <span className="inline-flex rounded-xl bg-amber-100 p-3 text-amber-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-xl font-black text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="metodo" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] bg-slate-950 px-8 py-11 text-white shadow-[0_40px_90px_-56px_rgba(15,23,42,0.95)] md:px-12">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">como funciona</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight">Metodo consultivo em 3 movimentos</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Conteudo de /como-funciona consolidado na home para voce entender rapidamente como conduzimos cada etapa.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {processSteps.map((step, index) => (
                <article
                  key={step.title}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-6 marketing-reveal ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">etapa {index + 1}</p>
                  <h3 className="mt-3 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="depoimentos" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">depoimentos reais</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Historias de quem decidiu melhor</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700">"{testimonial.quote}"</p>
                  <p className="mt-5 text-sm font-black text-slate-900">{testimonial.name}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{testimonial.profile}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">faq essencial</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Duvidas comuns, respostas diretas</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Conteudo de /faq incorporado na home para facilitar sua leitura antes de pedir o comparativo.
              </p>
              <Link
                to="/lp"
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-slate-50"
              >
                Quero atendimento agora
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
                      <Sparkles className="h-4 w-4 text-amber-700" />
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
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-amber-700 via-orange-600 to-red-500 p-10 text-white shadow-[0_40px_80px_-48px_rgba(124,45,18,0.65)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">proximo passo</p>
                <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Receba um comparativo desenhado para o seu perfil.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Se voce esta no inicio ou pronto para contratar, nossa equipe organiza o caminho com clareza tecnica e
                  acompanhamento humano.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  to="/lp"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
                >
                  Solicitar cotacao personalizada
                </Link>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/45 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
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

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-7 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Kifer Saude - Consultoria em saude suplementar no RJ.</p>
          <div className="flex items-center gap-4">
            <Link to="/planos" className="font-semibold text-slate-700 hover:text-slate-900">
              Planos
            </Link>
            <Link to="/lp" className="font-semibold text-slate-700 hover:text-slate-900">
              Cotacao
            </Link>
            <a href="tel:+5521979302389" className="font-semibold text-slate-700 hover:text-slate-900">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <a
        href="https://wa.me/5521979302389"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-700/35 transition hover:scale-105"
        aria-label="Abrir WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}
