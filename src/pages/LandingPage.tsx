import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, MessageCircle, ShieldCheck, Star } from 'lucide-react';
import { configService } from '../lib/configService';
import { supabase, type ConfigOption, type LeadOrigem, type LeadStatusConfig } from '../lib/supabase';

type FormValues = {
  nome: string;
  whatsapp: string;
  email: string;
  cidade: string;
  tipoContratacaoId: string;
};

type ContractTypeOption = {
  id: string;
  label: string;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

const fallbackContractTypes: ContractTypeOption[] = [
  { id: 'pf', label: 'Pessoa fisica' },
  { id: 'familia', label: 'Familia' },
  { id: 'mei-cnpj', label: 'MEI/CNPJ' },
];

const valuePills = ['Retorno no mesmo dia util', 'Comparativo tecnico', 'Atendimento humano', 'Suporte no pos-venda'];

const faqItems = [
  {
    question: 'Quanto tempo leva para receber o comparativo?',
    answer: 'Na maior parte dos casos, o primeiro comparativo chega no mesmo dia util, apos a triagem inicial.',
  },
  {
    question: 'A consultoria tem custo?',
    answer: 'Nao. O atendimento consultivo para orientacao e comparativo e gratuito para o cliente final.',
  },
  {
    question: 'Posso validar hospital especifico antes de contratar?',
    answer: 'Sim. Fazemos validacao por produto e territorio para evitar decisao com informacao incompleta.',
  },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatPhone = (rawValue: string) => {
  const digits = rawValue.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const resolveContractTypeOptions = (rows: Array<ConfigOption & { nome?: string | null }>) => {
  const normalized = rows
    .map((row) => {
      const labelCandidate =
        typeof row.label === 'string' && row.label.trim() !== ''
          ? row.label
          : typeof row.nome === 'string' && row.nome.trim() !== ''
            ? row.nome
            : typeof row.value === 'string' && row.value.trim() !== ''
              ? row.value
              : '';

      return {
        id: row.id,
        label: labelCandidate,
      };
    })
    .filter((option) => option.label !== '');

  return normalized.length > 0 ? normalized : fallbackContractTypes;
};

const findOriginId = (origins: LeadOrigem[]) => {
  const priorities = ['lp', 'landing', 'site'];
  const match = origins.find((origin) => {
    const normalized = normalizeText(origin.nome);
    return priorities.some((term) => normalized.includes(term));
  });

  return match?.id ?? origins[0]?.id ?? null;
};

const findStatusId = (statuses: LeadStatusConfig[]) => {
  const match = statuses.find((status) => normalizeText(status.nome).includes('novo'));
  return match?.id ?? statuses[0]?.id ?? null;
};

export default function LandingPage() {
  const [formData, setFormData] = useState<FormValues>({
    nome: '',
    whatsapp: '',
    email: '',
    cidade: '',
    tipoContratacaoId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [origins, setOrigins] = useState<LeadOrigem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusConfig[]>([]);
  const [contractTypeOptions, setContractTypeOptions] = useState<ContractTypeOption[]>(fallbackContractTypes);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [gtmId, setGtmId] = useState('');

  useEffect(() => {
    let active = true;

    const loadPageDependencies = async () => {
      const [originsResponse, statusesResponse, contractTypeResponse, metaPixelSetting, gtmSetting] = await Promise.all([
        supabase.from('lead_origens').select('*').eq('ativo', true),
        supabase.from('lead_status_config').select('*').eq('ativo', true).order('ordem', { ascending: true }),
        supabase.from('lead_tipos_contratacao').select('*').eq('ativo', true).order('ordem', { ascending: true }),
        configService.getIntegrationSetting('meta_pixel'),
        configService.getIntegrationSetting('google_tag_manager'),
      ]);

      if (!active) {
        return;
      }

      setOrigins(originsResponse.data ?? []);
      setStatuses(statusesResponse.data ?? []);
      const resolvedContractTypes = resolveContractTypeOptions(
        (contractTypeResponse.data ?? []) as Array<ConfigOption & { nome?: string | null }>,
      );
      setContractTypeOptions(resolvedContractTypes);

      const pixelId =
        metaPixelSetting?.settings && typeof metaPixelSetting.settings.pixelId === 'string'
          ? metaPixelSetting.settings.pixelId.trim()
          : '';
      const gtmContainerId =
        gtmSetting?.settings && typeof gtmSetting.settings.gtmId === 'string'
          ? gtmSetting.settings.gtmId.trim()
          : '';

      setMetaPixelId(pixelId);
      setGtmId(gtmContainerId);
    };

    loadPageDependencies();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (formData.tipoContratacaoId !== '' || contractTypeOptions.length === 0) {
      return;
    }

    setFormData((current) => ({
      ...current,
      tipoContratacaoId: contractTypeOptions[0].id,
    }));
  }, [contractTypeOptions, formData.tipoContratacaoId]);

  const metaPixelScript = useMemo(() => {
    if (!metaPixelId) {
      return null;
    }

    return `
      !function(f,b,e,v,n,t,s){
        if(f.fbq)return;
        n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;
        n.push=n;
        n.loaded=!0;
        n.version='2.0';
        n.queue=[];
        t=b.createElement(e);
        t.async=!0;
        t.src=v;
        s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)
      }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${metaPixelId}');
      fbq('track','PageView');
    `;
  }, [metaPixelId]);

  const gtmScript = useMemo(() => {
    if (!gtmId) {
      return null;
    }

    return `
      (function(w,d,s,l,i){
        w[l]=w[l]||[];
        w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
        var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),
          dl=l!='dataLayer'?'&l='+l:'';
        j.async=true;
        j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
        f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
  }, [gtmId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const cleanName = formData.nome.trim();
    const cleanPhone = formData.whatsapp.replace(/\D/g, '');

    if (cleanName.length < 3 || cleanPhone.length < 10) {
      setFeedback({
        type: 'error',
        message: 'Preencha nome e WhatsApp corretamente para continuar.',
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const selectedContractType = contractTypeOptions.find((option) => option.id === formData.tipoContratacaoId);

    const payload = {
      nome_completo: cleanName,
      telefone: cleanPhone,
      email: formData.email.trim() || null,
      cidade: formData.cidade.trim() || null,
      origem_id: findOriginId(origins),
      status_id: findStatusId(statuses),
      tipo_contratacao_id: formData.tipoContratacaoId || null,
      observacoes: `Lead via nova landing /lp - perfil: ${selectedContractType?.label ?? 'nao informado'}`,
      data_criacao: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      arquivado: false,
    };

    const { error } = await supabase.from('leads').insert([payload]);

    if (error) {
      setFeedback({
        type: 'error',
        message: 'Nao foi possivel enviar agora. Tente novamente em instantes ou chame no WhatsApp.',
      });
      setSubmitting(false);
      return;
    }

    if (typeof window !== 'undefined') {
      const trackedWindow = window as Window & {
        fbq?: (...args: unknown[]) => void;
        dataLayer?: Array<Record<string, unknown>>;
      };

      trackedWindow.fbq?.('track', 'Lead');
      if (Array.isArray(trackedWindow.dataLayer)) {
        trackedWindow.dataLayer.push({ event: 'lead_submit', source: 'lp' });
      }

      const encodedMessage = encodeURIComponent(
        `Ola! Acabei de preencher a landing da Kifer. Meu nome e ${cleanName} e quero receber o comparativo.`,
      );
      window.open(`https://wa.me/5521979302389?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
    }

    setFeedback({
      type: 'success',
      message: 'Recebemos seus dados. Abrimos o WhatsApp para acelerar seu atendimento.',
    });

    setFormData((current) => ({
      ...current,
      nome: '',
      whatsapp: '',
      email: '',
      cidade: '',
    }));

    setSubmitting(false);
  };

  const scrollToForm = () => {
    const formElement = document.getElementById('lead-form');
    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="marketing-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Cotacao de plano de saude | Kifer Saude</title>
        <meta
          name="description"
          content="Receba um comparativo de planos de saude com consultoria especializada no RJ. Atendimento humano e sem enrolacao."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/lp" />
        {metaPixelScript ? <script type="text/javascript">{metaPixelScript}</script> : null}
        {gtmScript ? <script type="text/javascript">{gtmScript}</script> : null}
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white shadow-lg shadow-slate-900/30">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <span className="marketing-display text-2xl font-semibold">Kifer Saude</span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="tel:+5521979302389"
              className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
            >
              (21) 97930-2389
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              Ver institucional
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-28 md:pb-16">
        <section className="relative overflow-hidden px-4 pb-14 pt-14 sm:px-6 lg:px-8">
          <div className="marketing-glow pointer-events-none absolute left-[-10rem] top-[-7rem] h-80 w-80 rounded-full bg-sky-300/32 blur-3xl" />
          <div className="marketing-glow pointer-events-none absolute bottom-[-8rem] right-[-10rem] h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">landing de conversao</p>
              <h1 className="marketing-display mt-4 text-5xl font-semibold leading-[0.95] text-slate-900 md:text-7xl">
                Seu comparativo de planos, com criterio e rapidez.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Sem letra miuda e sem empurro comercial. Preencha os dados e receba orientacao tecnica para contratar com
                seguranca no seu contexto real de uso.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-slate-900/25 transition hover:from-slate-800 hover:to-slate-700"
                >
                  Quero meu comparativo
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-7 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar no WhatsApp
                </a>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {valuePills.map((pill) => (
                  <div key={pill} className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">
                    {pill}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-1 text-sky-500">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <span className="font-semibold">Avaliacao media 4.9 de clientes atendidos.</span>
              </div>
            </div>

            <article id="lead-form" className="marketing-surface marketing-reveal marketing-delay-1 rounded-[2rem] p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">formulario rapido</p>
              <h2 className="marketing-display mt-3 text-4xl font-semibold text-slate-900">Receber analise personalizada</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Preenchimento em menos de 2 minutos. Nossa equipe retorna com os proximos passos de forma objetiva.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="nome" className="mb-2 block text-sm font-semibold text-slate-700">
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Como podemos te chamar?"
                  />
                </div>

                <div>
                  <label htmlFor="whatsapp" className="mb-2 block text-sm font-semibold text-slate-700">
                    WhatsApp
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    required
                    value={formData.whatsapp}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        whatsapp: formatPhone(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="(21) 99999-9999"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cidade" className="mb-2 block text-sm font-semibold text-slate-700">
                      Cidade
                    </label>
                    <input
                      id="cidade"
                      type="text"
                      value={formData.cidade}
                      onChange={(event) => setFormData((current) => ({ ...current, cidade: event.target.value }))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="Rio de Janeiro"
                    />
                  </div>

                  <div>
                    <label htmlFor="tipo" className="mb-2 block text-sm font-semibold text-slate-700">
                      Perfil
                    </label>
                    <select
                      id="tipo"
                      value={formData.tipoContratacaoId}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          tipoContratacaoId: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    >
                      {contractTypeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    E-mail (opcional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="voce@exemplo.com"
                  />
                </div>

                {feedback ? (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      feedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-red-200 bg-red-50 text-red-700'
                    }`}
                  >
                    {feedback.message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Receber meu comparativo'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Seus dados sao usados apenas para contato consultivo.
              </p>
            </article>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            <article className="marketing-surface marketing-reveal rounded-2xl p-6">
              <Clock3 className="h-6 w-6 text-sky-700" />
              <h3 className="mt-4 text-xl font-black text-slate-900">Triagem agil</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Entendemos seu perfil e definimos o recorte certo de planos para comparar.</p>
            </article>
            <article className="marketing-surface marketing-reveal marketing-delay-1 rounded-2xl p-6">
              <ShieldCheck className="h-6 w-6 text-sky-700" />
              <h3 className="mt-4 text-xl font-black text-slate-900">Comparacao transparente</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Rede, carencia, coparticipacao e reajuste com explicacao objetiva e sem jargao.</p>
            </article>
            <article className="marketing-surface marketing-reveal marketing-delay-2 rounded-2xl p-6">
              <BadgeCheck className="h-6 w-6 text-sky-700" />
              <h3 className="mt-4 text-xl font-black text-slate-900">Acompanhamento completo</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Apoio na proposta, ativacao e primeiros passos de uso do seu novo plano.</p>
            </article>
          </div>
        </section>

        <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-2xl border border-white/15 bg-white/5 p-7 marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">depoimento</p>
              <h2 className="mt-3 text-3xl font-black">"Sai da duvida para a decisao em um dia"</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                "A equipe da Kifer explicou tudo que eu precisava para contratar sem medo. Recebi comparativo com pontos
                positivos e limites de cada opcao, e isso mudou minha forma de escolher."
              </p>
              <p className="mt-5 text-sm font-black text-white">Juliana O. - Niteroi</p>
            </article>

            <article className="rounded-2xl border border-white/15 bg-white/5 p-7 marketing-reveal marketing-delay-1">
              <h2 className="text-2xl font-black">FAQ rapido</h2>
              <div className="mt-6 space-y-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="rounded-xl border border-white/15 bg-white/5 p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-white">{item.question}</summary>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.answer}</p>
                  </details>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-10 text-white shadow-[0_40px_80px_-48px_rgba(15,23,42,0.52)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">pronto para decidir melhor?</p>
                <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Vamos montar seu comparativo estrategico.
                </h2>
                <p className="mt-4 max-w-2xl text-slate-200">
                  Preencha o formulario ou chame no WhatsApp. O primeiro retorno acontece no mesmo dia util.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-slate-800 transition hover:bg-slate-100"
                >
                  Ir para o formulario
                </button>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-7 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Kifer Saude - Atendimento consultivo no RJ e Grande Rio.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-slate-700 hover:text-slate-900">
              Home
            </Link>
            <Link to="/planos" className="font-semibold text-slate-700 hover:text-slate-900">
              Planos
            </Link>
            <a href="tel:+5521979302389" className="font-semibold text-slate-700 hover:text-slate-900">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <button
        type="button"
        onClick={scrollToForm}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-900 backdrop-blur md:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Quero meu comparativo
        </span>
      </button>
    </div>
  );
}
