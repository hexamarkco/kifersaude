import { Briefcase, Building2, UserRound } from "lucide-react";
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
  { section: "para-quem", label: "Para quem é" },
  { section: "como-funciona", label: "Como funciona" },
  { section: "sobre", label: "Sobre a Luíza" },
  { section: "duvidas", label: "Dúvidas" },
] as const;

export const homePhotos = {
  luizaHero: "/images/home/luiza-opening.webp",
  luizaAbout: "/images/home/luiza-about-editorial.webp",
  luizaWhatsApp: "/images/home/luiza-portrait.webp",
  family: "/images/home/family-profile.webp",
  trust: "/images/home/trust-coffee.webp",
  work: "/images/home/mei-office.webp",
  quote: "/images/home/family-quote.webp",
  business: "/images/home/business.png",
} as const;

export const homeAudiences = [
  {
    kind: "PF",
    label: "Pessoa física",
    subtitle: "Você e sua família",
    title: "Para você.",
    emphasis: "Para a sua família.",
    description:
      "Planos que acompanham a sua rotina e o cuidado com quem você ama.",
    benefits: [
      "Rede pensada para o seu dia a dia",
      "Condições explicadas com clareza",
      "Cotação gratuita e sem compromisso",
    ],
    cta: "Encontrar meu plano",
    photo: homePhotos.family,
    photoWidth: 1448,
    photoHeight: 1086,
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
      "Avalie opções empresariais para o seu CNPJ, com orientação em cada detalhe.",
    benefits: [
      "Análise dos requisitos do seu CNPJ",
      "Comparação com opções individuais",

      "Suporte da proposta à ativação",
    ],
    cta: "Ver opções para MEI",
    photo: homePhotos.work,
    photoWidth: 1448,
    photoHeight: 1086,
    alt: "Imagem ilustrativa de uma profissional em seu escritório",
    icon: Briefcase,
  },
  {
    kind: "CNPJ",
    label: "Empresa",
    subtitle: "Para pequenas empresas",
    title: "Cuidado com quem",
    emphasis: "faz acontecer.",
    description:
      "Um benefício alinhado ao seu time, à rede desejada e ao seu orçamento.",
    benefits: [
      "Proposta para o tamanho da equipe",
      "Operadoras comparadas lado a lado",

      "Acompanhamento da contratação",
    ],
    cta: "Cuidar da minha equipe",
    photo: homePhotos.business,
    photoWidth: 1122,
    photoHeight: 1402,
    alt: "Imagem ilustrativa de uma equipe conversando no escritório",
    icon: Building2,
  },
] as const;
export const homeSteps = [
  {
    title: "A gente escuta o que você precisa.",
    text: "Conte seu perfil, quem vai participar e o que é importante na cobertura.",
  },
  {
    title: "As opções ficam mais claras.",
    text: "Comparamos operadoras, rede, custos e condições para o seu momento.",
  },
  {
    title: "Você escolhe com segurança.",
    text: "Receba uma proposta explicada, tire suas dúvidas e decida no seu tempo.",
  },
  {
    title: "Seguimos juntos até a ativação.",
    text: "Acompanhamos a documentação e os próximos passos com a operadora.",
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
    question: "Qual a diferença entre adesão e empresarial?",
    answer:
      "O plano empresarial exige CNPJ e segue as regras de contratação da operadora. O plano por adesão exige vínculo com uma entidade de classe e pode ter condições diferentes de preço, carência e reajuste.",
  },
  {
    question: "O plano de saúde tem carência?",
    answer:
      "A carência varia conforme a operadora, o tipo de contratação e a regra do produto. Antes da contratação, a Kifer explica o que muda para consultas, exames, internações e urgência.",
  },
  {
    question: "Quais regiões do Rio de Janeiro o plano cobre?",
    answer:
      "A cobertura varia conforme o plano. A análise considera sua cidade, os locais onde você precisa de atendimento e a rede credenciada disponível no Rio de Janeiro e na região metropolitana.",
  },
  {
    question: "Como faço para contratar?",
    answer:
      "Você envia seus dados pelo formulário ou WhatsApp, recebe opções de plano de saúde comparadas para o seu perfil e, depois da escolha, a Kifer acompanha documentação, proposta e ativação.",
  },
];
