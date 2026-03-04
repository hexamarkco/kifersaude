import { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, HelpCircle, MessageCircle } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

type FaqCategory = {
  title: string;
  description: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
};

const faqCategories: FaqCategory[] = [
  {
    title: 'Contratacao e escolha do plano',
    description: 'Perguntas para quem esta iniciando a avaliacao e quer comparar com mais criterio.',
    items: [
      {
        question: 'Como sei se devo contratar PF, familiar ou MEI/CNPJ?',
        answer:
          'A escolha depende da composicao de vidas, do objetivo de uso e do modelo financeiro mais sustentavel. Na consultoria, avaliamos elegibilidade, rede e custo total para indicar o formato mais coerente.',
      },
      {
        question: 'Vale a pena escolher o plano mais barato?',
        answer:
          'Nem sempre. O menor preco de entrada pode gerar custo total maior se a rede nao atender bem ou se a coparticipacao pesar na rotina. O ideal e comparar custo anual estimado e aderencia de uso.',
      },
      {
        question: 'Quantas opcoes devo comparar antes de decidir?',
        answer:
          'Normalmente 2 a 4 opcoes bem filtradas sao suficientes. Comparar dezenas de propostas sem criterio costuma aumentar confusao e atrasar a decisao.',
      },
      {
        question: 'A Kifer Saude cobra taxa de consultoria?',
        answer:
          'Nao. O atendimento consultivo para orientacao e comparativo e gratuito para o cliente final.',
      },
      {
        question: 'Posso contratar mesmo sem decidir tudo no primeiro contato?',
        answer:
          'Sim. O processo e gradual. Comecamos com triagem, ajustamos as opcoes e voce decide no seu ritmo, com informacoes claras.',
      },
    ],
  },
  {
    title: 'Rede credenciada e cobertura',
    description: 'Duvidas comuns sobre hospitais, laboratorios, abrangencia e uso pratico do plano.',
    items: [
      {
        question: 'Como confirmar se um hospital especifico esta na rede?',
        answer:
          'A validacao e feita no produto exato da proposta, considerando cidade e categoria contratada. Nao basta confirmar apenas o nome da operadora.',
      },
      {
        question: 'Plano com abrangencia nacional e sempre melhor?',
        answer:
          'Depende da sua rotina. Para quem quase nao viaja, uma cobertura regional bem estruturada pode trazer melhor relacao custo-beneficio.',
      },
      {
        question: 'Consultas e exames sao liberados imediatamente?',
        answer:
          'Cada contrato possui regras de carencia. Em geral, urgencia e emergencia tem prazo reduzido, enquanto consultas e exames podem variar conforme produto.',
      },
      {
        question: 'Posso manter meus medicos atuais?',
        answer:
          'Se estiverem na rede credenciada do plano escolhido, sim. Por isso, mapeamos profissionais e instituicoes prioritarias antes da decisao.',
      },
      {
        question: 'O que muda entre enfermaria e apartamento?',
        answer:
          'A principal diferenca esta no tipo de acomodacao em internacao. Essa escolha impacta custo e experiencia de uso em casos hospitalares.',
      },
    ],
  },
  {
    title: 'Custos, reajustes e coparticipacao',
    description: 'Pontos financeiros que mais geram duvidas durante a contratacao.',
    items: [
      {
        question: 'O que e coparticipacao na pratica?',
        answer:
          'E quando, alem da mensalidade, existe cobranca por uso de determinados servicos. Pode funcionar bem em baixo uso, mas precisa de controle para nao elevar o gasto total.',
      },
      {
        question: 'Como o reajuste anual funciona?',
        answer:
          'O reajuste varia conforme tipo de contrato e regras da operadora/ANS. O importante e simular cenarios futuros antes de assinar.',
      },
      {
        question: 'Faixa etaria altera muito o valor?',
        answer:
          'Sim, pode alterar. Por isso, analisamos o horizonte de medio prazo para evitar escolhas que parecam boas apenas no primeiro ano.',
      },
      {
        question: 'Existe custo escondido alem da mensalidade?',
        answer:
          'Em alguns casos, sim: coparticipacao, taxas previstas em contrato e impacto de reajuste. Nosso trabalho e explicitar esses pontos antes da contratacao.',
      },
      {
        question: 'Como comparar dois planos com precos parecidos?',
        answer:
          'Compare rede efetiva, regras de uso, modelo de custo e previsibilidade anual. Preco igual nao significa proposta equivalente.',
      },
    ],
  },
  {
    title: 'Documentacao, aprovacao e pos-venda',
    description: 'Duvidas sobre prazos, envio de documentos e suporte apos assinatura.',
    items: [
      {
        question: 'Quanto tempo leva para aprovar uma proposta?',
        answer:
          'Depende da operadora e da completude documental. Com documentacao bem organizada, o processo tende a ser mais rapido.',
      },
      {
        question: 'Se faltar documento, perco a proposta?',
        answer:
          'Nem sempre. Em geral, a operadora sinaliza pendencia para ajuste. Acompanhamos esse retorno para evitar retrabalho.',
      },
      {
        question: 'Vocês ajudam depois da contratacao?',
        answer:
          'Sim. O pos-venda faz parte do nosso processo: orientacao de uso, duvidas operacionais e apoio em ajustes cadastrais.',
      },
      {
        question: 'Posso trocar de plano no futuro?',
        answer:
          'Sim, existem caminhos como migracao ou portabilidade, conforme elegibilidade e regras vigentes no momento da mudanca.',
      },
      {
        question: 'Como iniciar o atendimento agora?',
        answer:
          'Voce pode falar via WhatsApp, telefone ou preencher a solicitacao de cotacao. A triagem inicial ja direciona os proximos passos.',
      },
    ],
  },
];

