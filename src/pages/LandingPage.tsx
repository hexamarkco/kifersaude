import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  HeartPulse,
  MessageCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { configService } from '../lib/configService';
import { formatPhoneInput } from '../lib/inputFormatters';
import { supabase, type ConfigOption, type LeadOrigem, type LeadStatusConfig } from '../lib/supabase';

type ProfileSlug = 'pf' | 'pme' | 'adesao';

type FormValues = {
  nome: string;
  whatsapp: string;
  email: string;
  cidade: string;
  vidas: string;
  perfil: ProfileSlug;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

type ContractTypeRow = ConfigOption & {
  nome?: string | null;
};

const profileConfigs: Array<{
  slug: ProfileSlug;
  label: string;
  subtitle: string;
  impact: string;
  Icon: typeof Users;
  benefits: string[];
}> = [
  {
    slug: 'pf',
    label: 'Pessoa fisica',
    subtitle: 'Comparativo individual com foco em previsibilidade.',
    impact: 'Ideal para quem quer decidir sem correr risco de contratar no impulso.',
    Icon: HeartPulse,
    benefits: [
      'Rede validada por rotina de uso',
      'Leitura de carencias e reajustes',
      'Escolha orientada por custo anual real',
    ],
  },
  {
    slug: 'pme',
    label: 'PME e CNPJ',
    subtitle: 'Estruturacao de beneficio de saude para empresas.',
    impact: 'Ideal para empresas que querem equilibrar cobertura e sustentabilidade financeira.',
    Icon: Briefcase,
    benefits: [
      'Apoio de elegibilidade e composicao',
      'Curadoria de operadoras por perfil de equipe',
      'Acompanhamento de proposta e ativacao',
    ],
  },
  {
    slug: 'adesao',
    label: 'Coletivo por adesao',
    subtitle: 'Alternativa para perfis elegiveis em entidades.',
    impact: 'Ideal para quem busca equilibrio entre rede, cobertura e custo de entrada.',
    Icon: Building2,
    benefits: [
      'Triagem de elegibilidade de entrada',
      'Comparativo tecnico entre opcoes de adesao',
      'Suporte completo da proposta ao uso inicial',
    ],
  },
];

const conversionBlocks = [
  {
    title: 'Briefing rapido',
    text: 'Em poucos minutos entendemos contexto, prioridade e objetivo da contratacao.',
    Icon: ClipboardCheck,
  },
  {
    title: 'Comparativo consultivo',
    text: 'Voce recebe opcoes filtradas com explicacao clara de riscos e vantagens.',
    Icon: FileCheck2,
  },
  {
    title: 'Decisao com suporte',
    text: 'Acompanhamos documentacao, pendencias e ativacao para reduzir atrito operacional.',
    Icon: CheckCircle2,
  },
];

const objectionFaq = [
  {
    question: 'A consultoria da landing tem custo?',
    answer: 'Nao. O atendimento consultivo e gratuito para o cliente final, incluindo comparativo e suporte de contratacao.',
  },
  {
    question: 'Em quanto tempo recebo o primeiro retorno?',
    answer: 'Em geral no mesmo dia util. O prazo pode variar de acordo com horario do envio e complexidade do perfil.',
  },
  {
    question: 'Vocês atendem cidade fora da capital?',
    answer: 'Sim. A analise e feita por regiao de uso para garantir coerencia de rede e deslocamento.',
  },
  {
    question: 'Posso validar hospital e laboratorio antes de assinar?',
    answer: 'Sim. A validacao acontece no produto especifico e na categoria correta de contratacao.',
  },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
    adesao: ['adesao', 'coletivo por adesao', 'entidade', 'associacao'],
  };

  const targets = aliases[profile];
  const match = rows.find((row) => {
    const candidate = normalizeText(`${row.label} ${row.value} ${row.nome ?? ''}`);
    return targets.some((target) => candidate.includes(target));
  });

  return match?.id ?? null;
};

