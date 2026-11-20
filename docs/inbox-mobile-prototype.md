# Inbox mobile — protótipo integrado

## Escopo

A rota autenticada `/painel/inbox-mobile` oferece uma **prévia mobile do Inbox real**. A rota original `/painel/inbox` permanece inalterada e não recebe a nova apresentação. Em desktop, a prévia usa largura de telefone, facilitando a revisão visual; em aparelhos estreitos utiliza toda a largura disponível.

Não é uma simulação com contatos fictícios: o protótipo reaproveita a tela e os hooks existentes do Inbox, com o mesmo canal, permissões e backend. Por isso, **ações confirmadas nessa rota alteram dados reais e podem enviar mensagens reais**. A faixa superior identifica a prévia e oferece retorno ao Inbox habitual. Não abrir em ambientes conectados à produção para testes de envio; preferir um backend de homologação para operações mutáveis.

## Inventário preservado

| Fluxo | Acesso na prévia |
| --- | --- |
| Conversas, não lidas, fixadas e silenciadas | Lista original com indicadores e menu individual |
| Arquivamento e desarquivamento | Abas Ativas/Arquivadas e menu da conversa |
| Busca por nome, telefone e mensagens | Busca no topo, resultado de mensagens e busca dentro do chat |
| Filtros de atividade, status e responsável | Filtros avançados originais, com limpar |
| Nova conversa | Ação Nova e seletor de contatos/leads/número |
| Mensagens, grupos, status de entrega, reações e histórico | Thread e ações sobre mensagens existentes |
| Resposta, encaminhamento, edição, cópia, exclusão e reenvio | Composer, seleção, menus e confirmações existentes |
| Mídia, voz, documentos, anexos, emojis e respostas rápidas | Composer, visualizador e gerenciadores existentes |
| Agenda e lembretes | Atalho Agenda e painel do contato, conforme permissões |
| Programação de mensagens e mensagens agendadas | Atalhos Programar/Agendadas e painéis originais |
| Informações do contato e CRM | Atalho Contato, painel com status, responsável, contratos, vinculação e lembretes |
| IA, follow-up, ajuste de texto e atendimento autônomo | Atalho de follow-up, menu completo e ações do composer |
| Arquivos, cópia e recuperação de histórico | Menu completo da conversa |
| Painel WhatsApp e indicadores operacionais | Barra de ferramentas da lista e banner original de conexão |

## Decisões técnicas

- **UI apenas**: nenhum novo endpoint, migration, banco, token, serviço de envio ou regra comercial.
- **Rota isolada**: `PainelWrapper` trata `inbox-mobile` com as mesmas permissões e layout full-bleed de `inbox`; o mesmo `WhatsAppInboxWrapper` e `WhatsAppInboxScreen` controlam ambos.
- **Ações reais reutilizadas**: `WhatsAppInboxMobileShortcuts` apresenta atalhos para callbacks já existentes, sem duplicação de lógica.
- **Design System**: componentes e tokens semânticos da biblioteca em `src/design-system`; CSS isolado pela classe `is-mobile-prototype`.
- **Navegação**: a lista abre a thread; voltar retorna à lista. O painel do contato ocupa a área de trabalho estreita e mantém o fechar original. Em grupos, ações de lead e follow-up não aparecem.
- **Segurança**: controles de permissão e bloqueio permanecem os do Inbox atual; atalhos sem callback ficam desabilitados. O protótipo não inicia envios, reprocessamentos ou automações ao ser aberto.

## Aceite e validação

1. Conferir autenticação/permissão e abertura direta de `/painel/inbox-mobile` com e sem `?chatId=...`.
2. Verificar lista, seleção e retorno, abas Ativas/Arquivadas, busca por mensagens e filtros.
3. Verificar telas 320px, 390px, 430px e desktop, temas claro/escuro, teclado virtual, rolagem e áreas seguras.
4. Verificar individual e grupo; testar menus, anexos, ações de mensagem, contato, agendamento e geração de follow-up em ambiente **não produtivo**.
5. Executar `npm run typecheck`, `npm run lint`, `npm test`, `npm run audit:design-system`, `npm run audit:visual` e `npm run build` em checkout da branch.

A entrega desta branch **não autoriza merge nem deploy em produção**.
