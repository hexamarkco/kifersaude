const FALLBACK_SITE_URL = 'https://www.kifersaude.com.br';

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
  personName: 'Luiza Kifer',
  description:
    'Corretora especializada em planos de saúde no Rio de Janeiro, com atendimento humano, comparação consultiva e suporte até o pós-venda.',
  url: normalizeSiteUrl(import.meta.env.VITE_SITE_URL),
  locale: 'pt_BR',
  language: 'pt-BR',
  email: 'contato@kifersaude.com.br',
  telephone: '+55 21 97930-2389',
  whatsappUrl: 'https://wa.me/5521979302389',
  instagramUrl: 'https://instagram.com/souluizakifer',
  areaServed: 'Rio de Janeiro',
  defaultOgImage: '/luiza-kifer-hero.png',
} as const;

export const absoluteUrl = (path = '/') => new URL(path, `${siteConfig.url}/`).toString();

export const isIndexableDeployment =
  !import.meta.env.DEV &&
  import.meta.env.VITE_SITE_INDEXABLE !== 'false' &&
  (import.meta.env.VITE_SITE_INDEXABLE === 'true' || __KIFER_DEPLOYMENT_ENV__ === 'production');
