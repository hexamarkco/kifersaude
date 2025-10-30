# Kifer Saúde - API de Leads

API REST para gerenciamento de leads do sistema Kifer Saúde. Esta API permite criar, buscar e atualizar leads através de scripts externos em Python ou qualquer outra linguagem.

## URL da API

```
https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api
```

## Autenticação

Todas as requisições devem incluir os seguintes headers de autenticação:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8
apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8
```

**Importante:** Ambos os headers são obrigatórios para autenticação nas Edge Functions do Supabase.

## Endpoints Disponíveis

### 1. Health Check

Verifica se a API está funcionando.

**Método:** `GET`
**URL:** `/health`

**Exemplo:**
```bash
curl -X GET "https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api/health" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "apikey: SUA_API_KEY"
```

**Resposta:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-13T10:30:00.000Z",
  "service": "leads-api"
}
```

---

### 2. Criar Lead

Cria um novo lead no sistema.

**Método:** `POST`
**URL:** `/leads`

**Campos Obrigatórios:**
- `nome_completo` (string): Nome completo do lead
- `telefone` (string): Telefone de contato
- `origem` (string): Origem do lead - valores: `"tráfego pago"`, `"Telein"`, `"indicação"`, `"orgânico"`
- `tipo_contratacao` (string): Tipo de contratação - valores: `"Pessoa Física"`, `"MEI"`, `"CNPJ"`, `"Adesão"`
- `responsavel` (string): Responsável pelo lead - valores: `"Luiza"`, `"Nick"`

**Campos Opcionais:**
- `email` (string): E-mail do lead
- `cidade` (string): Cidade
- `regiao` (string): Região/Estado
- `operadora_atual` (string): Operadora atual do cliente
- `status` (string): Status do lead - valores: `"Novo"`, `"Em contato"`, `"Cotando"`, `"Proposta enviada"`, `"Fechado"`, `"Perdido"` (padrão: `"Novo"`)
- `proximo_retorno` (string): Data/hora do próximo retorno (formato ISO 8601)
- `observacoes` (string): Observações adicionais

**Exemplo:**
```bash
curl -X POST "https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api/leads" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Maria Silva",
    "telefone": "11987654321",
    "email": "maria@example.com",
    "cidade": "São Paulo",
    "origem": "tráfego pago",
    "tipo_contratacao": "Pessoa Física",
    "responsavel": "Luiza",
    "observacoes": "Interessada em plano familiar"
  }'
```

**Resposta de Sucesso (201):**
```json
{
  "success": true,
  "message": "Lead criado com sucesso",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "nome_completo": "Maria Silva",
    "telefone": "11987654321",
    "email": "maria@example.com",
    ...
  }
}
```

**Resposta de Erro (400):**
```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    "Campo \"nome_completo\" é obrigatório e deve ser uma string",
    "Campo \"origem\" deve ser um dos valores: tráfego pago, Telein, indicação, orgânico"
  ]
}
```

---

### 3. Buscar Leads

Lista leads com filtros opcionais.

**Método:** `GET`
**URL:** `/leads`

**Parâmetros Query (opcionais):**
- `status` (string): Filtrar por status
- `responsavel` (string): Filtrar por responsável
- `telefone` (string): Buscar por telefone específico
- `email` (string): Buscar por e-mail (busca parcial)
- `limit` (number): Limitar quantidade de resultados (padrão: 100)

**Exemplo:**
```bash
curl -X GET "https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api/leads?status=Novo&responsavel=Luiza&limit=10" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "apikey: SUA_API_KEY"
```

**Resposta:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "nome_completo": "Maria Silva",
      "telefone": "11987654321",
      "status": "Novo",
      ...
    },
    ...
  ]
}
```

---

### 4. Atualizar Lead

Atualiza informações de um lead existente.

**Método:** `PUT`
**URL:** `/leads/{lead_id}`

**Parâmetros:**
- Qualquer campo do lead pode ser atualizado (exceto `id`, `created_at`)

**Exemplo:**
```bash
curl -X PUT "https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api/leads/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Em contato",
    "observacoes": "Cliente retornou ligação"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Lead atualizado com sucesso",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "Em contato",
    ...
  }
}
```

---

### 5. Criar Múltiplos Leads (Batch)

Cria vários leads de uma vez.

**Método:** `POST`
**URL:** `/leads/batch`

**Body:**
```json
{
  "leads": [
    {
      "nome_completo": "João Pereira",
      "telefone": "11912345678",
      "origem": "indicação",
      "tipo_contratacao": "MEI",
      "responsavel": "Nick"
    },
    {
      "nome_completo": "Ana Costa",
      "telefone": "11923456789",
      "origem": "orgânico",
      "tipo_contratacao": "CNPJ",
      "responsavel": "Luiza"
    }
  ]
}
```

**Exemplo:**
```bash
curl -X POST "https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api/leads/batch" \
  -H "Authorization: Bearer SUA_API_KEY" \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @leads_batch.json
