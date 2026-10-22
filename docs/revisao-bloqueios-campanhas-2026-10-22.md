# Revisão dos bloqueios de campanhas — 22/10/2026

## Escopo e resultado

Revisão somente de leitura dos dois motivos exibidos no detalhe da campanha
`663279e5-739c-4efc-916e-cdf13142a458`. Horários abaixo em `America/Sao_Paulo`.
Nenhum contato foi liberado, marcado como entregue ou colocado novamente na fila.

| Motivo exibido | Contatos | Etapas por contato | Estado observado |
| --- | ---: | ---: | --- |
| Envio anterior com resultado incerto | 7 | 6 | Etapas `uncertain`, sem identificador do provedor nem checkpoint de persistência |
| Etapas do grupo sem confirmação registrada | 1 | 6 | Evento de conclusão do grupo, mas suas seis etapas ficaram `uncertain` e sem confirmação |

São 48 etapas isoladas nesses oito contatos. Outra campanha,
`96da372c-b76d-4e12-a4e5-a93b6c60c084`, apresenta mais sete contatos com o primeiro
motivo; eles também precisam ser considerados numa recuperação posterior.

## Causas encontradas

### Retorno ausente na transição de despacho

A versão original de `advance_step_dispatch` declarava `RETURNS TABLE`, atualizava
a etapa e terminava sem `RETURN NEXT` ou `RETURN QUERY`. O worker recebia uma lista
vazia. Seu código anterior interpretava a ausência de `oldStatus` como uma etapa
a pular, prosseguia pelas demais mensagens e podia emitir `target_sent` ao final
sem passar pela chamada de envio.

O reconciliador encontrava posteriormente as etapas em `sending`, não obtinha
confirmação e as convertia em `uncertain`. O evento de conclusão do grupo, por si
só, não demonstra aceitação das mensagens pelo provedor.

### Identificador externo usado como UUID interno

Nos sete contatos do primeiro grupo, os eventos anteriores registram erro de
conversão para UUID ao atualizar o alvo. O código usava o identificador externo
da conversa no campo `comm_whatsapp_campaign_targets.chat_id`, que exige o UUID
interno. Esses eventos não são respostas de falha de entrega do provedor.

## Correções existentes verificadas

- `637df0ad`: preserva o UUID interno da conversa ao concluir o burst.
- `13b9c60c`: mantém envios ambíguos fora das tentativas automáticas.
- `d3163772`: exige uma transição de estado confirmada antes de enviar e confirma
  a gravação de `sent` antes de avançar o alvo.
- A função remota atual contém `RETURN NEXT` e devolve o estado efetivamente
  gravado por `RETURNING dispatch.id, dispatch.status`.

A migration local da última correção é
`20261022142800_fix_step_dispatch_transition_result.sql`. O histórico remoto a
registra como `20261022142917`, com o mesmo nome. Essa divergência de versão é
anterior à revisão e não foi alterada.

Depois da correção de 11h29, a campanha da imagem apresentou 15 contatos com
90 etapas em `sent`; todas as 90 possuíam identificador do provedor e checkpoint
de persistência. Os oito contatos isolados continuam sendo uma pendência do
incidente anterior.

## Evidência disponível e limite da conclusão

Os oito contatos não têm `chat_id` nem `external_message_id` no alvo. As consultas
não encontraram mensagens vinculadas por `campaign_target_id` nem conversas com
o mesmo telefone exato no cache local. Um dos oito tem `sent_at`, preenchido pelo
caminho antigo que emitia a conclusão do grupo sem validar as etapas.

O histórico do código explica os falsos estados de conclusão e os bloqueios.
A ausência de mensagens no cache local não comprova, sozinha, ausência de envio
no WhatsApp. Esta revisão não consultou o histórico remoto da Whapi e não confirmou
entrega nem ausência de envio dos oito contatos.

## Recuperação proposta

1. Consultar o histórico do provedor por destinatário e janela do incidente,
   conferindo texto/mídia, direção e identificador por etapa. Uma confirmação
   ambígua ou a ausência apenas no cache não autoriza reenvio.
2. Quando houver confirmação única, reconciliar a etapa com o identificador
   encontrado e avançar somente as etapas comprovadas, sem reenviar mensagens.
3. Quando for comprovado que o envio não ocorreu, preparar a volta à fila dos
   contatos correspondentes com auditoria, controle de concorrência e preservação
   da admissão, limites e cadência existentes. A execução exige autorização para
   os envios reais que o worker poderá iniciar.
4. Manter os casos inconclusivos em revisão, com o motivo e a evidência visíveis.

Uma ação de revisão deve apresentar as evidências e o efeito exato por contato.
O botão genérico de processar lote não resolve essa pendência de confirmação.
