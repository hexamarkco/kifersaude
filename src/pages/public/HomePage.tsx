import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  Handshake,
  Instagram,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';
import PublicSeo, { type PublicFaqItem } from '../../components/public/PublicSeo';
import { formatPhoneInput } from '../../lib/inputFormatters';
import { supabase, type ConfigOption, type LeadOrigem, type LeadStatusConfig } from '../../lib/supabase';
import { toast } from '../../lib/toast';

type ProfileSlug = 'pf' | 'pme' | 'adesao';

type ContractTypeRow = ConfigOption & {
  nome?: string | null;
};

type FooterFormValues = {
  nome: string;
  whatsapp: string;
  email: string;
  perfil: ProfileSlug;
};

type LogoItem =
  | {
      kind: 'image';
      src: string;
      alt: string;
      height: string;
    }
  | {
      kind: 'text';
      label: string;
    };

const WHATSAPP_PHONE = '5521979302389';
const WHATSAPP_DEFAULT_MESSAGE = 'Olá! Quero falar com a Kifer sobre um plano de saúde.';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
const CNPJ = '46.423.078/0001-10';
const EMAIL = 'contato@kifersaude.com.br';
const INSTAGRAM_URL = 'https://instagram.com/souluizakifer';
const FALLBACK_DASHBOARD_LEAD_COUNT = 3200;
const pageShellClass = 'mx-auto w-full max-w-[74rem]';

const navItems = [
  { label: 'Início', href: '#inicio' },
  { label: 'Planos', href: '#modalidades' },
  { label: 'Sobre', href: '#quem-somos' },
  { label: 'Contato', href: '#contato' },
];

const modalityCards: Array<{
  profile: ProfileSlug;
  title: string;
  text: string;
  highlight: string;
  Icon: typeof Users;
}> = [
  {
    profile: 'pf',
    title: 'Plano Individual / Familiar',
    text: 'Para quem quer segurança para a rotina da família sem decidir no impulso.',
    highlight: 'Comparativo claro de rede, carências e custo real.',
    Icon: Users,
  },
  {
    profile: 'pme',
    title: 'Plano PME',
    text: 'Para empresas, MEI e CNPJ que precisam equilibrar benefício e caixa.',
    highlight: 'Solução mais estratégica para sócios, equipe e crescimento.',
    Icon: Briefcase,
  },
  {
    profile: 'adesao',
    title: 'Plano por Adesão',
    text: 'Para perfis elegíveis que buscam boa cobertura com orientação técnica.',
    highlight: 'Checagem de elegibilidade e apoio completo na contratação.',
    Icon: Building2,
  },
];

const operatorLogos: LogoItem[] = [
  { kind: 'image', src: '/amil-logo-1-2.png', alt: 'Amil', height: 'h-7' },
  { kind: 'image', src: '/bradesco-saude-logo-1-1.png', alt: 'Bradesco Saúde', height: 'h-9' },
  { kind: 'image', src: '/sulamerica-saude-logo.png', alt: 'SulAmérica Saúde', height: 'h-8' },
  { kind: 'text', label: 'Unimed' },
  { kind: 'image', src: '/porto-logo.png', alt: 'Porto Saúde', height: 'h-6' },
  { kind: 'image', src: '/assim-saude-logo.png', alt: 'Assim Saúde', height: 'h-6' },
];

const differentials: Array<{
  title: string;
  text: string;
  Icon: typeof ShieldCheck;
}> = [
  {
    title: 'Consultoria personalizada',
    text: 'Cada indicação parte da sua rotina, do seu orçamento e do tipo de cobertura que realmente faz sentido.',
    Icon: Handshake,
  },
  {
    title: 'Transparência nos contratos',
    text: 'A gente explica carências, coparticipação, regras de entrada e pontos de atenção antes da assinatura.',
    Icon: FileText,
  },
  {
    title: 'Pós-venda humanizado',
    text: 'O suporte continua depois da venda, com ajuda em proposta, pendências e primeiros passos do plano.',
    Icon: BadgeCheck,
  },
  {
    title: 'Atendimento ágil no WhatsApp',
    text: 'Quem chega com urgência precisa de resposta rápida. O canal principal já abre direto na conversa com a equipe.',
    Icon: MessageCircle,
  },
];