```

**Resposta:**
```json
{
  "success": true,
  "message": "Processados 2 leads: 2 sucesso, 0 falhas",
  "results": {
    "success": [
      {
        "index": 0,
        "data": { "id": "...", "nome_completo": "João Pereira", ... }
      },
      {
        "index": 1,
        "data": { "id": "...", "nome_completo": "Ana Costa", ... }
      }
    ],
    "failed": []
  }
}
```

---

## Usando Python

### Instalação

```bash
pip install -r requirements.txt
```

### Exemplo Simples

```python
import requests

API_URL = 'https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api'
API_KEY = 'SUA_API_KEY'

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}',
    'apikey': API_KEY,
}

lead_data = {
    'nome_completo': 'José Santos',
    'telefone': '11999887766',
    'email': 'jose@email.com',
    'origem': 'tráfego pago',
    'tipo_contratacao': 'Pessoa Física',
    'responsavel': 'Luiza',
}

response = requests.post(
    f'{API_URL}/leads',
    headers=headers,
    json=lead_data
)

print(response.json())
```

### Cliente Python Completo

Use a classe `KiferLeadsAPI` do arquivo `python_client.py`:

```python
from python_client import KiferLeadsAPI

api = KiferLeadsAPI(API_URL, API_KEY)

result = api.create_lead(
    nome_completo='João da Silva',
    telefone='11987654321',
    email='joao@example.com',
    origem='tráfego pago',
    tipo_contratacao='Pessoa Física',
    responsavel='Luiza'
)

print(result)
```

### Importar Leads de CSV

```bash
python csv_import.py leads_example.csv
```

O arquivo CSV deve ter as seguintes colunas:
- **Obrigatórias:** `nome_completo`, `telefone`, `origem`, `tipo_contratacao`, `responsavel`
- **Opcionais:** `email`, `cidade`, `regiao`, `operadora_atual`, `status`, `observacoes`

---

## Códigos de Resposta HTTP

- `200` - OK (sucesso em GET ou PUT)
- `201` - Created (lead criado com sucesso)
- `400` - Bad Request (dados inválidos)
- `404` - Not Found (endpoint ou recurso não encontrado)
- `500` - Internal Server Error (erro no servidor)

---

## Validações

### Telefone
- O telefone será normalizado automaticamente (remove caracteres especiais)
- Exemplo: `(11) 98765-4321` → `11987654321`

### E-mail
- Deve ser um e-mail válido no formato `usuario@dominio.com`

### Campos Enum
Os seguintes campos aceitam apenas valores específicos:

**origem:**
- `tráfego pago`
- `Telein`
- `indicação`
- `orgânico`

**tipo_contratacao:**
- `Pessoa Física`
- `MEI`
- `CNPJ`
- `Adesão`

**responsavel:**
- `Luiza`
- `Nick`

**status:**
- `Novo`
- `Em contato`
- `Cotando`
- `Proposta enviada`
- `Fechado`
- `Perdido`

---

## Exemplos Práticos

### 1. Executar Exemplo Simples
```bash
python simple_example.py
```

### 2. Testar Cliente Completo
```bash
python python_client.py
```

### 3. Importar CSV
```bash
python csv_import.py leads_example.csv
```

### 4. Testar com cURL
```bash
bash curl_examples.sh
```

---

## Troubleshooting

### Erro 400: "Dados inválidos"
- Verifique se todos os campos obrigatórios foram preenchidos
- Confirme que os valores enum estão corretos (com acentuação e capitalização)

### Erro 401: "Missing authorization header" ou "Unauthorized"
- Verifique se ambos os headers `Authorization` e `apikey` estão presentes
- O header `Authorization` deve seguir o formato: `Bearer [SUA_API_KEY]`
- Ambos os headers devem usar a mesma chave de API

### Erro 500: "Erro interno do servidor"
- Verifique os logs da Edge Function
- Entre em contato com o suporte técnico

---

## Suporte

Para dúvidas ou problemas com a API, entre em contato com a equipe de desenvolvimento.

**Versão:** 1.0
**Última atualização:** Outubro 2025
