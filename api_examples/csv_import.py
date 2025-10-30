import csv
import sys
from python_client import KiferLeadsAPI


def import_leads_from_csv(csv_file_path: str, api: KiferLeadsAPI):
    leads_to_import = []
    errors = []

    try:
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)

            for row_num, row in enumerate(reader, start=2):
                try:
                    lead = {
                        'nome_completo': row['nome_completo'].strip(),
                        'telefone': row['telefone'].strip(),
                        'origem': row['origem'].strip(),
                        'tipo_contratacao': row['tipo_contratacao'].strip(),
                        'responsavel': row['responsavel'].strip(),
                    }

                    if row.get('email'):
                        lead['email'] = row['email'].strip()
                    if row.get('cidade'):
                        lead['cidade'] = row['cidade'].strip()
                    if row.get('regiao'):
                        lead['regiao'] = row['regiao'].strip()
                    if row.get('operadora_atual'):
                        lead['operadora_atual'] = row['operadora_atual'].strip()
                    if row.get('status'):
                        lead['status'] = row['status'].strip()
                    if row.get('observacoes'):
                        lead['observacoes'] = row['observacoes'].strip()

                    leads_to_import.append(lead)

                except KeyError as e:
                    errors.append(f"Linha {row_num}: Campo obrigatório ausente: {e}")
                except Exception as e:
                    errors.append(f"Linha {row_num}: Erro ao processar: {e}")

        if errors:
            print("=== ERROS ENCONTRADOS NO CSV ===")
            for error in errors:
                print(f"  - {error}")
            print()

        if not leads_to_import:
            print("Nenhum lead válido encontrado para importar.")
            return

        print(f"=== IMPORTANDO {len(leads_to_import)} LEADS ===")

        result = api.create_leads_batch(leads_to_import)

        print("\n=== RESULTADO DA IMPORTAÇÃO ===")
        print(f"Total processado: {len(leads_to_import)}")
        print(f"Sucesso: {len(result.get('results', {}).get('success', []))}")
        print(f"Falhas: {len(result.get('results', {}).get('failed', []))}")

        if result.get('results', {}).get('failed'):
            print("\n=== LEADS COM FALHA ===")
            for failed in result['results']['failed']:
                print(f"  - Linha {failed['index'] + 2}: {failed.get('errors', failed.get('error'))}")

    except FileNotFoundError:
        print(f"Erro: Arquivo '{csv_file_path}' não encontrado.")
    except Exception as e:
        print(f"Erro ao processar arquivo: {e}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python csv_import.py <caminho_do_arquivo.csv>")
        print("\nFormato do CSV:")
        print("  Colunas obrigatórias: nome_completo, telefone, origem, tipo_contratacao, responsavel")
        print("  Colunas opcionais: email, cidade, regiao, operadora_atual, status, observacoes")
        print("\nExemplo:")
        print("  python csv_import.py leads.csv")
        sys.exit(1)

    csv_file = sys.argv[1]

    API_URL = 'https://xhtwspmpzvmmmzntkgre.supabase.co/functions/v1/leads-api'
    API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhodHdzcG1wenZtbW16bnRrZ3JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzY1ODQsImV4cCI6MjA3NTg1MjU4NH0.H4WH2H25eDCYMKybKoYWXabfjUcMFqWjLaGn8mFRgi8'

    api = KiferLeadsAPI(API_URL, API_KEY)

    import_leads_from_csv(csv_file, api)
