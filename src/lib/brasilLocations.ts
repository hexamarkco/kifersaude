type BrazilState = {
  uf: string;
  nome: string;
};

type IbgeCityResponse = {
  nome?: string;
};

export const BRAZIL_STATES: BrazilState[] = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapa' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceara' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espirito Santo' },
  { uf: 'GO', nome: 'Goias' },
  { uf: 'MA', nome: 'Maranhao' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Para' },
  { uf: 'PB', nome: 'Paraiba' },
  { uf: 'PR', nome: 'Parana' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piaui' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondonia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'Sao Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

const citiesByStateCache = new Map<string, string[]>();

export const BRAZIL_STATE_OPTIONS = BRAZIL_STATES.map((state) => ({
  value: state.uf,
  label: `${state.nome} (${state.uf})`,
}));

export async function fetchCitiesByState(stateUf: string): Promise<string[]> {
  const normalizedUf = stateUf.trim().toUpperCase();

  if (!normalizedUf) {
    return [];
  }

  const cached = citiesByStateCache.get(normalizedUf);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalizedUf}/municipios`,
  );

  if (!response.ok) {
    throw new Error('Nao foi possivel carregar as cidades deste estado.');
  }

  const payload = (await response.json()) as IbgeCityResponse[];
  const cities = payload
    .map((item) => item.nome?.trim() ?? '')
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second, 'pt-BR'));

  citiesByStateCache.set(normalizedUf, cities);

  return cities;
}
