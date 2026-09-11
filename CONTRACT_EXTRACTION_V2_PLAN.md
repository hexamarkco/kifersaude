# Contract Extraction V2 - plano de implementação

## Resumo e baseline

`contract.document_extract` hoje envia todos os PDFs integrais como `input_file` para a OpenAI Responses API. A amostra de telemetria da auditoria registrou 7 execuções, cerca de 6,24 milhões de tokens de entrada e média de aproximadamente 891 mil tokens por extração. A API pública retorna 15 campos de contrato, 16 campos do titular, contagens e avisos; o frontend exibe uma revisão antes de aplicar os valores.

A V2 mantém esse contrato de compatibilidade e muda o trabalho pesado para código determinístico: extrai a camada textual no Edge, detecta a família, seleciona seções, normaliza e valida. A OpenAI passa a receber apenas campos não resolvidos e trechos candidatos. PDF multimodal será fallback de último nível e conterá somente um subconjunto de páginas.

## Corpus analisado

Foram analisados 9 PDFs reais, 427 páginas. Todos têm camada textual utilizável; uma página isolada do documento Supermed não retornou texto. Nenhum PDF real será copiado para o repositório e nenhuma informação pessoal será usada em documentação, comentários, logs ou fixtures.

| Corpus | Família | Tipo | Papel | Páginas úteis observadas | Suporte |
| --- | --- | --- | --- | ---: | --- |
| Assim A | `hcommerce` | `collective_business` | `beneficiaries` | 1-3 | `SUPPORTED_PROFILE` |
| Assim B | `hcommerce` | `collective_business` | `company` | 1-4 | `SUPPORTED_PROFILE` |
| Klini A | `hcommerce` | `collective_business` | `beneficiaries` | 1-3 | `SUPPORTED_PROFILE` |
| Klini B | `hcommerce` | `collective_business` | `company` | 1-6 | `SUPPORTED_PROFILE` |
| Leve | `planium` | `individual_proposal` | `proposal` | 1-3 | `SUPPORTED_PROFILE` |
| Qualicorp | `qualicorp` | `collective_membership` | `proposal` | 1-3 | `SUPPORTED_PROFILE` |
| Supermed | `supermed` | `collective_membership` | `contract` | 1, 4-7 | `SUPPORTED_PROFILE` |
| Porto | `porto` | `pme_quote` | `quote` | 1-3 | `SUPPORTED_PROFILE` |
| MedSênior | `medsenior` | `individual_contract` | `contract` | 1-3 e proposta anexada | `SUPPORTED_PROFILE` |

Amil, SulAmérica e Bradesco não recebem parser próprio nesta etapa. Se reconhecidas fora dos formatos comprovados, usam `GENERIC_FALLBACK`.

## Contrato real do formulário

### Campos obrigatórios ao salvar

- `codigo_contrato`
- `status` (não vem do documento)
- `modalidade`
- `operadora`
- `produto_plano`
- `responsavel` (não vem do documento)

### Campos opcionais importáveis

- Contrato: `abrangencia`, `acomodacao`, `data_inicio`, `mes_reajuste`, `carencia`, `mensalidade_total`, `vidas`.
- Empresa cliente, somente em `Empresarial`/`PME`: `cnpj`, `razao_social`, `nome_fantasia`, `endereco_empresa`.
- Titular: nome, CPF, RG, nascimento, sexo, estado civil, telefone, e-mail, CEP, endereço, número, complemento, bairro, cidade, UF e CNS.

Modalidade, abrangência, acomodação e carência usam opções configuráveis na UI. A extração continuará emitindo os valores canônicos já aceitos pelo formulário; a seleção final permanece revisável. Operadora e produto são relacionamentos operacionais por nome, resolvidos posteriormente pela UI/banco.

## Detecção e âncoras

### HCommerce

