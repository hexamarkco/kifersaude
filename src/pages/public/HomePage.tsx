import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Shield,
  Sparkles,
  Star,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';
import { Input } from '../../design-system';
import { formatPhoneInput } from '../../lib/inputFormatters';
import {
  getSupabaseErrorMessage,
  supabase,
  type ConfigOption,
  type LeadOrigem,
  type LeadStatusConfig,
} from '../../lib/supabase';
import { toast } from '../../lib/toast';

type ContractKind = 'PF' | 'MEI' | 'CNPJ';

type QuoteFormValues = {
  nome: string;
  telefone: string;
  cidade: string;
  tipoContratacao: ContractKind;
  numeroVidas: string;
  idadeTitular: string;
};

type ContractTypeRow = ConfigOption & {
  nome?: string | null;
};

type PartnerLogo = {
  src: string;
  alt: string;
};

type Testimonial = {
  quote: string;
  initial: string;
  name: string;
  detail: string;
};

type AudienceCard = {
  title: string;
  description: string;
  eyebrow: string;
  ctaLabel: string;
  contractKind: ContractKind;
  icon: typeof Briefcase;
};

type PublicMetric = {
  value: string;
  label: string;
  detail: string;
};

type OverlayModalProps = {
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: ReactNode;
};

const AGE_RANGES = ['00 - 18', '19 - 23', '24 - 28', '29 - 33', '34 - 38', '39 - 43', '44 - 48', '49 - 53', '54 - 58', '59+'] as const;
const WHATSAPP_PHONE = '5521979302389';
const WHATSAPP_DEFAULT_MESSAGE = 'Olá! Quero uma cotação de plano de saúde com a Kifer.';
const WHATSAPP_SUPPORT_MESSAGE = 'Olá! Já sou cliente da Kifer Saúde e preciso de suporte.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
const CNPJ = '46.423.078/0001-10';
const INSTAGRAM_URL = 'https://instagram.com/souluizakifer';
const GOOGLE_REVIEWS_URL = 'https://www.google.com/search?q=kifer+saude';

const faqItems: PublicFaqItem[] = [
  {
    question: 'MEI pode contratar plano empresarial?',
    answer:
      'Sim. Quando existe CNPJ ativo e enquadramento aceito pela operadora, o MEI pode acessar produtos empresariais com condição mais competitiva do que muitos planos individuais.',
  },
  {
    question: 'Qual a diferença entre plano por adesão e empresarial?',
    answer:
      'O empresarial depende de CNPJ e costuma seguir regras de elegibilidade da empresa. O plano por adesão depende de vínculo com entidade de classe e pode ter outra estrutura de preço, carência e reajuste.',
  },
  {
    question: 'Tem carência?',
    answer:
      'Tem, e ela varia conforme a operadora, o tipo de contratação e a regra do produto. Antes da contratação, a Kifer explica o que muda para consultas, exames, internações e urgência.',
  },
  {
    question: 'Cobre qual área do RJ?',
    answer:
      'A análise é feita de acordo com a cidade, os bairros de uso e a rede credenciada que realmente faz sentido para sua rotina no Rio de Janeiro e Grande Rio.',
  },
  {
    question: 'Como faço para contratar?',
    answer:
      'Você envia seus dados pelo formulário ou WhatsApp, recebe as opções comparadas para o seu perfil e, depois da escolha, a Kifer acompanha documentação, proposta e ativação até a contratação ficar de pé.',
  },
];

