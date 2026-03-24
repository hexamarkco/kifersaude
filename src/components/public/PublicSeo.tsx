import { Helmet } from 'react-helmet';

export type PublicBreadcrumbItem = {
  name: string;
  path: string;
};

export type PublicFaqItem = {
  question: string;
  answer: string;
};

type PublicSeoProps = {
  title: string;
  description: string;
  canonicalPath: string;
  breadcrumbs?: PublicBreadcrumbItem[];
  faqItems?: PublicFaqItem[];
};

const siteUrl = 'https://www.kifersaude.com.br';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Kifer Saúde',
  url: siteUrl,
  logo: `${siteUrl}/image.png`,
  email: 'contato@kifersaude.com.br',
  telephone: '+55 21 97930-2389',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Rio de Janeiro',
    addressRegion: 'RJ',
    addressCountry: 'BR',
  },
  sameAs: ['https://instagram.com/souluizakifer'],
};

export default function PublicSeo({
  title,
  description,
  canonicalPath,
  breadcrumbs = [],
  faqItems = [],
}: PublicSeoProps) {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const breadcrumbItems =
    breadcrumbs.length > 0 && breadcrumbs[0].path !== '/'
      ? [{ name: 'Início', path: '/' }, ...breadcrumbs]
      : breadcrumbs;

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'pt-BR',
    publisher: {
      '@type': 'Organization',
      name: 'Kifer Saúde',
      url: siteUrl,
    },
  };

  const breadcrumbSchema =
    breadcrumbItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbItems.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: `${siteUrl}${item.path}`,
          })),
        }
      : null;

  const faqSchema =
    faqItems.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Kifer Saúde" />
      <meta property="og:locale" content="pt_BR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(webPageSchema)}</script>
      {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
      {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
    </Helmet>
  );
}
