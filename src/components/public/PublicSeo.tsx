import { Helmet } from 'react-helmet';
import { absoluteUrl, isIndexableDeployment, siteConfig } from '../../config/site';

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
  indexable?: boolean;
  imagePath?: string;
};

export default function PublicSeo({
  title,
  description,
  canonicalPath,
  breadcrumbs = [],
  faqItems = [],
  indexable = true,
  imagePath = siteConfig.defaultOgImage,
}: PublicSeoProps) {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const socialImageUrl = absoluteUrl(imagePath);
  const fullTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
  const allowIndexing = indexable && isIndexableDeployment;
  const breadcrumbItems =
    breadcrumbs.length > 0 && breadcrumbs[0].path !== '/'
      ? [{ name: 'Início', path: '/' }, ...breadcrumbs]
      : breadcrumbs;

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': ['Organization', 'InsuranceAgency'],
        '@id': `${siteConfig.url}/#organization`,
        name: siteConfig.legalName,
        url: siteConfig.url,
        logo: absoluteUrl('/image.png'),
        image: socialImageUrl,
        description: siteConfig.description,
        email: siteConfig.email,
        telephone: siteConfig.telephone,
        areaServed: {
          '@type': 'State',
          name: siteConfig.areaServed,
          address: { '@type': 'PostalAddress', addressCountry: 'BR' },
        },
        sameAs: [siteConfig.instagramUrl],
      },
      {
        '@type': 'Person',
        '@id': `${siteConfig.url}/#luiza-kifer`,
        name: siteConfig.personName,
        jobTitle: 'Especialista em planos de saúde',
        image: absoluteUrl('/image.png'),
        url: siteConfig.url,
        sameAs: [siteConfig.instagramUrl],
        worksFor: { '@id': `${siteConfig.url}/#organization` },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        name: siteConfig.name,
        url: siteConfig.url,
        inLanguage: siteConfig.language,
        publisher: { '@id': `${siteConfig.url}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${canonicalUrl}#webpage`,
        name: fullTitle,
        description,
        url: canonicalUrl,
        inLanguage: siteConfig.language,
        isPartOf: { '@id': `${siteConfig.url}/#website` },
        about: { '@id': `${siteConfig.url}/#luiza-kifer` },
        primaryImageOfPage: socialImageUrl,
      },
    ],
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
            item: absoluteUrl(item.path),
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

  const robots = allowIndexing
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow, noarchive';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="application-name" content={siteConfig.name} />
      <meta name="author" content={siteConfig.personName} />
      <meta name="creator" content={siteConfig.personName} />
      <meta name="publisher" content={siteConfig.name} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      {import.meta.env.VITE_GOOGLE_SITE_VERIFICATION && (
        <meta name="google-site-verification" content={import.meta.env.VITE_GOOGLE_SITE_VERIFICATION} />
      )}
      {import.meta.env.VITE_BING_SITE_VERIFICATION && (
        <meta name="msvalidate.01" content={import.meta.env.VITE_BING_SITE_VERIFICATION} />
      )}
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang="pt-BR" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta property="og:locale" content={siteConfig.locale} />
      <meta property="og:image" content={socialImageUrl} />
      <meta property="og:image:alt" content={`${siteConfig.personName}, ${siteConfig.description}`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={socialImageUrl} />
      <meta name="twitter:image:alt" content={`${siteConfig.personName}, ${siteConfig.description}`} />
      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
      {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
    </Helmet>
  );
}
