import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Compass, HeartHandshake, Lightbulb, Shield, Users } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const timeline = [
  {
    period: 'Inicio da operacao',
    title: 'Atendimento artesanal e proximo',
    description:
      'A Kifer Saude nasceu com um objetivo simples: traduzir um mercado complexo para uma conversa clara, sem termos tecnicos desnecessarios.',
  },
  {
    period: 'Evolucao de metodo',
    title: 'Processo consultivo por perfil de uso',
    description:
      'Passamos a estruturar o atendimento com diagnostico, curadoria e comparativo, reduzindo escolhas por impulso ou por promessa comercial.',
  },
  {
    period: 'Consolidacao regional',
    title: 'Foco em rede e realidade do RJ',
    description:
      'Com o crescimento da demanda, aprofundamos a leitura de rede hospitalar e deslocamento por cidade para melhorar aderencia do plano.',
  },
  {
    period: 'Portal multipaginas',
    title: 'Conteudo completo para decisao consciente',
    description:
      'Agora, alem da consultoria individual, reunimos guias, comparativos e FAQ detalhado para apoiar quem quer decidir com autonomia.',
  },
];

const values = [
  {
    title: 'Transparencia radical',
    text: 'Carencia, reajuste, coparticipacao e limitacoes sao explicados desde o inicio, de forma objetiva e documentada.',
    Icon: Shield,
  },
  {
    title: 'Empatia com criterio',
    text: 'Escutamos o contexto real de cada familia ou empresa, mas sempre com recomendacao tecnica e responsabilidade.',
    Icon: HeartHandshake,
  },
  {
    title: 'Educacao como estrategia',
    text: 'Nosso trabalho nao termina na venda. Investimos em conteudo para que o cliente compreenda o produto que contratou.',
    Icon: Lightbulb,
  },
  {
    title: 'Compromisso de longo prazo',
    text: 'Acompanhamos o pos-venda para manter a relacao de confianca e apoiar ajustes que surgem ao longo da vigencia.',
    Icon: Users,
  },
];

const method = [
  'Levantamos sua necessidade de uso e nao apenas o valor de mensalidade desejado.',
  'Filtramos opcoes que encaixam no perfil de rede, abrangencia e previsibilidade financeira.',
  'Mostramos vantagens e riscos de cada alternativa de forma comparavel e sem linguagem ambigua.',
  'Apoiamos a contratacao com check de documentacao e acompanhamento de retorno da operadora.',
  'Seguimos no pos-venda para apoiar uso, ajustes e duvidas operacionais do contrato.',
];

export default function SobrePage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Sobre a Kifer Saude | Historia, metodo e valores</title>
        <meta
          name="description"
          content="Conheca a historia da Kifer Saude, nossos valores, metodo consultivo e compromisso com atendimento humano em planos de saude no RJ."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/sobre" />
      </Helmet>

      <section className="px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Nossa historia</p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
              Construimos uma consultoria de saude para simplificar decisoes complexas.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              A Kifer Saude surgiu para resolver um problema recorrente: pessoas escolhendo plano no escuro, com base em
              pressa, medo de reajuste ou promessa comercial incompleta. Nosso papel e transformar essa decisao em um
              processo orientado por criterio, contexto real e comunicacao honesta.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Trabalhamos com foco no Rio de Janeiro, entendendo dinamicas locais de rede hospitalar, deslocamento,
              disponibilidade de atendimento e comportamento de uso por faixa etaria. Isso torna nossa recomendacao
              mais pratica e aderente ao dia a dia de cada cliente.
            </p>
          </div>

          <article className="rounded-3xl border border-orange-100 bg-white p-8 shadow-2xl shadow-orange-100">
            <img
              src="/image.png"
              alt="Luiza Kifer, fundadora da Kifer Saude"
              className="h-80 w-full rounded-2xl object-cover object-[center_30%]"
            />
            <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-orange-500">Fundadora</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Luiza Kifer</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              "Plano de saude nao e uma compra impulsiva. E uma decisao que afeta tranquilidade, previsibilidade
              financeira e acesso a cuidado. Por isso, orientacao clara e indispensavel."
            </p>
          </article>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Linha do tempo</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Evolucao da Kifer Saude</h2>
          </div>
          <div className="mt-10 space-y-5">
            {timeline.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-6">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">
                  {index + 1}. {item.period}
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Nossos valores</p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Principios que orientam cada recomendacao</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {values.map(({ title, text, Icon }) => (
              <article key={title} className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
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

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Como trabalhamos</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Metodo consultivo com foco em clareza e aderencia</h2>
            <p className="mt-4 text-slate-300">
              Nossa consultoria combina escuta ativa, criterio tecnico e transparencia comercial. Cada proposta e
              contextualizada para evitar decisao precipitada e reduzir chance de insatisfacao no curto prazo.
            </p>
          </div>
          <ul className="space-y-4">
            {method.map((item) => (
              <li key={item} className="flex gap-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-5 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-orange-100 bg-white p-10 shadow-xl shadow-orange-100 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Compromisso continuo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight text-slate-900 md:text-4xl">
                Nao encerramos no "contrato assinado".
              </h2>
              <p className="mt-4 text-slate-600">
                Seguimos presentes no pos-venda para apoiar o uso correto do plano e orientar ajustes quando a rotina
                muda. A relacao com nossos clientes e de longo prazo, com responsabilidade e disponibilidade.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/contato"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Falar com a equipe
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/planos"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
              >
                Ver guias de planos
              </Link>
              <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <Compass className="h-4 w-4" />
                Direcao clara para cada etapa
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
