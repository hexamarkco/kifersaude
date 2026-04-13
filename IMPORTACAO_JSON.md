# Importacao de JSON

Este arquivo documenta os formatos de JSON de importacao identificados hoje no codigo.

Baseado em:
- `src/features/cotador/services/cotadorImportService.ts`
- `src/components/config/CotadorCatalogTab.tsx`
- `import_data.js`

## Resumo

Hoje existem 2 grupos de importacao JSON no repositorio:

1. `Cotador` no painel administrativo
2. Script legado `import_data.js`

## Cotador

O `Cotador` tem 2 entradas no painel:

- `Importar catalogo`: aceita JSON completo, com produto, tabelas e rede.
- `Importar rede hospitalar`: aceita o mesmo formato base, mas o arquivo deve estar focado em `redeHospitalar` e nao deve trazer `tabelas`.

### Formato da raiz

Formato recomendado:

```json
{
  "version": 1,
  "generatedAt": "2026-04-09T00:00:00.000Z",
  "source": "Origem do arquivo",
  "items": []
}
```

Regras da raiz:

- Use um objeto na raiz.
- O formato mais seguro e usar `items`.
- O importador tambem aceita um unico item solto na raiz, sem `items`.
- Nao use array na raiz.
- BOM e texto antes do primeiro `{` sao tolerados, mas o ideal e salvar o arquivo com JSON puro.
- `version`, `generatedAt` e `source` sao metadados opcionais.

### Campos por item

Cada item representa um produto ou um conjunto de produtos com a mesma estrutura.

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `operadora` | `string` | Sim | Se nao existir, pode ser criada automaticamente. |
| `linha` | `string` | Sim | Se nao existir na operadora, pode ser criada automaticamente. |
| `produto` | `string` | Sim, se `produtos` nao vier | Nome do produto. |
| `nome` | `string` | Nao | Alias de `produto` quando o item representa um unico produto. |
| `produtos` | `string[]` | Nao | Alternativa ao `produto`. Replica o mesmo item para varios produtos. |
| `administradora` | `string \| null` | Nao | Se nao existir, pode ser criada automaticamente. |
| `modalidadeBase` | `string` | Nao | Alias aceitos; o sistema normaliza para `PF`, `ADESAO` ou `PME`. |
| `modalidade_base` | `string` | Nao | Alias de `modalidadeBase`. |
| `abrangencia` | `string` | Nao | O sistema tenta normalizar para `Nacional`, `Regional` ou `Estadual`. |
| `acomodacoes` | `string[]` | Nao | Ex.: `Enfermaria`, `Apartamento`. |
| `entidadesElegiveis` | `string[]` | Nao | Entidades elegiveis do produto. |
| `entidades_elegiveis` | `string[]` | Nao | Alias de `entidadesElegiveis`. |
| `detalhes` | `object` | Nao | Bloco opcional com textos de apoio do produto. |
| `redeReferencia` | `object` | Nao | Usado para herdar rede de outro produto quando `redeHospitalar` nao vier. |
| `rede_referencia` | `object` | Nao | Alias de `redeReferencia`. |
| `redeHospitalar` | `object[]` | Nao | Se vier, sincroniza a rede do produto. |
| `rede_hospitalar` | `object[]` | Nao | Alias de `redeHospitalar`. |
| `tabelas` | `object[]` | Nao | Lista de tabelas comerciais do produto. |

### Campos de `detalhes`

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `carencias` | `string \| null` | Nao | Texto livre. |
| `documentosNecessarios` | `string \| null` | Nao | Texto livre. |
| `documentos_necessarios` | `string \| null` | Nao | Alias de `documentosNecessarios`. |
| `reembolso` | `string \| null` | Nao | Texto livre. |
| `informacoesImportantes` | `string \| null` | Nao | Texto livre. |
| `informacoes_importantes` | `string \| null` | Nao | Alias de `informacoesImportantes`. |

### Campos de `redeReferencia`

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `produto` | `string` | Nao | Produto de referencia para herdar rede. |
| `product` | `string` | Nao | Alias de `produto`. |
| `linha` | `string` | Nao | Linha de referencia. |
| `line` | `string` | Nao | Alias de `linha`. |
| `modalidade` | `string` | Nao | Modalidade de referencia. |
| `modality` | `string` | Nao | Alias de `modalidade`. |

### Campos de `redeHospitalar`

Cada item da rede deve seguir este formato:

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `cidade` | `string` | Recomendado | Cidade do prestador. |
| `regiao` | `string \| null` | Nao | Regiao ou macro-regiao. |
| `hospital` | `string` | Recomendado | Nome do hospital/prestador. |
| `bairro` | `string \| null` | Nao | Bairro do prestador. |
| `atendimentos` | `string[]` | Recomendado | Ex.: `Hospital`, `Maternidade`, `PS`. |
| `observacoes` | `string \| null` | Nao | Texto livre. |

### Campos de `tabelas`

