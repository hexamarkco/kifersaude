# Inbox em toda a área disponível

Removidos padding externo e cabeçalho de página duplicado. O título continua acessível a leitores de tela; iniciar conversa permanece na barra da lista. Lista e histórico se ajustam ao espaço restante, com o campo de mensagem ancorado abaixo do histórico. Em mobile, a navegação inferior mantém sua área reservada.

Playwright: 16 cenários (lista e conversa × claro e escuro × 1920, 768, 390 e 320 px), com dados fictícios e escritas/integrações bloqueadas. Confirmados: limites do inbox iguais aos da área disponível, ausência de overflow da página e campo de mensagem dentro da área útil. Abertura e fechamento do diálogo de nova conversa também verificados, sem criar registros ou enviar mensagens.

As imagens usam o padrão `inbox-{dispositivo}-{tema}-{lista|conversa}.png`. Medidas registradas em `coverage.json`.

Typecheck, lint, build e suas auditorias aprovados. Dois testes existentes de viewport/teclado virtual aprovados. O aviso preexistente de tamanho de chunk do Vite permanece.
