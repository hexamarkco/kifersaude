# Validação — shell e Leads

Etapa de 27/10/2026. As referências permanecem em `previous-approved/` e `references/`; a aplicação usa os componentes de produção.

## Cobertura

73 capturas: 12 antes e 61 depois. Lista, Kanban, filtros e formulário em 1920×1080, 768×1024, 390×844 e 320×640, sem overflow horizontal do documento. Kanban mantém rolagem localizada.

Detalhe contextual, nova interação, rolagem do histórico, edição, confirmação de exclusão, lembrete e menu de exportação foram abertos nas quatro larguras. Formulário inválido foi validado e cancelamento voltou à lista. Loading, vazio e erro foram simulados em desktop/mobile. Tema escuro conferido em desktop/mobile. Seleção em lote conferida sem aplicar mudanças.

## Limites e preservação

- Criar/editar agora ocupa o workspace da rota atual; consumidores de outros módulos mantêm a apresentação modal padrão.
- Detalhes e histórico continuam contextuais: captura de regressão não significa adesão concluída à referência de página própria.
- Não foram executados exclusão, conversão, salvamento remoto, exportação de dados reais, alteração de status/responsável, campanhas ou mensagens.
- Escritas são bloqueadas no backend fictício; os dois testes de formulário exercitam a persistência por mock da API pública e verificam `skip_automation`.
- As chamadas de leitura de cidades do IBGE foram bloqueadas no ensaio; a edição manteve a cidade já cadastrada. Sem dados pessoais reais.
- Perfis restritos, conversão, seletores/calendários individuais e todos os módulos posteriores continuam pendentes.
- As capturas fullPage de formulários longos incluem a navegação fixa na posição do viewport no momento do screenshot. A verificação de uso foi feita no viewport; o rodapé de salvar fica acima da navegação mobile ao rolar.
- O console registrou avisos de estrutura React/realtime do ambiente interceptado; as execuções finais não registraram erros `pageerror`. Erros HTTP simulados são esperados nos estados de falha.

## Checks

Build, contrato do design system, auditoria visual e arquitetura aprovados. Lint sem erros e com o aviso preexistente em `useMetaAds.ts:25`. Typecheck mantém erros preexistentes de `Uint8Array<ArrayBufferLike>` em `useVoiceRecording.ts:248` e `xlsxExport.ts:241`.

15 testes focados aprovados. Suíte completa: 320 arquivos, 1717 testes, 1713 aprovados. As mesmas quatro falhas já ocorriam antes desta alteração:

1. `supabase/functions/chatgpt-mcp/__tests__/write-actions.test.ts` — criação de lembrete/sincronização do próximo retorno.
2. `supabase/functions/_shared/__tests__/campaign-admission-safety-contract.test.ts` — resposta normal/opt-out do burst.
3. `supabase/functions/_shared/__tests__/comm-whatsapp-follow-up-v2-contract.test.ts` — simulação interna com service role.
4. `src/features/config/ai/components/__tests__/FeatureEditorDrawer.test.tsx` — liberar salvar após falha de criação.

Dados das medições: [resultados.json](resultados.json). O checklist geral registra separadamente implementação, validação e exceções.

## Imagens

