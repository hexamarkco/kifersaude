# Política de Privacidade — revisão antes da publicação

Minuta preparada em 23/10/2026. Não publicada. URL prevista: https://www.kifersaude.com.br/politica-de-privacidade.

## Informações a validar

- Razão social completa: `siteConfig.legalName` contém somente Kifer Saúde. CNPJ 46.423.078/0001-10 extraído do rodapé existente e centralizado em `src/config/site.ts`; validar sua titularidade.
- Confirmar que contato@kifersaude.com.br e +55 21 97930-2389 recebem solicitações de titulares, responsáveis e procedimento de identificação. Definir encarregado/canal específico se aplicável.
- Validar bases legais por finalidade, preferências comerciais, tratamento de menores e dados sensíveis. A ciência da política não é consentimento genérico.
- Confirmar perguntas dos anúncios Meta e integrações realmente ativas; nenhuma campanha ou configuração remota foi consultada/modificada.
- Validar fornecedores ativos (inclusive IA), contratos, papéis de controlador/operador, transferências internacionais e medidas organizacionais.
- Formalizar tabela de retenção e descarte por categoria, inclusive backups. Não foi presumido prazo numérico.
- Revisar juridicamente o texto completo e substituir os marcadores antes de publicar. Atualizar a data somente ao revisar a versão correspondente.

## Evidências locais utilizadas

- `src/pages/public/HomePage.tsx`, `src/features/public-content/data/publicLeadApi.ts`: campos de cotação e envio à função pública.
- `src/pages/public/FormPage.tsx`, `src/features/public-content/domain/types.ts`, `supabase/functions/public-form-submit`: e-mail opcional, respostas, geolocalização pulável, informações do navegador, origem, honeypot e limite por IP hasheado.
- `src/features/contracts/domain/types.ts`: CPF, nascimento, endereço, titular e dependentes. Fluxos de documentos e controles de acesso constam das invariantes do projeto.
- `src/app/VercelSpeedInsights.tsx`: medição em produção, caminhos normalizados, remoção de query na URL enviada. A nova política está fora dessa integração e do AuthProvider.
- `src/features/public-content/domain/publicAnalytics.ts`: eventos opcionais para dataLayer/gtag; não instala Google Analytics/GTM. Nenhum instalador de Pixel Meta/GTM/GA encontrado em src e index.html.
- `index.html`: fontes externas Google Fonts. Formulário público armazena preferência visual no localStorage; autenticação interna usa sessão persistida.
- Configuração e integrações locais demonstram Supabase, Vercel, WhatsApp/Whapi e IA, mas não comprovam fornecedores ativos/contratos em produção.

## Pendência separada: consentimento e rastreamento

Inspecionar rede e cookies em produção, incluindo scripts adicionados pela hospedagem. Inventariar tecnologias não essenciais e avaliar mecanismo de escolha/consentimento, revogação e registro. Não foi criado banner nem alterado rastreamento nesta tarefa. Não afirmar que há apenas cookies essenciais.

## Referências oficiais

- LGPD, especialmente arts. 6º, 7º, 9º, 11, 18 e 46: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- ANPD, cookies: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais

## Publicação após aprovação

1. Validar os itens acima e revisar a minuta, retirando/substituindo os avisos de revisão apenas após aprovação jurídica e operacional.
2. Executar typecheck, lint, testes e build. Resolver os gates pendentes antes da publicação.
3. Usar o fluxo habitual de publicação do repositório, somente após autorização. Não há migration, deploy de função ou alteração de backend necessária.
4. Em produção, confirmar VITE_SITE_URL=https://www.kifersaude.com.br e ambiente production com indexação habilitada. A rota foi incluída no sitemap gerado e na reescrita Vercel para index.html.
5. Abrir diretamente e atualizar /politica-de-privacidade sem login; verificar canonical, robots e sitemap. Depois informar a URL aprovada nos formulários Meta, em operação separada.

## Arquivos desta implementação

Criados: `src/features/public-content/PrivacyPolicyPage.tsx`, `src/features/public-content/PrivacyPolicyPage.test.tsx`, `src/features/public-content/components/PublicFooter.tsx`, `src/features/public-content/components/PrivacyNotice.tsx` e este documento.

Modificados: `src/main.tsx`, `src/routes/lazyRouteComponents.tsx`, `src/config/site.ts`, `scripts/seo-routes.ts`, `vercel.json`, `src/features/public-content/index.ts`, `src/pages/public/HomePage.tsx`, `src/pages/public/FormPage.tsx` e `src/features/operator-landings/OperatorLandingScreen.tsx`.

A implementação cobre as 13 seções solicitadas. Não altera backend, CRM, banco, automações, credenciais ou campanhas. Avisos adicionados aos formulários preservam processamento, validação e envio.

## Validação local

- Três testes específicos aprovados: renderização sem provedor de sessão, seções e canais, metadata e link da política nos avisos.
- Lint e verificação de arquitetura aprovados.
- Typecheck bloqueado por erros de ArrayBufferLike em useVoiceRecording.ts e xlsxExport.ts, fora desta implementação.
- npm run build bloqueado por três ocorrências da auditoria visual em SettingsCatalogManagers.test.tsx e LeadStatusManager.tsx, fora desta implementação. Geração direta com Vite e verify:editor-bundle aprovadas. O build local mantém noindex e sitemap vazio por ser ambiente não produtivo, conforme configuração existente.
- Navegador abriu diretamente a rota sem login e confirmou título e 13 seções. O aviso de StrictMode do react-helmet é da integração existente.
- Suíte completa: 1.609 testes aprovados e 4 falhas fora desta mudança (campaign-admission-safety-contract, campaign-admission-safety-pg, comm-whatsapp-follow-up-v2-contract e FeatureEditorDrawer). O teste FeatureEditorDrawer também falha isoladamente. Os três testes novos passaram novamente após a checagem de tipos.
