# Revisão visual — análises do dashboard

**Estado revisado com adaptação funcional.** Referências canônicas: [desktop](../../../references/desktop/state--dashboard-analises.png) e [mobile](../../../references/mobile/state--dashboard-analises.png). A meta global de redesign permanece ativa.

## Diferença entre a referência e o CRM

- A referência mostra um modal de cadastro com nome, descrição, status e ações para cancelar ou salvar.
- O CRM real não tem entidade, repository, configuração ou fluxo de criação/edição para análises personalizadas do dashboard. A ação “Abrir análises” é uma divulgação que mostra os relatórios existentes: produção da equipe, funil comercial, prioridades, métricas comerciais, distribuição, automações e calendário.
- O contexto foi revisado no estado real expandido. Não foi adicionado formulário, salvamento fictício, novo dado persistido ou regra comercial. A interface mantém a ação existente “Abrir/Ocultar análises” e apresenta os dados reais pelos componentes atuais do design system.
- Os relatórios continuam mostrando estados vazios e cobertura indisponível quando a fixture não tem dados para o recorte; não tratam ausência de dados como resultado zero.

## Comportamento verificado

- “Abrir análises” expande o conteúdo real abaixo do dashboard; “Ocultar análises” recolhe o mesmo conteúdo sem alterar a rota ou os dados.
- A ação “Atualizar produção” não foi acionada. Nenhum registro foi salvo, editado ou excluído e nenhuma comunicação foi enviada.
- Capturas feitas com fixture local sintética em 1920 × 1080, 768 × 1024, 390 × 844 e 320 × 640, nos temas claro e escuro. Todas incluem viewport e dashboard completo com a seção expandida.
- Sem overflow horizontal. O Chromium reserva 10 px para a barra vertical; a largura interna medida foi 1910, 758, 380 e 310 px, respectivamente.

## Limitações da captura

- O ambiente Playwright bloqueou por política de inventário uma tentativa da fixture de criar lembretes de reajuste (HTTP 403, sem operação remota), e a conexão Realtime local expirou. A seção indicou cobertura indisponível em vez de apresentar esses dados como zero. Também apareceu um aviso de ciclo de vida legado de dependência.
- A referência de modal de cadastro não tem ação correspondente no CRM atual. Isso fica como adaptação registrada; implementar esse formulário exigiria definir um novo fluxo e persistência de negócio.

## Capturas Playwright

`coverage.json` relaciona as 16 imagens, dimensões, tema, estado e verificações.

| Resolução | Tema claro | Tema escuro |
|---|---|---|
| Desktop 1920 × 1080 | [viewport](desktop/analyses-viewport.png) · [página completa](desktop/analyses-full.png) | [viewport](desktop/analyses-dark-viewport.png) · [página completa](desktop/analyses-dark-full.png) |
| Tablet 768 × 1024 | [viewport](tablet/analyses-viewport.png) · [página completa](tablet/analyses-full.png) | [viewport](tablet/analyses-dark-viewport.png) · [página completa](tablet/analyses-dark-full.png) |
| Mobile 390 × 844 | [viewport](mobile/analyses-viewport.png) · [página completa](mobile/analyses-full.png) | [viewport](mobile/analyses-dark-viewport.png) · [página completa](mobile/analyses-dark-full.png) |
| Mobile compacto 320 × 640 | [viewport](mobile-320/analyses-viewport.png) · [página completa](mobile-320/analyses-full.png) | [viewport](mobile-320/analyses-dark-viewport.png) · [página completa](mobile-320/analyses-dark-full.png) |