export default function FaqPage() {
  const [openItemKey, setOpenItemKey] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    setOpenItemKey((current) => (current === key ? null : key));
  };

  return (
    <PublicLayout>
      <Helmet>
        <title>FAQ | Duvidas frequentes sobre planos de saude</title>
        <meta
          name="description"
          content="Perguntas frequentes sobre contratacao, rede, carencia, coparticipacao, reajuste e pos-venda de planos de saude com a Kifer Saude."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/faq" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Central de duvidas</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Perguntas frequentes com respostas completas para contratar com mais confianca.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Reunimos as duvidas mais comuns dos nossos atendimentos para facilitar sua decisao. Se nao encontrar sua
            pergunta, nossa equipe ajuda no seu caso especifico.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <article key={category.title} className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">Categoria {categoryIndex + 1}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{category.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{category.description}</p>

              <div className="mt-6 space-y-3">
                {category.items.map((item, itemIndex) => {
                  const itemKey = `${category.title}-${itemIndex}`;
                  const isOpen = openItemKey === itemKey;

                  return (
                    <div key={itemKey} className="overflow-hidden rounded-2xl border border-orange-100 bg-orange-50/30">
                      <button
                        type="button"
                        onClick={() => handleToggle(itemKey)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-semibold text-slate-900">{item.question}</span>
                        <ChevronDown
                          className={`h-5 w-5 flex-shrink-0 text-orange-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-slate-700">{item.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <HelpCircle className="h-6 w-6 text-amber-300" />
              Nao encontrou sua duvida?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Envie seu contexto e nossa equipe responde com orientacao objetiva, considerando seu perfil de uso,
              cidade e modelo de contratacao mais adequado.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <MessageCircle className="h-6 w-6 text-amber-300" />
              Atendimento humano e sem pressa comercial
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Nosso foco e clareza. Preferimos explicar com profundidade para voce decidir com seguranca, em vez de
              acelerar uma assinatura sem entendimento completo.
            </p>
          </article>
        </div>
      </section>

      <section className="px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] bg-gradient-to-r from-orange-500 to-amber-500 p-10 text-white shadow-2xl shadow-orange-200 md:p-14">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Proximo passo</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">Vamos responder suas duvidas no seu contexto real</h2>
              <p className="mt-4 text-orange-50">
                Fale com nossa equipe e receba orientacao personalizada para comparar opcoes de forma clara.
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
                Ver canais de contato
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
