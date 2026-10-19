export const formatCommWhatsAppPhoneLabel = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (/@(?:lid|s\.whatsapp\.net|c\.us|g\.us)$/i.test(normalized)) {
    return 'Contato privado';
  }

  const digits = normalized.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  if (!digits) {
    return 'Contato privado';
  }

  return normalized || 'Contato privado';
};

// Códigos Nacionais por UF: https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais
const BRAZILIAN_DDD_REGIONS = [
  { uf: 'SP', name: 'São Paulo', codes: '11 12 13 14 15 16 17 18 19' },
  { uf: 'RJ', name: 'Rio de Janeiro', codes: '21 22 24' },
  { uf: 'ES', name: 'Espírito Santo', codes: '27 28' },
  { uf: 'MG', name: 'Minas Gerais', codes: '31 32 33 34 35 37 38' },
  { uf: 'PR', name: 'Paraná', codes: '41 42 43 44 45 46' },
  { uf: 'SC', name: 'Santa Catarina', codes: '47 48 49' },
  { uf: 'RS', name: 'Rio Grande do Sul', codes: '51 53 54 55' },
  { uf: 'DF/GO', name: 'Distrito Federal e Goiás', codes: '61' },
  { uf: 'GO', name: 'Goiás', codes: '62 64' },
  { uf: 'TO', name: 'Tocantins', codes: '63' },
  { uf: 'MT', name: 'Mato Grosso', codes: '65 66' },
  { uf: 'MS', name: 'Mato Grosso do Sul', codes: '67' },
  { uf: 'AC', name: 'Acre', codes: '68' },
  { uf: 'RO', name: 'Rondônia', codes: '69' },
  { uf: 'BA', name: 'Bahia', codes: '71 73 74 75 77' },
  { uf: 'SE', name: 'Sergipe', codes: '79' },
  { uf: 'PE', name: 'Pernambuco', codes: '81 87' },
  { uf: 'AL', name: 'Alagoas', codes: '82' },
  { uf: 'PB', name: 'Paraíba', codes: '83' },
  { uf: 'RN', name: 'Rio Grande do Norte', codes: '84' },
  { uf: 'CE', name: 'Ceará', codes: '85 88' },
  { uf: 'PI', name: 'Piauí', codes: '86 89' },
  { uf: 'PA', name: 'Pará', codes: '91 93 94' },
  { uf: 'AM', name: 'Amazonas', codes: '92 97' },
  { uf: 'RR', name: 'Roraima', codes: '95' },
  { uf: 'AP', name: 'Amapá', codes: '96' },
  { uf: 'MA', name: 'Maranhão', codes: '98 99' },
] as const;

export const getCommWhatsAppPhoneRegion = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  // Identificadores do WhatsApp não são números de telefone confirmados.
  if (!normalized || !/^\+?[\d\s().-]+$/.test(normalized)) return null;

  const digits = normalized.replace(/\D/g, '');
  const nationalNumber = /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits;
  if (!/^\d{10,11}$/.test(nationalNumber)) return null;
  // Um número com + explícito só pode ser interpretado como brasileiro com DDI 55.
  if (normalized.startsWith('+') && nationalNumber === digits) return null;
  // O histórico do WhatsApp também pode conter celulares sem o nono dígito.
  if (!/^(?:\d{2}[2-9]\d{7}|\d{2}9\d{8})$/.test(nationalNumber)) return null;

  const ddd = nationalNumber.slice(0, 2);
  const region = BRAZILIAN_DDD_REGIONS.find(({ codes }) => codes.split(' ').includes(ddd));
  return region ? { ddd, uf: region.uf, name: region.name } : null;
};
