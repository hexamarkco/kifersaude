# -*- coding: utf-8 -*-
import argparse
import csv
import io
import json
import re
import sys
import urllib.parse
from pathlib import Path

import requests
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


SUPABASE_URL_ENV = 'VITE_SUPABASE_URL'
SUPABASE_KEY_ENV = 'VITE_SUPABASE_SERVICE_ROLE_KEY'
ADDRESS_SELECTOR = '[data-item-id="address"] .Io6YTe'

CITY_REGION_MAP = {
    'ANGRA DOS REIS': 'SUL FLUMINENSE',
    'APERIBE': 'NOROESTE FLUMINENSE',
    'ARARUAMA': 'REGIAO DOS LAGOS',
    'AREAL': 'REGIAO SERRANA',
    'ARMACAO DOS BUZIOS': 'REGIAO DOS LAGOS',
    'ARRAIAL DO CABO': 'REGIAO DOS LAGOS',
    'BARRA DO PIRAI': 'SUL FLUMINENSE',
    'BARRA MANSA': 'SUL FLUMINENSE',
    'BELFORD ROXO': 'BAIXADA FLUMINENSE',
    'BOM JARDIM': 'REGIAO SERRANA',
    'BOM JESUS DO ITABAPOANA': 'NOROESTE FLUMINENSE',
    'CABO FRIO': 'REGIAO DOS LAGOS',
    'CACHOEIRAS DE MACACU': 'LESTE FLUMINENSE',
    'CAMBUCI': 'NOROESTE FLUMINENSE',
    'CAMPOS DOS GOYTACAZES': 'NORTE FLUMINENSE',
    'CANTAGALO': 'REGIAO SERRANA',
    'CARAPEBUS': 'NORTE FLUMINENSE',
    'CARDOSO MOREIRA': 'NOROESTE FLUMINENSE',
    'CARMO': 'REGIAO SERRANA',
    'CASIMIRO DE ABREU': 'REGIAO DOS LAGOS',
    'COMENDADOR LEVY GASPARIAN': 'CENTRO-SUL FLUMINENSE',
    'CONCEICAO DE MACABU': 'NORTE FLUMINENSE',
    'CORDEIRO': 'REGIAO SERRANA',
    'DUAS BARRAS': 'REGIAO SERRANA',
    'DUQUE DE CAXIAS': 'BAIXADA FLUMINENSE',
    'ENGENHEIRO PAULO DE FRONTIN': 'CENTRO-SUL FLUMINENSE',
    'GUAPIMIRIM': 'BAIXADA FLUMINENSE',
    'IGUABA GRANDE': 'REGIAO DOS LAGOS',
    'ITABORAI': 'LESTE FLUMINENSE',
    'ITAGUAI': 'BAIXADA FLUMINENSE',
    'ITALVA': 'NOROESTE FLUMINENSE',
    'ITAOCARA': 'NOROESTE FLUMINENSE',
    'ITAPERUNA': 'NOROESTE FLUMINENSE',
    'ITATIAIA': 'SUL FLUMINENSE',
    'JAPERI': 'BAIXADA FLUMINENSE',
    'LAJE DO MURIAE': 'NOROESTE FLUMINENSE',
    'MACAE': 'NORTE FLUMINENSE',
    'MACUCO': 'REGIAO SERRANA',
    'MAGE': 'BAIXADA FLUMINENSE',
    'MANGARATIBA': 'SUL FLUMINENSE',
    'MARICA': 'LESTE FLUMINENSE',
    'MENDES': 'CENTRO-SUL FLUMINENSE',
    'MESQUITA': 'BAIXADA FLUMINENSE',
    'MIGUEL PEREIRA': 'CENTRO-SUL FLUMINENSE',
    'MIRACEMA': 'NOROESTE FLUMINENSE',
    'NATIVIDADE': 'NOROESTE FLUMINENSE',
    'NILOPOLIS': 'BAIXADA FLUMINENSE',
    'NITEROI': 'LESTE FLUMINENSE',
    'NOVA FRIBURGO': 'REGIAO SERRANA',
    'NOVA IGUACU': 'BAIXADA FLUMINENSE',
    'PARACAMBI': 'BAIXADA FLUMINENSE',
    'PARAIBA DO SUL': 'CENTRO-SUL FLUMINENSE',
    'PARATY': 'SUL FLUMINENSE',
    'PATY DO ALFERES': 'CENTRO-SUL FLUMINENSE',
    'PETROPOLIS': 'REGIAO SERRANA',
    'PINHEIRAL': 'SUL FLUMINENSE',
    'PIRAI': 'SUL FLUMINENSE',
    'PORCIUNCULA': 'NOROESTE FLUMINENSE',
    'PORTO REAL': 'SUL FLUMINENSE',
    'QUATIS': 'SUL FLUMINENSE',
    'QUEIMADOS': 'BAIXADA FLUMINENSE',
    'QUISSAMA': 'NORTE FLUMINENSE',
    'RESENDE': 'SUL FLUMINENSE',
    'RIO BONITO': 'LESTE FLUMINENSE',
    'RIO CLARO': 'SUL FLUMINENSE',
    'RIO DAS FLORES': 'CENTRO-SUL FLUMINENSE',
    'RIO DAS OSTRAS': 'REGIAO DOS LAGOS',
    'RIO DE JANEIRO': 'CAPITAL',
    'SANTA MARIA MADALENA': 'REGIAO SERRANA',
    'SANTO ANTONIO DE PADUA': 'NOROESTE FLUMINENSE',
    'SAO FIDELIS': 'NORTE FLUMINENSE',
    'SAO FRANCISCO DE ITABAPOANA': 'NORTE FLUMINENSE',
    'SAO GONCALO': 'LESTE FLUMINENSE',
    'SAO JOAO DA BARRA': 'NORTE FLUMINENSE',
    'SAO JOAO DE MERITI': 'BAIXADA FLUMINENSE',
    'SAO JOSE DE UBA': 'NOROESTE FLUMINENSE',
    'SAO JOSE DO VALE DO RIO PRETO': 'REGIAO SERRANA',
    'SAO PEDRO DA ALDEIA': 'REGIAO DOS LAGOS',
    'SAO SEBASTIAO DO ALTO': 'REGIAO SERRANA',
    'SAPUCAIA': 'CENTRO-SUL FLUMINENSE',
    'SAQUAREMA': 'REGIAO DOS LAGOS',
    'SEROPEDICA': 'BAIXADA FLUMINENSE',
    'SILVA JARDIM': 'LESTE FLUMINENSE',
    'SUMIDOURO': 'REGIAO SERRANA',
    'TANGUA': 'LESTE FLUMINENSE',
    'TERESOPOLIS': 'REGIAO SERRANA',
    'TRAJANO DE MORAES': 'REGIAO SERRANA',
    'TRES RIOS': 'CENTRO-SUL FLUMINENSE',
    'VALENCA': 'CENTRO-SUL FLUMINENSE',
    'VARRE-SAI': 'NOROESTE FLUMINENSE',
    'VASSOURAS': 'CENTRO-SUL FLUMINENSE',
    'VOLTA REDONDA': 'SUL FLUMINENSE',
}