| Campo | Tipo | Obrigatorio | Observacoes |
| --- | --- | --- | --- |
| `nome` | `string` | Sim | Nao pode vir vazio. |
| `codigo` | `string \| null` | Nao | Codigo opcional da tabela. |
| `modalidade` | `string` | Nao | Normalizado para `PF`, `ADESAO` ou `PME`. Se nao vier, cai em `PME`. |
| `modalidade_tabela` | `string` | Nao | Alias de `modalidade`. |
| `perfilEmpresarial` | `string` | Nao | Valores canonicos: `todos`, `mei`, `nao_mei`. Se nao vier, cai em `todos`. |
| `perfil_empresarial` | `string` | Nao | Alias de `perfilEmpresarial`. |
| `coparticipacao` | `string` | Nao | Valores canonicos: `sem`, `parcial`, `total`. Se nao vier, cai em `sem`. |
| `vidasMin` | `number` | Nao | Inteiro maior que zero, se informado. |
| `vidas_min` | `number` | Nao | Alias de `vidasMin`. |
| `vidasMax` | `number` | Nao | Inteiro maior que zero, se informado. |
| `vidas_max` | `number` | Nao | Alias de `vidasMax`. |
| `observacoes` | `string \| null` | Nao | Texto livre. |
| `ativo` | `boolean` | Nao | Se nao vier, assume `true`. |
| `precosPorAcomodacao` | `object` | Sim, se houver tabela | Mapa por acomodacao. |
| `precos_por_acomodacao` | `object` | Sim, se houver tabela | Alias de `precosPorAcomodacao`. |

### Faixas de preco aceitas em `precosPorAcomodacao`

As chaves aceitas hoje sao:

- `0-18`
- `19-23`
- `24-28`
- `29-33`
- `34-38`
- `39-43`
- `44-48`
- `49-53`
- `54-58`
- `59+`

Exemplo:

```json
{
  "Enfermaria": {
    "0-18": 269.69,
    "19-23": 315.54,
    "24-28": 384.96
  },
  "Apartamento": {
    "0-18": 299.36,
    "19-23": 350.25
  }
}
```

### Normalizacoes e aliases aceitos

O importador faz algumas normalizacoes automaticamente.

#### Modalidade

- `PF`: aceita tambem `pf`, `pessoa fisica`, `individual`, `familiar`, `individual familiar`
- `ADESAO`: aceita tambem `adesao`, `adesao coletiva`, `coletivo por adesao`, `coletivo adesao`, `coletivo por associacao`, `associacao`, `sindicato`, `entidade de classe`
- `PME`: aceita tambem `pme`, `empresarial`, `coletivo empresarial`, `empresa`, `pj`, `pessoa juridica`, `mei`

#### Perfil empresarial

- `mei`: aceita tambem `microempreendedor`
- `nao_mei`: aceita tambem `nao mei` e `nao-mei`
- `todos`: aceita tambem `all`, `geral`, `livre`

#### Coparticipacao

- `sem`: aceita tambem `sem copart`
- `parcial`: aceita tambem `copart parcial` e `parcial com copart`
- `total`: aceita tambem `copart total` e `completa`

#### Acomodacao

- `Enfermaria`: aceita tambem `enf`, `coletivo`, `quarto coletivo`, `qc`
- `Apartamento`: aceita tambem `apart`, `apto`, `particular`, `quarto particular`, `qp`, `privativo`, `quarto privativo`

#### Abrangencia

O sistema tenta normalizar automaticamente textos como:

- `nacional`, `brasil`, `todo pais`
- `regional`, `intermunicipal`, `grupo de municipios`, `metropolitana`, `local`
- `estadual`, `todo estado` e siglas/nomes de estados

### Regras importantes de comportamento

- Itens sem `operadora`, `linha` ou `produto` nao entram na importacao.
- `produtos` replica o mesmo item em varios produtos.
- Se `redeHospitalar` vier, a rede atual do produto e substituida pelo conteudo enviado.
- Se `redeHospitalar` vier como array vazio, a rede atual e limpa.
- Se `redeHospitalar` nao vier, a rede atual nao e substituida pelo modal de rede; no fluxo completo, o produto pode herdar rede de `redeReferencia` quando fizer sentido.
- `tabelas` fazem `upsert`: criam ou atualizam as linhas enviadas, mas nao apagam tabelas antigas que ficaram fora do arquivo.
- Cada acomodacao dentro de `precosPorAcomodacao` vira uma linha de tabela separada no banco.
- Se `acomodacoes` vier preenchido, as acomodacoes usadas em `precosPorAcomodacao` precisam existir nessa lista.
- O importador aceita numeros como `1234.56`, `1.234,56` e `R$ 1.234,56`.
- `operadora`, `linha`, `administradora` e `entidadesElegiveis` podem ser criadas automaticamente se ainda nao existirem.
- `entidadesElegiveis` funciona como fonte da verdade do vinculo. Se o item chegar com array vazio, o produto fica sem entidades.

### Exemplo minimo de JSON completo

