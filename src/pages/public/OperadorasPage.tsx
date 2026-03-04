import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, MapPin, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const operatorProfiles = [
  {
    name: 'Amil',
    logo: '/amil-logo-1-2.png',
    highlights:
      'Portifolio amplo e alternativas para diferentes perfis de uso, com opcoes que variam de entrada a categorias mais completas.',
    bestFor: 'Quem busca equilibrar capilaridade de rede com variedade de produto por faixa de investimento.',
    attention: 'Validar rede efetiva por bairro/cidade antes da decisao final.',
  },
  {
    name: 'Bradesco Saude',
    logo: '/bradesco-saude-logo-1-1.png',
    highlights:
      'Marca forte em segmentos corporativos e produtos com posicionamento premium em varios cenarios.',
    bestFor: 'Empresas e familias que priorizam rede consolidada e previsibilidade de atendimento.',
    attention: 'Checar enquadramento de produto e regra contratual para o perfil de empresa.',
  },
  {
    name: 'SulAmerica Saude',
    logo: '/sulamerica-saude-logo.png',
    highlights:
      'Historico de produtos corporativos e flexibilidade de composicao em alguns perfis empresariais.',
    bestFor: 'Negocios e familias que demandam combinacao entre cobertura robusta e servicos de suporte.',
    attention: 'Comparar condicoes especificas de coparticipacao e abrangencia no contrato proposto.',
  },
  {
    name: 'Porto',
    logo: '/porto-logo.png',
    highlights:
      'Opcoes de saude com abordagem de servico e suporte, com foco em experiencia do beneficiario.',
    bestFor: 'Quem valoriza jornada assistida e relacao de atendimento mais estruturada.',
    attention: 'Avaliar rede local com foco no deslocamento real da rotina familiar ou empresarial.',
  },
  {
    name: 'Assim Saude',
    logo: '/assim-saude-logo.png',
    highlights:
      'Presenca regional relevante no RJ com opcoes bastante procuradas em determinadas faixas de custo.',
    bestFor: 'Perfis com necessidade de cobertura regional e analise cuidadosa de custo-beneficio local.',
    attention: 'Conferir com rigor a rede por especialidade e municipio de uso principal.',
  },
];

const evaluationPillars = [
  {
    title: 'Rede credenciada por territorio',
    text: 'Nao olhamos apenas nome do hospital. Verificamos aderencia da rede ao seu fluxo de deslocamento no dia a dia.',
    Icon: MapPin,
  },
  {
    title: 'Perfil clinico e faixa etaria',
    text: 'A recomendacao considera fase de vida, historico de uso e necessidade de especialidades recorrentes.',
    Icon: Stethoscope,
  },
  {
    title: 'Sustentabilidade financeira',
    text: 'Mensalidade, coparticipacao e reajuste sao analisados como custo anual estimado e nao so como preco inicial.',
    Icon: ShieldCheck,
  },
  {
    title: 'Governanca de contrato',
    text: 'Em planos empresariais, avaliamos regras operacionais para reduzir risco de pendencia e retrabalho.',
    Icon: Users,
  },
];

const validationQuestions = [
  'Os hospitais e laboratorios que voce realmente usa estao ativos na rede do produto ofertado?',
  'A rede funciona nas cidades onde voce mora, trabalha e costuma buscar atendimento?',
  'O modelo de custo (com ou sem coparticipacao) conversa com seu historico de uso?',
  'Existe previsao clara de reajuste e impacto de faixa etaria para seu perfil?',
  'As regras de elegibilidade e manutencao cadastral estao claras no contrato empresarial?',
  'A operadora tem canais de suporte aderentes ao nivel de acompanhamento que voce espera?',
];

export default function OperadorasPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Operadoras de saude | Comparativo pratico no RJ</title>
        <meta
          name="description"
          content="Conheca o perfil das principais operadoras parceiras da Kifer Saude e veja como comparar rede, cobertura e custo com criterio no Rio de Janeiro."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/operadoras" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Comparativo de operadoras</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Escolha de operadora com foco em rede real, perfil de uso e custo sustentavel.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Trabalhamos com as principais operadoras do mercado e orientamos a escolha com base em criterio pratico.
            O objetivo e encontrar aderencia no longo prazo, nao apenas uma proposta atraente no primeiro mes.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 xl:grid-cols-3">
          {operatorProfiles.map((operator) => (
            <article key={operator.name} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
              <div className="flex h-16 items-center">
                <img src={operator.logo} alt={`Logo ${operator.name}`} className="max-h-12 w-auto object-contain" />
              </div>
              <h2 className="mt-4 text-2xl font-black text-slate-900">{operator.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{operator.highlights}</p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                <strong className="text-slate-900">Perfil indicado: </strong>
                {operator.bestFor}
              </p>
              <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm leading-relaxed text-orange-700">
                <strong className="text-orange-800">Atencao: </strong>
                {operator.attention}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Pilares de analise</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Como estruturamos o comparativo entre operadoras</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {evaluationPillars.map(({ title, text, Icon }) => (
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
              Comparar e mais do que ver logo
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Marcas fortes sao importantes, mas a escolha correta depende de aderencia ao seu territorio de uso,
              previsibilidade financeira e qualidade de acesso para sua rotina. E por isso que o comparativo precisa ser
              contextualizado, e nao padronizado.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Em cada proposta, mapeamos o que realmente importa para o seu caso: rede funcional, custo total estimado,
              regras contratuais e estabilidade de uso no medio prazo.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="text-2xl font-black">Perguntas que voce deve validar antes de decidir</h2>
            <ul className="mt-6 space-y-4">
              {validationQuestions.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Proximo passo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Quer um comparativo de operadoras adaptado ao seu perfil?
              </h2>
              <p className="mt-4 text-orange-50">
                Organize sua decisao com apoio consultivo. Montamos uma recomendacao principal e alternativas para voce
                escolher com tranquilidade.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar comparativo
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
        </div>
      </section>
    </PublicLayout>
  );
}
