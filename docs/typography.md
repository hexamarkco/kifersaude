# Tipografia da Kifer Saúde

Site e backoffice usam a mesma escala, definida em `src/design-system/foundation.css`. Os temas alteram cores e superfícies, sem duplicar os tokens de tipografia.

| Papel | Família | Peso | Aplicação |
| --- | --- | --- | --- |
| Título de destaque | Sora | 500 | Hero e abertura editorial |
| Título de página ou seção principal | Sora | 600 | PageHeader e Heading de nível 2 |
| Título local | Sora | 500 | Cartões, diálogos e subseções |
| Corpo e texto de apoio | Poppins | 400 | Descrições, mensagens e tabelas |
| Rótulo | Poppins | 500 | Campos, etiquetas e contexto dos indicadores |
| Ação e identificação | Poppins | 600 | Botões, nomes de contatos e títulos de colunas |
| Indicador numérico | Poppins | 700 | Totais, KPIs e valores dos indicadores |

## Composição

Use `Heading` e `Text` com os tamanhos e tons semânticos existentes. `Heading` aceita `weight` para destaques editoriais pontuais. Evite mudar todos os títulos para o mesmo peso ou usar negrito em parágrafos inteiros.

Sora diferencia títulos e organiza a leitura. Poppins mantém a leitura rápida de controles, nomes, tabelas e dados comerciais. Calendários e rótulos operacionais continuam em Poppins, mesmo quando visualmente ocupam a posição de um título.

O corpo usa regular. Rótulos usam medium. Ações e nomes importantes usam semibold. Reserve bold para valores e ênfases curtas. Os indicadores numéricos usam algarismos tabulares para manter o alinhamento durante atualizações.

Os tamanhos de `Text` distinguem apoio de 12 px, texto compacto de 13 px, corpo de 14 px e introduções de 16 ou 18 px. As dimensões dos controles continuam definidas pelos tokens de controle.

## Itálico e carregamento

Use `em` para ênfase editorial breve. Poppins carrega os pesos de 400 a 800 em estilo normal e de 400 a 700 em itálico. Sora carrega os pesos de 400 a 700 em estilo normal. Não aplique itálico a rótulos, status, tabelas ou valores.

Na galeria `/design-system`, a seção de fundamentos mostra a escala, os quatro pesos de cada família e exemplos de uso público e operacional. Confira essa seção nos temas claro e escuro, além de verificar o site em desktop e celular.
