import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldCheck,
  Stethoscope,
  UserRound,
  WalletCards,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const fitProfiles = [
  {
    title: 'Profissional autonomo',
    text: 'Perfil que precisa equilibrar previsibilidade mensal com acesso rapido a consultas e exames pontuais.',
    Icon: UserRound,
  },
  {
    title: 'Quem saiu de beneficio empresarial',
    text: 'Transicao de contrato corporativo para individual exige revisao de rede e carencia com cuidado.',
    Icon: ShieldCheck,
  },
  {
    title: 'Uso ambulatorial recorrente',
    text: 'Quando ha rotina de acompanhamento medico, o custo total de uso pesa mais que o preco de entrada.',
    Icon: Stethoscope,
  },
  {
    title: 'Planejamento preventivo',
    text: 'Para quem quer plano antes da urgencia e busca decisao estruturada com horizonte de medio prazo.',
    Icon: Clock3,
  },
];

const modelScenarios = [
  {
    scenario: 'Baixo uso previsto',
    recommendation: 'Coparticipacao pode ser vantajosa se houver disciplina de acompanhamento de gasto mensal.',
  },
  {
    scenario: 'Uso frequente de consultas/exames',
    recommendation: 'Modelos sem coparticipacao costumam trazer mais previsibilidade no custo anual.',
  },
  {
    scenario: 'Rede hospitalar muito especifica',
    recommendation: 'Priorizar aderencia de rede e deslocamento, mesmo que isso reduza opcoes de menor preco.',
  },
  {
    scenario: 'Orcamento apertado no curto prazo',
    recommendation: 'Comparar custo total projetado para evitar escolha que parece barata e encarece depois.',
  },
];

const checklist = [
  'Mapear hospitais, clinicas e laboratorios que voce realmente usa hoje.',
  'Definir teto mensal e limite anual de gasto com saude para guiar comparacao.',
  'Escolher entre previsibilidade (sem coparticipacao) ou entrada menor (com coparticipacao).',
  'Analisar carencias com base em necessidades de curto prazo e historico de uso.',
  'Revisar regra de reajuste para evitar surpresa em mudanca de faixa etaria.',
  'Assinar apenas apos comparar ao menos uma opcao principal e uma alternativa de seguranca.',
];

const pitfalls = [
  'Decidir por impulso com foco apenas no menor valor de mensalidade.',
  'Assumir cobertura de rede sem conferir cidade, bairro e produto especifico.',
  'Ignorar impacto da coparticipacao em perfil de uso frequente.',
  'Nao validar carencias para procedimentos que podem ser necessarios no curto prazo.',
];

const quickFaq = [
  {
    question: 'Plano PF costuma ter boa rede no RJ?',
    answer: 'Depende do produto e da cidade de uso. A analise precisa ser feita na proposta exata, nao apenas na marca da operadora.',
  },
  {
    question: 'Consigo migrar de plano sem ficar desassistido?',
    answer: 'Sim, com planejamento correto de transicao e leitura cuidadosa de carencia, prazo de ativacao e regras de portabilidade.',
  },
  {
    question: 'Vale contratar antes de ter uma necessidade urgente?',
    answer: 'Sim. A contratacao preventiva geralmente amplia opcoes e reduz risco de decisao acelerada sob pressao.',
  },
  {
    question: 'Quantas opcoes comparar?',
    answer: 'Normalmente 2 a 4 opcoes bem filtradas sao suficientes para uma decisao clara e objetiva.',
  },
];

export default function PlanosPessoaFisicaPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude pessoa fisica | Guia completo Kifer Saude"
        description="Entenda como escolher plano de saude pessoa fisica no RJ com criterio de rede, custo total, carencia e previsibilidade financeira."
        canonicalPath="/planos/pessoa-fisica"
        breadcrumbs={[
          { name: 'Planos', path: '/planos' },
          { name: 'Pessoa fisica', path: '/planos/pessoa-fisica' },
        ]}
        faqItems={quickFaq}
      />
      <PublicBreadcrumbs
        items={[
          { name: 'Planos', path: '/planos' },
          { name: 'Pessoa fisica', path: '/planos/pessoa-fisica' },
        ]}
      />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Planos por perfil</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude pessoa fisica: quando faz sentido e como escolher sem erro.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            O plano PF e uma das opcoes mais procuradas por quem quer autonomia na contratacao. A escolha correta,
            no entanto, depende de rede funcional, modelo financeiro e expectativa de uso real no dia a dia.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {fitProfiles.map(({ title, text, Icon }) => (
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

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Cenarios praticos</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Como definir o modelo de custo</h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-orange-100">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-orange-50 text-orange-800">
                <tr>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Cenario</th>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Recomendacao orientativa</th>
                </tr>
              </thead>
              <tbody>
                {modelScenarios.map((item) => (
                  <tr key={item.scenario} className="border-t border-orange-100">
                    <td className="px-5 py-4 font-semibold text-slate-900">{item.scenario}</td>
                    <td className="px-5 py-4 leading-relaxed text-slate-600">{item.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <WalletCards className="h-6 w-6 text-amber-300" />
              Checklist antes de assinar
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
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <AlertTriangle className="h-6 w-6 text-amber-300" />
              Armadilhas comuns
            </h2>
            <ul className="mt-6 space-y-4">
              {pitfalls.map((item) => (
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
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Duvidas frequentes sobre plano PF</h2>
          </div>

          <div className="mt-8 space-y-4">
            {quickFaq.map((item) => (
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Proximo passo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba um comparativo de plano PF ajustado ao seu perfil de uso.
              </h2>
              <p className="mt-4 text-orange-50">
                Incluimos analise de rede por cidade, modelo de custo e pontos de atencao de contrato para voce decidir
                com mais tranquilidade.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao
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
            Analise com foco em rede e uso no Rio de Janeiro
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
