# Meta ativa: redesign integral do Kifer Saúde

Registrada em 27/10/2026 a pedido do usuário. Esta meta reabre a revisão visual de todas as interfaces; capturas e verificações anteriores permanecem como evidências históricas.

## Resultado obrigatório

Todas as páginas reais, modais, drawers, menus, formulários e estados devem corresponder à direção visual das referências do prompt original. O escopo inclui interfaces encontradas no código que não constem do manifesto. Corrigir componentes isolados ou aplicar tokens não basta para concluir o redesign de uma tela.

## Fontes de verdade

1. Preservar o código atual para campos, funcionalidades, validações, permissões, cálculos, integrações, dados e persistência.
2. Aplicar as orientações posteriores do usuário, incluindo raios semi-arredondados, controles consistentes, alinhamento dos textos, dicas nos ícones de informação e inbox ocupando toda a área disponível.
3. Em 28/10/2026, o usuário confirmou explicitamente que `kifersaude-ui-redesign/references/` é o resultado visual esperado para o design system e o layout de todas as páginas e modais.
4. Para listagem, Kanban e cadastro de leads, priorizar `previous-approved/` quando houver uma versão aprovada específica; ela continua sujeita à direção visual geral confirmada acima.
5. Para os demais módulos, usar `references/desktop/` e `references/mobile/`, consultando `manifest.json`, `GALERIA.html` e os PNGs correspondentes.
6. Usar `audit-samples/` para conferir que nenhuma ação ou campo desapareceu.
7. Toda solução visual deve usar os componentes e tokens oficiais do `/design-system`. Documentar no showcase qualquer padrão reutilizável novo. Manter o site institucional separado do shell do CRM.

## Execução e conclusão por interface

- Revisar por módulos, começando pela base compartilhada e leads, seguindo para inbox, contratos/clientes/agenda/comissões, campanhas/automações/IA/integrações e configurações/conteúdo/demais rotas.
- Mapear cada interface real para componente, referência e evidência aplicada. Distinguir implementação, teste funcional, captura e revisão de aderência visual.
- Comparar referência e implementação, conferindo composição, hierarquia, densidade, tipografia, alinhamento, espaçamentos, raios, botões e navegação.
- Verificar páginas e overlays em 1920×1080, 768×1024, 390×844 e 320×640; temas claro e escuro, teclado/foco, loading, vazio, erro, validação, seleção e permissão restrita.
- Não aceitar overflow acidental, ações encobertas, textos desalinhados ou componentes incompatíveis com o padrão oficial.
- Não remover funcionalidades para copiar uma referência incompleta. Registrar as adaptações necessárias preservando o comportamento comercial.
- Atualizar `STATUS_IMPLEMENTACAO.md` com pendências concretas e evidências por interface. Não reutilizar a classificação histórica “validado” como aprovação visual desta nova rodada.
- Executar os gates pertinentes e fazer commit e push a cada entrega. Usar dados fictícios na validação e bloquear escritas reais, envios e automações.

A meta permanece aberta até que todas as interfaces identificadas estejam redesenhadas e visualmente verificadas, sem pendências de implementação ou validação. A contagem de screenshots e o sucesso do build, isoladamente, não comprovam essa conclusão.
