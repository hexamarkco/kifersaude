import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  FileStack,
  Scale,
  ShieldCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const businessProfiles = [
  {
    title: 'MEI em fase de consolidacao',
    text: 'Busca alternativa de custo competitivo sem abrir mao de rede funcional para rotina de trabalho.',
  },
  {
    title: 'Pequena empresa com equipe enxuta',
    text: 'Precisa estruturar beneficio de saude com governanca simples e previsibilidade operacional.',
  },
  {
    title: 'Empresa em expansao',
    text: 'Quer crescimento com politica de beneficios consistente e menos retrabalho cadastral.',
  },
  {
    title: 'Socios e dependentes em composicao mista',
    text: 'Exige leitura detalhada de elegibilidade para evitar bloqueios na fase de proposta.',
  },
];

const pillars = [
  {
    title: 'Elegibilidade e enquadramento',
    text: 'Validar regra de entrada por perfil empresarial e evitar propostas inviaveis no inicio.',
    Icon: ShieldCheck,
  },
  {
    title: 'Governanca documental',
    text: 'Checklist claro reduz pendencias e acelera retorno da operadora durante aprovacao.',
    Icon: FileStack,
  },
  {
    title: 'Modelo financeiro empresarial',
    text: 'Analise de custo total para manter saude financeira da empresa no medio prazo.',
    Icon: WalletCards,
  },
  {
    title: 'Experiencia do beneficiario',
    text: 'Rede precisa atender rotina real de socios e colaboradores, nao apenas no papel.',
    Icon: Users,
  },
];

const documentChecklist = [
  'Cartao CNPJ atualizado e dados cadastrais da empresa.',
  'Documento societario aplicavel (contrato social ou CCMEI).',
  'Documentos pessoais dos socios e beneficiarios elegiveis.',
  'Comprovantes solicitados pela operadora para validacao de proposta.',
  'Informacoes de contato e enderecos para evitar divergencias cadastrais.',
];

const riskPoints = [
  'Iniciar proposta sem validar regra de elegibilidade de todos os beneficiarios.',
  'Escolher somente por mensalidade sem revisar qualidade da rede de atendimento.',
  'Subestimar impacto de coparticipacao em equipes com uso recorrente.',
  'Nao manter governanca de documentos e gerar pendencias constantes no contrato.',
  'Tratar beneficio de saude como decisao pontual, sem politica de medio prazo.',
];

const faq = [
  {
    question: 'MEI pode contratar plano empresarial?',
    answer: 'Sim, desde que atenda as regras de elegibilidade da operadora e apresente documentacao exigida.',
  },
  {
    question: 'Plano empresarial sempre economiza?',
    answer:
      'Pode ser vantajoso em muitos cenarios, mas precisa de comparacao tecnica para confirmar se rede e modelo financeiro realmente compensam.',
  },
  {
    question: 'Da para incluir dependentes de socios?',
    answer: 'Em varios produtos, sim, conforme regra contratual e comprovacoes de vinculo aplicaveis.',
  },
  {
    question: 'Qual o principal erro em contratacao CNPJ?',
    answer: 'Ignorar governanca operacional e fechar contrato sem planejamento de manutencao cadastral.',
  },
];

export default function PlanosMeiCnpjPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Plano de saude MEI e CNPJ | Guia empresarial completo</title>
        <meta
          name="description"
          content="Guia completo de plano de saude para MEI e CNPJ: elegibilidade, documentacao, custo empresarial e criterios de escolha no RJ."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/planos/mei-cnpj" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Planos por perfil</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude para MEI e CNPJ com estrategia, governanca e previsibilidade.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            No modelo empresarial, a escolha certa nao depende so de preco. Elegibilidade, documentacao e operacao do
            contrato fazem toda diferenca para manter o beneficio funcionando com estabilidade.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {businessProfiles.map((item) => (
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
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Pilares da contratacao empresarial</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">O que avaliamos no plano MEI/CNPJ</h2>
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
              <Building2 className="h-6 w-6 text-amber-300" />
              Checklist documental essencial
            </h2>
            <ul className="mt-6 space-y-4">
              {documentChecklist.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <Scale className="h-6 w-6 text-amber-300" />
              Riscos que mais travam a contratacao
            </h2>
            <ul className="mt-6 space-y-4">
              {riskPoints.map((item) => (
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
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Duvidas comuns no plano empresarial</h2>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Atendimento empresarial</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Estruture seu plano MEI/CNPJ com menos risco operacional.
              </h2>
              <p className="mt-4 text-orange-50">
                Ajudamos desde a triagem de elegibilidade ate o acompanhamento de aprovacao e pos-venda do contrato.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao MEI/CNPJ
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/contato"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Falar com consultor
              </Link>
            </div>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-100">
            <Briefcase className="h-4 w-4" />
            Solucao para MEI, pequena empresa e equipe em crescimento
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