| Captura | Etapa / resolução | Tela ou estado |
|---|---|---|
| [leads-criar.png](antes/desktop/leads-criar.png) | antes / desktop | criar |
| [leads-kanban.png](antes/desktop/leads-kanban.png) | antes / desktop | kanban |
| [leads-listagem.png](antes/desktop/leads-listagem.png) | antes / desktop | listagem |
| [leads-criar.png](antes/mobile/leads-criar.png) | antes / mobile | criar |
| [leads-kanban.png](antes/mobile/leads-kanban.png) | antes / mobile | kanban |
| [leads-listagem.png](antes/mobile/leads-listagem.png) | antes / mobile | listagem |
| [leads-criar.png](antes/mobile-320/leads-criar.png) | antes / mobile-320 | criar |
| [leads-kanban.png](antes/mobile-320/leads-kanban.png) | antes / mobile-320 | kanban |
| [leads-listagem.png](antes/mobile-320/leads-listagem.png) | antes / mobile-320 | listagem |
| [leads-criar.png](antes/tablet/leads-criar.png) | antes / tablet | criar |
| [leads-kanban.png](antes/tablet/leads-kanban.png) | antes / tablet | kanban |
| [leads-listagem.png](antes/tablet/leads-listagem.png) | antes / tablet | listagem |
| [leads-agendar-lembrete.png](depois/desktop/leads-agendar-lembrete.png) | depois / desktop | agendar-lembrete |
| [leads-confirmar-exclusao.png](depois/desktop/leads-confirmar-exclusao.png) | depois / desktop | confirmar-exclusao |
| [leads-criar.png](depois/desktop/leads-criar.png) | depois / desktop | criar |
| [leads-dark.png](depois/desktop/leads-dark.png) | depois / desktop | dark |
| [leads-detalhe-contextual.png](depois/desktop/leads-detalhe-contextual.png) | depois / desktop | detalhe-contextual |
| [leads-editar.png](depois/desktop/leads-editar.png) | depois / desktop | editar |
| [leads-empty.png](depois/desktop/leads-empty.png) | depois / desktop | empty |
| [leads-error.png](depois/desktop/leads-error.png) | depois / desktop | error |
| [leads-filtros.png](depois/desktop/leads-filtros.png) | depois / desktop | filtros |
| [leads-historico-rolagem.png](depois/desktop/leads-historico-rolagem.png) | depois / desktop | historico-rolagem |
| [leads-kanban.png](depois/desktop/leads-kanban.png) | depois / desktop | kanban |
| [leads-listagem.png](depois/desktop/leads-listagem.png) | depois / desktop | listagem |
| [leads-loading.png](depois/desktop/leads-loading.png) | depois / desktop | loading |
| [leads-menu-exportacao.png](depois/desktop/leads-menu-exportacao.png) | depois / desktop | menu-exportacao |
| [leads-nova-interacao.png](depois/desktop/leads-nova-interacao.png) | depois / desktop | nova-interacao |
| [leads-selecao.png](depois/desktop/leads-selecao.png) | depois / desktop | selecao |
| [leads-validacao.png](depois/desktop/leads-validacao.png) | depois / desktop | validacao |
| [leads-viewport.png](depois/desktop/leads-viewport.png) | depois / desktop | viewport |
| [leads-agendar-lembrete.png](depois/mobile/leads-agendar-lembrete.png) | depois / mobile | agendar-lembrete |
| [leads-confirmar-exclusao.png](depois/mobile/leads-confirmar-exclusao.png) | depois / mobile | confirmar-exclusao |
| [leads-criar.png](depois/mobile/leads-criar.png) | depois / mobile | criar |
| [leads-dark.png](depois/mobile/leads-dark.png) | depois / mobile | dark |
| [leads-detalhe-contextual.png](depois/mobile/leads-detalhe-contextual.png) | depois / mobile | detalhe-contextual |
| [leads-editar.png](depois/mobile/leads-editar.png) | depois / mobile | editar |
| [leads-empty.png](depois/mobile/leads-empty.png) | depois / mobile | empty |
| [leads-error.png](depois/mobile/leads-error.png) | depois / mobile | error |
| [leads-filtros.png](depois/mobile/leads-filtros.png) | depois / mobile | filtros |
| [leads-historico-rolagem.png](depois/mobile/leads-historico-rolagem.png) | depois / mobile | historico-rolagem |
| [leads-kanban.png](depois/mobile/leads-kanban.png) | depois / mobile | kanban |
| [leads-listagem.png](depois/mobile/leads-listagem.png) | depois / mobile | listagem |
| [leads-loading.png](depois/mobile/leads-loading.png) | depois / mobile | loading |
| [leads-menu-exportacao.png](depois/mobile/leads-menu-exportacao.png) | depois / mobile | menu-exportacao |
| [leads-nova-interacao.png](depois/mobile/leads-nova-interacao.png) | depois / mobile | nova-interacao |
| [leads-validacao.png](depois/mobile/leads-validacao.png) | depois / mobile | validacao |
| [leads-viewport.png](depois/mobile/leads-viewport.png) | depois / mobile | viewport |
| [leads-agendar-lembrete.png](depois/mobile-320/leads-agendar-lembrete.png) | depois / mobile-320 | agendar-lembrete |
| [leads-confirmar-exclusao.png](depois/mobile-320/leads-confirmar-exclusao.png) | depois / mobile-320 | confirmar-exclusao |
| [leads-criar.png](depois/mobile-320/leads-criar.png) | depois / mobile-320 | criar |
| [leads-detalhe-contextual.png](depois/mobile-320/leads-detalhe-contextual.png) | depois / mobile-320 | detalhe-contextual |
| [leads-editar.png](depois/mobile-320/leads-editar.png) | depois / mobile-320 | editar |
| [leads-filtros.png](depois/mobile-320/leads-filtros.png) | depois / mobile-320 | filtros |
| [leads-historico-rolagem.png](depois/mobile-320/leads-historico-rolagem.png) | depois / mobile-320 | historico-rolagem |
| [leads-kanban.png](depois/mobile-320/leads-kanban.png) | depois / mobile-320 | kanban |
| [leads-listagem.png](depois/mobile-320/leads-listagem.png) | depois / mobile-320 | listagem |
| [leads-menu-exportacao.png](depois/mobile-320/leads-menu-exportacao.png) | depois / mobile-320 | menu-exportacao |
| [leads-nova-interacao.png](depois/mobile-320/leads-nova-interacao.png) | depois / mobile-320 | nova-interacao |
| [leads-validacao.png](depois/mobile-320/leads-validacao.png) | depois / mobile-320 | validacao |
| [leads-viewport.png](depois/mobile-320/leads-viewport.png) | depois / mobile-320 | viewport |
| [leads-agendar-lembrete.png](depois/tablet/leads-agendar-lembrete.png) | depois / tablet | agendar-lembrete |
| [leads-confirmar-exclusao.png](depois/tablet/leads-confirmar-exclusao.png) | depois / tablet | confirmar-exclusao |
| [leads-criar.png](depois/tablet/leads-criar.png) | depois / tablet | criar |
| [leads-detalhe-contextual.png](depois/tablet/leads-detalhe-contextual.png) | depois / tablet | detalhe-contextual |
| [leads-editar.png](depois/tablet/leads-editar.png) | depois / tablet | editar |
| [leads-filtros.png](depois/tablet/leads-filtros.png) | depois / tablet | filtros |
| [leads-historico-rolagem.png](depois/tablet/leads-historico-rolagem.png) | depois / tablet | historico-rolagem |
| [leads-kanban.png](depois/tablet/leads-kanban.png) | depois / tablet | kanban |
| [leads-listagem.png](depois/tablet/leads-listagem.png) | depois / tablet | listagem |
| [leads-menu-exportacao.png](depois/tablet/leads-menu-exportacao.png) | depois / tablet | menu-exportacao |
| [leads-nova-interacao.png](depois/tablet/leads-nova-interacao.png) | depois / tablet | nova-interacao |
| [leads-validacao.png](depois/tablet/leads-validacao.png) | depois / tablet | validacao |
| [leads-viewport.png](depois/tablet/leads-viewport.png) | depois / tablet | viewport |
