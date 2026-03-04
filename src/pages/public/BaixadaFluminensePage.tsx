import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, MapPin, ShieldCheck, Users, WalletCards } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const cities = [
  {
    name: 'Duque de Caxias',
    note: 'Demanda forte por rede local combinada com opcoes de atendimento em municipios proximos.',
  },
  {
    name: 'Nova Iguacu',
    note: 'Comparativo precisa considerar deslocamento, laboratorios de referencia e cobertura regional.',
  },
  {
    name: 'Belford Roxo e Nilopolis',
    note: 'Escolha deve priorizar praticidade de uso para consultas, exames e urgencias da rotina.',
  },
  {
    name: 'Sao Joao de Meriti e entorno',
    note: 'Aderencia de rede por cidade faz diferenca direta no custo e na experiencia do beneficiario.',
  },
];

const approach = [
  {
    title: 'Leitura de rede por municipio',
    text: 'Validamos cobertura onde o cliente realmente utiliza atendimento, com foco em praticidade de deslocamento.',
    Icon: MapPin,
  },
  {
    title: 'Comparativo com visao regional',
    text: 'Para perfis que circulam entre cidades, a analise considera continuidade de atendimento no eixo completo.',
    Icon: Compass,
  },
  {
    title: 'Custo total para familias e empresas',
    text: 'Projetamos mensalidade, uso e previsibilidade para manter contratacao sustentavel no medio prazo.',
    Icon: WalletCards,
  },
  {
    title: 'Suporte no pos-venda',
    text: 'Acompanhamos ajustes operacionais para garantir que o plano permaneça aderente ao cotidiano.',
    Icon: Users,
  },
];

const faq = [
  {
    question: 'A rede da Baixada e igual em todas as cidades?',
    answer: 'Nao. A disponibilidade pode variar por municipio e por produto. Por isso a analise precisa ser local.',
  },
  {
    question: 'Compensa usar rede fora da cidade?',
    answer: 'Depende da rotina. Quando o deslocamento ja faz parte do dia a dia, essa estrategia pode ser viavel.',
  },
  {
    question: 'Como reduzir risco na contratacao?',
    answer: 'Validando rede por municipio, custo anual e regras de uso antes de assinar qualquer proposta.',
  },
];

export default function BaixadaFluminensePage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude na Baixada Fluminense | Guia local Kifer Saude"
        description="Comparativo de plano de saude na Baixada Fluminense com foco em rede por municipio, deslocamento regional e custo total anual."
        canonicalPath="/baixada-fluminense"
        breadcrumbs={[{ name: 'Baixada Fluminense', path: '/baixada-fluminense' }]}
        faqItems={faq}
      />
      <PublicBreadcrumbs items={[{ name: 'Baixada Fluminense', path: '/baixada-fluminense' }]} />

      <section className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Atendimento local</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude na Baixada Fluminense com foco em rede por municipio.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Na Baixada, a escolha mais segura nasce da analise territorial. Cada municipio possui dinamica propria de
            atendimento, deslocamento e estrutura de rede credenciada.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {cities.map((city) => (
            <article key={city.name} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{city.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{city.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Como analisamos</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Metodo local para a Baixada Fluminense</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {approach.map(({ title, text, Icon }) => (
              <article key={title} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-7">
                <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-2xl font-black text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
              Checklist para decidir
            </h2>
            <ul className="mt-6 space-y-4">
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Validar rede efetiva por municipio e nao apenas por nome de operadora.
              </li>
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Simular custo anual conforme perfil de uso da familia ou empresa.
              </li>
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Revisar carencias e regras contratuais antes da assinatura.
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">FAQ local da Baixada</h2>
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

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Comparativo local</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Monte uma recomendacao de plano aderente a sua cidade.
              </h2>
              <p className="mt-4 text-orange-50">
                Organizamos opcoes com base em rede local, previsibilidade financeira e cobertura para sua rotina real.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao na Baixada
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/rio-de-janeiro"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Ver guia da capital
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
