# Redesign da homepage — 30/10/2026

A homepage pública foi reconstruída nas dez composições solicitadas. Textos, seleção de perfil, navegação, FAQ, CTAs e formulário são componentes reais. As dez referências não entram no bundle nem são usadas como fundos. O escopo de implementação ficou na homepage e nos componentes necessários para ela.

## Prévia e evidências

- Prévia local: `http://127.0.0.1:5175/` enquanto o servidor Vite desta sessão estiver ativo.
- [Galeria comparativa por seção e largura](../output/playwright/home-redesign/index.html).
- Páginas completas: [320](../output/playwright/home-redesign/320/page.png), [390](../output/playwright/home-redesign/390/page.png), [768](../output/playwright/home-redesign/768/page.png), [1024](../output/playwright/home-redesign/1024/page.png), [1440](../output/playwright/home-redesign/1440/page.png), [1920](../output/playwright/home-redesign/1920/page.png).
- [Medições de responsividade](../output/playwright/home-redesign/responsive-results.json).
- [Resultados das interações e payloads simulados](../output/playwright/home-redesign/interaction-results.json).

Há 72 capturas finais: dez seções, página completa e primeira tela em cada uma das seis larguras. As capturas individuais ocultam temporariamente o cabeçalho sticky e o skip link **somente durante a captura**, para evitar artefatos de composição de screenshots maiores que a viewport. Páginas completas e primeiras telas mantêm a apresentação normal; nenhum controle foi removido ou ocultado na implementação.

## Análise e cobertura das referências

Antes da substituição, foram inspecionados `HomePage`, a API pública e os tipos de `public-content`, o serviço de captação, testes existentes, `siteConfig`, ativos de `public/`, tokens, componentes e a rota `/design-system`. Testes de caracterização foram executados contra o formulário original antes de mover sua coordenação para o hook.

| # | Composição da referência e implementação | Diferenças de conteúdo deliberadas |
| --- | --- | --- |
| 01 | Cabeçalho, título editorial com itálico, fotografia à direita, formas orgânicas, dois CTAs e três diferenciais. Menu mobile com Drawer existente. | Retrato já utilizado pelo site, em vez da fotografia conceitual do anexo. CTAs de cotação levam ao formulário por âncora; atalho de suporte preservado. |
| 02 | Título e imagem à esquerda; três explicações numeradas conectadas verticalmente; faixa estática de logos na base. | Cinco logos disponíveis no projeto: Amil, Bradesco, SulAmérica, Porto e Assim. Sem inventar logos ou métricas. |
| 03 | Um único painel com seletor lateral no desktop e seleção compacta no mobile. Título, descrição, benefícios, fotografia e CTA variam por perfil. | Imagens contextuais ilustrativas. A seleção PF/MEI/CNPJ é transmitida ao formulário. |
| 04 | Quatro etapas com ícones, números e curva pontilhada em SVG. Sequência vertical no celular e duas colunas no tablet. | Texto ajustado ao processo já descrito no projeto, sem prometer prazo de ativação. |
| 05 | Espaço principal e espaços secundários mantidos na composição editorial. Estado vazio explícito. | Não foram encontrados registros de autorização nem fotos dos relatos antigos. Não são publicados nomes, histórias, estrelas ou retratos fictícios. |
| 06 | Retrato amplo à esquerda; apresentação e três diferenciais à direita; nome tipográfico ao final. | Fotografia existente da Luíza, sem geração ou edição da sua aparência. Sem criar assinatura manuscrita ou novo logotipo. |
| 07 | Título à esquerda, ilustração discreta e cinco itens de acordeão à direita. | Perguntas e respostas reais da homepage anterior, que diferem das perguntas conceituais do anexo. |
| 08 | Composição editorial e diferenciais à esquerda; formulário real à direita, com fotografia contextual ao fundo. | Mantidos nome, WhatsApp, cidade, PF/MEI/CNPJ, quantidade, idade/faixas e aviso de privacidade. Não foi criada preferência de contato sem correspondência na integração real. |
| 09 | Texto e diferenciais à esquerda; smartphone em HTML/CSS, conversa ilustrativa e retrato da Luíza à direita. | Sem “online agora”, selo de verificação ou tempo de resposta não confirmado. WhatsApp oficial. |
| 10 | Fundo terracota profundo, wordmark branco, apresentação, navegação, perfis, contatos, Instagram e faixa legal. | Somente telefone, e-mail, Instagram e CNPJ de `siteConfig`; ano atual. Blog, glossário, outras redes e políticas sem rotas reais não são inventados. |

