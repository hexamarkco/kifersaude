import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, MapPin, ShieldCheck, WalletCards } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const contexts = [
  {
    title: 'Rotina de uso regional',
    text: 'A decisao precisa priorizar rede efetiva em Sao Goncalo e acessos viaveis para municipios vizinhos.',
  },
  {
    title: 'Deslocamento para Niteroi e Rio',
    text: 'Muitos perfis utilizam atendimento em cidades proximas, exigindo comparativo com visao intermunicipal.',
  },
  {
    title: 'Equilibrio entre custo e cobertura',
    text: 'Mensalidade isolada nao resolve. O importante e custo total com qualidade de acesso assistencial.',
  },
  {
    title: 'Previsibilidade para familias e autonomos',
    text: 'A estrategia muda conforme composicao de vidas e frequencia esperada de consultas/exames.',
  },
];

const practicalSteps = [
  'Listar pontos de atendimento indispensaveis na rotina local.',
  'Validar se a rede do produto atende Sao Goncalo e cidades de deslocamento frequente.',
  'Comparar impacto de coparticipacao conforme frequencia de uso da familia.',
  'Projetar custo anual para evitar surpresa financeira no medio prazo.',
  'Revisar carencias e regras contratuais antes da assinatura.',
];

const faq = [
  {
    question: 'Quem mora em Sao Goncalo pode priorizar rede de Niteroi?',
    answer: 'Sim, se o deslocamento fizer sentido para sua rotina. O ideal e equilibrar atendimento local e regional.',
  },
  {
    question: 'Plano regional costuma atender bem?',
    answer: 'Pode atender, desde que haja aderencia real de hospitais e laboratorios ao seu territorio de uso.',
  },
  {
    question: 'A comparacao muda para familia e MEI?',
    answer: 'Sim. Modelo de contratacao, composicao de vidas e objetivo de uso mudam o tipo de recomendacao.',
  },
];

export default function SaoGoncaloPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude em Sao Goncalo | Guia local de contratacao"
        description="Comparativo de plano de saude em Sao Goncalo com foco em rede local, deslocamento regional e custo total anual."
        canonicalPath="/sao-goncalo"
        breadcrumbs={[{ name: 'Sao Goncalo', path: '/sao-goncalo' }]}
        faqItems={faq}
      />
      <PublicBreadcrumbs items={[{ name: 'Sao Goncalo', path: '/sao-goncalo' }]} />

      <section className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Atendimento local</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude em Sao Goncalo com analise territorial e estrategia de uso.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Nosso comparativo considera a realidade de deslocamento da regiao e combina cobertura local com acesso a
            polos assistenciais proximos, como Niteroi e capital, quando necessario.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {contexts.map((context) => (
            <article key={context.title} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{context.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{context.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
              Etapas para escolher melhor
            </h2>
            <ul className="mt-6 space-y-4">
              {practicalSteps.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">FAQ local de Sao Goncalo</h2>
            <div className="mt-6 space-y-4">
              {faq.map((item) => (
                <div key={item.question} className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-sm font-bold text-white">{item.question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.answer}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
            <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
              <MapPin className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-900">Rede por territorio</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">Validamos cobertura nos bairros de uso real para evitar deslocamentos inviaveis.</p>
          </article>
          <article className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
            <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
              <WalletCards className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-900">Custo projetado</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">Comparacao orientada por custo anual e previsibilidade para reduzir risco financeiro.</p>
          </article>
          <article className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
            <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
              <Clock3 className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-xl font-black text-slate-900">Suporte continuo</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">Acompanhamos da triagem inicial ate o pos-venda para manter a decisao sustentavel.</p>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Comparativo local</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba opcoes aderentes para sua rotina em Sao Goncalo.
              </h2>
              <p className="mt-4 text-orange-50">
                Montamos uma analise objetiva de rede, custo e cobertura para apoiar sua decisao com seguranca.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao em Sao Goncalo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/niteroi"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Ver guia de Niteroi
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
