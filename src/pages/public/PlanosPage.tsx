import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import PublicBrandMark from '../../components/public/PublicBrandMark';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  HeartPulse,
  Landmark,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';

const planTypes = [
  {
    title: 'Plano individual (PF)',
    description: 'Para quem busca contratação direta e quer equilibrar previsibilidade de custo com cobertura para rotina pessoal.',
    bestFor: 'Perfis com uso moderado, que precisam de uma leitura clara de carência e reajuste.',
    Icon: UserRound,
  },
  {
    title: 'Plano familiar',
    description: 'Centraliza beneficiários em um mesmo contrato para organizar cobertura de diferentes fases da vida.',
    bestFor: 'Famílias que querem combinar rede de qualidade com controle do custo total da casa.',
    Icon: UsersRound,
  },
  {
    title: 'Plano MEI/CNPJ',
    description: 'Modelo empresarial com potencial de melhor relação custo-benefício quando existe elegibilidade correta.',
    bestFor: 'MEI, pequenas empresas e sócios que querem estrutura de benefício com governança documental.',
    Icon: Briefcase,
  },
  {
    title: 'Plano sênior e transição de faixa',
    description: 'Escolha orientada para continuidade de atendimento, previsibilidade e rede forte para acompanhamento recorrente.',
    bestFor: 'Quem prioriza estabilidade de uso e suporte em decisões de médio e longo prazo.',
    Icon: HeartPulse,
  },
];

const operatorProfiles = [
  {
    name: 'Amil',
    logo: '/amil-logo-1-2.png',
    highlight:
      'Portfólio amplo para diferentes perfis, com opções que variam de entrada até categorias com cobertura mais robusta.',
  },
  {
    name: 'Bradesco Saúde',
    logo: '/bradesco-saude-logo-1-1.png',
    highlight:
      'Histórico forte em produtos corporativos e posicionamento premium para quem prioriza rede consolidada.',
  },
  {
    name: 'SulAmérica Saúde',
    logo: '/sulamerica-saude-logo.png',
    highlight:
      'Alternativas empresariais com boa flexibilidade de composição, dependendo do perfil e da região de uso.',
  },
  {
    name: 'Porto',
    logo: '/porto-logo.png',
    highlight: 'Foco em experiencia de servico e jornada mais assistida para familias e empresas que valorizam suporte.',
  },
  {
    name: 'Assim Saúde',
    logo: '/assim-saude-logo.png',
    highlight: 'Presença regional relevante no RJ para perfis que buscam cobertura local com análise de custo-benefício.',
  },
];

const decisionChecklist = [
  'Rede credenciada nos bairros e cidades onde você realmente circula.',
  'Custo anual projetado, e não apenas mensalidade de entrada.',
  'Leitura de carências e regras de uso antes da assinatura.',
  'Análise de coparticipação conforme frequência de consultas e exames.',
  'Impacto de reajuste e mudança de faixa etária no médio prazo.',
  'Capacidade de suporte operacional da operadora para o seu perfil.',
];

const financialModels = [
  {
    title: 'Sem coparticipação',
    text: 'Mensalidade maior, com mais previsibilidade no uso rotineiro. Em perfis de uso frequente, pode reduzir variação de gasto.',
    Icon: Landmark,
  },
  {
    title: 'Com coparticipação',
    text: 'Entrada inicial menor, com custo por utilização. Funciona melhor para baixo uso e quando existe disciplina de acompanhamento.',
    Icon: ShieldCheck,
  },
];

