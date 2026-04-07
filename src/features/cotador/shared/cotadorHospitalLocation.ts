const CITY_REGION_MAP: Record<string, string> = {
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
};

export const formatCotadorLocationText = (value?: string | null) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';

  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

export const formatCotadorOptionalLocationText = (value?: string | null) => {
  const formatted = formatCotadorLocationText(value);
  return formatted || null;
};

export const resolveCotadorRegionByCity = (city?: string | null) => {
  const formattedCity = formatCotadorLocationText(city);
  if (!formattedCity) return null;
  return CITY_REGION_MAP[formattedCity] ?? null;
};

export const sanitizeCotadorHospitalBairro = (
  bairro: string | null | undefined,
  hospital?: string | null,
  city?: string | null,
  region?: string | null,
) => {
  const formattedBairro = formatCotadorOptionalLocationText(bairro);
  if (!formattedBairro) return null;

  const formattedHospital = formatCotadorLocationText(hospital);
  const formattedCity = formatCotadorLocationText(city);
  const formattedRegion = formatCotadorLocationText(region);

  if (formattedBairro === formattedHospital) return null;
  if (formattedBairro === formattedCity) return null;
  if (formattedRegion && formattedBairro === formattedRegion) return null;
  if (/^(S\/N|SN|\d+)(\s|-)/.test(formattedBairro)) return null;

  return formattedBairro;
};

export const formatCotadorHospitalLocationLabel = (entry: {
  bairro?: string | null;
  regiao?: string | null;
  cidade?: string | null;
}) => [entry.bairro, entry.regiao, entry.cidade].filter(Boolean).join(' | ');
