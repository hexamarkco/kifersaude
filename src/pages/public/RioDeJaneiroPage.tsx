import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, MapPin, ShieldCheck, Stethoscope, WalletCards } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';
import PublicBreadcrumbs from '../../components/public/PublicBreadcrumbs';
import PublicSeo from '../../components/public/PublicSeo';

const regions = [
  {
    name: 'Zona Sul e Centro',
    notes: 'Demanda alta por rede hospitalar consolidada, pronto atendimento e acesso facil por deslocamento urbano.',
  },
  {
    name: 'Barra e Recreio',
    notes: 'Perfil que costuma priorizar capilaridade local de rede e previsibilidade para rotina familiar.',
  },
  {
    name: 'Zona Norte',
    notes: 'Comparativo deve considerar distancia real de hospitais e disponibilidade de laboratorios de referencia.',
  },
  {
    name: 'Zona Oeste',
    notes: 'A aderencia territorial da rede faz diferenca na experiencia de uso e na praticidade do dia a dia.',
  },
];

const pillars = [
  {
    title: 'Rede funcional por bairro',
    text: 'Nao basta a operadora ter nome forte. O ponto principal e funcionar nos bairros em que voce realmente circula.',
    Icon: MapPin,
  },
  {
    title: 'Custo total e nao apenas mensalidade',
    text: 'No Rio, deslocamento e frequencia de uso podem alterar custo real. Por isso projetamos o ano completo.',
    Icon: WalletCards,
  },
  {
    title: 'Cobertura para rotina e urgencia',
    text: 'A escolha precisa equilibrar uso preventivo, exames recorrentes e eventual necessidade hospitalar.',
    Icon: Building2,
  },
  {
    title: 'Recomendacao por perfil real',
    text: 'Cada proposta considera fase de vida, historico de uso e expectativa de previsibilidade financeira.',
    Icon: Stethoscope,
  },
];

const checklist = [
  'Mapear os 2 ou 3 hospitais realmente relevantes para sua rotina no Rio de Janeiro.',
  'Verificar laboratorios e especialidades que voce mais utiliza no seu territorio de deslocamento.',
  'Comparar cenarios com e sem coparticipacao a partir do seu historico de uso.',
  'Avaliar custo anual estimado para evitar decisao baseada apenas no primeiro boleto.',
  'Revisar carencias e regras de reajuste com horizonte de medio prazo.',
];

const faq = [
  {
    question: 'No Rio, rede muda muito de um bairro para outro?',
    answer: 'Sim. A disponibilidade pode variar bastante por regiao e por produto. Por isso a validacao precisa ser territorial.',
  },
  {
    question: 'Plano mais barato costuma atender bem na capital?',
    answer: 'Depende. Sem checagem de rede e uso real, o menor preco pode gerar custo maior e baixa aderencia no cotidiano.',
  },
  {
    question: 'Voces ajudam a comparar por bairro?',
    answer: 'Sim. Organizamos comparativo com foco em deslocamento real e pontos de atendimento relevantes para sua rotina.',
  },
];

export default function RioDeJaneiroPage() {
  return (
    <PublicLayout>
      <PublicSeo
        title="Plano de saude no Rio de Janeiro | Guia local completo"
        description="Comparativo local de plano de saude no Rio de Janeiro: rede por bairro, custo total, cobertura e criterios para escolher com seguranca."
        canonicalPath="/rio-de-janeiro"
        breadcrumbs={[{ name: 'Rio de Janeiro', path: '/rio-de-janeiro' }]}
        faqItems={faq}
      />
      <PublicBreadcrumbs items={[{ name: 'Rio de Janeiro', path: '/rio-de-janeiro' }]} />

      <section className="px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Atendimento local</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Plano de saude no Rio de Janeiro com analise por territorio de uso.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            No Rio, a qualidade da escolha depende de contexto local: bairro, deslocamento, hospitais de referencia e
            rotina de uso. Nosso comparativo e desenhado para essa realidade.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
          {regions.map((region) => (
            <article key={region.name} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">{region.name}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{region.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Pilares de escolha</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">O que avaliamos para contratacao na capital</h2>
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
              Checklist rapido para decidir
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
            <h2 className="text-2xl font-black">FAQ local do Rio de Janeiro</h2>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Comparativo local</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">
                Receba opcoes filtradas para sua rotina no Rio de Janeiro.
              </h2>
              <p className="mt-4 text-orange-50">
                Nossa equipe monta recomendacoes objetivas com foco em rede, custo e previsibilidade para o seu dia a dia.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/cotacao"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Solicitar cotacao no RJ
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
