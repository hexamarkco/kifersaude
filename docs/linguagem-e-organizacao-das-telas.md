# Linguagem e organização das telas

Todas as áreas devem funcionar para quem atende clientes e opera a corretora,
inclusive pessoas sem conhecimento de programação. Este é o público de referência
também para configurações, IA, automações e mensagens de erro.

## O que mostrar primeiro

1. O trabalho da pessoa: atender, agendar, conferir dados, enviar ou acompanhar.
2. A situação atual, com palavras completas em português.
3. O impacto e uma próxima ação que exista na tela ou na navegação.
4. Números com a unidade de negócio: contatos, mensagens, contratos ou reais.

As informações de suporte ficam em áreas expansíveis identificadas. Uma tela de
operação não deve exigir que a pessoa entenda como o serviço foi implementado.
Configurações especializadas podem conservar formatos exatos, nomes de parâmetros
e códigos necessários à integração, acompanhados de explicação e indicação de que
são destinados ao responsável técnico.

## Vocabulário

| Termo de implementação | Linguagem para a operação |
| --- | --- |
| Saúde do worker | Envios automáticos: situação, última verificação e ação necessária |
| cron / process | Verificação automática / verificação de envios |
| success / running / failed | Concluída / em andamento / com problema |
| pipeline | Negociações em andamento ou funil de vendas, conforme o indicador |
| inbox / composer | WhatsApp, lista de conversas ou campo de mensagem |
| staging | Dados preparados e protegidos, com prazo e limite de uso |
| payload | Conteúdo ou dados enviados |
| prompt | Instruções da IA |
| provider / fallback | Fornecedor / alternativa automática |
| webhook | Recebimento de atualizações; configuração técnica dentro da ajuda avançada |
| opt-out | Pedido para não receber mensagens |

Não substituir nomes de campos, enums persistidos, contratos de APIs ou conteúdo
de mensagens do cliente para traduzir a interface. A apresentação faz a tradução.

## Estados e avisos

- Uma consulta que falhou deve dizer que o andamento não pôde ser consultado.
  Isso não comprova que o envio parou ou que está funcionando.
- Dados antigos precisam de indicação de atraso; ausência de dados não é zero
  nem sucesso confirmado.
- Uma verificação concluída sem falha não significa que toda a campanha terminou
  ou que as mensagens foram entregues ao destinatário.
- Envio não confirmado deve orientar a conferir a conversa antes de tentar
  novamente. Uma mudança de texto nunca pode liberar reenvio ou alterar o estado.
- Os detalhes originais do problema devem continuar disponíveis para suporte,
  em área secundária, sem transformar texto de banco ou provedor em instrução
  operacional.

## Aplicação desta revisão

A revisão percorreu os textos das rotas, componentes e configurações do frontend.
Os ajustes abrangem navegação, dashboard, contatos, WhatsApp, campanhas, contratos,
produção da equipe, IA, automações, integrações e testes de atendimento.

Os cartões de envios automáticos e de conexão do WhatsApp passaram a priorizar a
situação que interessa à operação. O histórico e os dados de configuração técnica
ficam em áreas expansíveis. Os avisos de campanhas mantêm o motivo original no
detalhe de suporte e explicam a próxima ação no texto principal.

Termos técnicos ainda necessários em arquivos de importação, instruções de
integração, identificadores de modelos e exemplos de testes permanecem no seu
contexto específico. A regra também está registrada no `AGENTS.md` para orientar
as próximas alterações.
