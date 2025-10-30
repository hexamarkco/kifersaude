#!/bin/bash

API_URL="https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api"
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8"

echo "=== 1. Health Check ==="
curl -X GET "$API_URL/health" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json"

echo -e "\n\n=== 2. Criar Novo Lead ==="
curl -X POST "$API_URL/leads" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nome_completo": "Maria Silva",
    "telefone": "11987654321",
    "email": "maria@example.com",
    "cidade": "São Paulo",
    "origem": "tráfego pago",
    "tipo_contratacao": "Pessoa Física",
    "responsavel": "Luiza",
    "observacoes": "Lead criado via curl"
  }'

echo -e "\n\n=== 3. Buscar Leads (Status: Novo) ==="
curl -X GET "$API_URL/leads?status=Novo&limit=5" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json"

echo -e "\n\n=== 4. Buscar Leads (Responsável: Luiza) ==="
curl -X GET "$API_URL/leads?responsavel=Luiza&limit=5" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json"

echo -e "\n\n=== 5. Criar Múltiplos Leads (Batch) ==="
curl -X POST "$API_URL/leads/batch" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
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
        "email": "ana@example.com",
        "origem": "orgânico",
        "tipo_contratacao": "CNPJ",
        "responsavel": "Luiza"
      }
    ]
  }'

echo -e "\n\n=== 6. Atualizar Lead (substitua LEAD_ID pelo ID real) ==="
echo "curl -X PUT \"$API_URL/leads/LEAD_ID\" \\"
echo "  -H \"Authorization: Bearer $API_KEY\" \\"
echo "  -H \"apikey: $API_KEY\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"status\": \"Em contato\","
echo "    \"observacoes\": \"Cliente retornou ligação\""
echo "  }'"