- Família: `Proposta de Admissão - Coletivo Empresarial` combinada com blocos de empresa ou beneficiário.
- Operadora: marca textual Assim Saúde ou Klini Saúde.
- `company`: `EMPRESA CONTRATANTE`, `DADOS CADASTRAIS`, `ENDEREÇO DE FATURAMENTO`, `REPRESENTANTE LEGAL`, `PLANOS ADERIDOS/PRODUTOS CONTRATADOS`.
- `beneficiaries`: `DADOS DO BENEFICIÁRIO TITULAR`, `DADOS DO BENEFICIÁRIO DEPENDENTE`, `INFORMAÇÕES SOBRE O PAGAMENTO`.
- Bundle: identificador `PJ...` extraído do conteúdo, nunca do nome ou da ordem dos arquivos. Bundles com chaves diferentes são rejeitados como conflito; arquivos parciais retornam aviso de incompletude.

### Planium / Leve

- Família: `PROPOSTA DE CONTRATAÇÃO - PF`, estrutura Planium e marca Leve.
- Seções: cadastro do contratante, dependentes, responsável pelo contrato e `Resumo da contratação`.
- O resumo fornece proposta, plano, registro ANS, vigência, acomodação, abrangência, coparticipação, quantidade e valor total sem percorrer condições gerais.

### Qualicorp

- Família/administradora: Qualicorp + `Contrato de Adesão`.
- Operadora é extraída separadamente do cabeçalho.
- Seções: proponente titular, endereço, plano pretendido e valor por proponente.
- A linha marcada na coluna de seleção é a única fonte válida para produto e acomodação.

### Supermed

- Administradora: Supermed; operadora é extraída separadamente.
- Seções: cabeçalho de proposta/vigência, `Dados Cadastrais`, `Produtos e Valores` e `Plano Saúde`.
- Páginas institucionais, regras e tabelas gerais de coparticipação recebem peso negativo.

### Porto

- Família: Porto; subtipo estrito `pme_quote` pelas âncoras `Indicativo de Preços Saúde - PME` e `Orçamento de Plano de Saúde`.
- Extrai empresa/CNPJ, vigência, plano, vidas, acomodação, coparticipação, abrangência e `Valor total mensal`.
- Número de orçamento/estudo fica em metadado de origem e não vira `codigo_contrato`.
- A amostra não sustenta dados individuais de beneficiários.

### MedSênior

- Família/operadora: marca MedSênior/Samedil e registro ANS do produto.
- Tipo: contrato individual/familiar.
- Seções: capa com número, qualificação/tipo do plano, nome comercial, acomodação e abrangência; proposta anexada quando presente.
- A razão social Samedil não substitui o nome comercial MedSênior. Dados ausentes no documento permanecem ausentes.

## Pipeline

1. Validar quantidade, assinatura PDF e limites em bytes.
2. Calcular SHA-256 por arquivo.
3. Extrair texto página a página, sequencialmente, com limite defensivo de páginas.
4. Medir qualidade textual sem persistir conteúdo.
5. Detectar família, operadora, administradora, tipo e papel.
6. Validar bundle HCommerce por identificador comum.
7. Pontuar páginas por âncoras positivas e negativas, sem regra absoluta de número.
8. Extrair valores rotulados, normalizar e validar CPF/CNPJ/data/valor/contagem.
9. Mesclar candidatos iguais; conflitos ficam sem valor e são explicitados.
10. Chamar LLM apenas para campos relevantes ainda ausentes/ambíguos, com schema dinâmico e trechos limitados.
11. Em PDF sem texto, construir um PDF reduzido com páginas representativas e usar uma única chamada multimodal.
12. Validar novamente, anexar proveniência e retornar a resposta compatível.

## Proveniência e confiança

Cada valor pode registrar `fileId`, página, seção e método (`deterministic`, `text_parser`, `llm_text`, `llm_vision`). Não haverá percentual de confiança inventado. Estados são `resolved`, `missing`, `ambiguous` ou `conflicting`, derivados de quantidade de candidatos, formato e consistência.

## Cache

Cache privado, acessível apenas por service role, com chave composta por hashes ordenados dos PDFs, override de perfil, versão do parser, versão do prompt e modelo. A identidade do bundle é independente da ordem de upload. Falha ou ausência da migration não derruba a extração; apenas desativa o cache até o schema ser aplicado.