const partnerLogos: PartnerLogo[] = [
  { src: '/amil-logo-1-2.png', alt: 'Amil' },
  { src: '/porto-logo.png', alt: 'Porto Seguro' },
  { src: '/assim-saude-logo.png', alt: 'Assim Saúde' },
  { src: '/sulamerica-saude-logo.png', alt: 'SulAmérica Saúde' },
  { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saúde' },
];

const heroRibbonItems = [
  'Consultoria em planos de saúde',
  'Atendimento humanizado',
  'Cotação sem compromisso',
  'Especialista no RJ',
  'Suporte do início ao pós-venda',
];

const loopedHeroRibbonItems = [...heroRibbonItems, ...heroRibbonItems];
const loopedPartnerLogos = [...partnerLogos, ...partnerLogos];

const testimonials: Testimonial[] = [
  {
    quote: 'Eu achava que plano bom era caro, mas com a Luiza consegui pagar menos e ainda ter Rede D\'Or. Atendimento nota 10!',
    initial: 'R',
    name: 'Regina',
    detail: '44 anos, Rio de Janeiro',
  },
  {
    quote: 'Atendimento super rápido pelo WhatsApp. Em menos de 1 hora já tinha minha cotação com várias opções.',
    initial: 'M',
    name: 'Marcelo',
    detail: '38 anos, Niterói',
  },
  {
    quote: 'Excelente suporte durante todo o processo. A Kifer Saúde realmente se importa com o cliente!',
    initial: 'A',
    name: 'Ana Paula',
    detail: '52 anos, Nova Iguaçu',
  },
];

const audienceCards: AudienceCard[] = [
  {
    eyebrow: 'MEI / Empresa pequena',
    title: 'Plano empresarial com melhor custo-benefício para quem tem CNPJ.',
    description: 'Sabia que como MEI você pode acessar plano empresarial com melhor custo-benefício? A Kifer compara opções e explica a elegibilidade certa para o seu caso.',
    ctaLabel: 'Quero cotar para empresa',
    contractKind: 'MEI',
    icon: Briefcase,
  },
  {
    eyebrow: 'Pessoa Física',
    title: 'Comparativo para quem quer sair do caro pelo mais coerente.',
    description: 'Está pagando caro no seu plano atual? A gente compara operadoras, rede, carência e custo real para mostrar o que faz sentido para a sua rotina.',
    ctaLabel: 'Quero cotar para pessoa física',
    contractKind: 'PF',
    icon: UserRound,
  },
];

const fallbackPublicMetrics: PublicMetric[] = [
  {
    value: '+500',
    label: 'clientes atendidos',
    detail: 'histórico comercial da operação',
  },
  {
    value: String(partnerLogos.length),
    label: 'operadoras comparadas',
    detail: 'parceiras exibidas no site',
  },
  {
    value: '4.9',
    label: 'avaliação média percebida',
    detail: 'fallback visual até a leitura protegida carregar',
  },
];

const createInitialAgeRangeCounts = () =>
  AGE_RANGES.reduce<Record<(typeof AGE_RANGES)[number], string>>((accumulator, range) => {
    accumulator[range] = '';
    return accumulator;
  }, {} as Record<(typeof AGE_RANGES)[number], string>);

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildWhatsAppUrl = (message: string) => `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;

const normalizeLeadPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length > 11) {
    return digits.slice(2, 13);
  }

  return digits.slice(0, 11);
};

const findOriginId = (origins: LeadOrigem[]) => {
  const priorities = ['site', 'home', 'inicio', 'organico', 'organico site', 'landing'];
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

const resolveContractTypeId = (rows: ContractTypeRow[], contractKind: ContractKind) => {
  const aliases: Record<ContractKind, string[]> = {
    PF: ['pf', 'pessoa fisica', 'pessoa fisica individual', 'individual', 'familiar'],
    MEI: ['mei', 'pme', 'empresa', 'empresarial', 'cnpj', 'pj'],
    CNPJ: ['cnpj', 'pme', 'empresa', 'empresarial', 'pj', 'coletivo empresarial'],
  };

  const targets = aliases[contractKind];
  const match = rows.find((row) => {
    const candidate = normalizeText(`${row.label} ${row.value} ${row.nome ?? ''}`);
    return targets.some((target) => candidate.includes(target));
  });

  return match?.id ?? null;
};

const normalizePublicMetric = (value: unknown): PublicMetric | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const metricValue = typeof record.value === 'string' ? record.value.trim() : '';
  const label = typeof record.label === 'string' ? record.label.trim() : '';
  const detail = typeof record.detail === 'string' ? record.detail.trim() : '';

  if (!metricValue || !label || !detail) {
    return null;
  }

  return {
    value: metricValue,
    label,
    detail,
  };
};

function OverlayModal({ title, subtitle, maxWidthClass = 'max-w-3xl', onClose, children }: OverlayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay)] p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`modal-panel flex w-full ${maxWidthClass} max-h-[90vh] flex-col overflow-hidden rounded-[var(--kds-radius-xl)] bg-[var(--bg-elevated)] text-[color:var(--text-primary)] shadow-[var(--shadow-modal)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 [background:var(--brand-primary-gradient)] p-6 text-[color:var(--text-on-brand)]">
          <div>
            <h2 className="text-3xl font-bold">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm opacity-90">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-[var(--brand-primary-muted)]"
            aria-label="Fechar modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="modal-panel-content overflow-y-auto p-8">{children}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [formData, setFormData] = useState<QuoteFormValues>({
    nome: '',
    telefone: '',
    cidade: '',
    tipoContratacao: 'PF',
    numeroVidas: '',
    idadeTitular: '',
  });
  const [ageRangeCounts, setAgeRangeCounts] = useState(createInitialAgeRangeCounts());
  const [origins, setOrigins] = useState<LeadOrigem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusConfig[]>([]);
  const [contractTypeRows, setContractTypeRows] = useState<ContractTypeRow[]>([]);
  const [publicMetrics, setPublicMetrics] = useState<PublicMetric[]>(fallbackPublicMetrics);
  const [submitting, setSubmitting] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  const totalLives = Number.parseInt(formData.numeroVidas, 10) || 0;
  const filledAgeRanges = Object.entries(ageRangeCounts)
    .map(([range, quantity]) => ({ range, quantity: Number.parseInt(quantity, 10) }))
    .filter(({ quantity }) => Number.isFinite(quantity) && quantity > 0);
  const ageRangeTotal = filledAgeRanges.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPublicData = async () => {
      const [originsResponse, statusesResponse, contractTypesResponse] = await Promise.all([
        supabase.from('lead_origens').select('*').eq('ativo', true),
        supabase.from('lead_status_config').select('*').eq('ativo', true).order('ordem', { ascending: true }),
        supabase.from('lead_tipos_contratacao').select('*').eq('ativo', true).order('ordem', { ascending: true }),
      ]);

      if (!active) {
        return;
      }

      setOrigins(originsResponse.data ?? []);
      setStatuses(statusesResponse.data ?? []);
      setContractTypeRows((contractTypesResponse.data ?? []) as ContractTypeRow[]);
    };

    void loadPublicData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPublicMetrics = async () => {
      const { data, error } = await supabase.functions.invoke('public-home-metrics');

      if (!active || error || !data || !Array.isArray(data.metrics)) {
        return;
      }

      const metrics = data.metrics
        .map(normalizePublicMetric)
        .filter((metric: PublicMetric | null): metric is PublicMetric => Boolean(metric));

      if (metrics.length === 3) {
        setPublicMetrics(metrics);
      }
    };

    void loadPublicMetrics();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (showQuoteModal) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showQuoteModal]);

  const updateAgeRangeCount = (range: (typeof AGE_RANGES)[number], value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setAgeRangeCounts((current) => ({ ...current, [range]: numericValue }));
  };

  const openWhatsApp = (message: string = WHATSAPP_DEFAULT_MESSAGE) => {
    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  const scrollToForm = (contractKind?: ContractKind) => {
    if (contractKind) {
      setFormData((current) => ({
        ...current,
        tipoContratacao: contractKind,
      }));
    }

    window.requestAnimationFrame(() => {
      document.getElementById('cotacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      telefone: '',
      cidade: '',
      tipoContratacao: 'PF',
      numeroVidas: '',
      idadeTitular: '',
    });
    setAgeRangeCounts(createInitialAgeRangeCounts());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const cleanName = formData.nome.trim();
    const cleanCity = formData.cidade.trim();
    const cleanPhone = normalizeLeadPhone(formData.telefone);

    if (cleanName.length < 3) {
      toast.warning('Preencha seu nome completo para continuar.');
      return;
    }

    if (cleanPhone.length < 10) {
      toast.warning('Preencha um WhatsApp válido para continuar.');
      return;
    }

    if (cleanCity.length < 2) {
      toast.warning('Informe sua cidade para montar a cotação.');
      return;
    }

    if (totalLives < 1) {
      toast.warning('Informe a quantidade de vidas no contrato.');
      return;
    }

    if (totalLives > 1 && filledAgeRanges.length === 0) {
      toast.warning('Distribua as vidas nas faixas etárias para continuar.');
      return;
    }

    if (totalLives > 1 && ageRangeTotal !== totalLives) {
      toast.warning('A soma das faixas etárias precisa bater com a quantidade total de vidas.');
      return;
    }

    if (totalLives === 1 && !formData.idadeTitular.trim()) {
      toast.warning('Informe a idade da pessoa para prosseguir.');
      return;
    }

    const agesText =
      totalLives === 1
        ? `1 vida - idade: ${formData.idadeTitular.trim()}`
        : `${totalLives} vidas - ${filledAgeRanges.map(({ range, quantity }) => `${range}: ${quantity}`).join(', ')}`;

    setSubmitting(true);

    const payload = {
      nome_completo: cleanName,
      telefone: cleanPhone,
      cidade: cleanCity,
      origem_id: findOriginId(origins),
      status_id: findStatusId(statuses),
      tipo_contratacao_id: resolveContractTypeId(contractTypeRows, formData.tipoContratacao),
      observacoes: `Lead site | Visual 11/2025 | Tipo: ${formData.tipoContratacao} | Cidade: ${cleanCity} | Beneficiários: ${agesText}`,
      data_criacao: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      arquivado: false,
    };

    const { error } = await supabase.from('leads').insert([payload]);

    if (error) {
      toast.error(getSupabaseErrorMessage(error, 'Não foi possível enviar a cotação agora. Tente novamente ou fale no WhatsApp.'));
      setSubmitting(false);
      return;
    }

    const whatsappMessage = [
      'Olá! Acabei de preencher a cotação no site da Kifer.',
      `Nome: ${cleanName}`,
      `Cidade: ${cleanCity}`,
      `Tipo: ${formData.tipoContratacao}`,
      `Beneficiários: ${agesText}`,
    ].join('\n');

    openWhatsApp(whatsappMessage);
    toast.success('Cotação enviada com sucesso. Abrimos o WhatsApp para agilizar o atendimento.');
    resetForm();
    setShowQuoteModal(false);
    setSubmitting(false);
  };

  const renderQuoteFields = () => (
    <>
      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-name">
          Nome completo *
        </label>
        <Input
          id="quote-name"
          type="text"
          required
          value={formData.nome}
          onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
          className="h-12 px-4 text-base"
          placeholder="Seu nome"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-phone">
          Telefone (WhatsApp) *
        </label>
        <Input
          id="quote-phone"
          type="tel"
          required
          value={formData.telefone}
          onChange={(event) =>
            setFormData((current) => ({
              ...current,
              telefone: formatPhoneInput(event.target.value),
            }))
          }
          className="h-12 px-4 text-base"
          placeholder="(21) 99999-9999"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-city">
          Cidade *
        </label>
        <Input
          id="quote-city"
          type="text"
          required
          value={formData.cidade}
          onChange={(event) => setFormData((current) => ({ ...current, cidade: event.target.value }))}
          className="h-12 px-4 text-base"
          placeholder="Sua cidade"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-contract-type">
          Tipo de contratação *
        </label>
        <select
          id="quote-contract-type"
          value={formData.tipoContratacao}
          onChange={(event) =>
            setFormData((current) => ({
              ...current,
              tipoContratacao: event.target.value as ContractKind,
            }))
          }
          className="kds-select h-12 px-4 text-base"
        >
          <option value="PF">Pessoa física</option>
          <option value="MEI">MEI</option>
          <option value="CNPJ">CNPJ</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-lives">
          Quantas vidas são no contrato? *
        </label>
        <Input
          id="quote-lives"
          type="number"
          min="1"
          required
          value={formData.numeroVidas}
          onChange={(event) => setFormData((current) => ({ ...current, numeroVidas: event.target.value }))}
          className="h-12 px-4 text-base"
          placeholder="Ex: 1, 2, 3"
        />
      </div>

      {totalLives > 1 ? (
        <div className="md:col-span-2">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="block text-sm font-semibold text-[color:var(--text-primary)]">Idade das vidas *</label>
            <span className={`text-xs font-semibold ${ageRangeTotal === totalLives ? 'text-[color:var(--success-text)]' : 'text-[color:var(--text-muted)]'}`}>
              Distribuídas: {ageRangeTotal} de {totalLives}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {AGE_RANGES.map((range) => (
              <div key={range} className="rounded-[var(--kds-radius-sm)] border border-[color:var(--border-default)] bg-[var(--bg-inset)] p-3">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{range}</p>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  pattern="\d*"
                  value={ageRangeCounts[range]}
                  onChange={(event) => updateAgeRangeCount(range, event.target.value)}
                  className="mt-2 h-10 px-3"
                  placeholder="Qtd."
                />
              </div>
            ))}
          </div>
        </div>
      ) : totalLives === 1 ? (
        <div>
          <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-age">
            Idade da pessoa *
          </label>
          <Input
            id="quote-age"
            type="number"
            min="0"
            required
            value={formData.idadeTitular}
            onChange={(event) => setFormData((current) => ({ ...current, idadeTitular: event.target.value }))}
            className="h-12 px-4 text-base"
            placeholder="Informe a idade"
          />
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <PublicSeo
        title="Kifer Saúde | Plano de saúde no RJ com atendimento humano"
        description="Plano de saúde no RJ com atendimento humano, cotação gratuita e suporte consultivo pelo WhatsApp para pessoa física, MEI e empresa pequena."
        canonicalPath="/"
        faqItems={faqItems}
      />

      <style>{`
        @keyframes partner-logos-slide {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        .partner-logos-marquee {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }

        .partner-logos-track {
          display: flex;
          width: max-content;
          animation: partner-logos-slide 24s linear infinite;
        }

        .partner-logos-card {
          flex: 0 0 auto;
          width: clamp(6.75rem, 11vw, 9rem);
        }

        @keyframes hero-ribbon-slide {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-50%);
          }
        }

        .hero-ribbon-marquee {
          overflow: hidden;
          background: linear-gradient(90deg, var(--brand-primary-muted), var(--bg-canvas-subtle), var(--brand-primary-muted));
          border-top: 1px solid var(--brand-primary-border);
          border-bottom: 1px solid var(--brand-primary-border);
          box-shadow: var(--shadow-card);
        }

        .hero-ribbon-track {
          display: flex;
          width: max-content;
          animation: hero-ribbon-slide 46s linear infinite;
        }

        .hero-ribbon-item {
          flex: 0 0 auto;
        }

        @media (max-width: 768px) {
          .hero-ribbon-track {
            animation-duration: 32s;
          }

          .partner-logos-track {
            animation-duration: 18s;
          }

          .partner-logos-card {
            width: clamp(5.5rem, 22vw, 7.25rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-ribbon-track,
          .partner-logos-track {
            animation: none;
          }
        }
      `}</style>

      <div className="painel-theme kifer-ds theme-light min-h-screen overflow-x-hidden bg-[var(--bg-canvas)] text-[color:var(--text-primary)]">
        <nav
          className={`fixed top-0 z-40 w-full transition-all duration-300 ${
            isScrolled ? 'bg-[var(--panel-glass-bg-lite)] shadow-[var(--shadow-card)] backdrop-blur-sm' : 'bg-transparent'
          }`}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <a href="#topo" className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[var(--kds-radius-sm)] [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
                <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
              </div>
              <span className="text-2xl font-bold text-[color:var(--text-primary)]">Kifer Saúde</span>
            </a>

            <div className="hidden flex-1 items-center justify-center space-x-6 md:flex">
              <a href="#prova-social" className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]">
                Operadoras
              </a>
              <a href="#para-quem" className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]">
                Para quem é
              </a>
              <a href="#como-funciona" className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]">
                Como funciona
              </a>
              <a href="#depoimentos" className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]">
                Depoimentos
              </a>
              <a href="#faq" className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]">
                FAQ
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQuoteModal(true)}
              className="rounded-[var(--kds-radius-sm)] [background:var(--brand-primary-gradient)] px-4 py-2 text-sm font-semibold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-105 hover:[background:var(--brand-primary-gradient-hover)] sm:px-6"
            >
              Cotação grátis
            </button>
          </div>
        </nav>

        <section
          id="topo"
          className="relative flex min-h-[85vh] items-center overflow-hidden [background:var(--surface-hero-bg)] px-4 pb-20 pt-24 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-[var(--brand-primary)] blur-3xl" />
            <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-[var(--accent-gold)] blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 text-left lg:order-1">
                <div className="mb-6">
                  <span className="inline-flex items-center rounded-full [background:var(--brand-primary-gradient)] px-5 py-2.5 text-sm font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)]">
                    <Star className="mr-2 h-4 w-4 fill-current" />
                    Especialista em planos de saúde no RJ
                  </span>
                </div>

                <h1 className="mb-6 font-[var(--font-display)] text-4xl font-extrabold leading-tight text-[color:var(--text-primary)] md:text-5xl lg:text-6xl">
                  O plano ideal começa com{' '}
                  <span className="[background:var(--brand-primary-gradient)] bg-clip-text [color:transparent]">gente de verdade.</span>
                </h1>

                <p className="mb-5 text-lg font-light leading-relaxed text-[color:var(--text-secondary)] md:text-xl">
                  Atendimento humano e especializado em planos de saúde para todo o estado do Rio de Janeiro.
                  <span className="mt-2 block font-semibold text-[color:var(--brand-primary)]">Mais de 500 clientes satisfeitos.</span>
                </p>

                <div className="mb-6 flex flex-wrap gap-2">
                  <div className="inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 backdrop-blur-sm">
                    <Shield className="mr-1.5 h-4 w-4 text-[color:var(--brand-primary)]" />
                    <span className="text-sm font-semibold text-[color:var(--text-primary)]">100% Gratuito</span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 backdrop-blur-sm">
                    <CheckCircle className="mr-1.5 h-4 w-4 text-[color:var(--brand-primary)]" />
                    <span className="text-sm font-semibold text-[color:var(--text-primary)]">Sem compromisso</span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 backdrop-blur-sm">
                    <ThumbsUp className="mr-1.5 h-4 w-4 text-[color:var(--brand-primary)]" />
                    <span className="text-sm font-semibold text-[color:var(--text-primary)]">98% Satisfação</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowQuoteModal(true)}
                    className="whitespace-nowrap rounded-[var(--kds-radius-md)] [background:var(--brand-primary-gradient)] px-8 py-4 text-base font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-105 hover:[background:var(--brand-primary-gradient-hover)] md:text-lg"
                  >
                    Quero minha cotação gratuita
                  </button>

                  <button
                    type="button"
                    onClick={() => openWhatsApp()}
                    className="whitespace-nowrap rounded-[var(--kds-radius-md)] border border-[color:var(--success-border)] bg-[var(--success)] px-8 py-4 text-base font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-105 hover:bg-[var(--success-hover)] md:text-lg"
                  >
                    <MessageCircle className="mr-2 inline-block h-5 w-5" />
                    Falar no WhatsApp
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => openWhatsApp(WHATSAPP_SUPPORT_MESSAGE)}
                  className="mt-4 inline-flex items-center text-sm font-semibold text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
                >
                  Já sou cliente e preciso de suporte
                  <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>

              <div className="order-1 flex justify-center lg:order-2">
                <div className="relative pb-8 pt-20">
                  <div className="absolute -left-2 top-20 z-10 rounded-[var(--kds-radius-md)] bg-[var(--bg-elevated)] px-5 py-3 shadow-[var(--shadow-card)]">
                    <div className="mb-0 text-2xl font-bold text-[color:var(--brand-primary)]">500+</div>
                    <div className="text-xs font-medium text-[color:var(--text-secondary)]">Clientes</div>
                  </div>

                  <div className="absolute -right-2 bottom-32 z-10 rounded-[var(--kds-radius-md)] bg-[var(--bg-elevated)] px-5 py-3 shadow-[var(--shadow-card)]">
                    <div className="mb-0 text-2xl font-bold text-[color:var(--brand-primary)]">4.9★</div>
                    <div className="text-xs font-medium text-[color:var(--text-secondary)]">Avaliação</div>
                  </div>

                  <div className="relative h-[480px] w-[320px] md:h-[540px] md:w-[360px]">
                    <div className="absolute right-0 top-0 z-20 flex items-center gap-2 rounded-full [background:var(--brand-primary-gradient)] px-4 py-2 shadow-[var(--shadow-button)]">
                      <div className="h-2 w-2 rounded-full bg-[var(--text-on-brand)]" />
                      <span className="text-xs font-bold whitespace-nowrap text-[color:var(--text-on-brand)]">Online agora</span>
                    </div>
                    <div className="absolute inset-0 overflow-hidden rounded-[var(--kds-radius-md)] border-4 border-[color:var(--text-on-brand)] [background:var(--surface-hero-bg)] shadow-[var(--shadow-modal)]">
                      <img
                        src="/image.png"
                        alt="Luiza Kifer - especialista em planos de saúde"
                        className="h-full w-full object-cover object-[center_35%] scale-105"
                      />
                    </div>
                  </div>

                  <div className="absolute -bottom-6 left-1/2 z-10 min-w-[280px] -translate-x-1/2 rounded-[var(--kds-radius-md)] bg-[var(--bg-elevated)] px-8 py-4 text-center shadow-[var(--shadow-card)]">
                    <h3 className="mb-1 text-xl font-bold text-[color:var(--text-primary)]">Luiza Kifer</h3>
                    <p className="font-semibold whitespace-nowrap text-[color:var(--brand-primary)]">Sua especialista em saúde</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hero-ribbon-marquee relative z-20 -mt-8 mb-2">
          <div className="hero-ribbon-track items-center gap-5 px-4 py-3 sm:gap-6 sm:px-6">
            {loopedHeroRibbonItems.map((item, index) => (
              <div key={`${item}-${index}`} className="hero-ribbon-item flex items-center gap-5 sm:gap-6" aria-hidden={index >= heroRibbonItems.length}>
                <span className="whitespace-nowrap text-[10px] font-semibold tracking-[0.01em] text-[color:var(--text-secondary)] sm:text-xs lg:text-sm">{item}</span>
                <Sparkles className="h-3.5 w-3.5 text-[color:var(--brand-primary)] sm:h-4 sm:w-4" />
              </div>
            ))}
          </div>
        </div>

        <section id="prova-social" className="scroll-mt-32 bg-[var(--bg-surface)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">confiança em números</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Confiança construída no atendimento real.</h2>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                A Kifer compara operadoras, custos e rede de atendimento com linguagem simples. O foco não é empurrar plano, é ajudar você a decidir.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {publicMetrics.map((metric) => (
                <article key={metric.label} className="rounded-[var(--kds-radius-xl)] border border-[color:var(--brand-primary-border)] bg-[var(--brand-primary-muted)] p-8 shadow-[var(--shadow-card)]">
                  <p className="text-4xl font-black text-[color:var(--text-primary)] md:text-5xl">{metric.value}</p>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--brand-primary)]">{metric.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">{metric.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-12 rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-surface-muted)] px-6 py-8 shadow-[var(--shadow-card)]">
              <div className="mb-6 flex flex-col gap-2 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">operadoras parceiras</p>
                <p className="text-base text-[color:var(--text-secondary)]">Trabalhamos com marcas relevantes para comparar cenário real de contratação no RJ.</p>
              </div>

              <div className="partner-logos-marquee py-2">
                <div className="partner-logos-track items-center gap-12 sm:gap-16">
                  {loopedPartnerLogos.map((logo, index) => (
                    <div
                      key={`${logo.alt}-${index}`}
                      className="partner-logos-card group flex h-20 items-center justify-center"
                      aria-hidden={index >= partnerLogos.length}
                    >
                      <img
                        src={logo.src}
                        alt={logo.alt}
                        className="max-h-9 w-auto max-w-full object-contain grayscale opacity-65 transition duration-300 group-hover:grayscale-0 group-hover:opacity-100 sm:max-h-11"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="para-quem" className="scroll-mt-32 bg-[var(--bg-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">para quem é</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">O plano certo para cada perfil: PF, MEI ou empresa.</h2>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                Se você quer cotar como pessoa física ou entender se existe uma via mais inteligente via CNPJ, a Kifer orienta o caminho sem enrolação.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {audienceCards.map((card) => (
                <article key={card.eyebrow} className="flex flex-col rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-8 shadow-[var(--shadow-card)]">
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">{card.eyebrow}</p>
                        <h3 className="mt-4 font-[var(--font-display)] text-3xl font-bold leading-tight text-[color:var(--text-primary)]">{card.title}</h3>
                      </div>
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--kds-radius-md)] bg-[var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                        <card.icon className="h-7 w-7" />
                      </span>
                    </div>

                    <p className="mt-5 flex-1 text-base leading-relaxed text-[color:var(--text-secondary)]">{card.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollToForm(card.contractKind)}
                    className="mt-auto inline-flex items-center rounded-[var(--kds-radius-sm)] [background:var(--brand-primary-gradient)] px-6 py-3 text-sm font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:-translate-y-0.5 hover:[background:var(--brand-primary-gradient-hover)]"
                  >
                    {card.ctaLabel}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-32 bg-[var(--bg-surface)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">como funciona</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Três passos para sair da dúvida com mais clareza.</h2>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Você me conta o que precisa',
                  text: 'Cidade, idade, rede desejada e perfil de contratação entram primeiro para a análise nascer certa.',
                  icon: MessageCircle,
                },
                {
                  step: '2',
                  title: 'Eu comparo as melhores opções',
                  text: 'A comparação considera operadora, custo, carência, coparticipação e rede funcional para sua rotina.',
                  icon: Search,
                },
                {
                  step: '3',
                  title: 'Você escolhe e eu cuido do resto',
                  text: 'A Kifer acompanha a contratação até a ativação para você não ficar sozinho no meio do processo.',
                  icon: CheckCircle,
                },
              ].map((item) => (
                <article key={item.step} className="relative rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-surface-muted)] p-8 shadow-[var(--shadow-card)]">
                  <div className="absolute -left-3 top-8 flex h-12 w-12 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] text-xl font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)]">
                    {item.step}
                  </div>
                  <div className="ml-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[var(--kds-radius-md)] bg-[var(--bg-elevated)] text-[color:var(--brand-primary)] shadow-[var(--shadow-card)]">
                      <item.icon className="h-8 w-8" />
                    </div>
                    <h3 className="mt-6 font-[var(--font-display)] text-2xl font-bold text-[color:var(--text-primary)]">{item.title}</h3>
                    <p className="mt-4 text-base leading-relaxed text-[color:var(--text-secondary)]">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="depoimentos" className="scroll-mt-32 bg-[var(--bg-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">depoimentos</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Clientes que saíram da cotação com mais segurança.</h2>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <article key={testimonial.name} className="rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-8 shadow-[var(--shadow-card)]">
                  <div className="mb-5 flex items-center gap-1 text-[color:var(--accent-gold)]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={`${testimonial.name}-${index}`} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <p className="text-lg leading-relaxed text-[color:var(--text-secondary)]">&quot;{testimonial.quote}&quot;</p>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-lg font-bold text-[color:var(--brand-primary)]">
                      {testimonial.initial}
                    </div>
                    <div>
                      <p className="font-semibold text-[color:var(--text-primary)]">{testimonial.name}</p>
                      <p className="text-sm text-[color:var(--text-muted)]">{testimonial.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 text-center">
              <a
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-semibold text-[color:var(--brand-primary)] transition-colors hover:text-[color:var(--brand-primary-hover)]"
              >
                Ver mais avaliações no Google
                <ChevronRight className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section id="quem-somos" className="scroll-mt-32 bg-[var(--bg-surface)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div className="relative overflow-hidden rounded-[var(--kds-radius-xl)] [background:var(--surface-hero-bg)] p-4 shadow-[var(--shadow-card)]">
              <div className="overflow-hidden rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)]">
                <img
                  src="/image.png"
                  alt="Luiza Kifer, corretora independente de planos de saúde no Rio de Janeiro"
                  className="h-full min-h-[420px] w-full object-cover object-[center_28%]"
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">sobre a Luiza</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Uma pessoa real te acompanha do início até a ativação.</h2>
              <p className="mt-6 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                Sou corretora independente no Rio de Janeiro. Trabalho com as principais operadoras e cuido de cada cliente com o mesmo cuidado que eu teria ao orientar alguém da minha família.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                O foco da Kifer é deixar a contratação mais clara, comparando custo, rede e regras com linguagem simples para você decidir sem pressão e sem surpresa depois.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: 'Corretora independente',
                    description: 'Comparação com visão consultiva, sem discurso engessado de operadora única.',
                    icon: Heart,
                  },
                  {
                    title: 'Especialista no RJ',
                    description: 'Leitura prática de bairros, cidades e rede credenciada que fazem sentido para a rotina local.',
                    icon: MapPin,
                  },
                  {
                    title: 'Atendimento via WhatsApp',
                    description: 'Velocidade para esclarecer dúvidas e tocar a contratação sem burocracia desnecessária.',
                    icon: MessageCircle,
                  },
                  {
                    title: 'Acompanhamento até o pós-venda',
                    description: 'Você não recebe só a cotação. Recebe suporte até a ativação ficar resolvida.',
                    icon: Phone,
                  },
                ].map((item) => (
                  <article key={item.title} className="rounded-[var(--kds-radius-md)] border border-[color:var(--border-default)] bg-[var(--bg-surface-muted)] p-5 shadow-[var(--shadow-card)]">
                    <item.icon className="h-8 w-8 text-[color:var(--brand-primary)]" />
                    <h3 className="mt-4 font-[var(--font-display)] text-lg font-bold text-[color:var(--text-primary)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-32 bg-[var(--bg-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">faq rápido</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Perguntas frequentes antes de contratar.</h2>
            </div>

            <div className="mt-12 space-y-4">
              {faqItems.map((faq, index) => (
                <div key={faq.question} className="overflow-hidden rounded-[var(--kds-radius-lg)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-card)]">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                    className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left transition-colors hover:bg-[var(--bg-hover)] sm:px-8 sm:py-6"
                    aria-expanded={openFaqIndex === index}
                  >
                    <span className="text-lg font-semibold leading-relaxed text-[color:var(--text-primary)]">{faq.question}</span>
                    <ChevronDown
                      className={`h-6 w-6 shrink-0 text-[color:var(--brand-primary)] transition-transform ${openFaqIndex === index ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaqIndex === index ? (
                    <div className="px-6 pb-6 sm:px-8">
                      <p className="leading-relaxed text-[color:var(--text-secondary)]">{faq.answer}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cotacao" className="scroll-mt-32 [background:var(--brand-primary-gradient)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="text-[color:var(--text-on-brand)]">
              <p className="text-sm font-black uppercase tracking-[0.2em] opacity-80">cotação gratuita</p>
              <h2 className="mt-4 text-4xl font-bold md:text-5xl">Receba um comparativo coerente com o seu perfil.</h2>
              <p className="mt-5 text-lg leading-relaxed opacity-90">
                Preencha o formulário e receba orientação para pessoa física, MEI ou empresa pequena com foco em rede, custo e contratação sem complicação.
              </p>

              <div className="mt-8 space-y-4 rounded-[var(--kds-radius-xl)] border border-[color:color-mix(in_srgb,var(--text-on-brand)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--text-on-brand)_14%,transparent)] p-6 backdrop-blur-sm">
                {[
                  'Atendimento sem custo e sem compromisso.',
                  'Análise prática da sua cidade, faixa etária e número de vidas.',
                  'Contato direto pelo WhatsApp para agilizar a resposta.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-relaxed opacity-90">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-[var(--kds-radius-xl)] bg-[var(--bg-elevated)] p-8 text-[color:var(--text-primary)] shadow-[var(--shadow-modal)] md:p-10">
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[var(--kds-radius-sm)] [background:var(--brand-primary-gradient)] py-4 text-lg font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-[1.01] hover:[background:var(--brand-primary-gradient-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Enviando cotação...' : 'Quero minha cotação personalizada agora'}
                <ChevronRight className="ml-2 inline-block h-5 w-5" />
              </button>

              <p className="mt-4 text-center text-sm text-[color:var(--text-muted)]">Seu contato é usado apenas para montar a melhor cotação para o seu perfil.</p>
            </form>
          </div>
        </section>

        <section className="bg-[var(--text-primary)] px-4 py-16 text-[color:var(--text-inverse)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[var(--kds-radius-xl)] border border-[color:var(--border-strong)] bg-[var(--text-primary)] p-8 shadow-[var(--shadow-modal)] md:p-12">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--accent-gold)]">fale agora</p>
                <h2 className="mt-4 text-4xl font-bold md:text-5xl">Quer resolver isso hoje pelo WhatsApp?</h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed opacity-75">
                  Se preferir, pule direto para a conversa. A Kifer entende seu cenário, compara as opções e te acompanha até a contratação acontecer de verdade.
                </p>
              </div>

              <div className="flex flex-col gap-4 lg:items-end">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-[var(--kds-radius-md)] border border-[color:var(--success-border)] bg-[var(--success)] px-8 py-4 text-base font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:-translate-y-0.5 hover:bg-[var(--success-hover)]"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Quero falar agora no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(true)}
                  className="inline-flex items-center justify-center rounded-[var(--kds-radius-md)] border border-[color:var(--border-strong)] bg-[var(--bg-hover)] px-8 py-4 text-sm font-bold transition-colors hover:bg-[var(--bg-active)]"
                >
                  Prefiro preencher a cotação
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="bg-[var(--text-primary)] px-4 py-14 text-[color:var(--text-inverse)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--kds-radius-md)] [background:var(--brand-primary-gradient)]">
                    <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
                  </div>
                  <span className="text-2xl font-bold">Kifer Saúde</span>
                </div>
                <p className="mt-5 max-w-md text-sm leading-relaxed opacity-70">
                  Corretora especializada em planos de saúde no Rio de Janeiro, com atendimento humano, comparação consultiva e suporte até o pós-venda.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Links rápidos</h3>
                <div className="mt-5 space-y-3 text-sm opacity-70">
                  <a href="#para-quem" className="block transition-colors hover:text-[color:var(--text-inverse)]">
                    Para quem é
                  </a>
                  <a href="#como-funciona" className="block transition-colors hover:text-[color:var(--text-inverse)]">
                    Como funciona
                  </a>
                  <a href="#faq" className="block transition-colors hover:text-[color:var(--text-inverse)]">
                    FAQ
                  </a>
                  <a href="#cotacao" className="block transition-colors hover:text-[color:var(--text-inverse)]">
                    Cotação gratuita
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Contato</h3>
                <div className="mt-5 space-y-3 text-sm opacity-70">
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[color:var(--text-inverse)]">
                    <MessageCircle className="h-4 w-4 text-[color:var(--success)]" />
                    WhatsApp
                  </a>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[color:var(--text-inverse)]">
                    <Instagram className="h-4 w-4 text-[color:var(--accent-gold)]" />
                    @souluizakifer
                  </a>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[color:var(--accent-gold)]" />
                    Rio de Janeiro, RJ
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Legal</h3>
                <div className="mt-5 space-y-3 text-sm opacity-70">
                  <p>CNPJ: {CNPJ}</p>
                  <p>Desenvolvido por Kifer Saúde</p>
                </div>
              </div>
            </div>
          </div>
        </footer>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full border border-[color:var(--success-border)] bg-[var(--success)] px-4 py-3 text-sm font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--success-hover)]"
          aria-label="Abrir conversa no WhatsApp"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>

        {showQuoteModal ? (
          <OverlayModal title="Faça sua cotação" subtitle="Preencha os dados abaixo e receba sua cotação personalizada via WhatsApp" onClose={() => setShowQuoteModal(false)}>
            <form onSubmit={handleSubmit}>
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[var(--kds-radius-sm)] [background:var(--brand-primary-gradient)] py-4 text-lg font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:[background:var(--brand-primary-gradient-hover)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Enviando cotação...' : 'Enviar cotação via WhatsApp'}
                <MessageCircle className="ml-2 inline-block h-5 w-5" />
              </button>

              <p className="mt-4 text-center text-sm text-[color:var(--text-muted)]">Resposta em até 10 minutos</p>
            </form>
          </OverlayModal>
        ) : null}
      </div>
    </>
  );
}
