export type ReceitaEmpresaData = {
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

const DEFAULT_API_BASE_URL = 'https://brasilapi.com.br/api';
const LOOKUP_TIMEOUT_MS = 8000;
const UNAVAILABLE_MESSAGE = 'A consulta de CNPJ está indisponível no momento. Tente novamente ou preencha os dados da empresa manualmente.';

class CompanyLookupError extends Error {
  constructor(readonly status: number) {
    super(UNAVAILABLE_MESSAGE);
  }
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

function normalizeCompany(payload: unknown, nested: boolean): ReceitaEmpresaData {
  const data = asRecord(payload);
  const address = nested ? asRecord(data.estabelecimento) : data;
  const razaoSocial = asText(data.razao_social) || asText(data.nome);
  if (!razaoSocial) throw new Error(UNAVAILABLE_MESSAGE);

  return {
    razao_social: razaoSocial,
    nome_fantasia: asText(address.nome_fantasia),
    cep: asText(address.cep),
    endereco: nested
      ? [asText(address.tipo_logradouro), asText(address.logradouro)].filter(Boolean).join(' ') || undefined
      : asText(address.logradouro) || asText(address.endereco),
    numero: asText(address.numero),
    complemento: asText(address.complemento),
    bairro: asText(address.bairro),
    cidade: nested
      ? asText(asRecord(address.cidade).nome)
      : asText(address.municipio) || asText(address.cidade),
    estado: nested
      ? asText(asRecord(address.estado).sigla)
      : asText(address.uf) || asText(address.estado),
  };
}

async function fetchCompany(url: string, nested: boolean): Promise<ReceitaEmpresaData> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new CompanyLookupError(response.status);
    return normalizeCompany(await response.json(), nested);
  } finally {
    clearTimeout(timeout);
  }
}

export async function consultarEmpresaPorCNPJ(cnpj: string): Promise<ReceitaEmpresaData> {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) throw new Error('CNPJ inválido. Informe os 14 dígitos.');

  const baseUrl = (import.meta.env.VITE_RECEITA_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
  const providers = [{ url: `${baseUrl}/cnpj/v1/${cleanCnpj}`, nested: false }];
  // Uma integração configurada explicitamente mantém sua própria fonte de dados.
  if (baseUrl === DEFAULT_API_BASE_URL) {
    providers.push({ url: `https://publica.cnpj.ws/cnpj/${cleanCnpj}`, nested: true });
  }

  let lastError: unknown;
  for (const provider of providers) {
    try {
      return await fetchCompany(provider.url, provider.nested);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof CompanyLookupError) {
    if (lastError.status === 404) {
      throw new Error('CNPJ não encontrado na base de consulta. Confira o número ou preencha os dados da empresa manualmente.');
    }
    if (lastError.status === 429) {
      throw new Error('O limite de consultas de CNPJ foi atingido. Aguarde um minuto e tente novamente ou preencha os dados da empresa manualmente.');
    }
  }
  throw new Error(UNAVAILABLE_MESSAGE);
}
