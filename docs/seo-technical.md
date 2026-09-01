# Fundação de SEO técnico

## Estratégia atual

- A aplicação é Vite + React Router e entrega as páginas públicas por CSR; não há SSR, SSG ou ISR.
- A home (`/`) é a única rota pública canônica e indexável hoje. A lista em `scripts/seo-routes.mjs` é a fonte de verdade para o sitemap gerado no build.
- `/links`, `/forms/:slug`, autenticação, painel, chat, design system e documentação de API são `noindex`. Formulários e links dependem de conteúdo configurável e não devem entrar no sitemap automaticamente.
- O build gera `robots.txt` e `sitemap.xml`. Em preview/staging a saída bloqueia crawling; em produção ela é liberada. `VITE_SITE_INDEXABLE=true|false` permite a mesma decisão fora da Vercel.

## Operação

- Configure `VITE_SITE_URL` com o domínio canônico de produção.
- Configure `VITE_GOOGLE_SITE_VERIFICATION` e `VITE_BING_SITE_VERIFICATION` somente com os tokens reais.
- Para adicionar uma página de conteúdo, entregue conteúdo original, metadata com `PublicSeo` e inclua a rota em `scripts/seo-routes.mjs` apenas se ela for indexável.
- Para posts ou páginas dinâmicas futuras, o sitemap deve ser estendido no build ou via endpoint servidor com datas confiáveis; nunca inventar `lastmod`.

## Limite conhecido

O conteúdo e a metadata por rota são renderizados no cliente. A home mantém metadata e um fallback sem JavaScript no HTML inicial, mas uma migração futura para SSG/SSR das páginas públicas é a evolução indicada se houver blog ou muitas landing pages indexáveis.