## Arquivos e componentes

| Arquivo | Responsabilidade |
| --- | --- |
| `src/pages/public/HomePage.tsx` | Wrapper mínimo pela API pública da feature. |
| `src/features/public-content/index.ts` | Exportação de `HomeScreen`. |
| `src/features/public-content/HomeScreen.tsx` | Composição, SEO e navegação por âncoras. |
| `src/features/public-content/components/PublicHomeHeader.tsx` | Cabeçalho e Drawer existentes; navegação centralizada e tipografia do menu. |
| `src/features/public-content/components/home/HomeIntro.tsx` | Hero e confiança/operadoras. |
| `src/features/public-content/components/home/HomeAudience.tsx` | Painel único de perfis. |
| `src/features/public-content/components/home/HomeJourney.tsx` | Quatro etapas, espaço de depoimentos e apresentação da Luíza. |
| `src/features/public-content/components/home/HomeContact.tsx` | FAQ e smartphone/WhatsApp. |
| `src/features/public-content/components/home/HomeQuoteForm.tsx` | Apresentação do formulário e autocompletar acessível. |
| `src/features/public-content/components/home/HomeFooter.tsx` | Rodapé exclusivo da homepage; rodapés das outras páginas preservados. |
| `src/features/public-content/domain/homeContent.ts` | Conteúdo, perfis, FAQ, imagens, logos e navegação compartilhados. |
| `src/features/public-content/hooks/useHomeQuote.ts` | Estado e coordenação da captação existente, usando o serviço da própria feature. |
| `src/design-system/home.css` | Composições e responsividade, com tokens oficiais e escopo `.kifer-home`. |
| `src/design-system/styles.css` | Importação pelo único entrypoint visual. |
| `src/design-system/components/Radio.tsx` | Suporte aditivo a nome e descrição acessíveis dos grupos. |
| `index.html` | Carregamento de Poppins; Inter e Playfair existentes mantidos. |
| `src/pages/public/HomePage.test.tsx` | Caracterização da captação e teste integrado de perfil/FAQ. |
| `public/images/home/{family,work,business}.png` | Três imagens ilustrativas contextuais, geradas com a ferramenta integrada. |
| `public/images/home/ASSETS.md` | Origem, finalidade e prompts finais dos três ativos. |

Reutilizados do design system: `PublicShell`, `BrandWordmark`, `Heading`, `Text`, `TextLink`, `Button`, `LinkButton`, `IconButton`, `Input`, `Field`, `FieldLabel`, `Radio`, `RadioGroup`, `Image`, `Drawer` e componentes do diálogo. `PrivacyNotice`, formatação de telefone e consulta de cidades também foram reutilizados. Não há controles básicos paralelos nem novas dependências no projeto.

## Captação e acessibilidade

O serviço `publicLeadApi.ts`, a Edge Function, o payload HTTP e as validações comerciais não foram alterados. O hook conserva a normalização do telefone, limite de pessoas, idade única ou soma das faixas e honeypot. Erros mantêm os dados; sucesso ocorre depois da confirmação do serviço. Há bloqueio contra submissão repetida durante o envio, feedback visível e link de continuidade no WhatsApp caso a abertura de nova janela seja bloqueada pelo navegador.

