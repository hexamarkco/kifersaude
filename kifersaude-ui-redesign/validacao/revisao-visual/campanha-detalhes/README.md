# Revisão visual — detalhe de campanha

**Comparado com adaptações.** As referências canônicas são [desktop](../../../references/desktop/page--campanha-detalhes.png) e [mobile](../../../references/mobile/page--campanha-detalhes.png). A meta de redesign integral segue em andamento.

## Resultado da comparação

- O cabeçalho agora identifica a área, mantém a descrição visível e apresenta “Editar campanha” como ação principal, seguindo o posicionamento das referências.
- Os quatro indicadores reais ficam em uma linha no desktop e duas colunas em tablet/mobile.
- Andamento e público selecionado são painéis separados, com proporção 3:2 em desktop. Relatório, filtros, contatos e paginação permanecem disponíveis abaixo deles.
- A ação “Editar campanha” encaminha a campanha ao editor em página completa já existente. Esse fluxo carrega as etapas pela função atual `listCampaignSteps`; não foi criado um editor paralelo nem alteradas regras do disparo.
- Os indicadores usam contagens reais de destinatários, pendências, envios e respostas. Nenhuma taxa ou estado de entrega foi inventado para reproduzir a referência estática.
- Em 1920, 768, 390 e 320 px, a largura do documento permaneceu igual à largura do viewport. O CTA de edição acompanha o alinhamento do título em telas estreitas e aparece antes dos controles secundários.

## Capturas

Playwright aguardou `document.fonts.ready`, reduziu movimento e desativou animações. Foram capturadas a área inicial e a página completa nos temas claro e escuro para desktop, tablet e dois tamanhos mobile. As dimensões e métricas estão em [`coverage.json`](coverage.json).

| Viewport | Claro | Escuro |
| --- | --- | --- |
| Desktop — 1920×1080 | [viewport](screenshots/desktop-light-viewport.png) · [página completa](screenshots/desktop-light-full.png) | [viewport](screenshots/desktop-dark-viewport.png) · [página completa](screenshots/desktop-dark-full.png) |
| Tablet — 768×1024 | [viewport](screenshots/tablet-light-viewport.png) · [página completa](screenshots/tablet-light-full.png) | [viewport](screenshots/tablet-dark-viewport.png) · [página completa](screenshots/tablet-dark-full.png) |
| Mobile — 390×844 | [viewport](screenshots/mobile-light-viewport.png) · [página completa](screenshots/mobile-light-full.png) | [viewport](screenshots/mobile-dark-viewport.png) · [página completa](screenshots/mobile-dark-full.png) |
| Mobile compacto — 320×640 | [viewport](screenshots/mobile-320-light-viewport.png) · [página completa](screenshots/mobile-320-light-full.png) | [viewport](screenshots/mobile-320-dark-viewport.png) · [página completa](screenshots/mobile-320-dark-full.png) |

## Escopo e limites

- As capturas montam o componente real `WhatsAppCampaignDetailScreen` em uma prévia isolada com dados sintéticos de leitura. Não contêm dados pessoais da produção.
- O ambiente local sem sessão redirecionou a rota autenticada `/painel/disparos` para o login. Por isso, shell autenticado, permissões e integração visual com navegação global não foram aprovados nesta revisão.
- Os testes exercitaram o botão de edição e a transferência da campanha para o editor existente. Pausar, cancelar ou processar lote não foi acionado; nenhuma mensagem foi enviada e nenhum registro foi gravado.
- A edição continua em uma página completa, conforme o padrão do CRM. Não foi aberto modal para o formulário de campanha.

## Verificações

- 3 testes focados passaram, cobrindo a navegação para edição e a abertura do editor existente.
- Typecheck, ESLint nos quatro arquivos alterados e build passaram. As auditorias de credenciais, Design System e valores visuais também passaram; o build conserva o aviso conhecido do chunk vendor acima de 500 kB.
- Playwright capturou 16 PNGs: viewport e full-page em 4 tamanhos × 2 temas. Nenhuma largura horizontal excedeu o viewport.
