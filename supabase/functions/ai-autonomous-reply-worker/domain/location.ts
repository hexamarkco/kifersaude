/** Geography, not product eligibility. Never infer residence from telephone area codes. */
const capitals: Record<string, string> = {
  'rio branco': 'AC', maceio: 'AL', macapa: 'AP', manaus: 'AM', salvador: 'BA', fortaleza: 'CE', brasilia: 'DF',
  vitoria: 'ES', goiania: 'GO', 'sao luis': 'MA', cuiaba: 'MT', 'campo grande': 'MS', 'belo horizonte': 'MG',
  belem: 'PA', 'joao pessoa': 'PB', curitiba: 'PR', recife: 'PE', teresina: 'PI', 'rio de janeiro': 'RJ',
  natal: 'RN', 'porto alegre': 'RS', 'porto velho': 'RO', 'boa vista': 'RR', florianopolis: 'SC',
  'sao paulo': 'SP', aracaju: 'SE', palmas: 'TO',
};
export const locationKey = (city: string): string => city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');
export const canonicalCity = (city: string): string => locationKey(city) === 'rio' ? 'Rio de Janeiro' : city.trim();
export const capitalState = (city: string): string | null => {
  const key = locationKey(canonicalCity(city));
  return Object.hasOwn(capitals, key) ? capitals[key] : null;
};
