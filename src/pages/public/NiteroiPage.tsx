import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, MapPin, ShieldCheck, Stethoscope, WalletCards } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const localAreas = [
  {
    name: 'Icarai e Santa Rosa',
    text: 'Demanda comum por rede hospitalar de referencia e laboratorios com agenda acessivel para rotina.',
  },
  {
    name: 'Regiao Oceanica',
    text: 'Comparativo deve considerar deslocamento e disponibilidade real de atendimento no territorio.',
  },
  {
    name: 'Centro e bairros adjacentes',
    text: 'Perfil que costuma equilibrar custo, rede local e facilidade de acesso intermunicipal.',
  },
  {
    name: 'Ponte e mobilidade com capital',
    text: 'Para quem circula entre Niteroi e Rio, cobertura precisa funcionar nos dois eixos de deslocamento.',
  },
];

const pillars = [
  {
    title: 'Rede com aderencia territorial',
    text: 'A selecao considera pontos de atendimento que fazem sentido para o seu fluxo real.',
    Icon: MapPin,
  },
  {
    title: 'Comparativo entre cidades de uso',
    text: 'Quando ha deslocamento para o Rio, avaliamos continuidade de rede e praticidade assistencial.',
    Icon: Compass,
  },
  {
    title: 'Sustentabilidade financeira',
    text: 'Projetamos custo anual para reduzir risco de decisao focada apenas na mensalidade inicial.',
    Icon: WalletCards,
  },
  {
    title: 'Cobertura orientada por rotina',
    text: 'Plano ideal e aquele que acompanha seu uso preventivo, eventual urgencia e exames de recorrencia.',
    Icon: Stethoscope,
  },
];

const faq = [
  {
    question: 'Quem mora em Niteroi e usa rede no Rio deve contratar como?',
    answer: 'A escolha precisa validar cobertura funcional nas duas cidades para evitar friccao no uso cotidiano.',
  },
  {
    question: 'A rede em Niteroi costuma variar por produto?',
    answer: 'Sim. Mesmo dentro da mesma operadora, a rede pode mudar conforme categoria contratada.',
  },
  {
    question: 'Vale comparar apenas o preco inicial?',
    answer: 'Nao. O custo real depende de uso, coparticipacao e deslocamento para acesso a atendimento.',
  },
];

export default function NiteroiPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude em Niteroi | Comparativo local Kifer Saude"
        description="Guia local de plano de saude em Niteroi: rede por regiao, deslocamento para capital, custo total e criterios de escolha."
        canonicalPath="/niteroi"
        breadcrumbs={[{ name: 'Niteroi', path: '/niteroi' }]}
        faqItems={faq}
      />
      <PublicBreadcrumbs items={[{ name: 'Niteroi', path: '/niteroi' }]} />

      <section className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Atendimento local</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude em Niteroi com foco em rede local e mobilidade intermunicipal.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Niteroi tem dinamica propria de atendimento e, em muitos casos, uso combinado com a capital. Nosso trabalho
            e montar um comparativo que funcione na pratica, sem surpresas de cobertura.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {localAreas.map((area) => (
            <article key={area.name} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{area.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{area.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Pontos-chave</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Como conduzimos a analise em Niteroi</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {pillars.map(({ title, text, Icon }) => (
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
              O que validar antes de fechar
            </h2>
            <ul className="mt-6 space-y-4">
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Hospitais prioritarios em Niteroi e eventual uso no Rio.
              </li>
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Custo anual estimado com base no seu historico de uso.
              </li>
              <li className="flex gap-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                Regras de carencia, reajuste e modelo de coparticipacao.
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">FAQ local de Niteroi</h2>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Comparativo em Niteroi</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba uma recomendacao alinhada ao seu fluxo real de atendimento.
              </h2>
              <p className="mt-4 text-orange-50">
                Organizamos opcoes por aderencia de rede e previsibilidade de custo para sua rotina local.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao em Niteroi
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/sao-goncalo"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Ver guia de Sao Goncalo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
