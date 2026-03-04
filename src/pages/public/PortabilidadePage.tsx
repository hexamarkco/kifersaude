import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileStack,
  RefreshCcw,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const whenToConsider = [
  'Insatisfacao recorrente com rede de atendimento no seu territorio de uso.',
  'Custo atual fora do planejamento, sem contrapartida de cobertura adequada.',
  'Mudanca de rotina familiar ou profissional que exige outra configuracao de plano.',
  'Necessidade de revisar modelo financeiro (coparticipacao versus previsibilidade).',
];

const migrationSteps = [
  {
    step: '1. Diagnostico do plano atual',
    description: 'Levantamos pontos de dor reais: rede, custo, uso e limitacoes operacionais percebidas.',
  },
  {
    step: '2. Validacao de elegibilidade',
    description: 'Checamos criterios de migracao/portabilidade para evitar tentativa inviavel.',
  },
  {
    step: '3. Comparativo de alternativas',
    description: 'Selecionamos opcoes com ganho concreto de aderencia, e nao apenas troca de operadora por trocar.',
  },
  {
    step: '4. Planejamento de transicao',
    description: 'Organizamos calendario e documentos para reduzir risco de descontinuidade no atendimento.',
  },
  {
    step: '5. Proposta e acompanhamento',
    description: 'Acompanhamos retorno da operadora e tratamos pendencias ate a confirmacao final.',
  },
];

const checklist = [
  'Dados completos do plano atual e historico recente de utilizacao.',
  'Comprovantes solicitados para analise de elegibilidade e adimplencia.',
  'Mapa de rede que precisa ser mantida ou melhorada na nova opcao.',
  'Definicao de teto financeiro para contratacao e manutencao no medio prazo.',
  'Cronograma de transicao para evitar lacunas de cobertura assistencial.',
];

const warningPoints = [
  'Trocar de plano sem confirmar regras de elegibilidade e acabar em retrabalho.',
  'Comparar apenas preco e perder qualidade de rede fundamental para sua rotina.',
  'Nao planejar prazos e correr risco de transicao com cobertura desalinhada.',
  'Ignorar leitura contratual e repetir no novo plano os mesmos problemas do atual.',
];

const faq = [
  {
    question: 'Portabilidade sempre elimina carencia?',
    answer:
      'Nao necessariamente. Depende das regras aplicaveis ao seu caso. Por isso avaliamos elegibilidade antes de qualquer decisao.',
  },
  {
    question: 'Vale migrar apenas para reduzir mensalidade?',
    answer:
      'So quando o ganho financeiro nao compromete rede e previsibilidade de uso. O ideal e olhar custo total e aderencia juntos.',
  },
  {
    question: 'Quanto tempo leva uma transicao?',
    answer: 'Varia por operadora e documentacao, mas com processo organizado o fluxo tende a ser mais rapido e seguro.',
  },
  {
    question: 'Posso fazer tudo sozinho?',
    answer:
      'Pode, mas apoio consultivo reduz risco de erro documental e melhora qualidade da comparacao entre alternativas.',
  },
];

export default function PortabilidadePage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Portabilidade e migracao de plano de saude | Kifer Saude</title>
        <meta
          name="description"
          content="Guia de portabilidade e migracao de plano de saude no RJ: elegibilidade, checklist, riscos comuns e processo de transicao com seguranca."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/portabilidade" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Mudanca de plano</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Portabilidade e migracao: troque de plano com estrategia e sem improviso.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Mudar de plano pode resolver problemas de rede, custo e aderencia, mas exige processo tecnico para reduzir
            risco de erro. A chave e planejar a transicao com criterio e validacao de elegibilidade.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-orange-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900">Quando vale considerar a mudanca</h2>
          <ul className="mt-6 space-y-4">
            {whenToConsider.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Passo a passo</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Fluxo de portabilidade com controle de risco</h2>
          </div>
          <div className="mt-10 space-y-4">
            {migrationSteps.map((item) => (
              <article key={item.step} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
                <h3 className="text-xl font-black text-slate-900">{item.step}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <FileStack className="h-6 w-6 text-amber-300" />
              Checklist para iniciar
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
              Erros que mais comprometem a troca
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
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Duvidas frequentes sobre portabilidade</h2>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Transicao assistida</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Planeje sua mudanca de plano com seguranca e clareza.
              </h2>
              <p className="mt-4 text-orange-50">
                Avaliamos elegibilidade, cenarios de custo e rede para voce migrar sem trocar um problema por outro.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar analise de migracao
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
            <RefreshCcw className="h-4 w-4" />
            Migracao orientada para reduzir risco de descontinuidade
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
            <Clock3 className="h-4 w-4" />
            Processo com etapas claras e acompanhamento ativo
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
            <Scale className="h-4 w-4" />
            Decisao baseada em comparativo tecnico, nao em promessa comercial
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
            <ShieldCheck className="h-4 w-4" />
            Suporte do inicio da analise ate a ativacao final
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