```json
{
  "version": 1,
  "items": [
    {
      "operadora": "Amil",
      "linha": "Linha Selecionada",
      "produto": "S380",
      "administradora": null,
      "modalidadeBase": "PME",
      "abrangencia": "Nacional",
      "acomodacoes": ["Enfermaria", "Apartamento"],
      "entidadesElegiveis": [],
      "detalhes": {
        "carencias": "Urgencia e emergencia em 24 horas.",
        "documentosNecessarios": "RG, CPF e comprovante de residencia.",
        "reembolso": "Conforme tabela vigente.",
        "informacoesImportantes": "Produto sujeito a analise da operadora."
      },
      "redeHospitalar": [
        {
          "cidade": "Rio de Janeiro",
          "regiao": "Zona Norte",
          "hospital": "Hospital Pasteur - Meier",
          "bairro": "Meier",
          "atendimentos": ["Hospital", "Maternidade"],
          "observacoes": null
        }
      ],
      "tabelas": [
        {
          "nome": "PME Nao MEI Copart. parcial - 2 a 2 vidas",
          "codigo": "AMIL-S380-PME-NMEI-PARC-2A2",
          "modalidade": "PME",
          "perfilEmpresarial": "nao_mei",
          "coparticipacao": "parcial",
          "vidasMin": 2,
          "vidasMax": 2,
          "ativo": true,
          "precosPorAcomodacao": {
            "Enfermaria": {
              "0-18": 269.69,
              "19-23": 315.54
            },
            "Apartamento": {
              "0-18": 299.36,
              "19-23": 350.25
            }
          }
        }
      ]
    }
  ]
}
```

### Exemplo minimo de JSON focado em rede

Este formato pode ser usado no modal `Importar rede hospitalar`.

```json
{
  "version": 1,
  "items": [
    {
      "operadora": "Amil",
      "linha": "Linha Selecionada",
      "produtos": ["S380", "S450"],
      "modalidadeBase": "PME",
      "abrangencia": "Nacional",
      "acomodacoes": ["Enfermaria", "Apartamento"],
      "redeHospitalar": [
        {
          "cidade": "Rio de Janeiro",
          "regiao": "Zona Norte",
          "hospital": "Hospital Pasteur - Meier",
          "bairro": "Meier",
          "atendimentos": ["Hospital", "Maternidade"],
          "observacoes": null
        }
      ]
    }
  ]
}
```

### Arquivos de exemplo ja existentes no repositorio

- `cotador-json/amil-linha-selecionada-rede-2026-04-05.json`
- `cotador-json/amil-reajuste-tabelas-2026-04-06.json`
- `cotador-json/amil-adesao-supermed-rj-2026-04-08.json`
- `amil-adesao-supermed-rj-2026-04-09.json`

## Script legado `import_data.js`

O arquivo `import_data.js` usa 2 JSONs locais:

- `leads_data.json`
- `reminders_data.json`

Comportamento atual do script:

- Ele faz `require()` dos 2 arquivos.
- Os 2 arquivos precisam ser arrays JSON validos.
- Cada item e enviado direto para o Supabase com `upsert(..., { onConflict: 'id' })`.
- Nao existe camada de normalizacao, parse ou validacao nesse script.

Na pratica, isso significa que o JSON precisa chegar pronto no formato das tabelas `leads` e `reminders`.

### `leads_data.json`

Use um array de objetos seguindo o contrato usado no frontend em `src/lib/supabase.ts`.

Campos nao opcionais no tipo atual:

- `id`
- `nome_completo`
- `telefone`
- `data_criacao`
- `arquivado`
- `created_at`
- `updated_at`

Exemplo minimo:

```json
[
  {
    "id": "lead-001",
    "nome_completo": "Maria da Silva",
    "telefone": "21999999999",
    "data_criacao": "2026-04-09T10:00:00.000Z",
    "arquivado": false,
    "created_at": "2026-04-09T10:00:00.000Z",
    "updated_at": "2026-04-09T10:00:00.000Z"
  }
]
```

### `reminders_data.json`

Use um array de objetos seguindo o contrato usado no frontend em `src/lib/supabase.ts`.

Campos nao opcionais no tipo atual:

- `id`
- `tipo`
- `titulo`
- `data_lembrete`
- `lido`
- `prioridade`
- `created_at`

Normalmente voce tambem vai querer informar `lead_id` ou `contract_id`.

Exemplo minimo:

```json
[
  {
    "id": "reminder-001",
    "lead_id": "lead-001",
    "tipo": "follow_up",
    "titulo": "Retornar contato",
    "data_lembrete": "2026-04-10T14:00:00.000Z",
    "lido": false,
    "prioridade": "media",
    "created_at": "2026-04-09T10:00:00.000Z"
  }
]
```

## Observacao final

Se o comportamento do importador mudar no codigo, este arquivo tambem precisa ser atualizado. O contrato mais confiavel continua sendo o que esta implementado em `cotadorImportService` e em `import_data.js`.
