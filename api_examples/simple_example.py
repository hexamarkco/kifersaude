import requests
import json


API_URL = 'https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api'
API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8'


lead_data = {
    'nome_completo': 'José Santos',
    'telefone': '11999887766',
    'email': 'jose.santos@email.com',
    'cidade': 'São Paulo',
    'origem': 'tráfego pago',
    'tipo_contratacao': 'Pessoa Física',
    'responsavel': 'Luiza',
    'observacoes': 'Lead criado via script Python simples'
}

headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {API_KEY}',
    'apikey': API_KEY,
}

print("Criando novo lead...")
response = requests.post(
    f'{API_URL}/leads',
    headers=headers,
    json=lead_data
)

print(f"Status: {response.status_code}")
print("Resposta:")
print(json.dumps(response.json(), indent=2, ensure_ascii=False))

if response.status_code == 201:
    print("\n✓ Lead criado com sucesso!")
else:
    print("\n✗ Erro ao criar lead")
