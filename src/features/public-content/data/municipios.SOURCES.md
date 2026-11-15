# Municípios brasileiros

Base obtida em 14/11/2026 da [API de Localidades do IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome).

O snapshot inclui 5.571 localidades das 27 UFs. Conserva o identificador IBGE, o nome do município, a UF e o nome do estado; usa a região imediata como alternativa quando a microrregião não está presente. É carregado somente quando o campo de cidade recebe interação. A busca é local e não envia o texto digitado ao IBGE.

Na próxima atualização, validar IDs únicos, nomes não vazios e presença das 27 UFs antes de substituir o JSON.