const isProfileSlug = (value: string | null): value is ProfileSlug => value === 'pf' || value === 'pme' || value === 'adesao';

export default function LandingPage() {
  const location = useLocation();
  const [formData, setFormData] = useState<FormValues>({
    nome: '',
    whatsapp: '',
    email: '',
    cidade: '',
    vidas: '',
    perfil: 'pme',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [origins, setOrigins] = useState<LeadOrigem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusConfig[]>([]);
  const [contractTypeRows, setContractTypeRows] = useState<ContractTypeRow[]>([]);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [gtmId, setGtmId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedProfile = params.get('perfil');
    if (isProfileSlug(requestedProfile)) {
      setFormData((current) => ({ ...current, perfil: requestedProfile }));
    }
  }, [location.search]);

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

  const handleProfileSelection = (profile: ProfileSlug) => {
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

    const selectedProfile = profileConfigs.find((item) => item.slug === formData.perfil);
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
        `Ola! Acabei de preencher a landing da Kifer. Meu perfil e ${selectedProfile?.label ?? formData.perfil} e quero receber comparativo.`,
      );
      window.open(`https://wa.me/5521979302389?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
    }

    setFeedback({
      type: 'success',
      message: 'Recebemos seus dados. Abrimos o WhatsApp para agilizar o atendimento.',
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
    <div className="clinic-theme kifer-ds kifer-landing-theme min-h-screen text-slate-900">
      <Helmet>
        <title>Landing Kifer | Cotacao para PME, PF e Adesao</title>
        <meta
          name="description"
          content="Landing da Kifer Saude focada em conversao para PF, PME e adesao com comparativo consultivo e atendimento rapido."
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
            <span className="clinic-heading text-2xl font-semibold">Kifer Saude</span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="tel:+5521979302389"
              className="ks-btn-secondary hidden rounded-full px-4 py-2 text-sm font-semibold text-slate-700 sm:inline-flex"
            >
              (21) 97930-2389
            </a>
            <Link
              to="/"
              className="ks-btn-primary inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white"
            >
              Ver institucional
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-28 md:pb-16">
        <section className="relative overflow-hidden px-4 pb-14 pt-14 sm:px-6 lg:px-8">
          <div className="clinic-glow pointer-events-none absolute left-[-10rem] top-[-7rem] h-80 w-80 rounded-full bg-orange-300/34 blur-3xl" />
          <div className="clinic-glow pointer-events-none absolute bottom-[-8rem] right-[-10rem] h-96 w-96 rounded-full bg-orange-200/32 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-700">landing de conversao</p>
              <h1 className="clinic-heading mt-4 text-5xl font-semibold leading-[0.93] text-slate-900 md:text-7xl">
                Cotacao consultiva para PME, PF e adesao.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Aqui voce nao recebe lista generica de planos. Recebe um comparativo direcionado para seu perfil, com
                orientacao tecnica e atendimento humano no mesmo dia util.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {profileConfigs.map((profile) => (
                  <button
                    key={profile.slug}
                    type="button"
                    onClick={() => handleProfileSelection(profile.slug)}
                    className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition ${
                      formData.perfil === profile.slug
                        ? 'border-orange-600 bg-orange-600 text-white'
                        : 'border-orange-200 bg-white text-orange-700 hover:bg-orange-50'
                    }`}
                  >
                    {profile.label}
                  </button>
                ))}
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Briefing em minutos</div>
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Comparativo consultivo</div>
                <div className="clinic-card ks-card rounded-2xl p-4 text-sm font-semibold text-slate-700">Apoio ate ativacao</div>
              </div>

              <div className="ks-card mt-8 rounded-2xl p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">espaco para foto da corretora</p>
                <div className="clinic-photo-slot mt-3 aspect-[5/3] rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4">
                  <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-orange-300 text-center text-slate-600">
                    <Sparkles className="h-6 w-6 text-orange-500" />
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em]">Inserir foto profissional da corretora</p>
                  </div>
                </div>
              </div>
            </div>

            <article id="lead-form" className="clinic-card ks-card clinic-reveal clinic-delay-1 rounded-[2rem] p-8 lg:sticky lg:top-24">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">formulario de lead</p>
              <h2 className="clinic-heading mt-3 text-4xl font-semibold text-slate-900">Receber comparativo personalizado</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Preenchimento rapido para iniciar seu atendimento consultivo.
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
                    className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
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
                        whatsapp: formatPhoneInput(event.target.value),
                      }))
                    }
                    className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
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
                      className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
                    >
                      {profileConfigs.map((option) => (
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
                      className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
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
                      className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
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
                      className="ks-input-field w-full rounded-xl px-4 py-3 text-sm text-slate-900 outline-none"
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
                  className="ks-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
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

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-700">rotas de conversao</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold text-slate-900">Escolha sua trilha e avance com estrategia</h2>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {profileConfigs.map((profile, index) => (
                <article
                  key={profile.slug}
                  className={`clinic-card ks-card clinic-reveal rounded-2xl p-7 ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
                >
                  <span className="inline-flex rounded-xl bg-orange-100 p-3 text-orange-700">
                    <profile.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-2xl font-black text-slate-900">{profile.label}</h3>
                  <p className="mt-2 text-sm font-semibold text-orange-700">{profile.subtitle}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{profile.impact}</p>
                  <ul className="mt-5 space-y-3">
                    {profile.benefits.map((benefit) => (
                      <li key={benefit} className="flex gap-3 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => handleProfileSelection(profile.slug)}
                    className="ks-btn-ghost mt-6 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em]"
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
            <div className="max-w-3xl clinic-reveal">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">processo</p>
              <h2 className="clinic-heading mt-3 text-5xl font-semibold">Em poucas horas voce sai da duvida para um plano de acao</h2>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {conversionBlocks.map((block, index) => (
                <article
                  key={block.title}
                  className={`rounded-2xl border border-white/15 bg-white/5 p-7 clinic-reveal ${index === 1 ? 'clinic-delay-1' : ''} ${index === 2 ? 'clinic-delay-2' : ''}`}
                >
                  <span className="inline-flex rounded-xl bg-orange-200/15 p-3 text-orange-200">
                    <block.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-2xl font-black">{block.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{block.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
            <article className="clinic-card ks-card clinic-reveal rounded-2xl p-7">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-700">guia da jornada</p>
              <h2 className="clinic-heading mt-3 text-4xl font-semibold text-slate-900">Espaco premium para foto da corretora</h2>
              <div className="clinic-photo-slot mt-6 aspect-[4/5] rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-100/55 to-white p-6">
                <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-300/90 text-center text-slate-600">
                  <BadgeCheck className="h-8 w-8 text-orange-600" />
                  <p className="mt-3 text-sm font-black uppercase tracking-[0.12em] text-orange-700">Foto da corretora</p>
                  <p className="mt-2 max-w-[17rem] text-xs">Inserir retrato autoral em alta qualidade para reforcar confianca e autoridade.</p>
                </div>
              </div>
            </article>

            <article className="clinic-card ks-card clinic-reveal clinic-delay-1 rounded-2xl p-7">
              <h2 className="text-2xl font-black text-slate-900">FAQ de objecoes</h2>
              <div className="mt-6 space-y-3">
                {objectionFaq.map((item) => (
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
                <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-100">pronto para comecar?</p>
                <h2 className="clinic-heading mt-3 text-5xl font-semibold leading-tight md:text-6xl">
                  Vamos montar seu comparativo agora.
                </h2>
                <p className="mt-4 max-w-2xl text-orange-50">
                  Selecione seu perfil, envie os dados e receba retorno com orientacao consultiva no mesmo dia util.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={scrollToForm}
                  className="ks-btn-secondary inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-orange-700"
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
          <p>Landing oficial da Kifer para conversao de leads PF, PME e adesao.</p>
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