O fluxo continua UI → hook → serviço existente → API. A implementação não importa o cliente Supabase nos componentes. A API existente usa o padrão documentado de [invocação de Edge Functions](https://supabase.com/docs/reference/javascript/functions-invoke). Nenhuma consulta de verificação ou escrita foi feita no banco remoto.

As seleções usam radios nativos com grupos nomeados e navegação por setas. O FAQ usa botões nativos com `aria-expanded`, `aria-controls` e regiões corretamente ocultas. O autocompletar expõe listbox e opção ativa para leitores de tela; funciona por setas, Enter e Escape. Campos têm rótulos e erros associados, foco visível e bloqueio durante envio. A animação respeita `prefers-reduced-motion`.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Playwright — 320, 390, 768, 1024, 1440, 1920 | Aprovado: `scrollWidth === clientWidth`, nenhum texto/controle fora da largura e nenhuma imagem quebrada nas seis larguras. |
| Playwright — menu | Abrir, fechar com Escape, retorno de foco e navegação por âncora aprovados. |
| Playwright — perfis/FAQ | Troca por teclado, atualização de conteúdo e foto, CTA sincronizado, expansão por Enter e fechamento por espaço aprovados. |
| Playwright — formulário | Obrigatoriedade, nome curto, cidade por teclado, soma de idades, loading e bloqueio, erro mantendo dados, recuperação, sucesso e payload normalizado aprovados. Duas submissões interceptadas localmente; nenhuma requisição de captação chegou à produção. Abertura externa do WhatsApp também foi interceptada. |
| Testes direcionados | 12 testes aprovados: homepage, cabeçalho, privacidade e validação compartilhada da captação. |
| `npm test` | 1.859 aprovados; um timeout de 5.000 ms no teste existente `scripts/__tests__/designSystemContract.test.ts`. Esse teste executa cinco processos do auditor sobre fixtures temporárias, não sobre os novos componentes. |
| Reexecução do caso de timeout | Aprovado isoladamente com `--testTimeout=20000`; execução efetiva do teste: 3.658 ms. Teste e auditor não foram modificados. [Registro](../output/playwright/home-redesign/auditor-test-results.txt). |
| `npm run typecheck` | Aprovado. |
| `npm run lint` | Sem erros; sete avisos em arquivos anteriores e fora deste diff: seis previews em `output/playwright` e um hook em `PainelWrapper.tsx`. |
| `npm run audit:design-system` | Aprovado. |
| `npm run audit:visual` | Aprovado, zero ocorrências fora da biblioteca. |
| `npm run architecture:check` | Aprovado. |
| `npm run build` | Aprovado, incluindo verificação de segredos e bundle do editor. Mantém aviso do Vite sobre o tamanho do vendor existente. |
| `git diff --check` | Aprovado. |

O browser de desenvolvimento também registra o aviso preexistente de lifecycle de `react-helmet`. Os erros HTTP no teste do formulário foram respostas 500 simuladas de propósito para verificar recuperação; não representam falha do serviço remoto.

## Diferenças residuais e conteúdo pendente

1. Depoimentos aguardam relatos, identidades e fotografias com autorização verificável. O espaço foi preservado sem prova social inventada.
2. As fotografias conceituais dos anexos não foram usadas como retratos reais da Luíza. O retrato do projeto tem pose, enquadramento e fundo diferentes. Fotografias reais aprovadas com as poses das referências permitiriam aproximar ainda mais as seções 01, 06 e 09.
3. As três fotografias contextuais são novas imagens ilustrativas, com direção de arte próxima das referências, sem representar clientes reais. [Prompts e arquivos](../public/images/home/ASSETS.md).
4. A faixa de operadoras contém os cinco logos oficiais disponíveis; as outras marcas vistas no conceito não foram recriadas.
5. Contatos, perguntas, campos e avisos legais reais prevalecem sobre dados ilustrativos. O formulário pode ficar maior ao informar idades de várias pessoas, preservando as regras de captação.
6. Cores vêm dos tokens Terracota CRM; Poppins fica restrita à homepage e ao seu menu. Outros módulos conservam Inter e seus estilos.

Não houve deploy, alteração de schema/migrations, autenticação, CRM administrativo, automações ou envio de comunicação real. Modificações de outras tarefas no workspace não foram alteradas por este trabalho.
