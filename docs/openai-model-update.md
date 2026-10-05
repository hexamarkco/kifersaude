# Atualização dos modelos OpenAI

Configuração publicada e preços revisados em 1 de outubro de 2026, usando a
[documentação oficial](https://developers.openai.com/api/docs/guides/latest-model).

| Features | Modelo | Raciocínio |
| --- | --- | --- |
| Reescrita, sugestão, mensagens de fluxo, intenção, refinamento, agenda, documentos | `gpt-6-luna` | `none` |
| Follow-up | `gpt-6.1-sol` | `medium` |
| Atendimento autônomo, crítica de atendimento, cenários | `gpt-6.1-sol` | `low` |
| Transcrição | `gpt-transcribe` | Não se aplica |

A análise comercial legada não recebe configuração nem é reativada. As escolhas
ficam em `ai_feature_configs`, a mesma configuração editável em
`painel/config?tab=ai`, com novas versões ativas preservando prompts, contexto e parâmetros
operacionais. Os limites de saída do Sol reservam espaço para raciocínio interno;
o comprimento da mensagem comercial continua limitado pelas instruções do prompt.

## Preços e limites da estimativa

Preços Standard para contexto curto, em USD por milhão de tokens:

| Modelo | Entrada | Entrada em cache | Saída |
| --- | ---: | ---: | ---: |
| GPT-6 Luna | 0,10 | 0,01 | 0,50 |
| GPT-6.1 Sol | 2,00 | 0,10 | 10,00 |
| GPT-6 Astra | 10,00 | 1,00 | 50,00 |
| GPT-5.6 Sol | 4,00 | 0,40 | 20,00 |
| GPT-5.6 Terra | 2,00 | 0,20 | 12,00 |
| GPT-5.6 Luna | 0,20 | 0,02 | 1,20 |

GPT-Transcribe: USD 0,0045 por minuto. Fontes:
[preços](https://developers.openai.com/api/docs/pricing),
[Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[Luna 5.6](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

O registro de custo continua sendo uma estimativa por tokens, não uma conciliação
da fatura: não inclui escrita de cache, multiplicadores para contexto longo nem
modalidades de processamento. A transcrição não registra duração de áudio e
mantém custo desconhecido na telemetria, mesmo com preço por minuto cadastrado.
Custos históricos desconhecidos não são recalculados.

## Publicação e validação

As 14 Edge Functions dependentes do roteamento foram publicadas após autorização.
O código mantém os defaults anteriores; as escolhas por feature são configurações
do painel. A transcrição agora respeita a configuração `audio.transcribe`.
O catálogo e os preços foram atualizados por operações de dados, sem migration ou
mudança de schema. As configurações globais de integração foram preservadas.

Os 33 testes direcionados de roteamento, compatibilidade, telemetria e transcrição
passaram. Typecheck, lint e build passaram. A suíte completa teve 12 falhas
preexistentes em `chatgpt-mcp/write-actions`, por fixtures com datas vencidas.

A qualidade das respostas e o acesso da conta OpenAI aos novos modelos ainda
precisam de avaliação no sandbox e nos logs de uso. Esta publicação não executou
workers nem enviou mensagens reais para validação.

Os testes locais simulam OpenAI/Whapi. Não demonstram melhoria de qualidade do
modelo. Reativar a versão anterior por feature permite reverter escolhas sem
perder prompts. Falta de créditos exige ajuste na conta OpenAI; mudar o modelo
não resolve `credit_balance_exhausted`.
