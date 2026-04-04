export const COTADOR_STORAGE_KEY = 'cotador.workspace.v1';

export const COTADOR_AGE_RANGES = [
  '0-18',
  '19-23',
  '24-28',
  '29-33',
  '34-38',
  '39-43',
  '44-48',
  '49-53',
  '54-58',
  '59+',
] as const;

export type CotadorAgeRange = (typeof COTADOR_AGE_RANGES)[number];

export const COTADOR_MODALITY_OPTIONS = [
  {
    value: 'PF',
    label: 'PF',
    description: 'Pessoa fisica e familiar, sem CNPJ.',
    helper: 'Mantem o foco em individual e familiar.',
  },
  {
    value: 'ADESAO',
    label: 'Adesao',
    description: 'Associacoes, sindicatos e entidades de classe.',
    helper: 'Prepara o caminho para administradoras e entidades.',
  },
  {
    value: 'PME',
    label: 'PME',
    description: 'MEI, CNPJ e empresarial de pequeno e medio porte.',
    helper: 'Na v1 agrupa as carteiras empresariais.',
  },
] as const;

export type CotadorQuoteModality = (typeof COTADOR_MODALITY_OPTIONS)[number]['value'];

export const COTADOR_MODALITY_MATCHERS: Record<CotadorQuoteModality, string[]> = {
  PF: ['pf', 'pessoa fisica', 'individual', 'familiar'],
  ADESAO: ['adesao', 'associacao', 'entidade', 'sindicato'],
  PME: ['pme', 'cnpj', 'empresarial', 'empresa', 'mei', 'microempreendedor'],
};
