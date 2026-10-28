# Login — acesso ao CRM

Comparado com as referências [desktop](../../../references/desktop/page--login.png) e [mobile](../../../references/mobile/page--login.png), usando a página real em `/login`.

## Ajustes aplicados

- Card central com largura máxima de 430 px e padding pelo espaçamento oficial do design system.
- Título operacional em Inter, com escala responsiva; campos e botão usam o tamanho médio dos controles.
- CTA alinhado ao conteúdo, com indicação de entrada no CRM e nota de acesso autorizado.
- Autocomplete semântico para usuário e senha, mantendo o contrato atual `signIn(username, password)`.
- Marca e formulário continuam no `PublicShell` claro. A referência inclui navegação e um operador de demonstração; esses elementos não foram copiados para a tela pré-autenticada, para não expor atalhos protegidos nem identidade fictícia.

## Verificação Playwright

Capturas full-page:

- [Desktop — 1920 × 1080](page--login-desktop-1920.png)
- [Tablet — 768 × 1024](page--login-tablet-768.png)
- [Mobile — 390 × 844](page--login-mobile-390.png)
- [Mobile compacto — 320 × 640](page--login-mobile-320.png)
- [Foco por teclado no usuário — 1920 × 1080](state--login-foco-usuario.png)

Em todas as larguras, a largura de rolagem do documento ficou igual à viewport. A sequência de Tab alcançou usuário, senha e botão; os três controles apresentaram `:focus-visible`. Os campos `required` foram conferidos como vazios para validar a proteção nativa do formulário, sem enviar credenciais.

O login fixa o tema claro em `PublicShell`; não há alternância de tema nessa rota. Os estados de carregamento e erro da resposta de autenticação não foram acionados, pois isso chamaria o serviço real. Essa interação permanece pendente de uma validação isolada com autenticação simulada.

## Medidas registradas

| Viewport | Largura do documento | Card |
| --- | ---: | --- |
| 1920 × 1080 | 1920 px | 430 × 452 px |
| 768 × 1024 | 768 px | 430 × 445 px |
| 390 × 844 | 390 px | 358 × 476 px |
| 320 × 640 | 320 px | 288 × 496 px |