const testimonialPlaceholders = [
  {
    name: 'Nome do cliente',
    detail: 'Plano Individual / Familiar',
    text: 'Insira aqui um depoimento real destacando atendimento, clareza na explicação e segurança na escolha.',
  },
  {
    name: 'Nome do cliente',
    detail: 'Plano PME',
    text: 'Use este espaço para uma avaliação real falando sobre agilidade no suporte e organização do processo.',
  },
  {
    name: 'Nome do cliente',
    detail: 'Plano por Adesão',
    text: 'Adicione aqui um depoimento real mencionando economia, confiança e qualidade do acompanhamento.',
  },
  {
    name: 'Nome do cliente',
    detail: 'Atendimento Kifer',
    text: 'Estrutura pronta para você inserir uma prova social forte, com linguagem humana e convincente.',
  },
];

const faqItems: PublicFaqItem[] = [
  {
    question: 'O que é carência no plano de saúde?',
    answer:
      'Carência é o prazo contado a partir da contratação para começar a usar determinados procedimentos. Esse prazo muda conforme o tipo de cobertura e a regra do produto.',
  },
  {
    question: 'Quem pode entrar como dependente?',
    answer:
      'Isso depende da modalidade do plano e das regras da operadora. Em geral, entram cônjuge, filhos e, em alguns casos, outros vínculos permitidos pelo contrato.',
  },
  {
    question: 'Plano PME precisa mesmo ter CNPJ?',
    answer:
      'Sim. Para contratar plano PME é necessário cumprir a regra de elegibilidade da modalidade empresarial, o que normalmente envolve CNPJ ativo e composição mínima do grupo.',
  },
  {
    question: 'Vocês ajudam também depois da contratação?',
    answer:
      'Sim. O pós-venda faz parte da nossa entrega, com apoio em proposta, pendências, ativação e orientações dos primeiros passos.',
  },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;

const findOriginId = (origins: LeadOrigem[]) => {
  const priorities = ['site', 'home', 'footer', 'lp', 'landing'];
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
    pf: ['pf', 'pessoa fisica', 'pessoa física', 'individual', 'familiar'],
    pme: ['pme', 'mei', 'empresa', 'empresarial', 'cnpj', 'pj'],
    adesao: ['adesao', 'adesão', 'coletivo por adesao', 'coletivo por adesão', 'entidade'],
  };

  const targets = aliases[profile];
  const match = rows.find((row) => {
    const candidate = normalizeText(`${row.label} ${row.value} ${row.nome ?? ''}`);
    return targets.some((target) => candidate.includes(target));
  });

  return match?.id ?? null;
};

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [dashboardLeadCount, setDashboardLeadCount] = useState<number | null>(null);
  const [origins, setOrigins] = useState<LeadOrigem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusConfig[]>([]);
  const [contractTypeRows, setContractTypeRows] = useState<ContractTypeRow[]>([]);
  const [footerForm, setFooterForm] = useState<FooterFormValues>({
    nome: '',
    whatsapp: '',
    email: '',
    perfil: 'pf',
  });
  const [submittingFooterForm, setSubmittingFooterForm] = useState(false);

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

      try {
        const activeStatusNames = (statusesResponse.data ?? [])
          .map((status) => String(status.nome ?? '').trim())
          .filter(Boolean);

        let countQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).eq('arquivado', false);

        if (activeStatusNames.length > 0) {
          countQuery = countQuery.in('status', activeStatusNames);
        }

        const { count, error } = await countQuery;

        if (error) {
          throw error;
        }

        if (active) {
          setDashboardLeadCount(count ?? 0);
        }
      } catch (error) {
        console.error('Erro ao carregar total real de leads na home pública:', error);
      }
    };

    void loadPublicData();

    return () => {
      active = false;
    };
  }, []);

  const formattedDashboardLeadCount = useMemo(() => {
    const count = dashboardLeadCount ?? FALLBACK_DASHBOARD_LEAD_COUNT;
    return `+${new Intl.NumberFormat('pt-BR').format(count)}`;
  }, [dashboardLeadCount]);

  const heroTrustItems = useMemo(
    () => [
      { label: 'Base ativa', value: formattedDashboardLeadCount },
      { label: 'Consultoria', value: 'Sem custo' },
      { label: 'Canal principal', value: 'WhatsApp' },
    ],
    [formattedDashboardLeadCount],
  );

  const handleFooterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingFooterForm) {
      return;
    }

    const cleanName = footerForm.nome.trim();
    const cleanPhone = footerForm.whatsapp.replace(/\D/g, '');

    if (cleanName.length < 3 || cleanPhone.length < 10) {
      toast.warning('Preencha nome e WhatsApp corretamente para enviar seus dados.');
      return;
    }

    setSubmittingFooterForm(true);

    const selectedProfile = modalityCards.find((item) => item.profile === footerForm.perfil);
    const payload = {
      nome_completo: cleanName,
      telefone: cleanPhone,
      email: footerForm.email.trim() || null,
      origem_id: findOriginId(origins),
      status_id: findStatusId(statuses),
      tipo_contratacao_id: resolveContractTypeId(contractTypeRows, footerForm.perfil),
      observacoes: `Lead home | Perfil: ${selectedProfile?.title ?? footerForm.perfil} | Formulário de contato do rodapé`,
      data_criacao: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      arquivado: false,
    };

    const { error } = await supabase.from('leads').insert([payload]);

    if (error) {
      toast.error('Não foi possível enviar agora. Tente novamente ou chame no WhatsApp.');
      setSubmittingFooterForm(false);
      return;
    }

    toast.success('Recebemos seus dados. Nossa equipe deve retornar em breve.');
    setFooterForm({ nome: '', whatsapp: '', email: '', perfil: 'pf' });
    setSubmittingFooterForm(false);
  };

  const secondaryWhatsAppUrl = buildWhatsAppUrl('Olá! Quero entender qual plano de saúde faz mais sentido para mim.');

  return (
    <div className="home-conv-theme min-h-screen overflow-x-hidden">
      <PublicSeo
        title="Kifer Saúde | Consultoria para planos de saúde no RJ"
        description="Planos de saúde com consultoria personalizada, atendimento humanizado e foco total em te levar direto para o WhatsApp da Kifer Saúde."
        canonicalPath="/"
        faqItems={faqItems}
      />

      <a href="#conteudo" className="home-conv-skip-link">
        Pular para o conteúdo
      </a>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--home-conv-line)] bg-[rgba(250,247,242,0.92)] backdrop-blur-xl">
        <div className={`${pageShellClass} flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8`}>
          <Link to="/" className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--home-conv-line-strong)] bg-white text-[color:var(--home-conv-accent)] shadow-[0_14px_24px_-18px_rgba(26,22,18,0.22)]">
              <Stethoscope className="h-5 w-5" />
            </span>
            <span>
              <span className="home-conv-heading block text-[1.55rem] font-bold leading-none text-stone-950">Kifer Saúde</span>
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--home-conv-muted)]">
                consultoria em saúde suplementar
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[color:var(--home-conv-muted)] lg:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="home-conv-nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="home-conv-header-cta">
            Falar no WhatsApp
          </a>
        </div>
      </header>

      <main id="conteudo" className="pb-24 pt-20 md:pt-[5.5rem]">
        <section id="inicio" className="scroll-mt-28 pb-10">
          <div className="home-conv-hero-card home-conv-hero-band px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className={`${pageShellClass} flex w-full`}>
              <div className="max-w-4xl">
                <span className="home-conv-kicker">atendimento consultivo com foco em decisão rápida</span>
                <h1 className="home-conv-heading mt-5 max-w-3xl text-4xl font-bold leading-[0.94] text-white sm:text-5xl lg:text-[4.5rem]">
                  Seu próximo passo precisa ser clicar no WhatsApp e resolver isso com segurança.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
                  A Kifer atende quem chega com dor, urgência ou dúvida. A gente entende seu perfil, filtra as melhores opções e
                  conduz a contratação com clareza, agilidade e credibilidade.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-conv-whatsapp-cta inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-semibold"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Falar agora no WhatsApp
                  </a>
                  <a href="#contato" className="home-conv-secondary-cta inline-flex items-center justify-center rounded-full px-6 py-4 text-sm font-semibold">
                    Prefiro deixar meus dados
                  </a>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {heroTrustItems.map((item) => (
                    <div key={item.label} className="home-conv-trust-pill rounded-full px-4 py-3">
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-stone-400">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="modalidades" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-section-head max-w-[44rem]">
              <span className="home-conv-kicker">modalidades</span>
              <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-5xl">
                O cliente precisa se encontrar rápido no site.
              </h2>
              <p className="mt-4 text-base leading-8 text-[color:var(--home-conv-muted)]">
                Por isso, a navegação começa deixando claro para quem cada caminho faz mais sentido.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {modalityCards.map((card) => (
                <article key={card.profile} className="home-conv-surface-card rounded-[2rem] p-6 md:p-7">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(197,107,37,0.12)] text-[color:var(--home-conv-accent)]">
                    <card.Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-2xl font-bold text-stone-950">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--home-conv-muted)]">{card.text}</p>
                  <p className="mt-5 border-t border-[color:var(--home-conv-line)] pt-4 text-sm font-semibold text-stone-900">{card.highlight}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-surface-card overflow-hidden rounded-[2rem] px-6 py-8 md:px-8">
              <div className="max-w-[40rem]">
                <span className="home-conv-kicker">operadoras e seguradoras</span>
                <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-4xl">
                  Autoridade aparece rápido quando o cliente reconhece com quem você trabalha.
                </h2>
              </div>

              <div className="home-conv-marquee mt-8">
                <div className="home-conv-marquee-track">
                  {[...operatorLogos, ...operatorLogos].map((item, index) => (
                    <div key={`${item.kind === 'image' ? item.alt : item.label}-${index}`} className="home-conv-logo-card">
                      {item.kind === 'image' ? (
                        <img src={item.src} alt={item.alt} className={`${item.height} w-auto max-w-[8rem] object-contain`} loading="lazy" />
                      ) : (
                        <span className="text-lg font-bold text-stone-700">{item.label}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-section-head max-w-[44rem]">
              <span className="home-conv-kicker">nossos diferenciais</span>
              <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-5xl">
                Antes de comparar preço, o cliente precisa confiar em quem está orientando.
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {differentials.map((item) => (
                <article key={item.title} className="home-conv-surface-card rounded-[2rem] p-6 md:p-7">
                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[rgba(197,107,37,0.12)] text-[color:var(--home-conv-accent)]">
                      <item.Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-stone-950">{item.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-[color:var(--home-conv-muted)]">{item.text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="quem-somos" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-surface-card rounded-[2.2rem] p-6 md:p-8 lg:p-10">
              <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:items-center">
                <div className="home-conv-photo-placeholder flex min-h-[26rem] items-center justify-center rounded-[2rem] border border-dashed border-[color:var(--home-conv-line-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(245,235,222,0.95))] p-6">
                  <div className="text-center">
                    <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(197,107,37,0.12)] text-[color:var(--home-conv-accent)]">
                      <UserRound className="h-8 w-8" />
                    </span>
                    <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--home-conv-muted)]">espaço reservado para foto da Luiza</p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--home-conv-muted)]">Troque este bloco pela foto oficial para humanizar ainda mais a página.</p>
                  </div>
                </div>

                <div className="max-w-[40rem]">
                  <span className="home-conv-kicker">quem somos</span>
                  <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-5xl">
                    Cuidamos da saúde dos clientes como se fosse da nossa família.
                  </h2>
                  <p className="mt-5 text-base leading-8 text-[color:var(--home-conv-muted)]">
                    A Kifer nasceu para simplificar uma decisão que quase sempre chega carregada de pressa, insegurança e dúvidas.
                    Nosso trabalho é ouvir, orientar com honestidade e acompanhar o cliente com atenção verdadeira do primeiro contato ao pós-venda.
                  </p>

                  <div className="mt-6 space-y-3">
                    {[
                      'Atendimento próximo, humano e consultivo.',
                      'Explicação clara antes de qualquer assinatura.',
                      'Compromisso real com confiança e continuidade.',
                    ].map((item) => (
                      <div key={item} className="flex gap-3 text-sm leading-7 text-stone-700">
                        <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-[color:var(--home-conv-accent)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <a
                    href={secondaryWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="home-conv-inline-link mt-8 inline-flex items-center gap-2 text-sm font-semibold"
                  >
                    Conversar com a equipe
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-section-head max-w-[44rem]">
              <span className="home-conv-kicker">prova social</span>
              <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-5xl">
                Estrutura pronta para depoimentos reais de quem já confiou no seu atendimento.
              </h2>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {testimonialPlaceholders.map((item, index) => (
                <article key={`${item.name}-${index}`} className="home-conv-surface-card rounded-[2rem] p-6 md:p-7">
                  <div className="flex items-center gap-1 text-[color:var(--home-conv-accent)]">
                    {Array.from({ length: 5 }).map((_, starIndex) => (
                      <Star key={starIndex} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="mt-5 text-base leading-8 text-stone-800">“{item.text}”</p>
                  <div className="mt-6 border-t border-[color:var(--home-conv-line)] pt-4">
                    <p className="font-semibold text-stone-950">{item.name}</p>
                    <p className="mt-1 text-sm text-[color:var(--home-conv-muted)]">{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8">
          <div className={pageShellClass}>
            <div className="home-conv-section-head max-w-[44rem]">
              <span className="home-conv-kicker">perguntas frequentes</span>
              <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-stone-950 sm:text-5xl">
                Dúvidas comuns merecem respostas claras sem ocupar espaço demais na página.
              </h2>
            </div>

            <div className="mt-8 space-y-3">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;

                return (
                  <article key={item.question} className="home-conv-faq-card rounded-[1.7rem] border border-[color:var(--home-conv-line)] bg-white/92">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-6"
                      aria-expanded={isOpen}
                    >
                      <span className="text-base font-semibold leading-7 text-stone-950">{item.question}</span>
                      <ChevronDown className={`h-5 w-5 flex-shrink-0 text-[color:var(--home-conv-accent)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <p className="px-5 pb-5 text-sm leading-7 text-[color:var(--home-conv-muted)] md:px-6">{item.answer}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer id="contato" className="scroll-mt-28 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className={pageShellClass}>
          <div className="home-conv-footer-card rounded-[2.3rem] p-6 md:p-8 lg:p-10">
            <div className="grid gap-10 lg:grid-cols-[0.42fr_0.58fr]">
              <div>
                <span className="home-conv-kicker text-[color:var(--home-conv-accent-soft)]">contato</span>
                <h2 className="home-conv-heading mt-4 text-3xl font-bold leading-[0.96] text-white sm:text-5xl">
                  Se preferir, deixe seus dados que a equipe retorna para você.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-8 text-stone-300">
                  O caminho principal continua sendo o WhatsApp. Mas, se fizer mais sentido, você também pode preencher o formulário e aguardar nosso retorno.
                </p>

                <div className="mt-8 space-y-4 text-sm text-stone-200">
                  <a href={`tel:+${WHATSAPP_PHONE}`} className="home-conv-contact-link flex items-center gap-3">
                    <Phone className="h-4 w-4 text-[color:var(--home-conv-accent-soft)]" />
                    (21) 97930-2389
                  </a>
                  <a href={`mailto:${EMAIL}`} className="home-conv-contact-link flex items-center gap-3">
                    <Mail className="h-4 w-4 text-[color:var(--home-conv-accent-soft)]" />
                    {EMAIL}
                  </a>
                  <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="home-conv-contact-link flex items-center gap-3">
                    <Instagram className="h-4 w-4 text-[color:var(--home-conv-accent-soft)]" />
                    @souluizakifer
                  </a>
                  <div className="flex items-start gap-3 text-stone-200">
                    <ShieldCheck className="mt-1 h-4 w-4 text-[color:var(--home-conv-accent-soft)]" />
                    <span>CNPJ: {CNPJ}</span>
                  </div>
                </div>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-conv-whatsapp-cta mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold"
                >
                  <MessageCircle className="h-5 w-5" />
                  Ir direto para o WhatsApp
                </a>
              </div>

              <form onSubmit={handleFooterSubmit} className="home-conv-form-panel rounded-[2rem] p-5 md:p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="home-conv-field-group md:col-span-2">
                    <span className="home-conv-field-label">Nome</span>
                    <input
                      type="text"
                      value={footerForm.nome}
                      onChange={(event) => setFooterForm((current) => ({ ...current, nome: event.target.value }))}
                      className="home-conv-field"
                      placeholder="Seu nome completo"
                    />
                  </label>

                  <label className="home-conv-field-group">
                    <span className="home-conv-field-label">WhatsApp</span>
                    <input
                      type="tel"
                      value={footerForm.whatsapp}
                      onChange={(event) =>
                        setFooterForm((current) => ({
                          ...current,
                          whatsapp: formatPhoneInput(event.target.value),
                        }))
                      }
                      className="home-conv-field"
                      placeholder="(21) 99999-9999"
                    />
                  </label>

                  <label className="home-conv-field-group">
                    <span className="home-conv-field-label">E-mail</span>
                    <input
                      type="email"
                      value={footerForm.email}
                      onChange={(event) => setFooterForm((current) => ({ ...current, email: event.target.value }))}
                      className="home-conv-field"
                      placeholder="voce@exemplo.com"
                    />
                  </label>

                  <label className="home-conv-field-group md:col-span-2">
                    <span className="home-conv-field-label">Modalidade de interesse</span>
                    <select
                      value={footerForm.perfil}
                      onChange={(event) =>
                        setFooterForm((current) => ({
                          ...current,
                          perfil: event.target.value as ProfileSlug,
                        }))
                      }
                      className="home-conv-field"
                    >
                      <option value="pf">Plano Individual / Familiar</option>
                      <option value="pme">Plano PME</option>
                      <option value="adesao">Plano por Adesão</option>
                    </select>
                  </label>
                </div>

                <button type="submit" disabled={submittingFooterForm} className="home-conv-form-submit mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold">
                  {submittingFooterForm ? 'Enviando...' : 'Quero receber retorno da equipe'}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <p className="mt-4 text-xs leading-6 text-stone-400">
                  Ao enviar, seus dados entram no nosso atendimento para retorno comercial. Se preferir agilidade imediata, o WhatsApp continua sendo o caminho mais rápido.
                </p>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-1 pt-5 text-xs text-[color:var(--home-conv-muted)] md:flex-row md:items-center md:justify-between">
            <p>Kifer Saúde. Todos os direitos reservados.</p>
            <div className="flex flex-wrap items-center gap-4">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="home-conv-nav-link">
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="home-conv-floating-whatsapp fixed bottom-5 right-5 z-50 inline-flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_24px_48px_-24px_rgba(21,128,61,0.65)]"
        aria-label="Abrir conversa no WhatsApp"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
