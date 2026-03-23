import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Heart,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Shield,
  Star,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';
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

type Review = {
  name: string;
  age: number;
  rating: number;
  date: string;
  review: string;
};

type ValueCard = {
  title: string;
  description: string;
  icon: typeof Heart;
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
const WHATSAPP_DEFAULT_MESSAGE = 'Ola! Quero uma cotacao de plano de saude com a Kifer.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
const EMAIL = 'contato@kifersaude.com.br';
const CNPJ = '46.423.078/0001-10';
const INSTAGRAM_URL = 'https://instagram.com/souluizakifer';

const faqItems: PublicFaqItem[] = [
  {
    question: 'Qual a diferenca entre pessoa fisica e MEI?',
    answer:
      'Planos para pessoa fisica sao individuais ou familiares contratados em seu nome. Ja planos MEI ou empresariais sao contratados com CNPJ e podem trazer melhor custo-beneficio quando existe elegibilidade correta.',
  },
  {
    question: 'Quanto tempo demora para o plano ser ativado?',
    answer:
      'Depois da aprovacao da proposta, o prazo costuma variar conforme a operadora e a analise documental. Em muitos casos o retorno acontece em poucos dias uteis.',
  },
  {
    question: 'Posso incluir minha familia no plano?',
    answer:
      'Sim. Dependendo da modalidade, e possivel incluir conjuge, filhos e dependentes permitidos pela operadora. A Kifer orienta a melhor composicao para o seu caso.',
  },
  {
    question: 'Existe carencia para usar o plano?',
    answer:
      'Sim. A carencia muda conforme o procedimento e as regras do produto. Urgencias, consultas, exames e internacoes podem ter prazos diferentes.',
  },
  {
    question: 'Posso escolher meus medicos e hospitais?',
    answer:
      'Isso depende da rede credenciada de cada plano. A analise correta considera hospitais, laboratorios e bairros que fazem sentido para sua rotina.',
  },
  {
    question: 'O que e coparticipacao?',
    answer:
      'Coparticipacao e quando a mensalidade tende a ser menor, mas parte do valor de consultas ou exames e cobrada quando ha utilizacao. Pode valer a pena para perfis de baixo uso.',
  },
  {
    question: 'Posso cancelar o plano quando quiser?',
    answer:
      'As regras de cancelamento variam conforme o contrato e a modalidade. Antes da assinatura, a Kifer explica as condicoes e pontos de atencao de cada proposta.',
  },
  {
    question: 'Qual a diferenca entre abrangencia estadual e nacional?',
    answer:
      'Planos estaduais costumam atender melhor quem concentra uso em uma regiao especifica. Ja os nacionais fazem mais sentido para quem viaja ou precisa de rede ampla fora do estado.',
  },
];

const partnerLogos: PartnerLogo[] = [
  { src: '/amil-logo-1-2.png', alt: 'Amil' },
  { src: '/porto-logo.png', alt: 'Porto Seguro' },
  { src: '/assim-saude-logo.png', alt: 'Assim Saude' },
  { src: '/sulamerica-saude-logo.png', alt: 'SulAmerica Saude' },
  { src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saude' },
];

const loopedPartnerLogos = [...partnerLogos, ...partnerLogos];

const testimonials: Testimonial[] = [
  {
    quote: 'Eu achava que plano bom era caro, mas com a Luiza consegui pagar menos e ainda ter Rede DOr. Atendimento nota 10!',
    initial: 'R',
    name: 'Regina',
    detail: '44 anos',
  },
  {
    quote: 'Atendimento super rapido pelo WhatsApp. Em menos de 1 hora ja tinha minha cotacao com varias opcoes.',
    initial: 'M',
    name: 'Marcelo',
    detail: '38 anos',
  },
  {
    quote: 'Excelente suporte durante todo o processo. A Kifer Saude realmente se importa com o cliente!',
    initial: 'A',
    name: 'Ana Paula',
    detail: '52 anos',
  },
];

const valueCards: ValueCard[] = [
  {
    title: 'Atendimento humanizado',
    description: 'Tratamos cada cliente com cuidado e atencao personalizada.',
    icon: Heart,
  },
  {
    title: 'Resposta rapida via WhatsApp',
    description: 'Atendimento agil e eficiente pelo canal que voce prefere.',
    icon: Zap,
  },
  {
    title: 'Suporte durante toda a vigencia',
    description: 'Acompanhamos voce do primeiro contato ao pos-venda.',
    icon: Phone,
  },
  {
    title: 'Cotacoes personalizadas',
    description: 'Sem custo e montadas de acordo com seu perfil real de uso.',
    icon: Search,
  },
  {
    title: 'Comparativo claro',
    description: 'Explicamos carencias, rede, coparticipacao e custo com linguagem simples.',
    icon: CheckCircle,
  },
  {
    title: 'Operadoras regulamentadas',
    description: 'Trabalhamos com parceiros certificados e opcoes validadas para o RJ.',
    icon: Shield,
  },
];

const reviewItems: Review[] = [
  {
    name: 'Regina Silva',
    age: 44,
    rating: 5,
    date: 'Ha 2 semanas',
    review:
      'Eu achava que plano bom era caro, mas com a Luiza consegui pagar menos e ainda ter Rede DOr. Atendimento nota 10! Ela explicou cada detalhe e me ajudou a escolher o melhor custo-beneficio.',
  },
  {
    name: 'Marcelo Santos',
    age: 38,
    rating: 5,
    date: 'Ha 1 mes',
    review:
      'Atendimento super rapido pelo WhatsApp. Em menos de 1 hora ja tinha minha cotacao com varias opcoes. A Luiza e muito atenciosa e profissional!',
  },
  {
    name: 'Ana Paula Ferreira',
    age: 52,
    rating: 5,
    date: 'Ha 1 mes',
    review:
      'Excelente suporte durante todo o processo. A Kifer Saude realmente se importa com o cliente! Tirou todas as minhas duvidas e ainda me ligou depois para saber se estava tudo certo.',
  },
  {
    name: 'Carlos Eduardo',
    age: 29,
    rating: 5,
    date: 'Ha 2 meses',
    review:
      'Como MEI, consegui economizar muito no plano empresarial. A Luiza me mostrou opcoes que eu nem sabia que existiam. Recomendo demais!',
  },
  {
    name: 'Juliana Oliveira',
    age: 35,
    rating: 5,
    date: 'Ha 2 meses',
    review:
      'Contratei plano para toda minha familia e foi super tranquilo. A Luiza tem um conhecimento incrivel sobre as operadoras e me ajudou a escolher o melhor.',
  },
  {
    name: 'Roberto Alves',
    age: 47,
    rating: 5,
    date: 'Ha 3 meses',
    review:
      'Precisava migrar de operadora com urgencia e a Kifer Saude resolveu tudo rapidinho. Atendimento excepcional e muito profissional!',
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

function OverlayModal({ title, subtitle, maxWidthClass = 'max-w-3xl', onClose, children }: OverlayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`modal-panel flex w-full ${maxWidthClass} max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
          <div>
            <h2 className="text-3xl font-bold">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-white/90">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-white/20"
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
  const [submitting, setSubmitting] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
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
    const hasOpenModal = showQuoteModal || showStoryModal || showReviewsModal;
    const previousOverflow = document.body.style.overflow;

    if (hasOpenModal) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showQuoteModal, showReviewsModal, showStoryModal]);

  const updateAgeRangeCount = (range: (typeof AGE_RANGES)[number], value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setAgeRangeCounts((current) => ({ ...current, [range]: numericValue }));
  };

  const openWhatsApp = (message: string = WHATSAPP_DEFAULT_MESSAGE) => {
    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  };

  const scrollToForm = () => {
    document.getElementById('cotacao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      toast.warning('Preencha um WhatsApp valido para continuar.');
      return;
    }

    if (cleanCity.length < 2) {
      toast.warning('Informe sua cidade para montar a cotacao.');
      return;
    }

    if (totalLives < 1) {
      toast.warning('Informe a quantidade de vidas no contrato.');
      return;
    }

    if (totalLives > 1 && filledAgeRanges.length === 0) {
      toast.warning('Distribua as vidas nas faixas etarias para continuar.');
      return;
    }

    if (totalLives > 1 && ageRangeTotal !== totalLives) {
      toast.warning('A soma das faixas etarias precisa bater com a quantidade total de vidas.');
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
      observacoes: `Lead site | Visual 11/2025 | Tipo: ${formData.tipoContratacao} | Cidade: ${cleanCity} | Beneficiarios: ${agesText}`,
      data_criacao: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      arquivado: false,
    };

    const { error } = await supabase.from('leads').insert([payload]);

    if (error) {
      toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel enviar a cotacao agora. Tente novamente ou fale no WhatsApp.'));
      setSubmitting(false);
      return;
    }

    const whatsappMessage = [
      'Ola! Acabei de preencher a cotacao no site da Kifer.',
      `Nome: ${cleanName}`,
      `Cidade: ${cleanCity}`,
      `Tipo: ${formData.tipoContratacao}`,
      `Beneficiarios: ${agesText}`,
    ].join('\n');

    openWhatsApp(whatsappMessage);
    toast.success('Cotacao enviada com sucesso. Abrimos o WhatsApp para agilizar o atendimento.');
    resetForm();
    setShowQuoteModal(false);
    setSubmitting(false);
  };

  const renderQuoteFields = () => (
    <>
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-name">
          Nome completo *
        </label>
        <input
          id="quote-name"
          type="text"
          required
          value={formData.nome}
          onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
          placeholder="Seu nome"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-phone">
          Telefone (WhatsApp) *
        </label>
        <input
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
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
          placeholder="(21) 99999-9999"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-city">
          Cidade *
        </label>
        <input
          id="quote-city"
          type="text"
          required
          value={formData.cidade}
          onChange={(event) => setFormData((current) => ({ ...current, cidade: event.target.value }))}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
          placeholder="Sua cidade"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-contract-type">
          Tipo de contratacao *
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
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
        >
          <option value="PF">Pessoa Fisica</option>
          <option value="MEI">MEI</option>
          <option value="CNPJ">CNPJ</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-lives">
          Quantas vidas sao no contrato? *
        </label>
        <input
          id="quote-lives"
          type="number"
          min="1"
          required
          value={formData.numeroVidas}
          onChange={(event) => setFormData((current) => ({ ...current, numeroVidas: event.target.value }))}
          className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
          placeholder="Ex: 1, 2, 3"
        />
      </div>

      {totalLives > 1 ? (
        <div className="md:col-span-2">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="block text-sm font-semibold text-slate-700">Idade das vidas *</label>
            <span className={`text-xs font-semibold ${ageRangeTotal === totalLives ? 'text-green-700' : 'text-slate-500'}`}>
              Distribuidas: {ageRangeTotal} de {totalLives}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {AGE_RANGES.map((range) => (
              <div key={range} className="rounded-xl border-2 border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-700">{range}</p>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  pattern="\d*"
                  value={ageRangeCounts[range]}
                  onChange={(event) => updateAgeRangeCount(range, event.target.value)}
                  className="mt-2 w-full rounded-lg border-2 border-slate-200 px-3 py-2 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Qtd."
                />
              </div>
            ))}
          </div>
        </div>
      ) : totalLives === 1 ? (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="quote-age">
            Idade da pessoa *
          </label>
          <input
            id="quote-age"
            type="number"
            min="0"
            required
            value={formData.idadeTitular}
            onChange={(event) => setFormData((current) => ({ ...current, idadeTitular: event.target.value }))}
            className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500 focus:outline-none"
            placeholder="Informe a idade"
          />
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <PublicSeo
        title="Kifer Saude | Planos de saude no RJ"
        description="Volta ao visual classico da Kifer com atendimento humano, cotacao personalizada e suporte consultivo para planos de saude no Rio de Janeiro."
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
          width: clamp(10rem, 18vw, 18rem);
        }

        @media (max-width: 768px) {
          .partner-logos-track {
            animation-duration: 18s;
          }

          .partner-logos-card {
            width: clamp(8.5rem, 42vw, 12rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .partner-logos-track {
            animation: none;
          }
        }
      `}</style>

      <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
        <nav
          className={`fixed top-0 z-40 w-full transition-all duration-300 ${
            isScrolled ? 'bg-white/95 shadow-sm backdrop-blur-sm' : 'bg-transparent'
          }`}
        >
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <a href="#topo" className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">Kifer Saude</span>
            </a>

            <div className="hidden flex-1 items-center justify-center space-x-6 md:flex">
              <a href="#quem-somos" className="font-medium text-slate-800 transition-colors hover:text-orange-600">
                Quem Somos
              </a>
              <a href="#como-funciona" className="font-medium text-slate-800 transition-colors hover:text-orange-600">
                Como Funciona
              </a>
              <a href="#planos" className="font-medium text-slate-800 transition-colors hover:text-orange-600">
                Planos
              </a>
              <a href="#faq" className="font-medium text-slate-800 transition-colors hover:text-orange-600">
                FAQ
              </a>
              <a href="#contato" className="font-medium text-slate-800 transition-colors hover:text-orange-600">
                Contato
              </a>
            </div>

            <button
              type="button"
              onClick={() => setShowQuoteModal(true)}
              className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:scale-105 hover:from-orange-600 hover:to-orange-700 sm:px-6"
            >
              Cotacao Gratis
            </button>
          </div>
        </nav>

        <section
          id="topo"
          className="relative flex min-h-[85vh] items-center overflow-hidden bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 px-4 pb-20 pt-24 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-orange-400 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-amber-400 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className="order-2 text-left lg:order-1">
                <div className="mb-6">
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg">
                    <Star className="mr-2 h-4 w-4 fill-current" />
                    Especialista em planos de saude no RJ
                  </span>
                </div>

                <h1 className="mb-6 text-4xl font-extrabold leading-tight text-slate-900 md:text-5xl lg:text-6xl">
                  O plano ideal comeca com{' '}
                  <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">gente de verdade.</span>
                </h1>

                <p className="mb-5 text-lg font-light leading-relaxed text-slate-700 md:text-xl">
                  Atendimento humano e especializado em planos de saude para todo o estado do Rio de Janeiro.
                  <span className="mt-2 block font-semibold text-orange-700">Mais de 500 clientes satisfeitos.</span>
                </p>

                <div className="mb-6 flex flex-wrap gap-2">
                  <div className="inline-flex items-center rounded-full border border-slate-300/50 bg-slate-800/10 px-4 py-2 backdrop-blur-sm">
                    <Shield className="mr-1.5 h-4 w-4 text-orange-600" />
                    <span className="text-sm font-semibold text-slate-900">100% Gratuito</span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-slate-300/50 bg-slate-800/10 px-4 py-2 backdrop-blur-sm">
                    <CheckCircle className="mr-1.5 h-4 w-4 text-orange-600" />
                    <span className="text-sm font-semibold text-slate-900">Sem Compromisso</span>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-slate-300/50 bg-slate-800/10 px-4 py-2 backdrop-blur-sm">
                    <ThumbsUp className="mr-1.5 h-4 w-4 text-orange-600" />
                    <span className="text-sm font-semibold text-slate-900">98% Satisfacao</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowQuoteModal(true)}
                    className="whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-bold text-white shadow-2xl transition-all hover:scale-105 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-300 md:text-lg"
                  >
                    Quero minha cotacao gratuita
                  </button>

                  <button
                    type="button"
                    onClick={() => openWhatsApp()}
                    className="whitespace-nowrap rounded-xl bg-green-600 px-8 py-4 text-base font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-green-700 md:text-lg"
                  >
                    <MessageCircle className="mr-2 inline-block h-5 w-5" />
                    Falar no WhatsApp
                  </button>
                </div>
              </div>

              <div className="order-1 flex justify-center lg:order-2">
                <div className="relative pb-8 pt-20">
                  <div className="absolute -left-2 top-20 z-10 rounded-2xl bg-white px-5 py-3 shadow-xl">
                    <div className="mb-0 text-2xl font-bold text-orange-600">500+</div>
                    <div className="text-xs font-medium text-slate-600">Clientes</div>
                  </div>

                  <div className="absolute -right-2 bottom-32 z-10 rounded-2xl bg-white px-5 py-3 shadow-xl">
                    <div className="mb-0 text-2xl font-bold text-orange-600">4.9★</div>
                    <div className="text-xs font-medium text-slate-600">Avaliacao</div>
                  </div>

                  <div className="relative h-[480px] w-[320px] md:h-[540px] md:w-[360px]">
                    <div className="absolute right-0 top-0 z-20 flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 shadow-xl">
                      <div className="h-2 w-2 rounded-full bg-white" />
                      <span className="text-xs font-bold whitespace-nowrap text-white">Online Agora</span>
                    </div>
                    <div className="absolute inset-0 overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-orange-200 to-amber-200 shadow-2xl">
                      <img
                        src="/image.png"
                        alt="Luiza Kifer - Especialista em planos de saude"
                        className="h-full w-full object-cover object-[center_35%] scale-105"
                      />
                    </div>
                  </div>

                  <div className="absolute -bottom-6 left-1/2 z-10 min-w-[280px] -translate-x-1/2 rounded-2xl bg-white px-8 py-4 text-center shadow-xl">
                    <h3 className="mb-1 text-xl font-bold text-slate-900">Luiza Kifer</h3>
                    <p className="font-semibold whitespace-nowrap text-orange-600">Sua especialista em saude</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="quem-somos" className="scroll-mt-32 bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div className="relative">
                <div className="h-[500px] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-2xl">
                  <img
                    src="/freepik__portrait-of-a-natural-redhaired-woman-about-158-me__96601.png"
                    alt="Luiza Kifer - Especialista em planos de saude"
                    className="h-full w-full object-cover object-[center_20%]"
                  />
                </div>
              </div>

              <div>
                <h2 className="mb-6 text-4xl font-bold text-slate-900 md:text-5xl">Quem Somos</h2>
                <div className="mb-6 rounded-r-xl border-l-4 border-orange-500 bg-orange-50 p-6">
                  <p className="mb-4 text-lg italic text-slate-700">
                    "Sou a Luiza Kifer, especialista em planos de saude. Acredito que contratar um plano nao e so uma escolha financeira - e uma decisao sobre cuidado, seguranca e tranquilidade."
                  </p>
                  <p className="text-sm font-semibold text-slate-600">- Luiza Kifer, Fundadora</p>
                </div>
                <p className="mb-6 text-lg text-slate-700">
                  A Kifer Saude nasceu para simplificar o acesso aos melhores planos, com atendimento humano e solucoes que cabem no seu bolso.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStoryModal(true)}
                  className="inline-flex items-center font-semibold text-orange-600 transition-colors hover:text-orange-700"
                >
                  Conheca nossa historia completa
                  <ChevronRight className="ml-1 h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-32 bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Como Funciona</h2>
              <p className="text-xl text-slate-600">Simples, rapido e sem burocracia</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Conte sobre voce',
                  text: 'Informe idade, cidade e quem deseja incluir no plano.',
                  icon: MessageCircle,
                },
                {
                  step: '2',
                  title: 'Receba as opcoes',
                  text: 'Comparativos claros com valores e coberturas personalizadas.',
                  icon: Search,
                },
                {
                  step: '3',
                  title: 'Escolha e ative',
                  text: 'Sem burocracia, com acompanhamento ate a carteirinha.',
                  icon: CheckCircle,
                },
              ].map((item) => (
                <article key={item.step} className="relative rounded-2xl bg-white p-8 shadow-lg transition-shadow hover:shadow-xl">
                  <div className="absolute -left-4 -top-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xl font-bold text-white shadow-lg">
                    {item.step}
                  </div>
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100">
                    <item.icon className="h-8 w-8 text-orange-600" />
                  </div>
                  <h3 className="mb-4 text-center text-2xl font-bold text-slate-900">{item.title}</h3>
                  <p className="text-center text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="scroll-mt-32 bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Operadoras Parceiras</h2>
              <p className="text-xl text-slate-600">Trabalhamos com as principais operadoras do mercado</p>
            </div>

            <div className="partner-logos-marquee py-4">
              <div className="partner-logos-track gap-6 sm:gap-8">
                {loopedPartnerLogos.map((logo, index) => (
                  <div
                    key={`${logo.alt}-${index}`}
                    className="partner-logos-card flex h-32 items-center justify-center rounded-2xl bg-white p-6 shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                    aria-hidden={index >= partnerLogos.length}
                  >
                    <img src={logo.src} alt={logo.alt} className="max-h-20 max-w-full object-contain" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 text-center">
              <div className="inline-flex items-center justify-center rounded-2xl border-2 border-orange-200 bg-orange-50 px-6 py-4">
                <CheckCircle className="mr-3 h-6 w-6 flex-shrink-0 text-orange-600" />
                <p className="text-lg text-slate-700">
                  <span className="font-semibold text-slate-900">E muitas outras operadoras.</span> Trabalhamos com varias opcoes para encontrar o plano ideal para voce.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Depoimentos Reais</h2>
              <p className="text-xl text-slate-600">O que nossos clientes dizem sobre nos</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <article key={testimonial.name} className="rounded-2xl bg-slate-50 p-8 shadow-lg transition-shadow hover:shadow-xl">
                  <div className="mb-4 flex items-center">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={`${testimonial.name}-${index}`} className="h-5 w-5 fill-current text-yellow-400" />
                    ))}
                  </div>
                  <p className="mb-6 italic text-slate-700">"{testimonial.quote}"</p>
                  <div className="flex items-center">
                    <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-200">
                      <span className="font-bold text-orange-700">{testimonial.initial}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-600">{testimonial.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowReviewsModal(true)}
                className="inline-flex items-center font-semibold text-orange-600 transition-colors hover:text-orange-700"
              >
                Mais avaliacoes no Google
                <ChevronRight className="ml-1 h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-orange-500 to-amber-600 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="rounded-3xl bg-white p-12 shadow-2xl">
              <TrendingUp className="mx-auto mb-6 h-16 w-16 text-orange-600" />
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Planos para Empresas e MEI</h2>
              <p className="mb-8 text-xl text-slate-700">Tem CNPJ ou MEI? Voce pode economizar ate 40% no plano de saude.</p>
              <button
                type="button"
                onClick={scrollToForm}
                className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-orange-700"
              >
                Ver planos empresariais
              </button>
              <p className="mt-6 text-sm font-semibold text-slate-600">Mais vendidos para MEI</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Por Que Escolher a Kifer Saude</h2>
              <p className="text-xl text-slate-600">O que nos torna diferentes</p>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {valueCards.map((card) => (
                <article key={card.title} className="rounded-xl bg-white p-6 shadow-lg transition-shadow hover:shadow-xl">
                  <card.icon className="mb-4 h-12 w-12 text-orange-600" />
                  <h3 className="mb-2 text-xl font-bold text-slate-900">{card.title}</h3>
                  <p className="text-slate-600">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-32 bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-4xl font-bold text-slate-900 md:text-5xl">Perguntas Frequentes</h2>
              <p className="text-xl text-slate-600">Tire suas duvidas sobre planos de saude</p>
            </div>

            <div className="mx-auto max-w-4xl space-y-4">
              {faqItems.map((faq, index) => (
                <div key={faq.question} className="overflow-hidden rounded-2xl bg-slate-50 shadow-sm transition-shadow hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                    className="flex w-full items-center justify-between px-8 py-6 text-left transition-colors hover:bg-slate-100"
                    aria-expanded={openFaqIndex === index}
                  >
                    <span className="pr-8 text-lg font-semibold text-slate-900">{faq.question}</span>
                    <ChevronDown
                      className={`h-6 w-6 flex-shrink-0 text-orange-600 transition-transform ${openFaqIndex === index ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {openFaqIndex === index ? (
                    <div className="px-8 pb-6">
                      <p className="leading-relaxed text-slate-700">{faq.answer}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="mb-4 text-slate-600">Nao encontrou sua resposta?</p>
              <button
                type="button"
                onClick={() => setShowQuoteModal(true)}
                className="rounded-xl bg-orange-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
              >
                Fale com um especialista
              </button>
            </div>
          </div>
        </section>

        <section id="cotacao" className="scroll-mt-32 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">Faca sua Cotacao Personalizada</h2>
              <p className="text-xl text-orange-50">Prometemos zero spam. Seu contato e usado apenas para montar as melhores opcoes.</p>
            </div>

            <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-8 shadow-2xl md:p-12">
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:from-orange-600 hover:to-orange-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Enviando cotacao...' : 'Quero minha cotacao personalizada agora'}
                <ChevronRight className="ml-2 inline-block h-5 w-5" />
              </button>

              <p className="mt-4 text-center text-sm text-slate-500">Resposta em ate 10 minutos</p>
            </form>
          </div>
        </section>

        <section id="contato" className="scroll-mt-32 bg-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="mb-4 text-4xl font-bold text-white md:text-5xl">Entre em Contato</h2>
              <p className="text-xl text-slate-300">Estamos prontos para te ajudar a encontrar o plano ideal</p>
            </div>

            <div className="mb-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              <a href={`tel:+${WHATSAPP_PHONE}`} className="group rounded-2xl bg-slate-800 p-8 transition-all hover:bg-slate-700">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 transition-transform group-hover:scale-110">
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-center text-xl font-bold text-white">Telefone</h3>
                <p className="text-center text-slate-300">(21) 97930-2389</p>
              </a>

              <a href={`mailto:${EMAIL}`} className="group rounded-2xl bg-slate-800 p-8 transition-all hover:bg-slate-700">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 transition-transform group-hover:scale-110">
                  <Mail className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-center text-xl font-bold text-white">E-mail</h3>
                <p className="text-center text-slate-300">{EMAIL}</p>
              </a>

              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="group rounded-2xl bg-slate-800 p-8 transition-all hover:bg-slate-700">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 transition-transform group-hover:scale-110">
                  <MessageCircle className="h-8 w-8 text-white" />
                </div>
                <h3 className="mb-2 text-center text-xl font-bold text-white">WhatsApp</h3>
                <p className="text-center text-slate-300">Atendimento rapido</p>
              </a>
            </div>
          </div>
        </section>

        <footer className="bg-slate-900 px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
              <div>
                <div className="mb-4 flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
                    <Heart className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-2xl font-bold">Kifer Saude</span>
                </div>
                <p className="leading-relaxed text-slate-400">Corretora especializada em planos de saude para todo o estado do Rio de Janeiro.</p>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-bold">Links Uteis</h3>
                <ul className="space-y-3 text-slate-400">
                  <li>
                    <a href="#quem-somos" className="transition-colors hover:text-orange-400">
                      Sobre Nos
                    </a>
                  </li>
                  <li>
                    <a href="#cotacao" className="transition-colors hover:text-orange-400">
                      Cotacao
                    </a>
                  </li>
                  <li>
                    <a href="#faq" className="transition-colors hover:text-orange-400">
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a href="#contato" className="transition-colors hover:text-orange-400">
                      Contato
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-bold">Contato</h3>
                <div className="space-y-3 text-slate-400">
                  <div className="flex items-start">
                    <MapPin className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                    <span>Rio de Janeiro, RJ</span>
                  </div>
                  <a href={`mailto:${EMAIL}`} className="flex items-start transition-colors hover:text-orange-400">
                    <Mail className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                    <span>{EMAIL}</span>
                  </a>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="flex items-start transition-colors hover:text-orange-400">
                    <Instagram className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-500" />
                    <span>@souluizakifer</span>
                  </a>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-bold">Legal</h3>
                <div className="space-y-2 text-slate-400">
                  <p className="text-sm">CNPJ: {CNPJ}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
              <p>Kifer Saude. Todos os direitos reservados.</p>
            </div>
          </div>
        </footer>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-2xl transition-transform hover:-translate-y-0.5 hover:bg-green-700"
          aria-label="Abrir conversa no WhatsApp"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>

        {showQuoteModal ? (
          <OverlayModal title="Faca sua Cotacao" subtitle="Preencha os dados abaixo e receba sua cotacao personalizada via WhatsApp" onClose={() => setShowQuoteModal(false)}>
            <form onSubmit={handleSubmit}>
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">{renderQuoteFields()}</div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Enviando cotacao...' : 'Enviar cotacao via WhatsApp'}
                <MessageCircle className="ml-2 inline-block h-5 w-5" />
              </button>

              <p className="mt-4 text-center text-sm text-slate-500">Resposta em ate 10 minutos</p>
            </form>
          </OverlayModal>
        ) : null}

        {showStoryModal ? (
          <OverlayModal title="Nossa Historia" maxWidthClass="max-w-4xl" onClose={() => setShowStoryModal(false)}>
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Como Tudo Comecou</h3>
                <p className="mb-4 leading-relaxed text-slate-700">
                  A Kifer Saude nasceu da visao de tornar o acesso a planos de saude mais simples, transparente e humano. Percebemos que muitas pessoas se sentiam perdidas em meio a tantas opcoes, termos tecnicos e processos burocraticos no mercado de saude suplementar.
                </p>
                <p className="leading-relaxed text-slate-700">
                  Por isso, criamos uma consultoria que nao vende apenas planos: orienta, compara, explica riscos e acompanha cada etapa da jornada do cliente com proximidade real.
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Nossa Missao</h3>
                <p className="leading-relaxed text-slate-700">
                  Contratar um plano de saude nao deve ser complicado. Nossa missao e traduzir o contrato para a linguagem do dia a dia, comparar as melhores opcoes do mercado e encontrar o plano que realmente faz sentido para cada pessoa, familia ou empresa.
                </p>
              </div>

              <div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Por Que Somos Diferentes</h3>
                <div className="rounded-r-xl border-l-4 border-orange-500 bg-orange-50 p-6">
                  <ul className="space-y-3 text-slate-700">
                    {[
                      'Atendimento humanizado para entender contexto, urgencia e rotina.',
                      'Transparencia total sobre rede, carencias e custo real.',
                      'Acompanhamento continuo, inclusive depois da contratacao.',
                      'Especializacao regional com leitura pratica do mercado no RJ.',
                    ].map((item) => (
                      <li key={item} className="flex items-start">
                        <CheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-2xl font-bold text-slate-900">Nossos Valores</h3>
                <p className="leading-relaxed text-slate-700">
                  Construimos nossa empresa sobre tres pilares: confianca, transparencia e compromisso. Cada cliente que atendemos representa uma relacao de longo prazo baseada em respeito, clareza e cuidado genuino.
                </p>
              </div>

              <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 p-8 text-white">
                <h3 className="mb-4 text-2xl font-bold">Mais de 500 clientes satisfeitos</h3>
                <p className="mb-4 leading-relaxed text-white/90">
                  Ja ajudamos centenas de familias a encontrarem o plano certo. Nossa taxa de satisfacao reflete o compromisso que temos com cada pessoa que confia no nosso trabalho.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowStoryModal(false);
                    setShowQuoteModal(true);
                  }}
                  className="rounded-xl bg-white px-6 py-3 font-bold text-orange-600 transition-all hover:bg-orange-50"
                >
                  Faca parte dessa historia
                </button>
              </div>
            </div>
          </OverlayModal>
        ) : null}

        {showReviewsModal ? (
          <OverlayModal
            title="Avaliacoes de Clientes"
            subtitle="Nota media: 4.9 estrelas"
            maxWidthClass="max-w-5xl"
            onClose={() => setShowReviewsModal(false)}
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {reviewItems.map((review) => (
                <article key={`${review.name}-${review.date}`} className="rounded-2xl bg-slate-50 p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex items-center">
                      <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-200">
                        <span className="text-lg font-bold text-orange-700">{review.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{review.name}</p>
                        <p className="text-sm text-slate-600">{review.age} anos</p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-500">{review.date}</span>
                  </div>
                  <div className="mb-3 flex items-center">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={`${review.name}-${index}`} className={`h-5 w-5 ${index < review.rating ? 'fill-current text-yellow-400' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <p className="leading-relaxed text-slate-700">{review.review}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border-2 border-orange-200 bg-orange-50 p-6 text-center">
              <p className="mb-4 text-slate-700">Quer ver mais avaliacoes ou deixar a sua opiniao?</p>
              <a
                href="https://www.google.com/search?q=kifer+saude"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
              >
                Ver no Google
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </div>
          </OverlayModal>
        ) : null}
      </div>
    </>
  );
}
