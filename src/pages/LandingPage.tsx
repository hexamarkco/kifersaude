import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  FileCheck2,
  HeartPulse,
  MessageCircle,
  Users,
} from 'lucide-react';
import { configService } from '../lib/configService';
import { supabase, type ConfigOption, type LeadOrigem, type LeadStatusConfig } from '../lib/supabase';

type ProfileSlug = 'pf' | 'pme' | 'adesao';

type FormValues = {
  nome: string;
  whatsapp: string;
  email: string;
  cidade: string;
  perfil: ProfileSlug;
  vidas: string;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

type ContractTypeRow = ConfigOption & {
  nome?: string | null;
};

const profileOptions: Array<{
  slug: ProfileSlug;
  label: string;
  headline: string;
  description: string;
  points: string[];
  Icon: typeof Users;
}> = [
  {
    slug: 'pf',
    label: 'Pessoa fisica',
    headline: 'PF com foco em previsibilidade',
    description: 'Para quem precisa decidir com calma e evitar custo oculto no medio prazo.',
    points: [
      'Comparativo por rotina real de uso',
      'Validacao de rede por regiao',
      'Leitura de carencias e reajustes',
    ],
    Icon: HeartPulse,
  },
  {
    slug: 'pme',
    label: 'PME e CNPJ',
    headline: 'Beneficio de saude para empresas',
    description: 'Para quem quer estruturar plano empresarial com criterio e controle de custo total.',
    points: [
      'Triagem de elegibilidade e composicao',
      'Apoio documental para acelerar aprovacao',
      'Comparacao tecnica de operadoras',
    ],
    Icon: Briefcase,
  },
  {
    slug: 'adesao',
    label: 'Coletivo por adesao',
    headline: 'Alternativa para perfis elegiveis',
    description: 'Para quem pode aderir por entidade e quer analisar risco, cobertura e sustentabilidade.',
    points: [
      'Validacao de regras de entrada',
      'Comparativo de cobertura e custo anual',
      'Acompanhamento ate ativacao',
    ],
    Icon: Building2,
  },
];

const processFlow = [
  {
    title: 'Briefing inicial',
    text: 'Coletamos perfil, regiao, quantidade de vidas e objetivo da contratacao.',
  },
  {
    title: 'Comparativo consultivo',
    text: 'Voce recebe opcoes filtradas com explicacao objetiva de cada decisao tecnica.',
  },
  {
    title: 'Apoio na contratacao',
    text: 'Acompanhamos proposta e pendencias ate a ativacao do plano escolhido.',
  },
];

const faqItems = [
  {
    question: 'Quanto tempo para receber o comparativo?',
    answer: 'Normalmente no mesmo dia util, apos a triagem inicial de perfil e objetivo.',
  },
  {
    question: 'A consultoria tem custo?',
    answer: 'Nao. O atendimento consultivo para comparacao de planos e gratuito para o cliente final.',
  },
  {
    question: 'Voces atendem PF, PME e adesao?',
    answer: 'Sim. A estrategia muda por perfil de contratacao, elegibilidade e necessidade de cobertura.',
  },
  {
    question: 'Posso validar hospitais antes de assinar?',
    answer: 'Sim. A validacao e feita no produto exato, por categoria e territorio de uso.',
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

const resolveContractTypeId = (rows: ContractTypeRow[], profile: ProfileSlug) => {
  const aliases: Record<ProfileSlug, string[]> = {
    pf: ['pf', 'pessoa fisica', 'individual'],
    pme: ['pme', 'mei', 'empresa', 'empresarial', 'pj', 'cnpj'],
    adesao: ['adesao', 'coletivo por adesao', 'coletivo adesao', 'associacao', 'entidade'],
  };

  const targetAliases = aliases[profile];

  const match = rows.find((row) => {
    const candidate = normalizeText(`${row.label} ${row.value} ${row.nome ?? ''}`);
    return targetAliases.some((alias) => candidate.includes(alias));
  });

  return match?.id ?? null;
};

export default function LandingPage() {
  const [formData, setFormData] = useState<FormValues>({
    nome: '',
    whatsapp: '',
    email: '',
    cidade: '',
    perfil: 'pme',
    vidas: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [origins, setOrigins] = useState<LeadOrigem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusConfig[]>([]);
  const [contractTypeRows, setContractTypeRows] = useState<ContractTypeRow[]>([]);
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
      setContractTypeRows((contractTypeResponse.data ?? []) as ContractTypeRow[]);

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

  const scrollToForm = () => {
    const formElement = document.getElementById('lead-form');
    formElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleProfileShortcut = (profile: ProfileSlug) => {
    setFormData((current) => ({ ...current, perfil: profile }));
    scrollToForm();
  };

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

    const selectedProfile = profileOptions.find((option) => option.slug === formData.perfil);
    const contractTypeId = resolveContractTypeId(contractTypeRows, formData.perfil);

    const payload = {
      nome_completo: cleanName,
      telefone: cleanPhone,
      email: formData.email.trim() || null,
      cidade: formData.cidade.trim() || null,
      origem_id: findOriginId(origins),
      status_id: findStatusId(statuses),
      tipo_contratacao_id: contractTypeId,
      observacoes: `Lead /lp | Perfil: ${selectedProfile?.label ?? formData.perfil} | Vidas: ${formData.vidas || 'nao informado'}`,
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
        trackedWindow.dataLayer.push({ event: 'lead_submit', source: 'lp', profile: formData.perfil });
      }

      const encodedMessage = encodeURIComponent(
        `Ola! Acabei de preencher a landing da Kifer. Sou perfil ${selectedProfile?.label ?? formData.perfil} e quero receber o comparativo.`,
      );
      window.open(`https://wa.me/5521979302389?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
    }

    setFeedback({
      type: 'success',
      message: 'Recebemos seus dados. Abrimos o WhatsApp para agilizar seu atendimento.',
    });

    setFormData((current) => ({
      ...current,
      nome: '',
      whatsapp: '',
      email: '',
      cidade: '',
      vidas: '',
    }));

    setSubmitting(false);
  };

  return (
    <div className="marketing-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Landing Kifer | Cotacao para PME, PF e Adesao</title>
        <meta
          name="description"
          content="Landing da Kifer Saude para conversao de leads PME, PF e adesao. Receba comparativo consultivo e atendimento no mesmo dia util."
        />
        <link rel="canonical" href="https://www.kifersaude.com.br/lp" />
        {metaPixelScript ? <script type="text/javascript">{metaPixelScript}</script> : null}
        {gtmScript ? <script type="text/javascript">{gtmScript}</script> : null}
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-900/20">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <span className="marketing-display text-2xl font-semibold">Kifer Saude</span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="tel:+5521979302389"
              className="hidden rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 sm:inline-flex"
            >
              (21) 97930-2389
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Ver institucional
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-28 md:pb-16">
        <section className="relative overflow-hidden px-4 pb-14 pt-14 sm:px-6 lg:px-8">
          <div className="marketing-glow pointer-events-none absolute left-[-10rem] top-[-7rem] h-80 w-80 rounded-full bg-orange-300/34 blur-3xl" />
          <div className="marketing-glow pointer-events-none absolute bottom-[-8rem] right-[-10rem] h-96 w-96 rounded-full bg-orange-200/32 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">landing de conversao</p>
              <h1 className="marketing-display mt-4 text-5xl font-semibold leading-[0.94] text-slate-900 md:text-7xl">
                Cotacao consultiva para PME, PF e adesao.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Preencha o formulario e receba comparativo tecnico com foco em cobertura, custo total e seguranca de
                decisao. Atendimento humano no mesmo dia util.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {profileOptions.map((profile) => (
                  <button
                    key={profile.slug}
                    type="button"
                    onClick={() => handleProfileShortcut(profile.slug)}
                    className={`marketing-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                      formData.perfil === profile.slug ? 'bg-orange-600 text-white border-orange-600' : ''
                    }`}
                  >
                    {profile.label}
                  </button>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">Briefing em minutos</div>
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">Comparativo sem jargao</div>
                <div className="marketing-surface rounded-2xl p-4 text-sm font-semibold text-slate-700">Apoio ate ativacao</div>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-slate-700">
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Orientacao para escolher o plano certo, nao o mais barato no curto prazo.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Analise de rede por cidade e categoria para evitar surpresa no uso.
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                  Processo claro para PF, PME e adesao, com acompanhamento completo.
                </li>
              </ul>
            </div>

            <article id="lead-form" className="marketing-surface marketing-reveal marketing-delay-1 rounded-[2rem] p-8 lg:sticky lg:top-24">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">formulario de lead</p>
              <h2 className="marketing-display mt-3 text-4xl font-semibold text-slate-900">Receber comparativo personalizado</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Preenchimento rapido. Nossa equipe responde com as proximas etapas no mesmo dia util.
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
                    className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
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
                    className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    placeholder="(21) 99999-9999"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="perfil" className="mb-2 block text-sm font-semibold text-slate-700">
                      Perfil
                    </label>
                    <select
                      id="perfil"
                      value={formData.perfil}
                      onChange={(event) =>
                        setFormData((current) => ({
                          ...current,
                          perfil: event.target.value as ProfileSlug,
                        }))
                      }
                      className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                    >
                      {profileOptions.map((option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="vidas" className="mb-2 block text-sm font-semibold text-slate-700">
                      Quantidade de vidas
                    </label>
                    <input
                      id="vidas"
                      type="text"
                      value={formData.vidas}
                      onChange={(event) => setFormData((current) => ({ ...current, vidas: event.target.value }))}
                      className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      placeholder="Ex: 3"
                    />
                  </div>
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
                      className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      placeholder="Rio de Janeiro"
                    />
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
                      className="w-full rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      placeholder="voce@empresa.com"
                    />
                  </div>
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-orange-900/20 transition hover:from-orange-700 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Quero meu comparativo'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                Dados usados apenas para atendimento consultivo.
              </p>
            </article>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8" id="segmentos">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">foco de conversao</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold text-slate-900">Qual trilha representa melhor seu momento?</h2>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {profileOptions.map((profile, index) => (
                <article
                  key={profile.slug}
                  className={`marketing-surface marketing-reveal rounded-2xl p-7 ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-700">
                    <profile.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-2xl font-black text-slate-900">{profile.label}</h3>
                  <p className="mt-2 text-sm font-semibold text-orange-700">{profile.headline}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{profile.description}</p>
                  <ul className="mt-5 space-y-3">
                    {profile.points.map((point) => (
                      <li key={point} className="flex gap-3 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleProfileShortcut(profile.slug)}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-orange-700 hover:text-orange-800"
                  >
                    Selecionar perfil
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl marketing-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">processo de conversao</p>
              <h2 className="marketing-display mt-3 text-5xl font-semibold">Em 24h voce tem caminho claro para decidir</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {processFlow.map((item, index) => (
                <article
                  key={item.title}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-7 marketing-reveal ${index === 1 ? 'marketing-delay-1' : ''} ${index === 2 ? 'marketing-delay-2' : ''}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-200">etapa {index + 1}</p>
                  <h3 className="mt-3 text-2xl font-black">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
            <article className="marketing-surface marketing-reveal rounded-2xl p-7">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">prova social</p>
              <h2 className="marketing-display mt-3 text-4xl font-semibold text-slate-900">"A decisao ficou clara em poucas horas"</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                "Eu cheguei na Kifer sem saber qual modelo fazia sentido para meu perfil. Recebi um comparativo objetivo,
                com riscos e vantagens de cada opcao. Fechei com seguranca e sem pressao."
              </p>
              <p className="mt-5 text-sm font-black text-slate-900">Juliana O. - perfil PF</p>

              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-orange-100 pt-5 text-center">
                <div>
                  <p className="text-2xl font-black text-slate-900">+3.200</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">atendimentos</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">4.9</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">avaliacao media</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">24h</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">primeiro retorno</p>
                </div>
              </div>
            </article>

            <article className="marketing-surface marketing-reveal marketing-delay-1 rounded-2xl p-7">
              <h2 className="text-2xl font-black text-slate-900">FAQ de conversao</h2>
              <div className="mt-6 space-y-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">{item.question}</summary>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
                  </details>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2.2rem] bg-gradient-to-r from-orange-700 via-orange-600 to-orange-500 p-10 text-white shadow-[0_40px_80px_-48px_rgba(124,45,18,0.65)] md:p-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">pronto para avancar?</p>
                <h2 className="marketing-display mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Vamos montar seu comparativo agora.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Escolha seu perfil, preencha os dados e receba retorno com orientacao consultiva no mesmo dia util.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700 transition hover:bg-orange-50"
                >
                  Ir para formulario
                </button>
                <a
                  href="https://wa.me/5521979302389"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/20"
                >
                  <MessageCircle className="h-4 w-4" />
                  Conversar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white/85 px-4 py-7 text-sm text-slate-600 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
          <p>Landing oficial Kifer Saude para conversao de leads PF, PME e adesao.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-slate-700 hover:text-orange-700">
              Home
            </Link>
            <Link to="/planos" className="font-semibold text-slate-700 hover:text-orange-700">
              Planos
            </Link>
            <a href="tel:+5521979302389" className="font-semibold text-slate-700 hover:text-orange-700">
              (21) 97930-2389
            </a>
          </div>
        </div>
      </footer>

      <button
        type="button"
        onClick={scrollToForm}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-orange-200 bg-white/96 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-slate-900 backdrop-blur md:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <FileCheck2 className="h-4 w-4 text-orange-600" />
          Quero meu comparativo
        </span>
      </button>
    </div>
  );
}
