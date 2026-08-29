import { type FormEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  CheckCircle,
  CheckCheck,
  ChevronRight,
  Clock,
  Heart,
  Instagram,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  UserRound,
  X,
} from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';
import { Input, Select } from '../../design-system';
import { fetchCitiesByState } from '../../lib/brasilLocations';
import { formatPhoneInput } from '../../lib/inputFormatters';
import { supabase } from '../../lib/supabase';
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
  bullets: string[];
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

const loopedPartnerLogos = [...partnerLogos, ...partnerLogos];
const metricIcons = [Users, Building2, TrendingUp];

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
    eyebrow: 'Pessoa física',
    title: 'Comparação direta pra quem quer parar de pagar caro.',
    description: 'A gente compara operadora, rede, carência e coparticipação para mostrar o que realmente compensa na sua rotina.',
    bullets: ['Comparação sem letra miúda', 'Rede pensada pro seu bairro', 'Zero compromisso para pedir'],
    ctaLabel: 'Quero cotar pessoa física',
    contractKind: 'PF',
    icon: UserRound,
  },
  {
    eyebrow: 'MEI',
    title: 'Plano empresarial custa menos do que parece com CNPJ ativo.',
    description: 'Como MEI, você pode acessar plano empresarial com condição melhor que muito plano individual. A gente confere a elegibilidade certa pro seu caso.',
    bullets: ['Elegibilidade explicada sem enrolação', 'Costuma sair mais barato que o individual', 'Ativação rápida com seu CNPJ'],
    ctaLabel: 'Quero cotar como MEI',
    contractKind: 'MEI',
    icon: Briefcase,
  },
  {
    eyebrow: 'Empresa',
    title: 'Plano coletivo pra empresa com o time crescendo.',
    description: 'Comparamos operadoras e desenho de plano para fechar uma proposta empresarial que faça sentido pro seu time e pro seu orçamento.',
    bullets: ['Proposta sob medida pro seu quadro', 'Comparação entre operadoras parceiras', 'Suporte na documentação e ativação'],
    ctaLabel: 'Quero cotar para empresa',
    contractKind: 'CNPJ',
    icon: Building2,
  },
];

