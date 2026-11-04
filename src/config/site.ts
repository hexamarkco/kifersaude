const FALLBACK_SITE_URL = 'https://www.kifersaude.com.br';
const TELEPHONE = '+55 21 99746-2039';
const TELEPHONE_DIGITS = TELEPHONE.replace(/\D/g, '');

const normalizeSiteUrl = (value: string | undefined) => {
  try {
    const url = new URL(value || FALLBACK_SITE_URL);
    return url.origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
};

export const siteConfig = {
  name: 'Kifer Saúde',
  legalName: 'Kifer Saúde',
  cnpj: '46.423.078/0001-10',
  personName: 'Luíza Kifer',
  description:
    'Corretora de planos de saúde no Rio de Janeiro para pessoa física, MEI e empresas. A Kifer compara operadoras, rede credenciada, carência e coparticipação com atendimento humano.',
  url: normalizeSiteUrl(import.meta.env.VITE_SITE_URL),
  locale: 'pt_BR',
  language: 'pt-BR',
  email: 'contato@kifersaude.com.br',
  telephone: TELEPHONE,
  telephoneHref: `tel:+${TELEPHONE_DIGITS}`,
  whatsappUrl: `https://wa.me/${TELEPHONE_DIGITS}`,
  instagramUrl: 'https://instagram.com/souluizakifer',
  areaServed: 'Rio de Janeiro',
  defaultOgImage: '/luiza-kifer-hero.png',
} as const;

export const absoluteUrl = (path = '/') => new URL(path, `${siteConfig.url}/`).toString();

export const isIndexableDeployment =
  !import.meta.env.DEV &&
  import.meta.env.VITE_SITE_INDEXABLE !== 'false' &&
  (import.meta.env.VITE_SITE_INDEXABLE === 'true' || __KIFER_DEPLOYMENT_ENV__ === 'production');
