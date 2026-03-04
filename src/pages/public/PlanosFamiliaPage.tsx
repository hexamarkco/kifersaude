import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  HeartPulse,
  MapPin,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const familyMoments = [
  {
    title: 'Familia em crescimento',
    text: 'Entrada de novos dependentes exige plano com boa flexibilidade cadastral e previsibilidade de custo.',
  },
  {
    title: 'Criancas em fase escolar',
    text: 'Consulta pediatrica, exames e urgencias leves podem aumentar frequencia de uso no ano.',
  },
  {
    title: 'Pais em diferentes faixas etarias',
    text: 'Composicao etaria mista pede analise de custo total, nao apenas valor individual por vida.',
  },
  {
    title: 'Rotina de deslocamento intensa',
    text: 'Rede precisa funcionar nos territorios em que a familia realmente circula no dia a dia.',
  },
];

const pillars = [
  {
    title: 'Composicao de vidas',
    text: 'Quantidade de beneficiarios e faixa etaria alteram bastante a estrategia de contratacao.',
    Icon: UsersRound,
  },
  {
    title: 'Rede de urgencia e rotina',
    text: 'A familia precisa de cobertura para urgencias, pediatria e exames frequentes no mesmo territorio.',
    Icon: HeartPulse,
  },
  {
    title: 'Planejamento financeiro anual',
    text: 'Importa projetar gasto anual para evitar desequilibrio entre mensalidade e uso recorrente.',
    Icon: WalletCards,
  },
  {
    title: 'Sustentacao no medio prazo',
    text: 'Contrato deve seguir viavel com mudancas de fase da familia, e nao apenas no primeiro ano.',
    Icon: ShieldCheck,
  },
];

const checklist = [
  'Definir quais beneficiarios entram agora e quais podem ser incluidos em etapas futuras.',
  'Mapear rede pediatrica, clinica medica, laboratorios e hospitais de referencia para a familia.',
  'Comparar cenario com e sem coparticipacao baseado no historico de uso familiar.',
  'Revisar carencias considerando consultas e exames mais provaveis para o proximo semestre.',
  'Avaliar impacto de reajuste por faixa etaria no planejamento financeiro anual.',
  'Validar regras de dependentes para evitar retrabalho em inclusoes futuras.',
];

const faq = [
  {
    question: 'Plano familiar sempre sai mais barato?',
    answer:
      'Nem sempre. O resultado depende da composicao de idades, modelo de custo e cobertura desejada. A comparacao deve ser feita por custo total anual.',
  },
  {
    question: 'Posso incluir dependentes depois da contratacao?',
    answer:
      'Em muitos casos, sim, conforme regras da operadora e documentacao exigida. O ideal e planejar isso desde a primeira analise.',
  },
  {
    question: 'Como escolher entre coparticipacao e sem coparticipacao para familia?',
    answer:
      'Depende da frequencia de uso. Familias com uso regular tendem a ganhar previsibilidade em modelos sem coparticipacao.',
  },
  {
    question: 'Como reduzir risco de arrependimento?',
    answer:
      'Checando rede real por cidade, simulando custo anual e revisando carencias antes da assinatura.',
  },
];

export default function PlanosFamiliaPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude familiar | Guia para escolher com seguranca"
        description="Guia completo para plano de saude familiar no RJ: composicao de vidas, rede, custo anual, coparticipacao e regras de dependentes."
        canonicalPath="/planos/familia"
        breadcrumbs={[
          { name: 'Planos', path: '/planos' },
          { name: 'Familia', path: '/planos/familia' },
        ]}
        faqItems={faq}
      />
      <PublicBreadcrumbs
        items={[
          { name: 'Planos', path: '/planos' },
          { name: 'Familia', path: '/planos/familia' },
        ]}
      />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Planos por perfil</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano familiar: como equilibrar cuidado, rede e previsibilidade financeira.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Quando a decisao envolve varias vidas, a estrategia precisa ser mais completa. O plano familiar ideal e
            aquele que protege a rotina da casa sem virar um custo imprevisivel no medio prazo.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {familyMoments.map((item) => (
            <article key={item.title} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Pilares de avaliacao</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">O que realmente pesa na escolha familiar</h2>
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
              <CalendarClock className="h-6 w-6 text-amber-300" />
              Checklist pratico de contratacao
            </h2>
            <ul className="mt-6 space-y-4">
              {checklist.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">Perguntas mais comuns de familias</h2>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Atendimento consultivo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Monte um comparativo familiar completo antes de assinar.
              </h2>
              <p className="mt-4 text-orange-50">
                Nosso time organiza uma recomendacao principal e alternativas para sua familia decidir com tranquilidade.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao familiar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/contato"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Falar com especialista
              </Link>
            </div>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
            <MapPin className="h-4 w-4" />
            Foco em rede funcional para familias no RJ
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
