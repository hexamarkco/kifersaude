import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase, CheckCircle2, HeartPulse, Landmark, Scale, UserRound, UsersRound } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const planTypes = [
  {
    title: 'Plano individual (PF)',
    audience: 'Quem busca cobertura para uso pessoal com contratacao direta.',
    goodFor: 'Perfis com rotina previsivel e preferencia por relacao contratual simples.',
    attention: 'Reajustes e rede devem ser lidos com cuidado para evitar escolha por preco inicial apenas.',
    Icon: UserRound,
  },
  {
    title: 'Plano familiar',
    audience: 'Familias que desejam concentrar beneficiarios no mesmo contrato.',
    goodFor: 'Quem precisa alinhar custo total, faixa etaria e cobertura para diferentes fases da vida.',
    attention: 'A composicao de idades muda o equilibrio financeiro do plano ao longo do tempo.',
    Icon: UsersRound,
  },
  {
    title: 'Plano MEI/CNPJ',
    audience: 'Microempreendedores, pequenos negocios e equipes em crescimento.',
    goodFor: 'Quem busca alternativa com potencial de custo competitivo e beneficios corporativos.',
    attention: 'Regras de elegibilidade, documentacao e manutencao cadastral precisam ser acompanhadas.',
    Icon: Briefcase,
  },
  {
    title: 'Plano senior e transicao de faixa',
    audience: 'Perfis que precisam olhar cobertura e previsibilidade com horizonte de longo prazo.',
    goodFor: 'Quem prioriza rede robusta, acompanhamento medico recorrente e estabilidade de atendimento.',
    attention: 'A decisao deve considerar historico de uso e impacto de reajustes por faixa etaria.',
    Icon: HeartPulse,
  },
];

const comparisonRows = [
  {
    criterion: 'Entrada financeira',
    pf: 'Mensalidade geralmente mais previsivel no inicio',
    familiar: 'Depende da composicao etaria dos beneficiarios',
    mei: 'Pode ter ganho de competitividade em varios cenarios',
  },
  {
    criterion: 'Complexidade documental',
    pf: 'Baixa a moderada',
    familiar: 'Moderada, com comprovacoes de vinculo',
    mei: 'Moderada a alta, com exigencias empresariais',
  },
  {
    criterion: 'Flexibilidade de composicao',
    pf: 'Focada no titular',
    familiar: 'Alta para estrutura familiar',
    mei: 'Alta para socios e colaboradores conforme regra',
  },
  {
    criterion: 'Posicionamento de custo no longo prazo',
    pf: 'Depende de uso e reajustes anuais',
    familiar: 'Sensivel a mudancas de faixa e inclusoes',
    mei: 'Pode ser eficiente se mantida governanca cadastral',
  },
];

const financialModels = [
  {
    title: 'Sem coparticipacao',
    text: 'Mensalidade mais alta em troca de maior previsibilidade no uso rotineiro. Costuma funcionar melhor para quem utiliza consultas e exames com frequencia.',
    Icon: Landmark,
  },
  {
    title: 'Com coparticipacao',
    text: 'Mensalidade inicial menor, com participacao em eventos de uso. Pode ser vantajoso para perfis de baixa frequencia, desde que exista disciplina de acompanhamento de custo.',
    Icon: Scale,
  },
];

const decisionGuide = [
  'Definir objetivo principal do plano: rotina preventiva, cobertura familiar ampla, ou transicao de contrato atual.',
  'Mapear hospitais, laboratorios e especialidades indispensaveis no territorio em que voce realmente circula.',
  'Comparar custo anual estimado e nao somente valor mensal de entrada do plano.',
  'Avaliar carencias e prazos de ativacao com base em necessidades de curto prazo.',
  'Validar regras de reajuste e faixas etarias para evitar surpresa no medio prazo.',
  'Fechar apenas quando a recomendacao fizer sentido no papel e na pratica de uso.',
];

const commonMistakes = [
  'Escolher plano por urgencia e descobrir depois que a rede principal nao atende sua regiao de uso.',
  'Ignorar coparticipacao em perfis de uso frequente e elevar o gasto total sem perceber.',
  'Nao revisar elegibilidade de dependentes no modelo empresarial antes de iniciar proposta.',
  'Assumir que toda carencia pode ser reduzida sem validar regra especifica da operadora.',
  'Nao organizar documentacao previamente e perder prazo de aprovacao por retrabalho.',
];

export default function PlanosPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Planos de saude | Guia completo para PF, familia, MEI e CNPJ</title>
        <meta
          name="description"
          content="Compare tipos de plano de saude, modelos financeiros e criterios de escolha. Guia completo da Kifer Saude para contratacao no Rio de Janeiro."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/planos" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Guia de contratacao</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Compare tipos de plano com criterio de uso, custo e previsibilidade.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Nesta pagina voce encontra um panorama completo para entender qual modelo de plano se encaixa melhor no seu
            contexto. O foco e clareza de decisao: menos impulso, mais estrategia.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2">
          {planTypes.map(({ title, audience, goodFor, attention, Icon }) => (
            <article key={title} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-900">Para quem: </strong>
                {audience}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-900">Quando costuma funcionar melhor: </strong>
                {goodFor}
              </p>
              <p className="mt-3 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-700">
                <strong className="text-orange-800">Ponto de atencao: </strong>
                {attention}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Tabela comparativa</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Visao rapida dos modelos mais procurados</h2>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-800 text-amber-200">
                <tr>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Criterio</th>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">PF</th>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Familiar</th>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">MEI/CNPJ</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.criterion} className="border-t border-slate-700 text-slate-200">
                    <td className="px-5 py-4 font-semibold">{row.criterion}</td>
                    <td className="px-5 py-4 leading-relaxed">{row.pf}</td>
                    <td className="px-5 py-4 leading-relaxed">{row.familiar}</td>
                    <td className="px-5 py-4 leading-relaxed">{row.mei}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Modelo financeiro</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Coparticipacao: quando ajuda e quando pesa</h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {financialModels.map(({ title, text, Icon }) => (
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

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900">Roteiro de escolha em 6 passos</h2>
            <ul className="mt-6 space-y-4">
              {decisionGuide.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-black text-slate-900">Erros comuns que encarecem a decisao</h2>
            <ul className="mt-6 space-y-4">
              {commonMistakes.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Pronto para comparar</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba uma recomendacao orientada para seu contexto real de uso.
              </h2>
              <p className="mt-4 text-orange-50">
                Nossa equipe monta o comparativo com base em objetivo, cidade de atendimento, modelo financeiro e fase de vida.
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
                to="/operadoras"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Ver detalhes das operadoras
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