INVALID_BAIRRO_TERMS = {
    'CAPITAL',
    'BAIXADA FLUMINENSE',
    'LESTE FLUMINENSE',
    'SUL FLUMINENSE',
    'NORTE FLUMINENSE',
    'NOROESTE FLUMINENSE',
    'REGIAO DOS LAGOS',
    'REGIAO SERRANA',
    'CENTRO-SUL FLUMINENSE',
    'METROPOLITANA DO RIO DE JANEIRO',
    'REGIAO METROPOLITANA',
    'RJ',
    'C',
    'ZONA OESTE',
    'ZONA NORTE',
    'ZONA SUL',
    'CENTRO FLUMINENSE',
}

KNOWN_BAIRRO_HINTS = {
    ('AMERICAS OFTALMOCENTER', 'RIO DE JANEIRO'): 'TIJUCA',
    ('AMIU JACAREPAGUA', 'RIO DE JANEIRO'): 'JACAREPAGUA',
    ('ASM HOSPITAL PRO CARDIACO', 'RIO DE JANEIRO'): 'BOTAFOGO',
    ('ASM HOSPITAL VITORIA RJ', 'RIO DE JANEIRO'): 'BARRA DA TIJUCA',
    ('DAY CLINIC MEIER', 'RIO DE JANEIRO'): 'MEIER',
    ('HOSPITAL DE CLINICAS SANTA CRUZ', 'RIO DE JANEIRO'): 'SANTA CRUZ',
    ('TIJU TRAUMA', 'RIO DE JANEIRO'): 'TIJUCA',
    ('SAMCORDIS', 'SAO GONCALO'): 'ESTRELA DO NORTE',
    ('OFTALMOCLINICA ICARAI', 'NITEROI'): 'ICARAI',
    ('CENTRO AVANCADO DE OFTALMOLOGIA', 'RIO DE JANEIRO'): 'COPACABANA',
    ('DAY HOSPITAL CCA', 'RIO DE JANEIRO'): 'BARRA DA TIJUCA',
    ('EYE CENTER', 'RIO DE JANEIRO'): 'BARRA DA TIJUCA',
}


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip()
    return values


