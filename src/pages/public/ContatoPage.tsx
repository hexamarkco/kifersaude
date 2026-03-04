import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, Mail, MapPin, MessageCircle, Phone, Send, ShieldCheck } from 'lucide-react';
import PublicLayout from '../../components/public/PublicLayout';

const channels = [
  {
    title: 'WhatsApp',
    detail: 'Canal mais rapido para triagem e envio de dados iniciais.',
    value: '(21) 97930-2389',
    href: 'https://wa.me/5521979302389',
    Icon: MessageCircle,
  },
  {
    title: 'Telefone',
    detail: 'Ideal para quem prefere conversar por ligacao.',
    value: '(21) 97930-2389',
    href: 'tel:+5521979302389',
    Icon: Phone,
  },
  {
    title: 'E-mail',
    detail: 'Bom para enviar contexto detalhado e documentos.',
    value: 'contato@kifersaude.com.br',
    href: 'mailto:contato@kifersaude.com.br',
    Icon: Mail,
  },
];

const prepSteps = [
  'Informe cidade de uso principal e, se possivel, bairros onde costuma buscar atendimento.',
  'Conte quantas vidas serao incluidas e faixa etaria aproximada de cada uma.',
  'Defina seu objetivo: menor mensalidade, rede especifica, previsibilidade ou equilibrio geral.',
  'Se ja possui plano, compartilhe o que funciona e o que hoje esta gerando insatisfacao.',
  'Caso tenha urgencia de contratacao, sinalize prazos para priorizarmos o fluxo.',
];

const quickAnswers = [
  {
    title: 'Atendem apenas Rio de Janeiro?',
    answer: 'Nosso foco principal e RJ e Grande Rio, com consultoria orientada a realidade local de rede e deslocamento.',
  },
  {
    title: 'Tem horario fixo para atendimento?',
    answer: 'Atendemos em horario comercial e organizamos retornos em janelas combinadas para nao deixar o processo parado.',
  },
  {
    title: 'Posso iniciar sem toda documentacao em maos?',
    answer: 'Sim. A triagem inicial acontece primeiro, e depois enviamos checklist de documentos para avancar na proposta.',
  },
  {
    title: 'Quanto tempo para receber um comparativo?',
    answer: 'Na maioria dos cenarios, o comparativo inicial sai no mesmo dia util ou no dia util seguinte.',
  },
];

export default function ContatoPage() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Contato | Fale com a equipe Kifer Saude</title>
        <meta
          name="description"
          content="Entre em contato com a Kifer Saude por WhatsApp, telefone ou e-mail. Atendimento consultivo para planos de saude no Rio de Janeiro."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/contato" />
      </Helmet>

      <section className="px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-600">Fale com a gente</p>
          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Atendimento direto com especialistas para orientar sua escolha de plano.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Se voce quer comparar opcoes com clareza, estamos prontos para ajudar. Nosso atendimento e consultivo,
            objetivo e focado no seu contexto real de uso.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {channels.map(({ title, detail, value, href, Icon }) => (
            <a
              key={title}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-600">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{detail}</p>
              <p className="mt-5 text-sm font-bold text-orange-700">{value}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-orange-100 bg-orange-50/30 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <Send className="h-6 w-6 text-orange-500" />
              Como acelerar seu atendimento
            </h2>
            <ul className="mt-6 space-y-4">
              {prepSteps.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-orange-100 bg-white p-7 shadow-sm">
            <h2 className="flex items-center gap-2 text-2xl font-black text-slate-900">
              <CalendarClock className="h-6 w-6 text-orange-500" />
              Agenda de atendimento
            </h2>
            <div className="mt-6 space-y-4 text-sm text-slate-600">
              <p>
                <strong className="text-slate-900">Horario principal:</strong> segunda a sexta em horario comercial.
              </p>
              <p>
                <strong className="text-slate-900">Retornos:</strong> organizados por prioridade e complexidade para manter
                previsibilidade no fluxo de atendimento.
              </p>
              <p>
                <strong className="text-slate-900">Cobertura geografia:</strong> Rio de Janeiro, Grande Rio e municipios com
                atendimento remoto estruturado.
              </p>
              <p className="rounded-xl bg-orange-50 px-4 py-3 text-orange-700">
                Para demandas urgentes, sinalize no primeiro contato para acelerarmos a triagem.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <MapPin className="h-6 w-6 text-amber-300" />
              Atendimento com foco regional
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Conhecemos a dinamica de rede e deslocamento do RJ para orientar escolhas com mais aderencia. Esse
              conhecimento local faz diferenca na experiencia de uso depois da assinatura.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-700 bg-slate-800/70 p-7">
            <h2 className="flex items-center gap-2 text-2xl font-black">
              <ShieldCheck className="h-6 w-6 text-amber-300" />
              Duvidas rapidas
            </h2>
            <div className="mt-5 space-y-4">
              {quickAnswers.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-700 bg-slate-900/30 p-4">
                  <p className="text-sm font-bold text-white">{item.title}</p>
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-100">Vamos comecar</p>
              <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">Pronto para receber seu comparativo?</h2>
              <p className="mt-4 text-orange-50">
                Abra a solicitacao e nossa equipe conduz o processo com clareza desde o primeiro contato.
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
              <a
                href="https://wa.me/5521979302389"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white"
              >
                Ir para WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
