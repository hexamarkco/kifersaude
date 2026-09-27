export type OperatorAccentTone = 'terracotta' | 'gold' | 'copper' | 'success' | 'info';

export type OperatorContractProfile = {
  label: string;
  detail: string;
};

export type OperatorFaq = {
  question: string;
  answer: string;
};

export type OperatorSeo = {
  title: string;
  description: string;
};

export type OperatorLandingContent = {
  name: string;
  slug: string;
  variantSlug?: string;
  path: string;
  logoPath: string | null;
  logoAlt: string;
  accentTone: OperatorAccentTone;
  eyebrow: string;
  heroHeadline: string;
  heroDescription: string;
  valueProposition: string;
  contractProfiles: readonly OperatorContractProfile[];
  minimumLives: string;
  coverage: string;
  products: readonly string[];
  networkHighlights: readonly string[];
  differentials: readonly string[];
  commercialNotes: readonly string[];
  faqs: readonly OperatorFaq[];
  seo: OperatorSeo;
};

export const OPERATOR_LANDING_SLUGS = [
  'amil',
  'porto-saude',
  'bradesco-saude',
  'sulamerica',
  'unimed',
  'medsenior',
  'assim-saude',
  'hapvida-notredame',
  'leve-saude',
  'klini',
] as const;

export type OperatorLandingSlug = (typeof OPERATOR_LANDING_SLUGS)[number];