def format_text(value: str | None) -> str:
    if not value:
        return ''
    return (
        value.strip()
        .upper()
        .translate(str.maketrans('ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN'))
        .replace('Ý', 'Y')
    )


def normalize_key(value: str | None) -> str:
    return re.sub(r'[^A-Z0-9]+', ' ', format_text(value)).strip()


def resolve_region(city: str | None) -> str | None:
    return CITY_REGION_MAP.get(normalize_key(city))


def sanitize_bairro(bairro: str | None, hospital_name: str, city: str, region: str | None) -> str | None:
    formatted = format_text(bairro)
    if not formatted:
        return None
    if ' - ' in formatted:
        trailing = formatted.split(' - ')[-1].strip()
        if trailing:
            formatted = trailing
    for token in ('BARRA DA TIJUCA', 'COPACABANA', 'TIJUCA', 'BOTAFOGO', 'MEIER', 'JACAREPAGUA', 'ICARAI', 'SANTA CRUZ', 'ESTRELA DO NORTE', 'TODOS OS SANTOS'):
        if formatted.endswith(token):
            formatted = token
            break
    formatted = re.sub(r'\s+-\s+RJ$', '', formatted).strip()
    formatted = re.sub(r'\s+RJ$', '', formatted).strip()
    if normalize_key(formatted) in {normalize_key(hospital_name), normalize_key(city), normalize_key(region)}:
        return None
    if formatted in INVALID_BAIRRO_TERMS:
        return None
    if re.match(r'^(S/N|SN|\d+)(\s|-)', formatted):
        return None
    if re.match(r'^(RUA|R\.|R |AVENIDA|AV\.|AV |ESTRADA|ESTR\.|RODOVIA|ROD\.|ALAMEDA|TRAVESSA|TV\.|PRACA|PCA\.)', formatted):
        return None
    if re.search(r'(ANDAR|SALA|BLOCO|LOJA|CONJ|CJ\b|TERREO|PAVIMENTO)', formatted):
        return None
    if normalize_key(formatted) == normalize_key(city):
        return None
    return formatted