## Telemetria sem PII

Uma execução registra família, tipo, papéis, operadora, administradora, status de suporte, arquivos/páginas, páginas candidatas e enviadas, qualidade textual, bundle, uso de LLM/visão, motivo de fallback, tokens de entrada/cache/saída/raciocínio, custo estimado, retry, duração, contagem dos estados de campo e cache hit. Texto, páginas e valores nunca entram na telemetria.

## Testes e evals

- Fixtures permanentes são sintéticas e cobrem os mesmos rótulos/estruturas, sem copiar pessoas, documentos ou números reais.
- Testes por família cobrem detecção, campos, ausências, administradora x operadora, mensalidade correta e falsos positivos.
- HCommerce cobre ordem invertida, bundle parcial e contratos conflitantes.
- Generic cobre operadores sem perfil, texto parcial, ausência de texto e conflitos.
- A avaliação local do corpus real reportará apenas métricas agregadas e campos resolvidos, nunca valores.

## Estimativa de tokens

| Caminho | Entrada estimada | Saída estimada | Redução vs. 891k |
| --- | ---: | ---: | ---: |
| Conhecido, resolvido por parser | 0 | 0 | 100% |
| Conhecido com fallback textual | 2k-10k | 0,2k-1k | 98,8%-99,8% |
| Escaneado com fallback seletivo | 15k-80k | 0,3k-1k | 91%-98% |

No corpus atual, por ter camada textual, a expectativa é reduzir mais de 98% dos tokens de `contract.document_extract`. Em produção, considerando formatos desconhecidos e scans, a faixa recomendada é 90%-98%, mantendo uma única tentativa cara.

### Avaliação local do corpus real

A V2 foi executada localmente sobre os nove PDFs sem chamar a OpenAI e sem imprimir ou persistir valores extraídos. As sete unidades contratuais (dois bundles e cinco documentos únicos), somando 427 páginas, foram classificadas corretamente; todas apresentaram camada textual `good`. O fallback textual recebe de 2 a 8 páginas candidatas e de 2.986 a 24.000 caracteres — aproximadamente 0,8k a 6k tokens de texto antes do prompt/schema, contra a média histórica de 891k tokens de entrada.

| Unidade | Família | Páginas totais | Páginas candidatas | Caracteres selecionados | PDF integral enviado |
| --- | --- | ---: | ---: | ---: | --- |
| Assim | `hcommerce` | 82 | 8 | 13.409 | não |
| Klini | `hcommerce` | 95 | 8 | 11.114 | não |
| Leve | `planium` | 56 | 2 | 2.986 | não |
| Qualicorp | `qualicorp` | 82 | 8 | 24.000 | não |
| Supermed | `supermed` | 54 | 8 | 16.448 | não |
| Porto | `porto` | 15 | 5 | 8.798 | não |
| MedSênior | `medsenior` | 43 | 8 | 17.482 | não |

O parser determinístico resolveu sozinho os identificadores de bundle, modalidade, operadora e diversos campos de plano. Todos os formatos do corpus ainda acionariam um fallback textual curto para completar campos críticos: isso é intencionalmente conservador nesta versão, porque valores sem evidência clara não são promovidos apenas para eliminar a chamada. Porto ficou a apenas dois campos da resolução integral. Nenhum PDF completo seria enviado nesse corpus.

## Riscos e mitigação

- Ordem do texto em tabelas pode variar entre geradores de PDF: extração por rótulo é combinada com seções e fallback textual.
- Checkbox visual pode não existir como caractere: Qualicorp cai para fallback seletivo se a linha marcada não for inequívoca.
- Scans sem camada textual: limite de páginas multimodais e aviso de cobertura incompleta.
- Documento híbrido/múltiplas vendas: conflito de bundle interrompe consolidação.
- Cache contém resultado operacional com PII: tabela privada, sem políticas de leitura para clientes, prazo de expiração e nenhuma telemetria de valores.
- Mudanças de layout: `GENERIC_FALLBACK`, métricas de fallback e versões explícitas permitem evolução sem alterar o core.
