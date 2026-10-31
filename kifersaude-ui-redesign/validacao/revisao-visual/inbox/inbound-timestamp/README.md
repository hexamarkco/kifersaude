# Inbox — horário em mídia recebida

Capturas do `WhatsAppMessageThread` real com imagem inbound e reação sintéticas. O recuo horizontal de 12 px agora pertence diretamente ao trecho de data/hora da mensagem, permanecendo visível quando a estrutura de mídia muda.

| Captura | Viewport/tema | Verificação |
|---|---|---|
| `desktop-light-1920.png` | 1920×1080, claro | Data/hora inseta em relação à mídia e à borda da linha. |
| `desktop-dark-1920.png` | 1920×1080, escuro | Mesmo recuo no tema escuro. |
| `tablet-light-768.png` | 768×1024, claro | Sem overflow horizontal. |
| `mobile-light-390.png` | 390×844, claro | Sem overflow horizontal; recuo computado de 12 px. |
| `mobile-320.png` | 320×640, claro | Sem overflow horizontal; recuo computado de 12 px. |
| `desktop-light-1920-after.png` | recorte do componente em uma sessão 1920×1080, claro | Captura após remover a dependência do ancestral `.whatsapp-inbox-thread`; a metadata conserva 12 px de cada lado. |

A prévia usa somente um contato, uma imagem e uma reação fictícios; não carrega conversas reais nem envia mensagens. Playwright confirmou padding de 4 px na vertical e 12 px nas laterais em 1920×1080, 768×1024, 390×844 e 320×640, sem overflow. A tela autenticada do Inbox não foi aberta nesta validação.
