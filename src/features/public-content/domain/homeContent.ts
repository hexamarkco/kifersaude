import {
  Briefcase,
  Building2,
  FileCheck2,
  FilePenLine,
  FileSearch,
  FileText,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { siteConfig } from "../../../config/site";
import type { PublicFaqItem } from "../../../components/public/PublicSeo";

export type ContractKind = "PF" | "MEI" | "CNPJ";
export const AGE_RANGES = [
  "00 - 18",
  "19 - 23",
  "24 - 28",
  "29 - 33",
  "34 - 38",
  "39 - 43",
  "44 - 48",
  "49 - 53",
  "54 - 58",
  "59+",
] as const;
export const formatAgeRangeLabel = (range: string) =>
  range === "59+"
    ? "59 anos ou mais"
    : `${range.replace("00", "0").replace(" - ", " a ")} anos`;
export const createInitialAgeRangeCounts = () =>
  Object.fromEntries(AGE_RANGES.map((range) => [range, ""]));
export const WHATSAPP_DEFAULT_MESSAGE =
  "Olá! Quero uma cotação de plano de saúde com a Kifer.";
export const buildHomeWhatsAppUrl = (message = WHATSAPP_DEFAULT_MESSAGE) =>
  `${siteConfig.whatsappUrl}?text=${encodeURIComponent(message)}`;

export const homeNavigation = [
  { section: "prova-social", label: "Operadoras" },
  { section: "para-quem", label: "Para quem é" },
  { section: "como-funciona", label: "Como funciona" },
  { section: "depoimentos", label: "Depoimentos" },
  { section: "faq", label: "Dúvidas" },
] as const;

export const homePhotos = {
  luiza: "/luiza-kifer-hero.png",
  family: "/images/home/family.png",
  work: "/images/home/work.png",
  business: "/images/home/business.png",
} as const;

export const homePartners = [
  { src: "/amil-logo-1-2.png", alt: "Amil", href: "/planos/amil" },
  {
    src: "/bradesco-saude-logo-1-1.png",
    alt: "Bradesco Saúde",
    href: "/planos/bradesco-saude",
  },
  {
    src: "/sulamerica-saude-logo.png",
    alt: "SulAmérica Saúde",
    href: "/planos/sulamerica",
  },
  { src: "/porto-logo.png", alt: "Porto Saúde", href: "/planos/porto-saude" },
  {
    src: "/assim-saude-logo.png",
    alt: "Assim Saúde",
    href: "/planos/assim-saude",
  },
] as const;

export const homeTrust = [
  {
    title: "Compare com clareza",
    text: "Avaliamos as principais operadoras lado a lado, com informações simples e transparentes, para você enxergar as diferenças e escolher com segurança.",
    icon: FileSearch,
  },
  {
    title: "Entenda a sua rede",
    text: "Veja quais hospitais, laboratórios e especialistas fazem parte da rede credenciada de cada plano e escolha o que melhor atende à sua rotina, na sua região.",
    icon: MapPin,
  },
  {
    title: "Conte com suporte do início ao fim",
    text: "Do orçamento à contratação, nossa equipe está ao seu lado para tirar dúvidas, explicar cada detalhe e acompanhar a ativação do seu plano.",
    icon: Users,
  },
] as const;

export const homeAudiences = [
  {
    kind: "PF",
    label: "Pessoa física",
    subtitle: "Você e sua família",
    title: "Plano de saúde para",
    emphasis: "você e sua família.",
    description:
      "Compare operadoras, rede credenciada, carência e coparticipação para escolher uma cobertura compatível com a sua rotina no RJ.",
    benefits: [
      "Opções para solteiros, casais e famílias",
      "Rede analisada para os locais que você usa",
      "Cotação gratuita e sem compromisso",
      "Suporte especializado em todas as etapas",
    ],
    cta: "Quero cotar como pessoa física",
    photo: homePhotos.family,
    alt: "Imagem ilustrativa de uma família reunida no sofá",
    icon: UserRound,
  },
  {
    kind: "MEI",
    label: "MEI",
    subtitle: "Plano para o seu CNPJ",
    title: "Seu trabalho cresce.",
    emphasis: "Seu cuidado também.",
    description:
      "Com CNPJ ativo, você pode avaliar planos empresariais. A Kifer verifica os requisitos, a quantidade de pessoas e as condições antes de apresentar a proposta.",
    benefits: [
      "Verificação dos requisitos para o seu CNPJ",
      "Comparação com opções individuais",
      "Análise de rede, carências e custos",
      "Suporte com a documentação e a ativação",
    ],
    cta: "Quero cotar como MEI",
    photo: homePhotos.work,
    alt: "Imagem ilustrativa de uma profissional em seu escritório",
    icon: Briefcase,
  },
  {
    kind: "CNPJ",
    label: "Empresa",
    subtitle: "Para pequenas empresas",
    title: "Cuidado com quem faz",
    emphasis: "sua empresa acontecer.",
    description:
      "Compare operadoras e formatos de contratação para montar um benefício adequado ao tamanho do seu time, à rede desejada e ao orçamento.",
    benefits: [
      "Proposta alinhada ao quadro de funcionários",
      "Comparação entre operadoras parceiras",
      "Rede e condições verificadas para sua equipe",
      "Acompanhamento até a ativação",
    ],
    cta: "Quero cotar para minha empresa",
    photo: homePhotos.business,
    alt: "Imagem ilustrativa de uma equipe conversando no escritório",
    icon: Building2,
  },
] as const;
export const homeBenefitIcons = [Users, MapPin, FileText, Heart] as const;
export const homeSteps = [
  {
    title: "Você informa sua necessidade",
    text: "Nos conte seu perfil, número de pessoas e o que é importante para você na cobertura.",
    icon: FilePenLine,
  },
  {
    title: "A gente compara as melhores opções",
    text: "Analisamos operadoras, coberturas, redes e preços, de forma independente e personalizada.",
    icon: Search,
  },
  {
    title: "Você escolhe o plano ideal",
    text: "Você recebe uma proposta clara, com os detalhes para decidir com segurança e sem complicação.",
    icon: FileCheck2,
  },
  {
    title: "Acompanhamento até a ativação",
    text: "Cuidamos da documentação e do processo com a operadora, acompanhando você até o plano estar ativo.",
    icon: UserCheck,
  },
] as const;
export const homeAboutBenefits = [
  {
    title: "Atendimento humanizado",
    text: "Escuta para entender o que realmente importa para você e sua família.",
    icon: Users,
  },
  {
    title: "Orientação especializada",
    text: "Comparação entre operadoras, com foco nas suas necessidades.",
    icon: FileText,
  },
  {
    title: "Acompanhamento de ponta a ponta",
    text: "Da cotação à ativação, você conta com orientação em cada etapa.",
    icon: Heart,
  },
] as const;
export const homeQuoteBenefits = [
  {
    title: "Operadoras para o seu perfil",
    text: "Rede e condições verificadas antes da sua escolha.",
    icon: ShieldCheck,
  },
  {
    title: "Atendimento especializado",
    text: "Orientação do início ao fim, com foco no que você precisa.",
    icon: UserRound,
  },
  {
    title: "Cotação gratuita e sem compromisso",
    text: "Receba uma proposta personalizada para comparar.",
    icon: FileText,
  },
] as const;

// Respostas já publicadas na homepage; o redesign preserva seu conteúdo.
export const homeFaqs: PublicFaqItem[] = [
  {
    question: "MEI pode contratar plano empresarial?",
    answer:
      "Sim. Com CNPJ ativo e enquadramento aceito pela operadora, o MEI pode avaliar planos empresariais. A Kifer verifica os requisitos, a quantidade de pessoas e as condições disponíveis antes de apresentar a proposta.",
  },
  {
    question: "Qual a diferença entre plano por adesão e empresarial?",
    answer:
      "O plano empresarial exige CNPJ e segue as regras de contratação da operadora. O plano por adesão exige vínculo com uma entidade de classe e pode ter condições diferentes de preço, carência e reajuste.",
  },
  {
    question: "Tem carência?",
    answer:
      "A carência varia conforme a operadora, o tipo de contratação e a regra do produto. Antes da contratação, a Kifer explica o que muda para consultas, exames, internações e urgência.",
  },
  {
    question: "Quais regiões do Rio de Janeiro o plano cobre?",
    answer:
      "A cobertura varia conforme o plano. A análise considera sua cidade, os bairros onde você precisa de atendimento e a rede credenciada disponível no Rio de Janeiro e na região metropolitana.",
  },
  {
    question: "Como faço para contratar?",
    answer:
      "Você envia seus dados pelo formulário ou WhatsApp, recebe opções de plano de saúde comparadas para o seu perfil e, depois da escolha, a Kifer acompanha documentação, proposta e ativação.",
  },
];