def select_best_result_link(page, hospital_name: str) -> str | None:
    query_key = normalize_key(hospital_name)
    query_tokens = [token for token in query_key.split() if len(token) > 2]
    candidates: list[tuple[int, str]] = []

    for node in page.query_selector_all('a[href*="/maps/place/"]'):
        href = node.get_attribute('href')
        aria_label = format_text(node.get_attribute('aria-label'))
        if not href or not aria_label:
            continue

        label_key = normalize_key(aria_label)
        score = 0
        if label_key == query_key:
            score += 100
        if query_key in label_key:
            score += 40
        if label_key in query_key:
            score += 20
        score += sum(1 for token in query_tokens if token in label_key)

        if score > 0:
            candidates.append((score, href))

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_score, best_href = candidates[0]
    if len(candidates) > 1 and candidates[1][0] == best_score and best_score < 100:
        return None

    return best_href


def build_headers(env: dict[str, str]) -> dict[str, str]:
    supabase_key = env.get(SUPABASE_KEY_ENV)
    if not supabase_key:
        raise RuntimeError(f'Chave {SUPABASE_KEY_ENV} nao encontrada na .env.local')
    return {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
    }


def fetch_hospitals(supabase_url: str, headers: dict[str, str]) -> list[dict]:
    response = requests.get(
        f'{supabase_url}/rest/v1/cotador_hospitais',
        headers=headers,
        params={'select': 'id,nome,cidade,regiao,bairro', 'order': 'cidade.asc,nome.asc', 'limit': 1000},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def update_hospital(supabase_url: str, headers: dict[str, str], hospital_id: str, payload: dict[str, str | None]) -> None:
    response = requests.patch(
        f'{supabase_url}/rest/v1/cotador_hospitais',
        headers=headers,
        params={'id': f'eq.{hospital_id}'},
        json=payload,
        timeout=30,
    )
    response.raise_for_status()


def extract_coords_from_maps_url(url: str | None) -> tuple[float, float] | None:
    if not url:
        return None

    match = re.search(r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', url)
    if not match:
        match = re.search(r'@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', url)
    if not match:
        return None

    return float(match.group(1)), float(match.group(2))


def reverse_geocode_bairro(lat: float, lng: float) -> str | None:
    response = requests.get(
        'https://nominatim.openstreetmap.org/reverse',
        params={
            'format': 'jsonv2',
            'lat': lat,
            'lon': lng,
            'addressdetails': 1,
        },
        headers={'User-Agent': 'kifersaude-hospital-sync/1.0'},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    address = payload.get('address') or {}

    for key in ('suburb', 'neighbourhood', 'quarter', 'city_district'):
        value = address.get(key)
        if value:
            return format_text(value)

    return None


def resolve_address(page, hospital_name: str, city: str) -> tuple[str | None, str | None, str | None]:
    queries = [
        f'{hospital_name} {city}',
        f'HOSPITAL {hospital_name} {city}',
        f'{hospital_name} {city} RJ',
    ]
    for query in queries:
        search_url = f'https://www.google.com/maps/search/{query.replace(" ", "+")}'
        best_result_href = None
        try:
            page.goto(search_url, timeout=60000, wait_until='domcontentloaded')
            page.wait_for_timeout(3500)
        except PlaywrightTimeoutError:
            continue

        address_node = page.query_selector(ADDRESS_SELECTOR)
        if address_node:
            address = address_node.inner_text().strip()
            if address:
                return address, page.url, None

        best_result_href = select_best_result_link(page, hospital_name)
        if best_result_href:
            try:
                page.goto(best_result_href, timeout=60000, wait_until='domcontentloaded')
                page.wait_for_timeout(2500)
                address_node = page.query_selector(ADDRESS_SELECTOR)
                if address_node:
                    address = address_node.inner_text().strip()
                    if address:
                        return address, best_result_href, None
            except PlaywrightTimeoutError:
                pass

        result_buttons = page.query_selector_all('a[href*="/maps/place/"]')
        if len(result_buttons) > 1:
            return None, best_result_href, 'AMBIGUO_MULTIPLAS_UNIDADES'

        if best_result_href:
            return None, best_result_href, 'COORDENADA_SEM_ENDERECO'

        if '/maps/place/' in page.url:
            return None, page.url, 'COORDENADA_SEM_ENDERECO'

    return None, None, 'ENDERECO_NAO_ENCONTRADO'


def extract_bairro_from_address(address: str, city: str, region: str | None, hospital_name: str) -> str | None:
    cleaned = re.sub(r'\d{5}-?\d{3}', '', address).strip(' ,')
    formatted_address = format_text(cleaned)
    formatted_city = format_text(city)

    if formatted_city:
        city_anchor = re.search(rf'-\s*([^,]+),\s*{re.escape(formatted_city)}(?:\s*-\s*[A-Z]{{2}})?', formatted_address)
        if city_anchor:
            bairro_from_city_anchor = city_anchor.group(1)
            bairro_from_city_anchor = re.sub(r'^\d+(?:/\d+)?\s*-\s*', '', bairro_from_city_anchor)
            bairro_from_city_anchor = bairro_from_city_anchor.strip(' -')
            sanitized = sanitize_bairro(bairro_from_city_anchor, hospital_name, city, region)
            if sanitized:
                return sanitized

    hyphen_match = re.search(r'(?:S/N|\d+(?:/\d+)?)\s*-\s*([^,]+)', cleaned, flags=re.IGNORECASE)
    if hyphen_match:
        bairro_from_hyphen = hyphen_match.group(1)
        bairro_from_hyphen = re.sub(r'^\d+(?:/\d+)?\s*-\s*', '', bairro_from_hyphen)
        bairro_from_hyphen = bairro_from_hyphen.strip(' -')
        sanitized = sanitize_bairro(bairro_from_hyphen, hospital_name, city, region)
        if sanitized:
            return sanitized

    parts = [part.strip() for part in cleaned.split(',') if part.strip()]
    if len(parts) < 2:
        return None

    for part in parts[1:]:
        bairro_candidate = re.sub(r'^S/N\s*-\s*', '', part, flags=re.IGNORECASE)
        bairro_candidate = re.sub(r'^\d+(?:/\d+)?\s*-\s*', '', bairro_candidate)
        bairro_candidate = re.sub(r'^\d+\s+', '', bairro_candidate)
        bairro_candidate = bairro_candidate.strip(' -')
        sanitized = sanitize_bairro(bairro_candidate, hospital_name, city, region)
        if sanitized:
            return sanitized

    return None


def write_reports(base_path: Path, rows: list[dict]) -> None:
    base_path.mkdir(parents=True, exist_ok=True)
    json_path = base_path / 'hospital_location_report.json'
    csv_path = base_path / 'hospital_location_report.csv'
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    with csv_path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['id', 'nome', 'cidade', 'regiao_atual', 'regiao_nova', 'bairro_atual', 'bairro_novo', 'status', 'motivo', 'endereco'])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description='Corrige REGIAO e BAIRRO dos hospitais do Cotador.')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--headless', action='store_true')
    parser.add_argument('--only-empty-bairro', action='store_true')
    args = parser.parse_args()

    workspace_root = Path(__file__).resolve().parent.parent
    env = load_env_file(workspace_root / '.env.local')
    supabase_url = env.get(SUPABASE_URL_ENV)
    if not supabase_url:
        raise RuntimeError(f'URL {SUPABASE_URL_ENV} nao encontrada na .env.local')

    headers = build_headers(env)
    hospitals = fetch_hospitals(supabase_url, headers)
    if args.only_empty_bairro:
        hospitals = [hospital for hospital in hospitals if not (hospital.get('bairro') or '').strip()]
    if args.limit > 0:
        hospitals = hospitals[:args.limit]

    report_rows: list[dict] = []
    updated_count = 0
    skipped_count = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=args.headless,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        )
        context = browser.new_context(
            viewport={'width': 1440, 'height': 960},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            locale='pt-BR',
        )
        page = context.new_page()

        for index, hospital in enumerate(hospitals, start=1):
            nome = format_text(hospital.get('nome'))
            cidade = format_text(hospital.get('cidade'))
            regiao_atual = format_text(hospital.get('regiao')) or None
            bairro_atual = format_text(hospital.get('bairro')) or None
            regiao_nova = resolve_region(cidade) or regiao_atual

            print(f'[{index}/{len(hospitals)}] {nome} - {cidade}')

            hinted_bairro = KNOWN_BAIRRO_HINTS.get((nome, cidade))
            if hinted_bairro:
                bairro_novo = sanitize_bairro(hinted_bairro, nome, cidade, regiao_nova)
                payload = {
                    'nome': nome,
                    'cidade': cidade,
                    'regiao': regiao_nova,
                    'bairro': bairro_novo,
                }
                status = 'UPDATED' if not args.dry_run else 'SUGGESTED'
                if not args.dry_run:
                    update_hospital(supabase_url, headers, hospital['id'], payload)
                updated_count += 1
                report_rows.append({
                    'id': hospital['id'],
                    'nome': nome,
                    'cidade': cidade,
                    'regiao_atual': regiao_atual or '',
                    'regiao_nova': regiao_nova or '',
                    'bairro_atual': bairro_atual or '',
                    'bairro_novo': bairro_novo or '',
                    'status': status,
                    'motivo': 'HINT_MANUAL_SEGURA',
                    'endereco': '',
                })
                print(f'   REGIAO={regiao_nova or "-"} | BAIRRO={bairro_novo or "-"} | STATUS={status} | MOTIVO=HINT_MANUAL_SEGURA')
                continue

            endereco, maps_url, motivo = resolve_address(page, nome, cidade)
            bairro_novo = extract_bairro_from_address(endereco, cidade, regiao_nova, nome) if endereco else None
            if not bairro_novo:
                coords = extract_coords_from_maps_url(maps_url)
                if coords:
                    try:
                        bairro_por_coord = reverse_geocode_bairro(*coords)
                    except Exception:
                        bairro_por_coord = None
                    bairro_novo = sanitize_bairro(bairro_por_coord, nome, cidade, regiao_nova)
            if not bairro_novo:
                bairro_novo = sanitize_bairro(bairro_atual, nome, cidade, regiao_nova)

            status = 'SKIPPED'
            payload = {
                'nome': nome,
                'cidade': cidade,
                'regiao': regiao_nova,
                'bairro': bairro_novo,
            }

            if regiao_nova and bairro_novo:
                status = 'UPDATED' if not args.dry_run else 'SUGGESTED'
                if not args.dry_run:
                    update_hospital(supabase_url, headers, hospital['id'], payload)
                updated_count += 1
                motivo = 'OK'
            elif regiao_nova and not bairro_novo:
                status = 'REGION_ONLY' if not args.dry_run else 'REGION_ONLY_SUGGESTED'
                if not args.dry_run:
                    update_hospital(supabase_url, headers, hospital['id'], {**payload, 'bairro': None})
                updated_count += 1
                motivo = motivo or 'BAIRRO_PENDENTE'
            else:
                skipped_count += 1
                motivo = motivo or 'BAIRRO_OU_REGIAO_NAO_CONFIRMADOS'

            report_rows.append({
                'id': hospital['id'],
                'nome': nome,
                'cidade': cidade,
                'regiao_atual': regiao_atual or '',
                'regiao_nova': regiao_nova or '',
                'bairro_atual': bairro_atual or '',
                'bairro_novo': bairro_novo or '',
                'status': status,
                'motivo': motivo,
                'endereco': endereco or '',
            })
            print(f'   REGIAO={regiao_nova or "-"} | BAIRRO={bairro_novo or "-"} | STATUS={status} | MOTIVO={motivo}')

        browser.close()

    reports_dir = workspace_root / 'cotador-json'
    write_reports(reports_dir, report_rows)
    print('--- RESUMO ---')
    print(f'ATUALIZADOS/SUGERIDOS: {updated_count}')
    print(f'PENDENTES/AMBIGUOS: {skipped_count}')
    print(f'RELATORIO: {reports_dir / "hospital_location_report.json"}')


if __name__ == '__main__':
    main()