export default function PlanosPage() {
  return (
    <div className="marketing-theme kifer-ds kifer-home-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Planos de saúde | Kifer Saúde</title>
        <meta
          name="description"
          content="Guia completo para comparar tipos de plano e operadoras no RJ com criterio de rede, uso e custo total."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/planos" />
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-lg shadow-slate-900/30">
              <PublicBrandMark className="h-5 w-auto text-white" />
            </span>
            <span>
              <span className="marketing-display block text-2xl font-semibold leading-none">Kifer Saúde</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">guia de planos</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <Link to="/" className="transition hover:text-slate-900">
              Início
            </Link>
            <a href="#operadoras" className="transition hover:text-slate-900">
              Operadoras
            </a>
            <a href="#criterios" className="transition hover:text-slate-900">
              Critérios
            </a>
          </nav>

          <Link
            to="/lp"
            className="ks-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white"
          >
            Falar com especialista
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="pb-24">
        <section className="px-4 pb-10 pt-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl marketing-reveal">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">pagina reconstruida</p>
            <h1 className="marketing-display mt-4 max-w-5xl text-5xl font-semibold leading-[0.95] text-slate-900 md:text-7xl">
              Compare planos com criterio de uso, cobertura e custo anual.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
              O objetivo desta página é concentrar tudo que realmente importa para sua decisão: tipos de contratação,
              operadoras parceiras e checklist prático para evitar erro caro.
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
            {planTypes.map(({ title, description, bestFor, Icon }, index) => (
              <article
                key={title}
                className={`marketing-surface ks-card marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index >= 2 ? 'marketing-delay-2' : ''}`}
              >
                <span className="inline-flex rounded-xl bg-slate-100 p-3 text-slate-700">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
                <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  <strong className="font-black">Melhor para: </strong>
                  {bestFor}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="operadoras" className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">operadoras</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Comparativo de operadoras na mesma página</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Conforme solicitado, o conteúdo de /operadoras foi consolidado aqui para facilitar análise em um único fluxo.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {operatorProfiles.map((operator, index) => (
                <article
                  key={operator.name}
                  className={`marketing-surface ks-card marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index >= 2 ? 'marketing-delay-2' : ''}`}
                >
                  <div className="flex h-14 items-center">
                    <img src={operator.logo} alt={`Logo ${operator.name}`} className="max-h-10 w-auto object-contain" loading="lazy" />
                  </div>
                  <h3 className="mt-4 text-xl font-black text-slate-900">{operator.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{operator.highlight}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">modelo financeiro</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold">Quando a coparticipação ajuda e quando ela pesa</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {financialModels.map(({ title, text, Icon }, index) => (
                <article
                  key={title}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-7 marketing-reveal ${index === 1 ? 'marketing-delay-1' : ''}`}
                >
                  <span className="inline-flex rounded-xl bg-cyan-300/15 p-3 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-2xl font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="criterios" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
            <article className="marketing-surface ks-card marketing-reveal rounded-2xl p-7">
              <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <Building2 className="h-6 w-6 text-sky-700" />
                Checklist antes de assinar
              </h2>
              <ul className="mt-6 space-y-4">
                {decisionChecklist.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-surface ks-card marketing-reveal marketing-delay-1 rounded-2xl p-7">
              <h2 className="text-2xl font-black text-slate-900">Como usamos estes critérios na consultoria</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                 Primeiro entendemos seu objetivo real de uso. Depois filtramos opções viáveis, comparamos custo anual e
                 validamos rede funcional por território. Só então recomendamos um plano principal e alternativas seguras.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                 Essa abordagem reduz risco de arrependimento e evita contratação baseada apenas em valor de entrada.
              </p>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                Resultado esperado: decisão técnica com linguagem simples e acompanhamento até a ativação.
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-10 text-white shadow-[0_40px_80px_-48px_rgba(15,23,42,0.52)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">fale com a equipe</p>
                <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Quer uma recomendação para o seu perfil?
                </h2>
                <p className="mt-4 max-w-2xl text-slate-200">
                  Receba um comparativo objetivo com plano principal, alternativa de segurança e orientação completa de
                  contratação.
                </p>
              </div>

              <div className="space-y-3">
                <Link
                  to="/lp"
                  className="ks-btn-secondary inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800"
                >
                  Solicitar cotação
                </Link>
                <Link
                  to="/"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/45 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  Voltar para home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
