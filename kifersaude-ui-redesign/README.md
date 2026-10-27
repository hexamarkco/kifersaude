# Kifer Saúde — Pacote de referências UI/UX

Este pacote é para ser **extraído na raiz do repositório** Kifer Saúde, preservando a pasta `kifersaude-ui-redesign/`.

## O que contém

- **47 páginas e seções** mapeadas no inventário do CRM/site.
- **19 telas complementares** (detalhes, formulários e fluxos).
- **94 estados interativos** (modais, drawers, seletores, confirmações, assistentes e variantes) gerados como estudos visuais.
- **320 PNGs principais**: 160 contextos × desktop (1920×1080) e mobile (390×844).
- **Capturas mobile completas** de páginas e formulários selecionados em `references/mobile-full/`.
- **6 PNGs aprovados anteriormente**, preservados em `previous-approved/`, junto com três HTMLs desse primeiro lote.
- **Originais sintéticos selecionados** do inventário em `audit-samples/` para comparação funcional.
- `manifest.json`: correspondência entre rota, estado, proposta de redesign e arquivos.
- `PROMPT_CODEX.md`: instruções completas de implementação.
- `GALERIA.html`: galeria navegável sem servidor.

## A regra mais importante

Os arquivos de redesign são **referências visuais estáticas**, não especificações funcionais completas. O código atual do CRM determina campos, permissões, validações, fluxos, regras de negócio e comportamentos obrigatórios. Referências não autorizam eliminar ou inventar funcionalidades.

### Ordem de precedência do visual

1. `previous-approved/`: Gestão de Leads (lista, Kanban e novo lead). **Esse foi o visual aprovado pelo usuário.**
2. `references/desktop` e `references/mobile`: demais páginas e modais.
3. `references/mobile-full`: continuidade vertical de telas/formulários.
4. `audit-samples`: **apenas evidências da interface original**, não referência visual final.

## Navegação

Abra `GALERIA.html`, ou use `manifest.json` para localizar a rota/estado. As imagens desktop foram feitas para 1920×1080; as mobile, para 390×844.

## Escopo

O grupo `publico` é **site público**, não tela administrativa. Aplique nele a identidade visual sem forçar sidebar administrativa ou bottom navigation do CRM.

## Observações

- A auditoria original reportou 1.470 capturas e dados sintéticos.
- Nem toda variante foi desenhada com fidelidade de campos. Os componentes e formulários devem ser reconciliados com o código-fonte antes de alteração.
- Algumas referências da mesma família compartilham um template visual intencionalmente, para garantir consistência entre módulos.
- As referências de tela não estão conectadas ao banco; HTML é prévia visual independente.
- Não instale nem publique arquivos `html/`, `audit-samples/` ou `references/` na aplicação pública sem necessidade.