const howItWorksSteps = [
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

const buildWhatsAppUrl = (message: string) => `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;

const normalizeLeadPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('55') && digits.length > 11) {
    return digits.slice(2, 13);
  }

  return digits.slice(0, 11);
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
    <div
      className="modal-backdrop-animated fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--overlay)] p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`modal-panel modal-panel-animated flex w-full ${maxWidthClass} max-h-[90vh] flex-col overflow-hidden rounded-[var(--kds-radius-xl)] bg-[var(--bg-elevated)] text-[color:var(--text-primary)] shadow-[var(--shadow-modal)]`}
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

type ParsedMetricValue = {
  sign: string;
  suffix: string;
  targetValue: number;
  decimalPlaces: number;
};

const parseMetricValue = (raw: string): ParsedMetricValue | null => {
  const trimmed = raw.trim();
  const sign = trimmed.startsWith('+') || trimmed.startsWith('-') ? trimmed[0] : '';
  const rest = sign ? trimmed.slice(1) : trimmed;

  const numericMatch = rest.match(/^[\d.]+/);
  if (!numericMatch) {
    return null;
  }

  const numericPart = numericMatch[0];
  const suffix = rest.slice(numericPart.length);
  const segments = numericPart.split('.').filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  const lastSegment = segments[segments.length - 1];
  const isDecimal = segments.length > 1 && lastSegment.length < 3;
  const decimalPlaces = isDecimal ? lastSegment.length : 0;
  const integerSegments = isDecimal ? segments.slice(0, -1) : segments;
  const wholeDigits = integerSegments.join('');
  const targetValue = isDecimal ? Number(`${wholeDigits}.${lastSegment}`) : Number(segments.join(''));

  if (!Number.isFinite(targetValue)) {
    return null;
  }

  return { sign, suffix, targetValue, decimalPlaces };
};

const formatMetricValue = (value: number, parsed: ParsedMetricValue) => {
  const formattedNumber =
    parsed.decimalPlaces > 0 ? value.toFixed(parsed.decimalPlaces) : Math.round(value).toLocaleString('pt-BR');

  return `${parsed.sign}${formattedNumber}${parsed.suffix}`;
};

type AnimatedMetricValueProps = {
  value: string;
  play: boolean;
};

function AnimatedMetricValue({ value, play }: AnimatedMetricValueProps) {
  const parsed = useMemo(() => parseMetricValue(value), [value]);
  const [display, setDisplay] = useState(() => (parsed ? formatMetricValue(0, parsed) : value));
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }

    if (!play) {
      if (!hasPlayedRef.current) {
        setDisplay(formatMetricValue(0, parsed));
      }
      return;
    }

    // Only ever animate the count-up once. If the metric value changes afterwards
    // (e.g. live data replacing the fallback), just snap to it instead of resetting
    // to 0 and counting up again, which reads as the number flickering/blinking.
    if (hasPlayedRef.current) {
      setDisplay(formatMetricValue(parsed.targetValue, parsed));
      return;
    }

    hasPlayedRef.current = true;

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplay(formatMetricValue(parsed.targetValue, parsed));
      return;
    }

    let frameId: number;
    const duration = 1400;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(formatMetricValue(parsed.targetValue * eased, parsed));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [parsed, play, value]);

  return <>{display}</>;
}

type RevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  onReveal?: () => void;
};

function Reveal({ children, className, delayMs = 0, onReveal }: RevealProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          onReveal?.();
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
    // Runs once on mount; onReveal only needs to fire the first time this enters view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={nodeRef}
      className={`${isVisible ? 'reveal-visible' : 'reveal-hidden'}${className ? ` ${className}` : ''}`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

type CityAutocompleteFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

function CityAutocompleteField({ id, value, onChange }: CityAutocompleteFieldProps) {
  const [cities, setCities] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    let active = true;

    fetchCitiesByState('RJ')
      .then((list) => {
        if (active) {
          setCities(list);
        }
      })
      .catch(() => {
        // Sem lista carregada, o campo continua funcionando como texto livre.
      });

    return () => {
      active = false;
    };
  }, []);

  const query = value.trim().toLowerCase();
  const suggestions = query.length >= 2 ? cities.filter((city) => city.toLowerCase().includes(query)).slice(0, 6) : [];
  const showSuggestions = isOpen && suggestions.length > 0;

  const selectCity = (city: string) => {
    onChange(city);
    setIsOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectCity(suggestions[highlightedIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        required
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        leftIcon={MapPin}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={handleKeyDown}
        size="large"
        placeholder="Sua cidade no RJ"
      />
      {showSuggestions ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-[color:var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-popover)]"
        >
          {suggestions.map((city, index) => {
            const matchIndex = city.toLowerCase().indexOf(query);
            const before = matchIndex >= 0 ? city.slice(0, matchIndex) : city;
            const match = matchIndex >= 0 ? city.slice(matchIndex, matchIndex + query.length) : '';
            const after = matchIndex >= 0 ? city.slice(matchIndex + query.length) : '';

            return (
              <button
                key={city}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCity(city)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm text-[color:var(--text-secondary)] ${
                  index === highlightedIndex ? 'bg-[var(--bg-hover)]' : ''
                }`}
              >
                {before}
                <strong className="text-[color:var(--text-primary)]">{match}</strong>
                {after}
              </button>
            );
          })}
        </div>
      ) : null}
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
  const [publicMetrics, setPublicMetrics] = useState<PublicMetric[]>(fallbackPublicMetrics);
  const [submitting, setSubmitting] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [metricsInView, setMetricsInView] = useState(false);

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

  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (!node) {
      return;
    }

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const handleNavLinkClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    scrollToSection(id);
  };

  const scrollToForm = (contractKind?: ContractKind) => {
    if (contractKind) {
      setFormData((current) => ({
        ...current,
        tipoContratacao: contractKind,
      }));
    }

    window.requestAnimationFrame(() => scrollToSection('cotacao'));
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
    const website = new FormData(event.currentTarget).get('website');

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

    if (totalLives > 99) {
      toast.warning('Informe no maximo 99 vidas no contrato.');
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

    const holderAge = Number(formData.idadeTitular);
    if (totalLives === 1 && (!Number.isInteger(holderAge) || holderAge < 0 || holderAge > 120)) {
      toast.warning('Informe uma idade valida para prosseguir.');
      return;
    }

    const agesText =
      totalLives === 1
        ? `1 vida - idade: ${formData.idadeTitular.trim()}`
        : `${totalLives} vidas - ${filledAgeRanges.map(({ range, quantity }) => `${range}: ${quantity}`).join(', ')}`;

    setSubmitting(true);

    const payload = {
      name: cleanName,
      phone: cleanPhone,
      city: cleanCity,
      contractType: formData.tipoContratacao,
      totalLives,
      ageSummary:
        totalLives === 1
          ? { type: 'single', age: holderAge }
          : {
              type: 'ranges',
              counts: Object.fromEntries(
                AGE_RANGES.map((range) => [range.replace(/\s+/g, ''), Number.parseInt(ageRangeCounts[range], 10) || 0]),
              ),
            },
      website: typeof website === 'string' ? website : '',
    };

    try {
      const { error } = await supabase.functions.invoke('public-lead-submit', { body: payload });
      if (error) {
        throw error;
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
    } catch {
      toast.error('Não foi possível enviar a cotação agora. Tente novamente ou fale no WhatsApp.');
    } finally {
      setSubmitting(false);
    }
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
          size="large"
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
          size="large"
          placeholder="(21) 99999-9999"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-city">
          Cidade *
        </label>
        <CityAutocompleteField
          id="quote-city"
          value={formData.cidade}
          onChange={(city) => setFormData((current) => ({ ...current, cidade: city }))}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[color:var(--text-primary)]" htmlFor="quote-contract-type">
          Tipo de contratação *
        </label>
        <Select
          id="quote-contract-type"
          value={formData.tipoContratacao}
          onChange={(event) =>
            setFormData((current) => ({
              ...current,
              tipoContratacao: event.target.value as ContractKind,
            }))
          }
          size="large"
          options={[
            { value: 'PF', label: 'Pessoa física' },
            { value: 'MEI', label: 'MEI' },
            { value: 'CNPJ', label: 'CNPJ' },
          ]}
        />
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
          size="large"
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
                  className="mt-2"
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
            size="large"
            placeholder="Informe a idade"
          />
        </div>
      ) : null}

      <div className="absolute h-px w-px overflow-hidden whitespace-nowrap opacity-0 pointer-events-none" aria-hidden="true">
        <label htmlFor="quote-website">Website</label>
        <input id="quote-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
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

        @media (max-width: 768px) {
          .partner-logos-track {
            animation-duration: 18s;
          }

          .partner-logos-card {
            width: clamp(5.5rem, 22vw, 7.25rem);
          }
        }

        @keyframes modal-backdrop-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes modal-panel-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-backdrop-animated {
          animation: modal-backdrop-in 200ms ease-out;
        }

        .modal-panel-animated {
          animation: modal-panel-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .reveal-hidden,
        .reveal-visible {
          transition: opacity 600ms ease-out, transform 600ms ease-out;
        }

        .reveal-hidden {
          opacity: 0;
          transform: translateY(24px);
        }

        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }

        @media (prefers-reduced-motion: reduce) {
          .partner-logos-track {
            animation: none;
          }

          .modal-backdrop-animated,
          .modal-panel-animated {
            animation: none;
          }

          .reveal-hidden,
          .reveal-visible {
            transition: none;
            opacity: 1;
            transform: none;
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
            <a href="#topo" onClick={(event) => handleNavLinkClick(event, 'topo')} className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
                <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
              </div>
              <span className="text-2xl font-bold text-[color:var(--text-primary)]">Kifer Saúde</span>
            </a>

            <div className="hidden flex-1 items-center justify-center space-x-6 md:flex">
              <a
                href="#prova-social"
                onClick={(event) => handleNavLinkClick(event, 'prova-social')}
                className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
              >
                Operadoras
              </a>
              <a
                href="#para-quem"
                onClick={(event) => handleNavLinkClick(event, 'para-quem')}
                className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
              >
                Para quem é
              </a>
              <a
                href="#como-funciona"
                onClick={(event) => handleNavLinkClick(event, 'como-funciona')}
                className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
              >
                Como funciona
              </a>
              <a
                href="#depoimentos"
                onClick={(event) => handleNavLinkClick(event, 'depoimentos')}
                className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
              >
                Depoimentos
              </a>
              <a
                href="#faq"
                onClick={(event) => handleNavLinkClick(event, 'faq')}
                className="font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--brand-primary)]"
              >
                FAQ
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQuoteModal(true)}
              className="rounded-full [background:var(--brand-primary-gradient)] px-4 py-2 text-sm font-semibold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-105 hover:[background:var(--brand-primary-gradient-hover)] sm:px-6"
            >
              Cotação grátis
            </button>
          </div>
        </nav>

        <section id="topo" className="relative overflow-hidden [background:var(--surface-hero-bg)] px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:px-8 lg:pb-0 lg:pt-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_78%_43%,var(--brand-primary-muted),transparent_36%)]" />
          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-4">
            <div className="relative z-10 max-w-2xl py-6 sm:py-10 lg:py-16">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-primary-border)] bg-[var(--brand-primary-muted)] px-4 py-2 text-sm font-medium text-[color:var(--text-secondary)]">
                <Heart aria-hidden="true" className="h-4 w-4 fill-current text-[color:var(--brand-primary)]" />
                Especialista em planos de saúde no RJ
              </div>

              <h1 className="mt-7 max-w-[11ch] font-[var(--font-display)] text-[clamp(3rem,6.2vw,5.75rem)] font-bold leading-[0.94] tracking-[-0.035em] text-[color:var(--text-primary)]">
                O plano ideal começa com <span className="text-[color:var(--brand-primary)]">gente de verdade.</span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-8 text-[color:var(--text-secondary)] sm:text-xl">
                Atendimento humano e especializado em planos de saúde para todo o estado do Rio de Janeiro.
              </p>

              <div aria-hidden="true" className="mt-7 h-0.5 w-14 rounded-full bg-[var(--brand-primary)]" />
              <p className="mt-7 font-[var(--font-display)] text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">
                Seu cuidado é a nossa prioridade
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowQuoteModal(true)}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--kds-radius-lg)] [background:var(--brand-primary-gradient)] px-6 text-base font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition duration-200 hover:-translate-y-0.5 hover:[background:var(--brand-primary-gradient-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]"
                >
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                  Quero minha cotação gratuita
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp()}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--kds-radius-lg)] border border-[color:var(--success-border)] bg-[var(--bg-surface)] px-6 text-base font-bold text-[color:var(--success)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--success-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--success)]"
                >
                  <MessageCircle aria-hidden="true" className="h-5 w-5" />
                  Falar no WhatsApp
                </button>
              </div>

              <button
                type="button"
                onClick={() => openWhatsApp(WHATSAPP_SUPPORT_MESSAGE)}
                className="mt-5 inline-flex items-center border-b border-[color:var(--border-default)] pb-1 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--brand-primary)]"
              >
                Já sou cliente e preciso de suporte
                <ArrowUpRight aria-hidden="true" className="ml-2 h-4 w-4" />
              </button>
            </div>

            <div className="relative mx-auto flex w-full max-w-xl items-end justify-center self-end lg:h-[calc(100vh-5rem)] lg:min-h-[640px]">
              <div aria-hidden="true" className="absolute bottom-[7%] left-1/2 aspect-square w-[92%] -translate-x-1/2 rounded-full bg-[var(--brand-primary-muted)]" />
              <div aria-hidden="true" className="absolute bottom-[10%] left-[4%] h-[54%] w-[92%] rounded-[50%] border border-[color:var(--brand-primary-border)] opacity-50" />
              <img
                src="/luiza-kifer-hero.png"
                alt="Luiza Kifer, especialista em planos de saúde, segurando um notebook"
                className="relative z-10 h-auto max-h-[720px] w-[88%] object-contain object-bottom lg:max-h-[900px] lg:w-[125%] lg:max-w-none"
              />
              <div className="absolute bottom-[9%] right-0 z-20 flex items-center gap-3 rounded-[var(--kds-radius-lg)] border border-[color:var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 shadow-[var(--shadow-card)] sm:right-[2%] sm:px-5 sm:py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-primary-muted)] text-[color:var(--brand-primary)]">
                  <UserRound aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold leading-5 text-[color:var(--text-primary)] sm:text-base">
                  Atendimento<br /><strong className="text-[color:var(--brand-primary)]">100% gratuito</strong>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="prova-social" className="scroll-mt-32 bg-[var(--bg-surface)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">confiança em números</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Confiança construída no atendimento real.</h2>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                A Kifer compara operadoras, custos e rede de atendimento com linguagem simples. O foco não é empurrar plano, é ajudar você a decidir.
              </p>
            </Reveal>

            <Reveal className="mt-12 grid gap-5 md:grid-cols-3" delayMs={100} onReveal={() => setMetricsInView(true)}>
              {publicMetrics.map((metric, index) => {
                const MetricIcon = metricIcons[index] ?? Sparkles;

                return (
                  <article
                    key={metric.label}
                    className="relative overflow-hidden rounded-[var(--kds-radius-xl)] border border-[color:var(--brand-primary-border)] bg-[var(--brand-primary-muted)] p-8 shadow-[var(--shadow-card)]"
                  >
                    <MetricIcon className="absolute -right-4 -top-4 h-24 w-24 text-[color:var(--brand-primary)] opacity-[0.08]" />
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[color:var(--brand-primary)] shadow-[var(--shadow-card)]">
                      <MetricIcon className="h-6 w-6" />
                    </span>
                    <p className="relative mt-6 text-4xl font-black text-[color:var(--text-primary)] md:text-5xl">
                      <AnimatedMetricValue value={metric.value} play={metricsInView} />
                    </p>
                    <p className="relative mt-3 text-lg font-semibold text-[color:var(--brand-primary)]">{metric.label}</p>
                    <p className="relative mt-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">{metric.detail}</p>
                  </article>
                );
              })}
            </Reveal>

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
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">para quem é</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">O plano certo para cada perfil: PF, MEI ou empresa.</h2>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                Cada perfil pede uma leitura diferente de rede, custo e carência. Escolha o seu abaixo e a Kifer cuida dos detalhes.
              </p>
            </Reveal>

            <Reveal className="mt-12 grid gap-6 md:grid-cols-3" delayMs={100}>
              {audienceCards.map((card) => (
                <article key={card.eyebrow} className="flex flex-col rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)] p-7 shadow-[var(--shadow-card)]">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                    <card.icon className="h-7 w-7" />
                  </span>

                  <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">{card.eyebrow}</p>
                  <h3 className="mt-2 font-[var(--font-display)] text-2xl font-bold leading-tight text-[color:var(--text-primary)]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-secondary)]">{card.description}</p>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {card.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-sm text-[color:var(--text-secondary)]">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-primary)]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => scrollToForm(card.contractKind)}
                    className="mt-6 inline-flex items-center justify-center rounded-full [background:var(--brand-primary-gradient)] px-6 py-3 text-sm font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:-translate-y-0.5 hover:[background:var(--brand-primary-gradient-hover)]"
                  >
                    {card.ctaLabel}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-32 bg-[var(--bg-surface)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">como funciona</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Três passos para sair da dúvida com mais clareza.</h2>
              <p className="mt-4 text-lg leading-relaxed text-[color:var(--text-secondary)]">
                Do primeiro contato até a ativação, você sabe exatamente em que etapa está.
              </p>
            </Reveal>

            <Reveal className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8" delayMs={100}>
              <div className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-8 hidden h-px bg-[color:var(--border-strong)] md:block" />

              {howItWorksSteps.map((item) => (
                <div key={item.step} className="relative flex flex-col items-center text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[color:var(--brand-primary)] shadow-[var(--shadow-card)] ring-8 ring-[var(--bg-surface)]">
                    <item.icon className="h-7 w-7" />
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] text-xs font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)]">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="mt-6 font-[var(--font-display)] text-xl font-bold text-[color:var(--text-primary)]">{item.title}</h3>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-[color:var(--text-secondary)]">{item.text}</p>
                </div>
              ))}
            </Reveal>

            <Reveal className="mt-14 flex flex-col items-center gap-4 text-center" delayMs={150}>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">Pronto para começar a sua comparação?</p>
              <button
                type="button"
                onClick={() => scrollToForm()}
                className="inline-flex items-center justify-center rounded-full [background:var(--brand-primary-gradient)] px-8 py-4 text-base font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:-translate-y-0.5 hover:[background:var(--brand-primary-gradient-hover)]"
              >
                Quero minha cotação gratuita
                <ChevronRight className="ml-2 h-5 w-5" />
              </button>
            </Reveal>
          </div>
        </section>

        <section id="depoimentos" className="scroll-mt-32 bg-[var(--bg-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">depoimentos</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Clientes que saíram da cotação com mais segurança.</h2>
            </Reveal>

            <Reveal className="mt-12 grid gap-6 md:grid-cols-3" delayMs={100}>
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
            </Reveal>

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
            <Reveal className="relative overflow-hidden rounded-[var(--kds-radius-xl)] [background:var(--surface-hero-bg)] p-4 shadow-[var(--shadow-card)]">
              <div className="overflow-hidden rounded-[var(--kds-radius-xl)] border border-[color:var(--border-default)] bg-[var(--bg-elevated)]">
                <img
                  src="/image.png"
                  alt="Luiza Kifer, corretora independente de planos de saúde no Rio de Janeiro"
                  className="h-full min-h-[420px] w-full object-cover object-[center_28%]"
                />
              </div>
            </Reveal>

            <Reveal delayMs={120}>
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
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-32 bg-[var(--bg-surface-muted)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <Reveal className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">faq rápido</p>
              <h2 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-[color:var(--text-primary)] md:text-5xl">Perguntas frequentes antes de contratar.</h2>
            </Reveal>

            <Reveal className="mt-12 space-y-3" delayMs={100}>
              {faqItems.map((faq, index) => (
                <div key={faq.question} className="rounded-2xl border border-[color:var(--border-default)] bg-[var(--bg-elevated)] px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                    className="flex w-full items-center justify-between gap-5 text-left"
                    aria-expanded={openFaqIndex === index}
                  >
                    <span className="text-base font-semibold leading-relaxed text-[color:var(--text-primary)] sm:text-lg">{faq.question}</span>
                    {openFaqIndex === index ? (
                      <Minus className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]" />
                    ) : (
                      <Plus className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]" />
                    )}
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: openFaqIndex === index ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <p className="pt-3 leading-relaxed text-[color:var(--text-secondary)]">{faq.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </section>

        <section id="cotacao" className="scroll-mt-32 [background:var(--brand-primary-gradient)] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <Reveal className="text-[color:var(--text-on-brand)]">
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
            </Reveal>

            <Reveal delayMs={120}>
              <form onSubmit={handleSubmit} className="rounded-[var(--kds-radius-xl)] bg-[var(--bg-elevated)] p-8 text-[color:var(--text-primary)] shadow-[var(--shadow-modal)] md:p-10">
                <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full [background:var(--brand-primary-gradient)] py-4 text-lg font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:scale-[1.01] hover:[background:var(--brand-primary-gradient-hover)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Enviando cotação...' : 'Quero minha cotação personalizada agora'}
                  <ChevronRight className="ml-2 inline-block h-5 w-5" />
                </button>

                <p className="mt-4 text-center text-sm text-[color:var(--text-muted)]">Seu contato é usado apenas para montar a melhor cotação para o seu perfil.</p>
              </form>
            </Reveal>
          </div>
        </section>

        <section id="fale-agora" className="scroll-mt-32 bg-[var(--text-primary)] px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[var(--kds-radius-xl)] border border-[color:var(--border-strong)] bg-[var(--text-primary)] text-[color:var(--text-inverse)] shadow-[var(--shadow-modal)]">
            <div className="pointer-events-none absolute inset-0 opacity-20">
              <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-[var(--brand-primary)] blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[var(--accent-gold)] blur-3xl" />
            </div>

            <div className="relative grid gap-12 p-8 md:p-12 lg:grid-cols-2 lg:items-center lg:gap-16">
              <div>
                <div className="mb-6 flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0">
                    <div className="h-full w-full overflow-hidden rounded-full border-4 border-[color:color-mix(in_srgb,var(--text-inverse)_16%,transparent)]">
                      <img src="/image.png" alt="Luiza Kifer" className="h-full w-full object-cover object-[center_20%]" />
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[color:var(--text-primary)] bg-[var(--success)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--text-on-brand)]" />
                    </span>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--success)_18%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--success)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                      Online agora
                    </div>
                    <p className="mt-1.5 text-sm font-semibold opacity-80">Luiza Kifer · Kifer Saúde</p>
                  </div>
                </div>

                <p className="text-sm font-black uppercase tracking-[0.2em] text-[color:var(--accent-gold)]">fale agora</p>
                <h2 className="mt-4 text-4xl font-bold md:text-5xl">Quer resolver isso hoje pelo WhatsApp?</h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed opacity-75">
                  Se preferir, pule direto para a conversa. A Kifer entende seu cenário, compara as opções e te acompanha até a contratação acontecer de verdade.
                </p>

                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold opacity-70">
                  <Clock className="h-4 w-4 text-[color:var(--accent-gold)]" />
                  Responde em poucos minutos, sem robô.
                </div>
              </div>

              <div>
                <div className="rounded-[var(--kds-radius-xl)] border border-[color:var(--border-strong)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-modal)]">
                  <div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] pb-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
                      <img src="/image.png" alt="" className="h-full w-full object-cover object-[center_20%]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[color:var(--text-primary)]">Luiza Kifer</p>
                      <p className="text-xs font-semibold text-[color:var(--success-text)]">online</p>
                    </div>
                    <MessageCircle className="ml-auto h-5 w-5 text-[color:var(--success)]" />
                  </div>

                  <div className="mt-4 rounded-[var(--kds-radius-lg)] border border-[color:var(--brand-primary-border)] [background:linear-gradient(135deg,var(--brand-primary-soft)_0%,var(--accent-gold-soft)_100%)] px-4 py-3 text-sm leading-relaxed text-[color:var(--text-primary)]">
                    Oi! 👋 Me conta sua cidade e o tipo de plano que você procura que eu já trago as opções comparadas.
                    <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-[color:var(--text-muted)]">
                      agora
                      <CheckCheck className="h-3.5 w-3.5 text-[color:var(--info)]" />
                    </div>
                  </div>
                </div>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-5 inline-flex w-full items-center justify-between gap-2 rounded-full border border-[color:var(--success-border)] bg-[var(--success)] py-2 pl-5 pr-2 text-sm font-bold whitespace-nowrap text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:-translate-y-0.5 hover:bg-[var(--success-hover)]"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 shrink-0" />
                    Falar no WhatsApp
                  </span>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--text-on-brand)_20%,transparent)] transition-transform group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="bg-[var(--text-primary)] px-4 py-14 text-[color:var(--text-inverse)] sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full [background:var(--brand-primary-gradient)]">
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
                  <a
                    href="#para-quem"
                    onClick={(event) => handleNavLinkClick(event, 'para-quem')}
                    className="block transition-colors hover:text-[color:var(--text-inverse)]"
                  >
                    Para quem é
                  </a>
                  <a
                    href="#como-funciona"
                    onClick={(event) => handleNavLinkClick(event, 'como-funciona')}
                    className="block transition-colors hover:text-[color:var(--text-inverse)]"
                  >
                    Como funciona
                  </a>
                  <a
                    href="#faq"
                    onClick={(event) => handleNavLinkClick(event, 'faq')}
                    className="block transition-colors hover:text-[color:var(--text-inverse)]"
                  >
                    FAQ
                  </a>
                  <a
                    href="#cotacao"
                    onClick={(event) => handleNavLinkClick(event, 'cotacao')}
                    className="block transition-colors hover:text-[color:var(--text-inverse)]"
                  >
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

        {showQuoteModal ? (
          <OverlayModal title="Faça sua cotação" subtitle="Preencha os dados abaixo e receba sua cotação personalizada via WhatsApp" onClose={() => setShowQuoteModal(false)}>
            <form onSubmit={handleSubmit}>
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full [background:var(--brand-primary-gradient)] py-4 text-lg font-bold text-[color:var(--text-on-brand)] shadow-[var(--shadow-button)] transition-all hover:[background:var(--brand-primary-gradient-hover)] disabled:cursor-not-allowed disabled:opacity-70"
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
