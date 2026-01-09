export type ReceitaPessoaData = {
  nome?: string;
  data_nascimento?: string;
  sexo?: string;
  situacao?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
};

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

const RECEITA_API_BASE_URL = import.meta.env.VITE_RECEITA_API_BASE_URL || 'https://brasilapi.com.br/api';

const sanitizeDocument = (value: string): string => value.replace(/\D/g, '');

const normalizeDate = (value?: string): string | undefined => {
  if (!value) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const match = value.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  return value;
};

const fetchFromReceita = async <T>(url: string, errorMessage: string): Promise<T> => {
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || errorMessage);
  }

  return response.json();
};

export const consultarPessoaPorCPF = async (
  cpf: string,
  dataNascimento?: string,
): Promise<ReceitaPessoaData> => {
  const cleanCpf = sanitizeDocument(cpf);

  if (cleanCpf.length !== 11) {
    throw new Error('CPF inválido');
  }

  const normalizedBirthDate = normalizeDate(dataNascimento);
  const url = new URL(`${RECEITA_API_BASE_URL}/cpf/v1/${cleanCpf}`);

  if (normalizedBirthDate) {
    url.searchParams.set('data_nascimento', normalizedBirthDate);
  }

  const data = await fetchFromReceita<any>(url, 'Não foi possível consultar CPF na Receita');

  return {
    nome: data.nome || data.name,
    data_nascimento: normalizeDate(data.data_nascimento || data.birth_date),
    sexo: data.sexo || data.gender,
    situacao: data.situacao_cadastral || data.situacao,
    cep: data.cep,
    endereco: data.logradouro || data.endereco || data.address,
    numero: data.numero || data.numero_endereco,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.municipio || data.cidade || data.city,
    estado: data.uf || data.estado || data.state,
  };
};

export const consultarEmpresaPorCNPJ = async (cnpj: string): Promise<ReceitaEmpresaData> => {
  const cleanCnpj = sanitizeDocument(cnpj);

  if (cleanCnpj.length !== 14) {
    throw new Error('CNPJ inválido');
  }

  const url = `${RECEITA_API_BASE_URL}/cnpj/v1/${cleanCnpj}`;
  const data = await fetchFromReceita<any>(url, 'Não foi possível consultar CNPJ na Receita');

  return {
    razao_social: data.razao_social || data.nome,
    nome_fantasia: data.nome_fantasia,
    cep: data.cep,
    endereco: data.logradouro || data.endereco,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.municipio || data.cidade,
    estado: data.uf || data.estado,
  };
};
