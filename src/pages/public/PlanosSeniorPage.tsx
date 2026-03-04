import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserRound,
  WalletCards,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const priorities = [
  {
    title: 'Rede robusta para acompanhamento',
    text: 'Importa garantir acesso consistente a especialidades e exames de rotina em territorios de uso frequente.',
    Icon: Stethoscope,
  },
  {
    title: 'Previsibilidade no medio prazo',
    text: 'A escolha deve considerar horizonte financeiro de varios anos, nao somente o valor inicial.',
    Icon: WalletCards,
  },
  {
    title: 'Uso assistencial continuo',
    text: 'Planos para publico senior tendem a exigir leitura cuidadosa de cobertura e dinamica de atendimento.',
    Icon: HeartPulse,
  },
  {
    title: 'Suporte ativo no pos-venda',
    text: 'Apoio continuo facilita utilizacao correta do plano e reduz desgaste operacional da familia.',
    Icon: ShieldCheck,
  },
];

const decisionSteps = [
  'Mapear historico de uso medico e especialidades de maior recorrencia.',
  'Priorizar rede com acesso viavel para consultas, exames e eventual internacao.',
  'Comparar modelos financeiros com foco em estabilidade e previsibilidade.',
  'Revisar regras de carencia e impactos de reajuste para o horizonte de contratacao.',
  'Escolher opcoes que mantenham equilibrio entre cobertura e capacidade financeira.',
];

const warningPoints = [
  'Escolher plano pela mensalidade mais baixa sem validar estrutura de rede senior.',
  'Ignorar impacto de reajuste e perder previsibilidade no medio prazo.',
  'Desconsiderar a necessidade de suporte para uso frequente do plano.',
  'Nao alinhar expectativa da familia sobre rotina de atendimento e deslocamento.',
];

const faq = [
  {
    question: 'Plano senior e igual ao plano tradicional?',
    answer: 'A logica contratual pode ser semelhante, mas a estrategia de escolha muda porque o perfil de uso costuma ser mais recorrente.',
  },
  {
    question: 'Como evitar surpresa de custo depois?',
    answer: 'Projetando cenario anual, revisando regras de reajuste e escolhendo modelo financeiro coerente com a rotina de uso.',
  },
  {
    question: 'Rede local faz tanta diferenca assim?',
    answer: 'Sim. No publico senior, deslocamento e acesso rapido a atendimento influenciam diretamente a qualidade da experiencia.',
  },
  {
    question: 'Vale contratar sem apoio consultivo?',
    answer: 'E possivel, mas o risco de escolher plano desalinhado aumenta quando nao ha comparativo estruturado por perfil de uso.',
  },
];

export default function PlanosSeniorPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude senior | Guia de escolha com foco em previsibilidade"
        description="Guia de plano de saude senior no RJ: rede assistencial, custo no medio prazo, carencias e criterios para escolher com seguranca."
        canonicalPath="/planos/senior"
        breadcrumbs={[
          { name: 'Planos', path: '/planos' },
          { name: 'Senior', path: '/planos/senior' },
        ]}
        faqItems={faq}
      />
      <PublicBreadcrumbs
        items={[
          { name: 'Planos', path: '/planos' },
          { name: 'Senior', path: '/planos/senior' },
        ]}
      />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Planos por perfil</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano senior: escolha com foco em cuidado continuo e previsibilidade financeira.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Para o publico senior, a decisao precisa olhar cobertura real, estabilidade de custo e facilidade de uso.
            Um comparativo bem feito reduz risco de arrependimento e melhora seguranca da familia.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {priorities.map(({ title, text, Icon }) => (
            <article key={title} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <UserRound className="h-6 w-6 text-amber-300" />
              Passos para escolher melhor
            </h2>
            <ul className="mt-6 space-y-4">
              {decisionSteps.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Clock3 className="h-6 w-6 text-amber-300" />
              Pontos de atencao mais comuns
            </h2>
            <ul className="mt-6 space-y-4">
              {warningPoints.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">FAQ rapido</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Duvidas frequentes sobre plano senior</h2>
          </div>
          <div className="mt-8 space-y-4">
            {faq.map((item) => (
              <article key={item.question} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
                <h3 className="text-lg font-black text-slate-900">{item.question}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Apoio especializado</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Monte uma estrategia senior com foco em estabilidade e acesso.
              </h2>
              <p className="mt-4 text-orange-50">
                Nossa equipe ajuda sua familia a comparar opcoes com criterio de longo prazo e mais seguranca na decisao.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar analise senior
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
            Foco em rede e rotina assistencial no RJ
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
