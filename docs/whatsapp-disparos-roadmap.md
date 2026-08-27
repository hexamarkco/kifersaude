# Disparos WhatsApp

## MVP entregue

- Modulo `/painel/disparos` dentro de Comunicacao.
- Criacao de campanhas em rascunho ou agendadas.
- Publico por filtros basicos do CRM ou contatos importados por CSV.
- Opcao de CSV criar/atualizar leads no CRM em fase de processamento.
- Mensagem unica em texto com suporte planejado a variaveis como `{{nome}}`.
- Ritmo de envio por minuto e parada ao responder como configuracoes persistidas.
- Tabelas de opt-out e sugestoes de IA para bloquear disparos apos revisao humana.

## Proxima etapa: worker de envio

- Criar Edge Function `comm-whatsapp-campaign-worker`.
- Materializar publico CRM em `comm_whatsapp_campaign_targets` ao ativar campanha.
- Remover duplicados, telefones invalidos, chats mutados/excluidos e opt-outs antes de enfileirar.
- Enviar usando `comm-whatsapp-send` ou helper compartilhado com idempotencia por campanha/alvo.
- Respeitar `pacing_per_minute`, janela de envio, agendamento e pausa/cancelamento.
- Atualizar contadores e registrar eventos em `comm_whatsapp_campaign_events`.
- Parar alvos automaticamente quando houver inbound posterior ao envio da campanha.

## Evolucao IA para opt-out

- Criar Edge Function de classificacao de intenção para mensagens inbound recentes de campanhas.
- Classificar em `opt_out`, `negative_interest`, `angry_or_complaint`, `wrong_number`, `continue_conversation` ou `unclear`.
- Persistir sugestoes em `comm_whatsapp_ai_intent_suggestions` com confiança, motivo e evidência.
- Exibir sugestao no inbox para o atendente aceitar ou dispensar.
- Ao aceitar, criar/atualizar `comm_whatsapp_opt_outs` e excluir o telefone de campanhas futuras.
- Automatizar bloqueio apenas depois de validar precisão operacional.

## Evolucao de produto entregue

- Preview real do publico CRM antes de ativar, com a mensagem ja resolvida por lead de amostra.
- Templates salvos (nome + pacote de mensagens) reutilizaveis entre campanhas.
- Midias em campanha: imagem, documento e video anexados por etapa (audio ainda nao suportado).
- Sequencias multi-etapas com delays.
- Teste para numero interno antes de ativar, direto do formulario da campanha.
- Relatorio de respostas, taxa de falha e principais motivos de erro no detalhe da campanha.
- Regras de recorrencia (diaria/semanal/mensal) que rematerializam o publico de CRM automaticamente.
- Teste A/B na mensagem inicial com percentual configuravel e comparativo de taxa de resposta por variante.

## Evolucao de produto ainda pendente

- Mapeamento visual de colunas do CSV.
- Suporte a audio nas midias de campanha.
- Preview por lead individual fora da amostra (hoje limitado a 5 contatos de exemplo).
- Sequencias com regras condicionais (hoje o fluxo e sempre linear).
