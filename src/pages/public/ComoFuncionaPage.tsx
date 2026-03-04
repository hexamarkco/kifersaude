import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, FileStack, Handshake, SearchCheck, Timer, WalletCards } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const processSteps = [
  {
    step: '01',
    title: 'Briefing inicial no WhatsApp ou telefone',
    description:
      'Coletamos dados essenciais de perfil, cidade de uso, faixa de investimento e objetivo principal da contratacao.',
    output: 'Mapa de prioridade do cliente e checklist de dados pendentes.',
  },
  {
    step: '02',
    title: 'Diagnostico de aderencia',
    description:
      'Avaliamos se o perfil pede PF, familiar, MEI ou empresarial e quais combinacoes devem ser evitadas para nao gerar friccao no uso.',
    output: 'Definicao de estrategia de contratacao e recorte de operadoras.',
  },
  {
    step: '03',
    title: 'Comparativo orientado por uso real',
    description:
      'Apresentamos opcoes com foco em rede hospitalar, carencia, coparticipacao, reajuste e previsibilidade de custo.',
    output: 'Quadro comparativo com recomendacao principal e alternativa de seguranca.',
  },
  {
    step: '04',
    title: 'Ajustes e validacao final',
    description:
      'Refinamos a escolha com base em duvidas, cenarios familiares e eventuais restricoes operacionais identificadas no processo.',
    output: 'Plano final aprovado para envio de proposta.',
  },
  {
    step: '05',
    title: 'Envio de proposta e documentacao',
    description:
      'Organizamos os documentos exigidos e acompanhamos pendencias para acelerar aprovacao com a operadora.',
    output: 'Proposta protocolada com acompanhamento ativo ate retorno.',
  },
  {
    step: '06',
    title: 'Suporte de ativacao e pos-venda',
    description:
      'Apos a aprovacao, orientamos os primeiros passos de uso e permanecemos disponiveis para ajustes operacionais.',
    output: 'Cliente orientado para usar o plano com seguranca desde o primeiro dia.',
  },
];

const documentChecklist = [
  {
    profile: 'Pessoa fisica',
    items: 'RG/CPF, comprovante de residencia, dados de contato e informacoes dos dependentes (quando houver).',
  },
  {
    profile: 'Familia',
    items: 'Documentos do titular, certidoes ou comprovacao de vinculo dos dependentes e dados cadastrais completos.',
  },
  {
    profile: 'MEI/CNPJ',
    items: 'Cartao CNPJ, contrato social ou CCMEI, documentos dos socios e comprovantes cadastrais da empresa.',
  },
  {
    profile: 'Portabilidade',
    items: 'Informacoes do plano atual, comprovantes de adimplencia e dados para validacao de regras de migracao.',
  },
];

const decisionCriteria = [
  {
    title: 'Rede hospitalar e deslocamento',
    text: 'Se os hospitais e laboratorios relevantes para sua rotina estao na rede e com logistica viavel de atendimento.',
    Icon: SearchCheck,
  },
  {
    title: 'Comportamento de uso',
    text: 'Se o perfil e de uso eventual, familiar frequente ou com demanda recorrente de consultas e exames.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Modelo financeiro',
    text: 'Equilibrio entre mensalidade, coparticipacao e previsibilidade anual de custo para evitar sustos.',
    Icon: WalletCards,
  },
  {
    title: 'Regra de carencia e cobertura',
    text: 'Quando carencias podem impactar seu planejamento e quais coberturas sao indispensaveis para seu contexto.',
    Icon: FileStack,
  },
];

const expectations = [
  {
    topic: 'Primeiro retorno apos contato',
    timing: 'Normalmente no mesmo dia util',
    detail: 'Triagem inicial para entender objetivo e direcionar o briefing correto.',
  },
  {
    topic: 'Entrega do comparativo',
    timing: 'Entre poucas horas e 1 dia util',
    detail: 'Variacao depende da complexidade do perfil e da quantidade de vidas.',
  },
  {
    topic: 'Ajuste final de escolha',
    timing: 'Conforme validacao do cliente',
    detail: 'Refinamos ate que rede, custo e cobertura fiquem coerentes com o uso esperado.',
  },
  {
    topic: 'Aprovacao da proposta',
    timing: 'Prazo da operadora',
    detail: 'Acompanhamos pendencias para evitar retrabalho e atrasos desnecessarios.',
  },
];

const precautions = [
  'Nao decidir apenas pelo menor preco de entrada sem avaliar custo real de uso ao longo do ano.',
  'Confirmar rede hospitalar por cidade e nao assumir que a mesma rede vale para todo o estado.',
  'Entender quando a coparticipacao ajuda e quando ela pode aumentar muito o gasto mensal.',
  'Avaliar regras de reajuste e mudanca de faixa etaria com antecedencia para evitar surpresas.',
  'Revisar com atencao dados cadastrais na proposta para reduzir chance de pendencia operacional.',
];

export default function ComoFuncionaPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Como funciona | Processo de cotacao e contratacao Kifer Saude"
        description="Veja o processo completo da Kifer Saude: briefing, comparativo, validacao, documentacao e suporte no pos-venda para planos de saude no RJ."
        canonicalPath="/como-funciona"
        breadcrumbs={[{ name: 'Como funciona', path: '/como-funciona' }]}
      />
      <PublicBreadcrumbs items={[{ name: 'Como funciona', path: '/como-funciona' }]} />

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Metodo de trabalho</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Cada etapa existe para reduzir risco e aumentar clareza na sua decisao.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Nosso processo e desenhado para evitar contratacao no impulso. Da triagem inicial ao pos-venda, voce entende
            o por que de cada recomendacao e consegue escolher com mais seguranca.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
          {processSteps.map((item) => (
            <article key={item.step} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Etapa {item.step}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{item.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700">Entrega: {item.output}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Documentacao</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Checklist de documentos por perfil</h2>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-700">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-800 text-amber-200">
                <tr>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Perfil</th>
                  <th className="px-5 py-4 font-black uppercase tracking-[0.1em]">Documentos mais comuns</th>
                </tr>
              </thead>
              <tbody>
                {documentChecklist.map((row) => (
                  <tr key={row.profile} className="border-t border-slate-700 text-slate-200">
                    <td className="px-5 py-4 font-semibold">{row.profile}</td>
                    <td className="px-5 py-4 leading-relaxed">{row.items}</td>
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
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Criterios de avaliacao</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">O que analisamos em cada cotacao</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {decisionCriteria.map(({ title, text, Icon }) => (
              <article key={title} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-6">
                <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-xl font-black text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <Timer className="h-6 w-6 text-orange-500" />
              Prazos e expectativas realistas
            </h2>
            <div className="mt-6 space-y-4">
              {expectations.map((item) => (
                <div key={item.topic} className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                  <p className="text-sm font-black text-slate-900">{item.topic}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">{item.timing}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <Handshake className="h-6 w-6 text-orange-500" />
              Boas praticas antes de assinar
            </h2>
            <ul className="mt-6 space-y-4">
              {precautions.map((item) => (
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Pronto para comecar</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">Receba um plano de acao para sua cotacao</h2>
              <p className="mt-4 text-orange-50">
                Se voce quer agilizar a escolha com criterio, nossa equipe inicia pelo briefing e monta um comparativo
                alinhado ao seu objetivo de uso.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Iniciar cotacao
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/faq"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Revisar duvidas frequentes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
