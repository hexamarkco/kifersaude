import requests
from typing import Optional, Dict, List, Any
from datetime import datetime
import json


class KiferLeadsAPI:
    def __init__(self, api_url: str, api_key: str):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
            'apikey': api_key,
        }

    def create_lead(
        self,
        nome_completo: str,
        telefone: str,
        origem: str,
        tipo_contratacao: str,
        responsavel: str,
        email: Optional[str] = None,
        cidade: Optional[str] = None,
        regiao: Optional[str] = None,
        operadora_atual: Optional[str] = None,
        status: str = 'Novo',
        proximo_retorno: Optional[str] = None,
        observacoes: Optional[str] = None,
    ) -> Dict[str, Any]:
        data = {
            'nome_completo': nome_completo,
            'telefone': telefone,
            'origem': origem,
            'tipo_contratacao': tipo_contratacao,
            'responsavel': responsavel,
            'status': status,
        }

        if email:
            data['email'] = email
        if cidade:
            data['cidade'] = cidade
        if regiao:
            data['regiao'] = regiao
        if operadora_atual:
            data['operadora_atual'] = operadora_atual
        if proximo_retorno:
            data['proximo_retorno'] = proximo_retorno
        if observacoes:
            data['observacoes'] = observacoes

        response = requests.post(
            f'{self.api_url}/leads',
            headers=self.headers,
            json=data,
        )

        return response.json()

    def get_leads(
        self,
        status: Optional[str] = None,
        responsavel: Optional[str] = None,
        telefone: Optional[str] = None,
        email: Optional[str] = None,
        limit: int = 100,
    ) -> Dict[str, Any]:
        params = {'limit': limit}

        if status:
            params['status'] = status
        if responsavel:
            params['responsavel'] = responsavel
        if telefone:
            params['telefone'] = telefone
        if email:
            params['email'] = email

        response = requests.get(
            f'{self.api_url}/leads',
            headers=self.headers,
            params=params,
        )

        return response.json()

    def update_lead(self, lead_id: str, **kwargs) -> Dict[str, Any]:
        response = requests.put(
            f'{self.api_url}/leads/{lead_id}',
            headers=self.headers,
            json=kwargs,
        )

        return response.json()

    def create_leads_batch(self, leads: List[Dict[str, Any]]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.api_url}/leads/batch',
            headers=self.headers,
            json={'leads': leads},
        )

        return response.json()

    def health_check(self) -> Dict[str, Any]:
        response = requests.get(
            f'{self.api_url}/health',
            headers=self.headers,
        )

        return response.json()


if __name__ == '__main__':
    API_URL = 'https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api'
    API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8'

    api = KiferLeadsAPI(API_URL, API_KEY)

    print("=== Teste 1: Health Check ===")
    health = api.health_check()
    print(json.dumps(health, indent=2, ensure_ascii=False))

    print("\n=== Teste 2: Criar Lead Simples ===")
    result = api.create_lead(
        nome_completo='João da Silva',
        telefone='11987654321',
        email='joao@example.com',
        cidade='São Paulo',
        regiao='SP',
        origem='tráfego pago',
        tipo_contratacao='Pessoa Física',
        responsavel='Luiza',
        observacoes='Lead de teste via API Python'
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))

    print("\n=== Teste 3: Buscar Leads ===")
    leads = api.get_leads(status='Novo', limit=5)
    print(json.dumps(leads, indent=2, ensure_ascii=False))

    print("\n=== Teste 4: Criar Múltiplos Leads (Batch) ===")
    batch_leads = [
        {
            'nome_completo': 'Maria Santos',
            'telefone': '11912345678',
            'email': 'maria@example.com',
            'origem': 'indicação',
            'tipo_contratacao': 'MEI',
            'responsavel': 'Nick',
        },
        {
            'nome_completo': 'Pedro Oliveira',
            'telefone': '11923456789',
            'origem': 'orgânico',
            'tipo_contratacao': 'CNPJ',
            'responsavel': 'Luiza',
        },
    ]

    batch_result = api.create_leads_batch(batch_leads)
    print(json.dumps(batch_result, indent=2, ensure_ascii=False))
