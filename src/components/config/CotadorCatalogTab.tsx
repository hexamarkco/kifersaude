import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle,
  Copy,
  Download,
  Edit2,
  FileJson,
  Layers3,
  MapPin,
  Network,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { configService } from '../../lib/configService';
import { formatCurrencyFromNumber, parseFormattedNumber } from '../../lib/inputFormatters';
import { toast } from '../../lib/toast';
import type { CotadorAgeRange } from '../../features/cotador/shared/cotadorConstants';
import { COTADOR_AGE_RANGES } from '../../features/cotador/shared/cotadorConstants';
import type { CotadorHospitalNetworkEntry, CotadorQuote } from '../../features/cotador/shared/cotadorTypes';
import {
  formatCotadorHospitalLocationLabel,
  formatCotadorLocationText,
  formatCotadorOptionalLocationText,
  resolveCotadorRegionByCity,
  sanitizeCotadorHospitalBairro,
} from '../../features/cotador/shared/cotadorHospitalLocation';
import {
  cotadorService,
  type CotadorHospitalManagerInput,
  type CotadorHospitalManagerRecord,
  type CotadorLineManagerRecord,
  type CotadorPriceRowInput,
  type CotadorProductManagerInput,
  type CotadorProductManagerRecord,
  type CotadorProductNetworkManagerInput,
  type CotadorProductNetworkManagerRecord,
  type CotadorTableManagerInput,
  type CotadorTableManagerRecord,
} from '../../features/cotador/services/cotadorService';
import { cotadorImportService, type CotadorImportPreview } from '../../features/cotador/services/cotadorImportService';
import type { CotadorAdministradora, CotadorEntidadeClasse, Operadora } from '../../lib/supabase';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import Tabs from '../ui/Tabs';
import Textarea from '../ui/Textarea';
import FilterSingleSelect from '../FilterSingleSelect';
import Pagination from '../Pagination';
import CotadorCatalogMetricsPanel from './CotadorCatalogMetricsPanel';
import CotadorHospitalMergeSuggestionsPanel, { type NetworkHospitalMergeSuggestion } from './CotadorHospitalMergeSuggestionsPanel';
import OperadorasTab from './OperadorasTab';

type CotadorCatalogTabProps = {
  embedded?: boolean;
};

type CatalogTabId = 'operadoras' | 'linhas' | 'produtos' | 'tabelas' | 'redes' | 'administradoras' | 'entidades';

type Message = {
  type: 'success' | 'error';
  text: string;
};

type BaseCatalogForm = {
  nome: string;
  ativo: boolean;
  observacoes: string;
};

type LineFormState = BaseCatalogForm & {
  operadoraId: string;
};

type ProductFormState = {
  nome: string;
  linhaId: string;
  administradoraId: string;
  modalidade: string;
  abrangencia: string;
  acomodacoes: string[];
  entidadeIds: string[];
  comissaoSugerida: number;
  bonusPorVidaValor: number;
  carencias: string;
  documentosNecessarios: string;
  reembolso: string;
  informacoesImportantes: string;
  ativo: boolean;
  observacoes: string;
};

type TableFormState = {
  produtoId: string;
  nome: string;
  codigo: string;
  modalidade: 'PF' | 'ADESAO' | 'PME';
  perfilEmpresarial: 'todos' | 'mei' | 'nao_mei';
  coparticipacao: 'sem' | 'parcial' | 'total';
  acomodacao: string;
  vidasMin: string;
  vidasMax: string;
  pricesByAgeRange: Record<CotadorAgeRange, string>;
  pricesByAcomodacao: Record<string, Record<CotadorAgeRange, string>>;
  ativo: boolean;
  observacoes: string;
};

type GroupedTableEntry = {
  key: string;
  baseName: string;
  produtoId: string;
  modalidade: CotadorTableManagerRecord['modalidade'];
  perfilEmpresarial: CotadorTableManagerRecord['perfil_empresarial'];
  coparticipacao: CotadorTableManagerRecord['coparticipacao'];
  vidasMin: CotadorTableManagerRecord['vidas_min'];
  vidasMax: CotadorTableManagerRecord['vidas_max'];
  product: CotadorProductManagerRecord | null;
  records: CotadorTableManagerRecord[];
};

type ProductCompletenessStatus = {
  missingNetwork: boolean;
  missingPrice: boolean;
  missingCarencias: boolean;
  missingDocuments: boolean;
  missingReembolso: boolean;
  complete: boolean;
};

type ImportFormState = {
  file: File | null;
};

type NetworkEntryFormState = {
  hospital: string;
  cidade: string;
  regiao: string;
  bairro: string;
  atendimentos: string[];
  observacoes: string;
  aliasesText: string;
};

type NetworkDraftEntry = CotadorProductNetworkManagerRecord;

type NetworkListStatusFilter = 'all' | 'with-network' | 'without-network';
type NetworkDirectoryMode = 'products' | 'hospitals';
type NetworkHospitalDataStatusFilter = 'all' | 'missing-bairro' | 'missing-regiao' | 'missing-any' | 'suspect-bairro' | 'complete';

type NetworkHospitalFormState = {
  nome: string;
  cidade: string;
  regiao: string;
  bairro: string;
  aliasesText: string;
  ativo: boolean;
};

type NetworkProductSummary = {
  product: CotadorProductManagerRecord;
  entries: CotadorHospitalNetworkEntry[];
  cities: string[];
};

const tabs: Array<{ id: CatalogTabId; label: string }> = [
  { id: 'operadoras', label: 'Operadoras' },
  { id: 'linhas', label: 'Linhas' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'tabelas', label: 'Tabelas' },
  { id: 'redes', label: 'Redes' },
  { id: 'administradoras', label: 'Administradoras' },
  { id: 'entidades', label: 'Entidades' },
];

const DEFAULT_BASE_FORM: BaseCatalogForm = {
  nome: '',
  ativo: true,
  observacoes: '',
};

const DEFAULT_LINE_FORM: LineFormState = {
  operadoraId: '',
  ...DEFAULT_BASE_FORM,
};

const DEFAULT_PRODUCT_FORM: ProductFormState = {
  nome: '',
  linhaId: '',
  administradoraId: '',
  modalidade: '',
  abrangencia: '',
  acomodacoes: [],
  entidadeIds: [],
  comissaoSugerida: 0,
  bonusPorVidaValor: 0,
  carencias: '',
  documentosNecessarios: '',
  reembolso: '',
  informacoesImportantes: '',
  ativo: true,
  observacoes: '',
};

const createEmptyTablePrices = () =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    accumulator[range] = '';
    return accumulator;
  }, {} as Record<CotadorAgeRange, string>);

const cloneTablePrices = (value?: Record<CotadorAgeRange, string>) =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    accumulator[range] = value?.[range] ?? '';
    return accumulator;
  }, {} as Record<CotadorAgeRange, string>);

const hasAnyTablePriceValue = (value: Record<CotadorAgeRange, string>) =>
  COTADOR_AGE_RANGES.some((range) => (value[range] ?? '').trim().length > 0);

const parseTablePricesInput = (value: Record<CotadorAgeRange, string>) =>
  Object.entries(value).reduce((accumulator, [range, rawValue]) => {
    const parsed = parseFormattedNumber(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      accumulator[range as CotadorAgeRange] = parsed;
    }
    return accumulator;
  }, {} as CotadorPriceRowInput);

const DEFAULT_TABLE_FORM: TableFormState = {
  produtoId: '',
  nome: '',
  codigo: '',
  modalidade: 'PME',
  perfilEmpresarial: 'todos',
  coparticipacao: 'sem',
  acomodacao: '',
  vidasMin: '',
  vidasMax: '',
  pricesByAgeRange: createEmptyTablePrices(),
  pricesByAcomodacao: {},
  ativo: true,
  observacoes: '',
};

const DEFAULT_NETWORK_ENTRY_FORM: NetworkEntryFormState = {
  hospital: '',
  cidade: '',
  regiao: '',
  bairro: '',
  atendimentos: [],
  observacoes: '',
  aliasesText: '',
};

const DEFAULT_NETWORK_HOSPITAL_FORM: NetworkHospitalFormState = {
  nome: '',
  cidade: '',
  regiao: '',
  bairro: '',
  aliasesText: '',
  ativo: true,
};

const modalidadeOptions = [
  { value: 'PF', label: 'PF' },
  { value: 'ADESAO', label: 'Adesao' },
  { value: 'PME', label: 'PME' },
] as const;

const perfilEmpresarialOptions = [
  { value: 'todos', label: 'Todos' },
  { value: 'mei', label: 'MEI' },
  { value: 'nao_mei', label: 'Não MEI' },
] as const;

const coparticipacaoOptions = [
  { value: 'sem', label: 'Sem copart.' },
  { value: 'parcial', label: 'Copart. parcial' },
  { value: 'total', label: 'Copart. total' },
] as const;

const networkServiceOptions = [
  { value: 'H', label: 'H' },
  { value: 'H CARD', label: 'H CARD' },
  { value: 'HD', label: 'HD' },
  { value: 'H ORT', label: 'H ORT' },
  { value: 'M', label: 'M' },
  { value: 'HP', label: 'HP' },
  { value: 'PA', label: 'PA' },
  { value: 'PS', label: 'PS' },
  { value: 'PS CARD', label: 'PS CARD' },
  { value: 'PS OBST', label: 'PS OBST' },
  { value: 'PSI', label: 'PSI' },
  { value: 'PSO', label: 'PSO' },
] as const;

const networkLegend = [
  'H: Hospital Eletivo',
  'H CARD: Hospital Cardiologico',
  'HD: Hospital Dia',
  'H ORT: Hospital Cirurgia Ortopedica',
  'M: Maternidade',
  'HP: Hospital Pediatrico',
  'PA: Pronto Atendimento',
  'PS: Pronto Socorro',
  'PS CARD: Pronto Socorro Cardiologico',
  'PS OBST: Pronto Socorro Obstetrico',
  'PSI: Pronto Socorro Infantil',
  'PSO: Pronto Socorro Ortopedico',
  '*: habilitado apenas na acomodacao QP',
  '**: habilitado apenas na acomodacao QC',
];

const formatPerfilEmpresarial = (value: 'todos' | 'mei' | 'nao_mei') => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Não MEI';
  return 'Todos';
};

const formatCoparticipacao = (value: 'sem' | 'parcial' | 'total') => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  return 'Sem copart.';
};

const normalizeCodeToken = (value?: string | null, maxLength = 10) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, maxLength);

const buildCoparticipacaoCode = (value: TableFormState['coparticipacao']) => {
  if (value === 'parcial') return 'CPARC';
  if (value === 'total') return 'CTOT';
  return 'SEMCP';
};

const buildPerfilCode = (value: TableFormState['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'NMEI';
  return 'TODOS';
};

const buildLivesCode = (vidasMin: string, vidasMax: string) => {
  const min = vidasMin.trim() || '1';
  const max = vidasMax.trim() || 'MAX';
  return `${min}A${max}`;
};

const buildLivesLabel = (vidasMin: string, vidasMax: string) => {
  const min = vidasMin.trim() || '1';
  const max = vidasMax.trim() || 'MAX';
  return `${min} a ${max} vidas`;
};

const formatTableModalidade = (value: TableFormState['modalidade']) => {
  if (value === 'ADESAO') return 'Adesao';
  return value;
};

const PRODUCT_ACOMODACAO_SEPARATOR = ' | ';

const normalizeSortText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseProductAcomodacoes = (value?: string | null, allowedValues?: string[]) => {
  const trimmed = value?.trim();
  if (!trimmed) return [] as string[];

  const allowed = (allowedValues ?? []).filter(Boolean);
  if (allowed.includes(trimmed)) {
    return [trimmed];
  }

  const tokens = trimmed
    .split(/\s*\|\s*|\s*\/\s*|\s*,\s*|\s*;\s*|\s*\+\s*|\s+e\s+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    return Array.from(new Set(tokens.length > 0 ? tokens : [trimmed]));
  }

  const allowedByNormalized = new Map(allowed.map((item) => [normalizeSortText(item), item]));
  const resolved = (tokens.length > 0 ? tokens : [trimmed])
    .map((token) => allowedByNormalized.get(normalizeSortText(token)) ?? null)
    .filter((token): token is string => Boolean(token));

  if (resolved.length > 0) {
    return Array.from(new Set(resolved));
  }

  return Array.from(new Set(tokens.length > 0 ? tokens : [trimmed]));
};

const sanitizeNetworkAliases = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => formatCotadorLocationText(item)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }

  if (typeof value !== 'string') {
    return [] as string[];
  }

  return Array.from(new Set(
    value
      .split(/\r?\n|;/)
      .map((item) => formatCotadorLocationText(item))
      .filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, 'pt-BR'));
};

const sanitizeNetworkEntry = (entry: Partial<NetworkDraftEntry>): NetworkDraftEntry | null => {
  const hospital = formatCotadorLocationText(entry.hospital);
  const cidade = formatCotadorLocationText(entry.cidade);

  if (!hospital || !cidade) return null;

  const regiao = resolveCotadorRegionByCity(cidade) ?? formatCotadorOptionalLocationText(entry.regiao);
  const bairro = sanitizeCotadorHospitalBairro(entry.bairro, hospital, cidade, regiao);
  const atendimentos = Array.from(new Set((entry.atendimentos ?? []).map((item) => item.trim()).filter(Boolean)));

  return {
    link_id: typeof entry.link_id === 'string' ? entry.link_id : null,
    hospital_id: typeof entry.hospital_id === 'string' ? entry.hospital_id : null,
    hospital,
    cidade,
    regiao,
    bairro,
    atendimentos,
    observacoes: entry.observacoes?.trim() || null,
    aliases: sanitizeNetworkAliases(entry.aliases),
  };
};

const sanitizeNetworkEntries = (value: unknown): NetworkDraftEntry[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => sanitizeNetworkEntry(item as Partial<NetworkDraftEntry>))
    .filter((item): item is NetworkDraftEntry => item !== null)
    .sort((left, right) => {
      const cityComparison = normalizeSortText(left.cidade).localeCompare(normalizeSortText(right.cidade), 'pt-BR');
      if (cityComparison !== 0) return cityComparison;
      const bairroComparison = normalizeSortText(left.bairro).localeCompare(normalizeSortText(right.bairro), 'pt-BR');
      if (bairroComparison !== 0) return bairroComparison;
      return normalizeSortText(left.hospital).localeCompare(normalizeSortText(right.hospital), 'pt-BR');
    });
};

const buildNetworkEntryIdentityKey = (entry: Pick<NetworkDraftEntry, 'hospital' | 'cidade' | 'bairro'>) => (
  [normalizeSortText(entry.hospital), normalizeSortText(entry.cidade), normalizeSortText(entry.bairro)].join('|')
);

const buildNetworkEntryLooseKey = (entry: Pick<NetworkDraftEntry, 'hospital' | 'cidade'>) => (
  [normalizeSortText(entry.hospital), normalizeSortText(entry.cidade)].join('|')
);

const mergeNetworkDraftEntries = (normalizedEntries: NetworkDraftEntry[], rawEntries: NetworkDraftEntry[]) => {
  const sanitizedNormalized = sanitizeNetworkEntries(normalizedEntries);
  const sanitizedRaw = sanitizeNetworkEntries(rawEntries);

  if (sanitizedNormalized.length === 0) {
    return sanitizedRaw;
  }

  const exactKeys = new Set(sanitizedNormalized.map((entry) => buildNetworkEntryIdentityKey(entry)));
  const looseCounts = sanitizedNormalized.reduce((accumulator, entry) => {
    const key = buildNetworkEntryLooseKey(entry);
    accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
    return accumulator;
  }, new Map<string, number>());

  const extras = sanitizedRaw.filter((entry) => {
    const exactKey = buildNetworkEntryIdentityKey(entry);
    if (entry.bairro && exactKeys.has(exactKey)) {
      return false;
    }

    const looseKey = buildNetworkEntryLooseKey(entry);
    const looseMatches = looseCounts.get(looseKey) ?? 0;
    if (looseMatches === 1) {
      return false;
    }

    if (!entry.bairro && looseMatches > 0) {
      return false;
    }

    return true;
  });

  return sanitizeNetworkEntries([...sanitizedNormalized, ...extras]);
};

const buildNetworkEntryFormFromValue = (entry?: NetworkDraftEntry | null): NetworkEntryFormState => ({
  hospital: entry?.hospital ?? '',
  cidade: entry?.cidade ?? '',
  regiao: entry?.regiao ?? resolveCotadorRegionByCity(entry?.cidade) ?? '',
  bairro: entry?.bairro ?? '',
  atendimentos: entry?.atendimentos ?? [],
  observacoes: entry?.observacoes ?? '',
  aliasesText: (entry?.aliases ?? []).join('\n'),
});

const buildNetworkHospitalFormFromValue = (hospital?: CotadorHospitalManagerRecord | null): NetworkHospitalFormState => ({
  nome: hospital?.nome ?? '',
  cidade: hospital?.cidade ?? '',
  regiao: hospital?.regiao ?? resolveCotadorRegionByCity(hospital?.cidade) ?? '',
  bairro: hospital?.bairro ?? '',
  aliasesText: (hospital?.aliases ?? []).join('\n'),
  ativo: hospital?.ativo ?? true,
});

const formatNetworkLocation = (entry: { bairro?: string | null; regiao?: string | null; cidade?: string | null }) =>
  formatCotadorHospitalLocationLabel(entry);

const hasSuspectHospitalBairro = (hospital: Pick<CotadorHospitalManagerRecord, 'nome' | 'cidade' | 'regiao' | 'bairro'>) => {
  const bairro = formatCotadorLocationText(hospital.bairro);
  if (!bairro) return false;

  const nome = formatCotadorLocationText(hospital.nome);
  const cidade = formatCotadorLocationText(hospital.cidade);
  const regiao = formatCotadorLocationText(hospital.regiao);

  if (bairro === nome || bairro === cidade || bairro === regiao) return true;
  if (/^(S\/N|SN|\d+)(\s|-)/.test(bairro)) return true;
  if (/^(RUA|R\.|R |AVENIDA|AV\.|AV |ESTRADA|ESTR\.|RODOVIA|ROD\.|ALAMEDA|TRAVESSA|TV\.|PRACA|PCA\.)/.test(bairro)) return true;
  if (/(ANDAR|SALA|BLOCO|LOJA|CONJ|CJ\b|TERREO|PAVIMENTO)/.test(bairro)) return true;

  return false;
};

const buildHospitalAliasSet = (hospital: Pick<CotadorHospitalManagerRecord, 'nome' | 'aliases'>) =>
  Array.from(new Set([hospital.nome, ...hospital.aliases].map((value) => normalizeSortText(value)).filter(Boolean)));

const getTokenOverlapRatio = (left: string, right: string) => {
  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(' ').filter((token) => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) shared += 1;
  });

  return shared / Math.max(leftTokens.size, rightTokens.size);
};

const getHospitalMergeCandidate = (
  left: CotadorHospitalManagerRecord,
  right: CotadorHospitalManagerRecord,
): NetworkHospitalMergeSuggestion | null => {
  const leftCity = normalizeSortText(left.cidade);
  const rightCity = normalizeSortText(right.cidade);
  if (!leftCity || leftCity !== rightCity) return null;

  const leftBairro = normalizeSortText(left.bairro);
  const rightBairro = normalizeSortText(right.bairro);
  const bothBairrosDefined = Boolean(leftBairro && rightBairro);
  const sameBairro = bothBairrosDefined && leftBairro === rightBairro;
  const oneMissingBairro = !leftBairro || !rightBairro;
  if (bothBairrosDefined && !sameBairro) {
    return null;
  }

  const leftAliases = buildHospitalAliasSet(left);
  const rightAliases = buildHospitalAliasSet(right);
  const sharedAliases = leftAliases.filter((alias) => rightAliases.includes(alias));
  const exactNameMatch = normalizeSortText(left.nome) === normalizeSortText(right.nome);
  const similarName = getTokenOverlapRatio(normalizeSortText(left.nome), normalizeSortText(right.nome));
  const sharedLinkedProducts = left.linkedProducts.filter((link) => right.linkedProducts.some((candidate) => candidate.produto_id === link.produto_id)).length;

  const reasons: string[] = [];
  let confidence: NetworkHospitalMergeSuggestion['confidence'] | null = null;

  if (exactNameMatch && (sameBairro || oneMissingBairro)) {
    confidence = 'high';
    reasons.push(sameBairro ? 'Mesmo nome e mesmo bairro' : 'Mesmo nome na mesma cidade com bairro faltando em um dos cadastros');
  }

  if (sharedAliases.length > 0 && (sameBairro || oneMissingBairro)) {
    confidence = confidence ?? 'high';
    reasons.push(`Alias em comum: ${sharedAliases.slice(0, 2).join(', ')}`);
  }

  if (!confidence && sameBairro && similarName >= 0.75) {
    confidence = 'medium';
    reasons.push('Mesmo bairro e nome muito parecido');
  }

  if (!confidence && oneMissingBairro && similarName >= 0.9) {
    confidence = 'medium';
    reasons.push('Mesmo nome/cidade com um bairro ainda ausente');
  }

  if (!confidence && sharedLinkedProducts > 0 && (exactNameMatch || similarName >= 0.85) && (sameBairro || oneMissingBairro)) {
    confidence = 'medium';
    reasons.push(`Ja aparecem juntos em ${sharedLinkedProducts} plano(s)`);
  }

  if (!confidence) return null;

  const leftStrength = (left.linkedProducts.length * 10) + (left.aliases.length * 2) + (left.bairro ? 3 : 0) + (left.regiao ? 2 : 0);
  const rightStrength = (right.linkedProducts.length * 10) + (right.aliases.length * 2) + (right.bairro ? 3 : 0) + (right.regiao ? 2 : 0);
  const target = leftStrength >= rightStrength ? left : right;
  const source = target.id === left.id ? right : left;

  return {
    key: [target.id, source.id].join('::'),
    targetId: target.id,
    sourceId: source.id,
    targetName: target.nome,
    sourceName: source.nome,
    city: target.cidade,
    targetLocation: formatNetworkLocation(target),
    sourceLocation: formatNetworkLocation(source),
    confidence,
    reasons: Array.from(new Set(reasons)),
    sharedLinkedProducts,
  };
};

const formatNetworkAliasesTextarea = (value: string) => value
  .split(/\r?\n/)
  .map((line) => formatCotadorLocationText(line))
  .filter(Boolean)
  .join('\n');

const serializeProductAcomodacoes = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(PRODUCT_ACOMODACAO_SEPARATOR);

const formatProductAcomodacoesLabel = (values: string[]) => {
  if (values.length === 0) return '';
  if (values.length === 1) return values[0];
  return values.join(' + ');
};

const stripTableAcomodacaoSuffix = (name: string, acomodacao?: string | null) => {
  const trimmedName = name.trim();
  const trimmedAcomodacao = acomodacao?.trim();
  if (!trimmedAcomodacao) return trimmedName;

  const suffix = ` - ${trimmedAcomodacao}`;
  return trimmedName.toLowerCase().endsWith(suffix.toLowerCase())
    ? trimmedName.slice(0, trimmedName.length - suffix.length)
    : trimmedName;
};

const compareCotadorProducts = (left: CotadorProductManagerRecord, right: CotadorProductManagerRecord) => {
  const comparisons = [
    normalizeSortText(left.modalidade).localeCompare(normalizeSortText(right.modalidade), 'pt-BR'),
    normalizeSortText(left.administradora?.nome).localeCompare(normalizeSortText(right.administradora?.nome), 'pt-BR'),
    normalizeSortText(formatProductAcomodacoesLabel(parseProductAcomodacoes(left.acomodacao))).localeCompare(normalizeSortText(formatProductAcomodacoesLabel(parseProductAcomodacoes(right.acomodacao))), 'pt-BR'),
    normalizeSortText(left.abrangencia).localeCompare(normalizeSortText(right.abrangencia), 'pt-BR'),
    left.nome.localeCompare(right.nome, 'pt-BR'),
  ];

  return comparisons.find((result) => result !== 0) ?? 0;
};

const compareCotadorTables = (left: CotadorTableManagerRecord, right: CotadorTableManagerRecord) => {
  const comparisons = [
    normalizeSortText(left.produto?.operadora?.nome).localeCompare(normalizeSortText(right.produto?.operadora?.nome), 'pt-BR'),
    normalizeSortText(left.produto?.linha?.nome).localeCompare(normalizeSortText(right.produto?.linha?.nome), 'pt-BR'),
    normalizeSortText(left.produto?.nome).localeCompare(normalizeSortText(right.produto?.nome), 'pt-BR'),
    normalizeSortText(left.modalidade).localeCompare(normalizeSortText(right.modalidade), 'pt-BR'),
    normalizeSortText(left.produto?.administradora?.nome).localeCompare(normalizeSortText(right.produto?.administradora?.nome), 'pt-BR'),
    normalizeSortText(left.acomodacao).localeCompare(normalizeSortText(right.acomodacao), 'pt-BR'),
    normalizeSortText(left.produto?.abrangencia).localeCompare(normalizeSortText(right.produto?.abrangencia), 'pt-BR'),
    (left.vidas_min ?? 0) - (right.vidas_min ?? 0),
    (left.vidas_max ?? Number.MAX_SAFE_INTEGER) - (right.vidas_max ?? Number.MAX_SAFE_INTEGER),
    normalizeSortText(left.nome).localeCompare(normalizeSortText(right.nome), 'pt-BR'),
  ];

  return comparisons.find((result) => result !== 0) ?? 0;
};

function FeedbackBanner({ message }: { message: Message | null }) {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
        message.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <span>{message.text}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
      <h4 className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{title}</h4>
      <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{description}</p>
    </div>
  );
}

function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
      <h4 className="mt-4 text-lg font-semibold text-red-900">{title}</h4>
      <p className="mt-2 text-sm text-red-700">{description}</p>
      <div className="mt-5 flex justify-center">
        <Button variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

function InlineCheckboxGroup({
  options,
  values,
  onChange,
  emptyMessage,
  scrollable = false,
}: {
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
  emptyMessage: string;
  scrollable?: boolean;
}) {
  const toggleValue = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-3 ${scrollable ? 'max-h-56 overflow-y-auto' : ''}`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const isChecked = values.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors ${
                isChecked
                  ? 'border-[color:var(--panel-border-strong,#9d7f5a)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)]'
                  : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-transparent text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface,#fffdfa)]'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleValue(option.value)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function CotadorCatalogTab({ embedded = false }: CotadorCatalogTabProps) {
  const { options } = useConfig();
  const [activeTab, setActiveTab] = useState<CatalogTabId>('operadoras');
  const [loading, setLoading] = useState(true);
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [administradoras, setAdministradoras] = useState<CotadorAdministradora[]>([]);
  const [entidades, setEntidades] = useState<CotadorEntidadeClasse[]>([]);
  const [linhas, setLinhas] = useState<CotadorLineManagerRecord[]>([]);
  const [produtos, setProdutos] = useState<CotadorProductManagerRecord[]>([]);
  const [tabelas, setTabelas] = useState<CotadorTableManagerRecord[]>([]);
  const [quotes, setQuotes] = useState<CotadorQuote[]>([]);
  const [importFailureCount, setImportFailureCount] = useState(0);
  const [entityModalKind, setEntityModalKind] = useState<'administradoras' | 'entidades' | null>(null);
  const [entityEditingId, setEntityEditingId] = useState<string | null>(null);
  const [entityForm, setEntityForm] = useState<BaseCatalogForm>(DEFAULT_BASE_FORM);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [lineEditingId, setLineEditingId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState<LineFormState>(DEFAULT_LINE_FORM);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(DEFAULT_PRODUCT_FORM);
  const [productSearch, setProductSearch] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importForm, setImportForm] = useState<ImportFormState>({ file: null });
  const [importPreview, setImportPreview] = useState<CotadorImportPreview | null>(null);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [importPreviewLoading, setImportPreviewLoading] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableModalMode, setTableModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [tableEditingId, setTableEditingId] = useState<string | null>(null);
  const [tableEditingRecords, setTableEditingRecords] = useState<CotadorTableManagerRecord[]>([]);
  const [tableForm, setTableForm] = useState<TableFormState>(DEFAULT_TABLE_FORM);
  const [tableNameTouched, setTableNameTouched] = useState(false);
  const [tableCodeTouched, setTableCodeTouched] = useState(false);
  const [tablesPage, setTablesPage] = useState(1);
  const [tablesPerPage, setTablesPerPage] = useState(25);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [networkProductId, setNetworkProductId] = useState<string | null>(null);
  const [networkDraft, setNetworkDraft] = useState<NetworkDraftEntry[]>([]);
  const [networkModalLoading, setNetworkModalLoading] = useState(false);
  const [networkEntryModalOpen, setNetworkEntryModalOpen] = useState(false);
  const [networkEntryForm, setNetworkEntryForm] = useState<NetworkEntryFormState>(DEFAULT_NETWORK_ENTRY_FORM);
  const [networkEditingIndex, setNetworkEditingIndex] = useState<number | null>(null);
  const [networkSearch, setNetworkSearch] = useState('');
  const [networkCity, setNetworkCity] = useState('');
  const [networkListSearch, setNetworkListSearch] = useState('');
  const [networkListOperadoraId, setNetworkListOperadoraId] = useState('');
  const [networkListLineId, setNetworkListLineId] = useState('');
  const [networkListCity, setNetworkListCity] = useState('');
  const [networkListStatus, setNetworkListStatus] = useState<NetworkListStatusFilter>('all');
  const [networkPage, setNetworkPage] = useState(1);
  const [networkPerPage, setNetworkPerPage] = useState(25);
  const [networkDirectoryMode, setNetworkDirectoryMode] = useState<NetworkDirectoryMode>('products');
  const [networkHospitals, setNetworkHospitals] = useState<CotadorHospitalManagerRecord[]>([]);
  const [networkHospitalsLoading, setNetworkHospitalsLoading] = useState(false);
  const [networkHospitalsError, setNetworkHospitalsError] = useState<string | null>(null);
  const [networkHospitalSearch, setNetworkHospitalSearch] = useState('');
  const [networkHospitalCity, setNetworkHospitalCity] = useState('');
  const [networkHospitalOperadoraId, setNetworkHospitalOperadoraId] = useState('');
  const [networkHospitalDataStatus, setNetworkHospitalDataStatus] = useState<NetworkHospitalDataStatusFilter>('all');
  const [networkHospitalPage, setNetworkHospitalPage] = useState(1);
  const [networkHospitalPerPage, setNetworkHospitalPerPage] = useState(25);
  const [mergingHospitalKey, setMergingHospitalKey] = useState<string | null>(null);
  const [networkHospitalModalOpen, setNetworkHospitalModalOpen] = useState(false);
  const [networkHospitalEditingId, setNetworkHospitalEditingId] = useState<string | null>(null);
  const [networkHospitalForm, setNetworkHospitalForm] = useState<NetworkHospitalFormState>(DEFAULT_NETWORK_HOSPITAL_FORM);
  const [networkImportModalOpen, setNetworkImportModalOpen] = useState(false);
  const [networkImportForm, setNetworkImportForm] = useState<ImportFormState>({ file: null });
  const [networkImportPreview, setNetworkImportPreview] = useState<CotadorImportPreview | null>(null);
  const [networkImportPreviewError, setNetworkImportPreviewError] = useState<string | null>(null);
  const [networkImportPreviewLoading, setNetworkImportPreviewLoading] = useState(false);
  const networkImportFileInputRef = useRef<HTMLInputElement | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  useEffect(() => {
    void loadCatalogData();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const lineOptions = useMemo(
    () => linhas.filter((line) => line.ativo).map((line) => ({ value: line.id, label: `${line.operadora?.nome ?? 'Operadora'} - ${line.nome}` })),
    [linhas],
  );

  const operadoraOptions = useMemo(
    () => operadoras.filter((operadora) => operadora.ativo).map((operadora) => ({ value: operadora.id, label: operadora.nome })),
    [operadoras],
  );

  const productOptions = useMemo(
    () => produtos.filter((product) => product.ativo).map((product) => ({ value: product.id, label: `${product.linha?.nome ?? 'Linha'} - ${product.nome}` })),
    [produtos],
  );

  const administradoraOptions = useMemo(
    () => administradoras.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [administradoras],
  );

  const entidadeOptions = useMemo(
    () => entidades.filter((item) => item.ativo).map((item) => ({ value: item.id, label: item.nome })),
    [entidades],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = productSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    if (!normalizedSearch) {
      return produtos;
    }

    return produtos.filter((product) => {
      const haystack = [
        product.nome,
        product.operadora?.nome,
        product.linha?.nome,
        product.modalidade,
        formatProductAcomodacoesLabel(parseProductAcomodacoes(product.acomodacao)),
        product.administradora?.nome,
        ...product.entidadesClasse.map((entity) => entity.nome),
      ]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [productSearch, produtos]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      operadoraNome: string;
      linhaNome: string;
      items: CotadorProductManagerRecord[];
    }>();

    filteredProducts.forEach((product) => {
      const operadoraNome = product.operadora?.nome ?? 'Operadora não encontrada';
      const linhaNome = product.linha?.nome ?? 'Linha não definida';
      const key = `${operadoraNome}::${linhaNome}`;
      const current = groups.get(key);

      if (current) {
        current.items.push(product);
        return;
      }

      groups.set(key, {
        key,
        operadoraNome,
        linhaNome,
        items: [product],
      });
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort(compareCotadorProducts),
      }))
      .sort((left, right) => {
        const operadoraComparison = left.operadoraNome.localeCompare(right.operadoraNome, 'pt-BR');
        if (operadoraComparison !== 0) return operadoraComparison;
        return left.linhaNome.localeCompare(right.linhaNome, 'pt-BR');
      });
  }, [filteredProducts]);

  const networkProducts = useMemo(
    () => [...produtos].sort(compareCotadorProducts),
    [produtos],
  );

  const networkProductSummaries = useMemo<NetworkProductSummary[]>(
    () => networkProducts.map((product) => {
      const entries = sanitizeNetworkEntries(product.rede_hospitalar);
      const cities = Array.from(new Set(entries.map((entry) => entry.cidade).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR'));

      return {
        product,
        entries,
        cities,
      };
    }),
    [networkProducts],
  );

  const networkListOperadoraOptions = useMemo(
    () => Array.from(new Map<string, NonNullable<CotadorProductManagerRecord['operadora']>>(
      networkProducts.reduce<Array<[string, NonNullable<CotadorProductManagerRecord['operadora']>]>>((accumulator, product) => {
        if (product.operadora?.id) {
          accumulator.push([product.operadora.id, product.operadora]);
        }
        return accumulator;
      }, []),
    ).values())
      .filter((operadora): operadora is NonNullable<CotadorProductManagerRecord['operadora']> => Boolean(operadora))
      .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
      .map((operadora) => ({ value: operadora.id, label: operadora.nome })),
    [networkProducts],
  );

  const networkListLineOptions = useMemo(
    () => Array.from(new Map<string, NonNullable<CotadorProductManagerRecord['linha']>>(
      networkProducts.reduce<Array<[string, NonNullable<CotadorProductManagerRecord['linha']>]>>((accumulator, product) => {
        if (product.linha?.id) {
          accumulator.push([product.linha.id, product.linha]);
        }
        return accumulator;
      }, []),
    ).values())
      .filter((line): line is NonNullable<CotadorProductManagerRecord['linha']> => Boolean(line))
      .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
      .map((line) => ({ value: line.id, label: line.nome })),
    [networkProducts],
  );

  const networkListCityOptions = useMemo(
    () => Array.from(new Set(networkProductSummaries.flatMap((summary) => summary.cities)))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .map((city) => ({ value: city, label: city })),
    [networkProductSummaries],
  );

  const filteredNetworkProducts = useMemo(() => {
    const normalizedSearch = normalizeSortText(networkListSearch);

    return networkProductSummaries.filter((summary) => {
      if (networkListOperadoraId && summary.product.operadora?.id !== networkListOperadoraId) return false;
      if (networkListLineId && summary.product.linha?.id !== networkListLineId) return false;
      if (networkListCity && !summary.cities.includes(networkListCity)) return false;
      if (networkListStatus === 'with-network' && summary.entries.length === 0) return false;
      if (networkListStatus === 'without-network' && summary.entries.length > 0) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        summary.product.nome,
        summary.product.operadora?.nome,
        summary.product.linha?.nome,
        summary.product.abrangencia,
        summary.product.acomodacao,
        ...summary.entries.map((entry) => [entry.hospital, entry.cidade, entry.regiao, entry.bairro, entry.atendimentos.join(' '), entry.observacoes].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeSortText(haystack).includes(normalizedSearch);
    });
  }, [networkListCity, networkListLineId, networkListOperadoraId, networkListSearch, networkListStatus, networkProductSummaries]);

  const totalNetworkPages = Math.max(1, Math.ceil(filteredNetworkProducts.length / networkPerPage));

  const networkProductsWithEntriesCount = useMemo(
    () => networkProductSummaries.filter((summary) => summary.entries.length > 0).length,
    [networkProductSummaries],
  );

  useEffect(() => {
    if (networkPage > totalNetworkPages) {
      setNetworkPage(totalNetworkPages);
    }
  }, [networkPage, totalNetworkPages]);

  const paginatedNetworkProducts = useMemo(() => {
    const startIndex = (networkPage - 1) * networkPerPage;
    return filteredNetworkProducts.slice(startIndex, startIndex + networkPerPage);
  }, [filteredNetworkProducts, networkPage, networkPerPage]);

  const lineOperadoraById = useMemo(
    () => new Map(linhas.map((line) => [line.id, line.operadora?.id ?? ''])),
    [linhas],
  );

  const modalidadeProductOptions = useMemo(
    () => (options.contract_modalidade || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_modalidade],
  );

  const abrangenciaOptions = useMemo(
    () => (options.contract_abrangencia || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_abrangencia],
  );

  const acomodacaoOptions = useMemo(
    () => (options.contract_acomodacao || []).filter((option) => option.ativo).map((option) => ({ value: option.label, label: option.label })),
    [options.contract_acomodacao],
  );

  const selectedTableProduct = useMemo(
    () => produtos.find((product) => product.id === tableForm.produtoId) ?? null,
    [produtos, tableForm.produtoId],
  );

  const selectedTableProductAcomodacoes = useMemo(
    () => parseProductAcomodacoes(selectedTableProduct?.acomodacao, acomodacaoOptions.map((option) => option.value)),
    [acomodacaoOptions, selectedTableProduct],
  );

  const tableFormAcomodacoes = useMemo(
    () => Object.keys(tableForm.pricesByAcomodacao).filter((value) => value.trim().length > 0),
    [tableForm.pricesByAcomodacao],
  );

  const groupedTableEntries = useMemo<GroupedTableEntry[]>(() => {
    const grouped = new Map<string, GroupedTableEntry>();

    [...tabelas].sort(compareCotadorTables).forEach((table) => {
      const baseName = stripTableAcomodacaoSuffix(table.nome, table.acomodacao);
      const key = [
        table.produto_id,
        normalizeSortText(baseName),
        table.modalidade,
        table.perfil_empresarial,
        table.coparticipacao,
        table.vidas_min ?? '',
        table.vidas_max ?? '',
      ].join('::');

      const current = grouped.get(key);
      if (current) {
        current.records.push(table);
        return;
      }

      grouped.set(key, {
        key,
        baseName,
        produtoId: table.produto_id,
        modalidade: table.modalidade,
        perfilEmpresarial: table.perfil_empresarial,
        coparticipacao: table.coparticipacao,
        vidasMin: table.vidas_min ?? null,
        vidasMax: table.vidas_max ?? null,
        product: table.produto ?? null,
        records: [table],
      });
    });

    return Array.from(grouped.values()).map((entry) => ({
      ...entry,
      records: [...entry.records].sort((left, right) => normalizeSortText(left.acomodacao).localeCompare(normalizeSortText(right.acomodacao), 'pt-BR')),
    }));
  }, [tabelas]);

  const activeTablesByProductId = useMemo(() => {
    const grouped = new Map<string, CotadorTableManagerRecord[]>();

    tabelas.forEach((table) => {
      if (!table.ativo) return;
      const current = grouped.get(table.produto_id) ?? [];
      current.push(table);
      grouped.set(table.produto_id, current);
    });

    return grouped;
  }, [tabelas]);

  const productCompletenessById = useMemo(() => {
    const next = new Map<string, ProductCompletenessStatus>();

    produtos.forEach((product) => {
      const activeTables = activeTablesByProductId.get(product.id) ?? [];
      const hasNetwork = sanitizeNetworkEntries(product.rede_hospitalar).length > 0;
      const hasPrice = activeTables.some((table) => Object.keys(table.pricesByAgeRange).length > 0);
      const hasCarencias = Boolean(product.carencias?.trim());
      const hasDocuments = Boolean(product.documentos_necessarios?.trim());
      const hasReembolso = Boolean(product.reembolso?.trim());

      const status: ProductCompletenessStatus = {
        missingNetwork: !hasNetwork,
        missingPrice: !hasPrice,
        missingCarencias: !hasCarencias,
        missingDocuments: !hasDocuments,
        missingReembolso: !hasReembolso,
        complete: hasNetwork && hasPrice && hasCarencias && hasDocuments && hasReembolso,
      };

      next.set(product.id, status);
    });

    return next;
  }, [activeTablesByProductId, produtos]);

  const activeCatalogKeys = useMemo(() => {
    const keys = new Set<string>();
    const productsWithActiveTables = new Set(tabelas.filter((table) => table.ativo).map((table) => table.produto_id));

    tabelas.forEach((table) => {
      const product = table.produto;
      if (table.ativo && product?.ativo && product.operadora?.ativo !== false && product.linha?.ativo !== false) {
        keys.add(`cotador-tabela:${table.id}`);
      }
    });

    produtos.forEach((product) => {
      if (product.ativo && product.operadora?.ativo !== false && product.linha?.ativo !== false && !productsWithActiveTables.has(product.id)) {
        keys.add(`cotador-produto:${product.id}`);
      }
    });

    return keys;
  }, [produtos, tabelas]);

  const catalogMetrics = useMemo(() => {
    const pfQuotes = quotes.filter((quote) => quote.modality === 'PF').length;
    const adesaoQuotes = quotes.filter((quote) => quote.modality === 'ADESAO').length;
    const pmeQuotes = quotes.filter((quote) => quote.modality === 'PME').length;
    const outdatedQuoteItems = quotes.reduce((total, quote) => total + quote.selectedItems.filter((item) => {
      if (!item.catalogItemKey.startsWith('cotador-')) return false;
      return !activeCatalogKeys.has(item.catalogItemKey);
    }).length, 0);

    const values = Array.from(productCompletenessById.values());
    return {
      totalProducts: produtos.length,
      totalQuotes: quotes.length,
      withoutNetwork: values.filter((status) => status.missingNetwork).length,
      withoutPrice: values.filter((status) => status.missingPrice).length,
      withoutCarencias: values.filter((status) => status.missingCarencias).length,
      withoutDocuments: values.filter((status) => status.missingDocuments).length,
      withoutReembolso: values.filter((status) => status.missingReembolso).length,
      completeProducts: values.filter((status) => status.complete).length,
      inactiveTables: tabelas.filter((table) => !table.ativo).length,
      outdatedQuoteItems,
      importFailureCount,
      quoteBreakdown: {
        pf: pfQuotes,
        adesao: adesaoQuotes,
        pme: pmeQuotes,
      },
    };
  }, [activeCatalogKeys, importFailureCount, productCompletenessById, produtos.length, quotes, tabelas]);

  const totalTablePages = Math.max(1, Math.ceil(groupedTableEntries.length / tablesPerPage));

  useEffect(() => {
    if (tablesPage > totalTablePages) {
      setTablesPage(totalTablePages);
    }
  }, [tablesPage, totalTablePages]);

  const paginatedTableEntries = useMemo(() => {
    const startIndex = (tablesPage - 1) * tablesPerPage;
    return groupedTableEntries.slice(startIndex, startIndex + tablesPerPage);
  }, [groupedTableEntries, tablesPage, tablesPerPage]);

  const selectedNetworkProduct = useMemo(
    () => produtos.find((product) => product.id === networkProductId) ?? null,
    [networkProductId, produtos],
  );

  const networkProductCityOptions = useMemo(
    () => Array.from(new Set(networkDraft.map((entry) => entry.cidade).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR')).map((city) => ({ value: city, label: city })),
    [networkDraft],
  );

  const filteredNetworkEntries = useMemo(() => {
    const normalizedSearch = normalizeSortText(networkSearch);

    return networkDraft.reduce<Array<{ entry: NetworkDraftEntry; index: number }>>((accumulator, entry, index) => {
      if (networkCity && entry.cidade !== networkCity) return accumulator;
      if (!normalizedSearch) {
        accumulator.push({ entry, index });
        return accumulator;
      }

      const matchesSearch = [entry.hospital, entry.cidade, entry.regiao, entry.bairro, entry.atendimentos.join(' '), entry.observacoes, entry.aliases.join(' ')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);

      if (matchesSearch) {
        accumulator.push({ entry, index });
      }

      return accumulator;
    }, []);
  }, [networkCity, networkDraft, networkSearch]);

  const networkImportPreviewItems = useMemo(
    () => (networkImportPreview?.items ?? []).filter((item) => item.networkEntriesCount > 0),
    [networkImportPreview],
  );

  const networkImportPreviewTablesCount = useMemo(
    () => networkImportPreviewItems.reduce((total, item) => total + item.tabelasCount, 0),
    [networkImportPreviewItems],
  );

  const networkImportPreviewEntriesCount = useMemo(
    () => networkImportPreviewItems.reduce((total, item) => total + item.networkEntriesCount, 0),
    [networkImportPreviewItems],
  );

  const selectedNetworkHospital = useMemo(
    () => networkHospitals.find((hospital) => hospital.id === networkHospitalEditingId) ?? null,
    [networkHospitalEditingId, networkHospitals],
  );

  const networkHospitalCityOptions = useMemo(
    () => Array.from(new Set(networkHospitals.map((hospital) => hospital.cidade).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .map((city) => ({ value: city, label: city })),
    [networkHospitals],
  );

  const networkHospitalOperadoraOptions = useMemo(
    () => Array.from(new Map<string, { value: string; label: string }>(
      networkHospitals.flatMap((hospital) => hospital.linkedProducts)
        .reduce<Array<[string, { value: string; label: string }]>>((accumulator, link) => {
          if (link.operadora?.id) {
            accumulator.push([link.operadora.id, { value: link.operadora.id, label: link.operadora.nome }]);
          }
          return accumulator;
        }, []),
    ).values()).sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
    [networkHospitals],
  );

  const filteredNetworkHospitals = useMemo(() => {
    const normalizedSearch = normalizeSortText(networkHospitalSearch);

    return networkHospitals.filter((hospital) => {
      const missingBairro = !hospital.bairro?.trim();
      const missingRegiao = !hospital.regiao?.trim();
      const suspectBairro = hasSuspectHospitalBairro(hospital);

      if (networkHospitalCity && hospital.cidade !== networkHospitalCity) return false;
      if (networkHospitalOperadoraId && !hospital.linkedProducts.some((link) => link.operadora?.id === networkHospitalOperadoraId)) return false;
      if (networkHospitalDataStatus === 'missing-bairro' && !missingBairro) return false;
      if (networkHospitalDataStatus === 'missing-regiao' && !missingRegiao) return false;
      if (networkHospitalDataStatus === 'missing-any' && !missingBairro && !missingRegiao) return false;
      if (networkHospitalDataStatus === 'suspect-bairro' && !suspectBairro) return false;
      if (networkHospitalDataStatus === 'complete' && (missingBairro || missingRegiao || suspectBairro)) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        hospital.nome,
        hospital.cidade,
        hospital.regiao,
        hospital.bairro,
        ...hospital.aliases,
        ...hospital.linkedProducts.map((link) => [link.produto_nome, link.operadora?.nome, link.linha?.nome, link.atendimentos.join(' '), link.observacoes].filter(Boolean).join(' ')),
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeSortText(haystack).includes(normalizedSearch);
    });
  }, [networkHospitalCity, networkHospitalDataStatus, networkHospitalOperadoraId, networkHospitalSearch, networkHospitals]);

  const networkHospitalsWithLinksCount = useMemo(
    () => networkHospitals.filter((hospital) => hospital.linkedProducts.length > 0).length,
    [networkHospitals],
  );

  const networkHospitalQualityCounts = useMemo(() => {
    const counts = {
      all: networkHospitals.length,
      'missing-bairro': 0,
      'missing-regiao': 0,
      'missing-any': 0,
      'suspect-bairro': 0,
      complete: 0,
    } satisfies Record<NetworkHospitalDataStatusFilter, number>;

    networkHospitals.forEach((hospital) => {
      const missingBairro = !hospital.bairro?.trim();
      const missingRegiao = !hospital.regiao?.trim();
      const suspectBairro = hasSuspectHospitalBairro(hospital);

      if (missingBairro) counts['missing-bairro'] += 1;
      if (missingRegiao) counts['missing-regiao'] += 1;
      if (missingBairro || missingRegiao) counts['missing-any'] += 1;
      if (suspectBairro) counts['suspect-bairro'] += 1;
      if (!missingBairro && !missingRegiao && !suspectBairro) counts.complete += 1;
    });

    return counts;
  }, [networkHospitals]);

  const networkHospitalMergeSuggestions = useMemo<NetworkHospitalMergeSuggestion[]>(() => {
    const suggestions: NetworkHospitalMergeSuggestion[] = [];

    for (let leftIndex = 0; leftIndex < networkHospitals.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < networkHospitals.length; rightIndex += 1) {
        const candidate = getHospitalMergeCandidate(networkHospitals[leftIndex], networkHospitals[rightIndex]);
        if (candidate) {
          suggestions.push(candidate);
        }
      }
    }

    return suggestions
      .sort((left, right) => {
        if (left.confidence !== right.confidence) {
          return left.confidence === 'high' ? -1 : 1;
        }
        if (left.sharedLinkedProducts !== right.sharedLinkedProducts) {
          return right.sharedLinkedProducts - left.sharedLinkedProducts;
        }
        return left.targetName.localeCompare(right.targetName, 'pt-BR');
      })
      .slice(0, 12);
  }, [networkHospitals]);

  const totalNetworkHospitalPages = Math.max(1, Math.ceil(filteredNetworkHospitals.length / networkHospitalPerPage));

  useEffect(() => {
    if (networkHospitalPage > totalNetworkHospitalPages) {
      setNetworkHospitalPage(totalNetworkHospitalPages);
    }
  }, [networkHospitalPage, totalNetworkHospitalPages]);

  const paginatedNetworkHospitals = useMemo(() => {
    const startIndex = (networkHospitalPage - 1) * networkHospitalPerPage;
    return filteredNetworkHospitals.slice(startIndex, startIndex + networkHospitalPerPage);
  }, [filteredNetworkHospitals, networkHospitalPage, networkHospitalPerPage]);

  const loadNetworkHospitals = async () => {
    setNetworkHospitalsLoading(true);
    setNetworkHospitalsError(null);

    try {
      const hospitals = await cotadorService.getHospitaisRedeDetalhados(true);
      setNetworkHospitals(hospitals);
    } catch (error) {
      console.error('Error loading detailed hospital network:', error);
      setNetworkHospitalsError(error instanceof Error ? error.message : 'Nao foi possivel carregar os hospitais compartilhados.');
      setNetworkHospitals([]);
    } finally {
      setNetworkHospitalsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'redes') {
      void loadNetworkHospitals();
    }
  }, [activeTab]);

  const resetNetworkHospitalModal = () => {
    setNetworkHospitalModalOpen(false);
    setNetworkHospitalEditingId(null);
    setNetworkHospitalForm(DEFAULT_NETWORK_HOSPITAL_FORM);
  };

  const openNetworkHospitalModal = (hospital: CotadorHospitalManagerRecord) => {
    setNetworkHospitalEditingId(hospital.id);
    setNetworkHospitalForm(buildNetworkHospitalFormFromValue(hospital));
    setNetworkHospitalModalOpen(true);
  };

  const handleNetworkHospitalSubmit = async () => {
    if (!selectedNetworkHospital) return;

    if (!networkHospitalForm.nome.trim() || !networkHospitalForm.cidade.trim() || !networkHospitalForm.regiao.trim()) {
      toast.error('Preencha nome, cidade e regiao para salvar o hospital compartilhado.');
      return;
    }

    setSubmitting(true);
    const payload: CotadorHospitalManagerInput = {
      nome: formatCotadorLocationText(networkHospitalForm.nome),
      cidade: formatCotadorLocationText(networkHospitalForm.cidade),
      regiao: resolveCotadorRegionByCity(networkHospitalForm.cidade) ?? formatCotadorOptionalLocationText(networkHospitalForm.regiao),
      bairro: sanitizeCotadorHospitalBairro(networkHospitalForm.bairro, networkHospitalForm.nome, networkHospitalForm.cidade, networkHospitalForm.regiao),
      aliases: sanitizeNetworkAliases(networkHospitalForm.aliasesText),
      ativo: networkHospitalForm.ativo,
    };

    const result = await cotadorService.updateHospitalRede(selectedNetworkHospital.id, payload);
    if (result.error) {
      toast.error('Nao foi possivel salvar o hospital compartilhado.');
      setSubmitting(false);
      return;
    }

    await Promise.all([loadCatalogData(), loadNetworkHospitals()]);
    toast.success('Hospital compartilhado atualizado com sucesso.');
    setSubmitting(false);
    resetNetworkHospitalModal();
  };

  const handleMergeNetworkHospitals = async (suggestion: NetworkHospitalMergeSuggestion) => {
    const confirmed = await requestConfirmation({
      title: 'Mesclar hospitais compartilhados',
      description: `O cadastro ${suggestion.sourceName} sera consolidado em ${suggestion.targetName}. Os aliases e vinculos de planos serao preservados.`,
      confirmLabel: 'Mesclar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setMergingHospitalKey(suggestion.key);
    const result = await cotadorService.mergeHospitaisRede(suggestion.targetId, suggestion.sourceId);
    if (result.error) {
      toast.error('Nao foi possivel mesclar os hospitais sugeridos.');
      setMergingHospitalKey(null);
      return;
    }

    await Promise.all([loadCatalogData(), loadNetworkHospitals()]);
    if (networkHospitalEditingId === suggestion.sourceId) {
      resetNetworkHospitalModal();
    }
    toast.success('Hospitais mesclados com sucesso.');
    setMergingHospitalKey(null);
  };

  const resetNetworkModal = () => {
    setNetworkModalOpen(false);
    setNetworkProductId(null);
    setNetworkDraft([]);
    setNetworkModalLoading(false);
    setNetworkEntryModalOpen(false);
    setNetworkEntryForm(DEFAULT_NETWORK_ENTRY_FORM);
    setNetworkEditingIndex(null);
    setNetworkSearch('');
    setNetworkCity('');
  };

  const openNetworkModal = async (product: CotadorProductManagerRecord) => {
    setNetworkProductId(product.id);
    setNetworkDraft([]);
    setNetworkModalLoading(true);
    setNetworkEntryModalOpen(false);
    setNetworkEntryForm(DEFAULT_NETWORK_ENTRY_FORM);
    setNetworkEditingIndex(null);
    setNetworkSearch('');
    setNetworkCity('');
    setNetworkModalOpen(true);

    const detailedNetwork = await cotadorService.getProdutoRedeHospitalarDetalhada(product.id);
    setNetworkDraft(mergeNetworkDraftEntries(detailedNetwork, sanitizeNetworkEntries(product.rede_hospitalar)));
    setNetworkModalLoading(false);
  };

  const openNetworkEntryCreateModal = () => {
    setNetworkEditingIndex(null);
    setNetworkEntryForm(DEFAULT_NETWORK_ENTRY_FORM);
    setNetworkEntryModalOpen(true);
  };

  const startEditingNetworkEntry = (entry: NetworkDraftEntry, index: number) => {
    setNetworkEditingIndex(index);
    setNetworkEntryForm(buildNetworkEntryFormFromValue(entry));
    setNetworkEntryModalOpen(true);
  };

  const resetNetworkEntryForm = () => {
    setNetworkEntryForm(DEFAULT_NETWORK_ENTRY_FORM);
    setNetworkEditingIndex(null);
    setNetworkEntryModalOpen(false);
  };

  const handleNetworkEntrySubmit = () => {
    if (!networkEntryForm.hospital.trim() || !networkEntryForm.cidade.trim() || !networkEntryForm.regiao.trim()) {
      toast.error('Preencha nome do hospital, cidade e regiao para salvar o cadastro.');
      return;
    }

    const currentEntry = networkEditingIndex === null ? null : networkDraft[networkEditingIndex] ?? null;
    const sanitizedEntry = sanitizeNetworkEntry({
      ...currentEntry,
      hospital: networkEntryForm.hospital,
      cidade: networkEntryForm.cidade,
      regiao: networkEntryForm.regiao,
      bairro: networkEntryForm.bairro,
      atendimentos: networkEntryForm.atendimentos,
      observacoes: networkEntryForm.observacoes,
      aliases: sanitizeNetworkAliases(networkEntryForm.aliasesText),
    });
    if (!sanitizedEntry) {
      toast.error('Nao foi possivel validar o hospital informado.');
      return;
    }

    setNetworkDraft((current) => {
      if (networkEditingIndex === null) {
        return sanitizeNetworkEntries([...current, sanitizedEntry]);
      }

      return sanitizeNetworkEntries(current.map((entry, index) => index === networkEditingIndex ? sanitizedEntry : entry));
    });

    toast.success(networkEditingIndex === null ? 'Prestador adicionado na rede.' : 'Prestador atualizado na rede.');
    resetNetworkEntryForm();
  };

  const handleRemoveNetworkEntry = (entryIndex: number) => {
    setNetworkDraft((current) => current.filter((_, index) => index !== entryIndex));
    if (networkEditingIndex === entryIndex) {
      resetNetworkEntryForm();
    }
    toast.success('Prestador removido da rede.');
  };

  const handleSaveNetwork = async () => {
    if (!selectedNetworkProduct) return;

    setSubmitting(true);
    const sanitizedDraft = sanitizeNetworkEntries(networkDraft);
    const result = await cotadorService.replaceProdutoRedeHospitalarDetalhada(
      selectedNetworkProduct.id,
      sanitizedDraft.map<CotadorProductNetworkManagerInput>((entry) => ({
        linkId: entry.link_id,
        hospitalId: entry.hospital_id,
        hospital: entry.hospital,
        cidade: entry.cidade,
        regiao: entry.regiao,
        bairro: entry.bairro,
        atendimentos: entry.atendimentos,
        observacoes: entry.observacoes,
        aliases: entry.aliases,
      })),
    );

    if (result.error) {
      toast.error('Nao foi possivel salvar a rede hospitalar deste produto.');
      setSubmitting(false);
      return;
    }

    await Promise.all([loadCatalogData(), loadNetworkHospitals()]);
    toast.success('Rede hospitalar salva com sucesso.');
    setSubmitting(false);
    resetNetworkModal();
  };

  const resetNetworkImportModal = () => {
    setNetworkImportModalOpen(false);
    setNetworkImportForm({ file: null });
    setNetworkImportPreview(null);
    setNetworkImportPreviewError(null);
    setNetworkImportPreviewLoading(false);
    if (networkImportFileInputRef.current) {
      networkImportFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!networkImportModalOpen || !networkImportForm.file) {
      setNetworkImportPreview(null);
      setNetworkImportPreviewError(null);
      setNetworkImportPreviewLoading(false);
      return;
    }

    let isCancelled = false;
    setNetworkImportPreviewLoading(true);
    setNetworkImportPreviewError(null);

    void networkImportForm.file.text()
      .then((content) => {
        if (isCancelled) return;
        const preview = cotadorImportService.previewFromText('json-completo', content);
        setNetworkImportPreview(preview);
      })
      .catch((error) => {
        if (isCancelled) return;
        setNetworkImportPreview(null);
        setNetworkImportPreviewError(error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo selecionado.');
      })
      .finally(() => {
        if (isCancelled) return;
        setNetworkImportPreviewLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [networkImportForm.file, networkImportModalOpen]);

  const handleNetworkImportSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!networkImportForm.file) {
      toast.error('Selecione um arquivo JSON para importar a rede.');
      return;
    }

    if (networkImportPreviewError) {
      toast.error(networkImportPreviewError);
      return;
    }

    if (networkImportPreviewItems.length === 0 || networkImportPreviewEntriesCount === 0) {
      toast.error('O arquivo nao contem itens de rede hospitalar para importar.');
      return;
    }

    if (networkImportPreviewTablesCount > 0) {
      toast.error('Este modal aceita apenas JSON focado em rede. Para importar tabelas, use o importador geral do catalogo.');
      return;
    }

    setSubmitting(true);
    try {
      const content = await networkImportForm.file.text();
      const result = await cotadorImportService.importFromText('json-completo', content);
      await Promise.all([loadCatalogData(), loadNetworkHospitals()]);

      if (result.importedNetworkEntries === 0) {
        toast.error('Nenhum item de rede foi importado. Revise o arquivo e tente novamente.');
        return;
      }

      toast.success(`Importacao de rede concluida: ${result.importedNetworkEntries} item(ns) em ${networkImportPreviewItems.length} produto(s).`);
      resetNetworkImportModal();
    } catch (error) {
      setImportFailureCount((current) => current + 1);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel importar a rede.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeTablePricingAcomodacoes = tableModalMode === 'create'
    ? selectedTableProductAcomodacoes
    : tableFormAcomodacoes;

  const useMultiAcomodacaoPricing = activeTablePricingAcomodacoes.length > 1;

  const autoGeneratedTableCode = useMemo(() => {
    if (!selectedTableProduct) {
      return '';
    }

    const tokens = [
      normalizeCodeToken(selectedTableProduct.operadora?.nome, 6),
      normalizeCodeToken(selectedTableProduct.nome, 12),
      tableForm.modalidade,
      buildPerfilCode(tableForm.perfilEmpresarial),
      buildCoparticipacaoCode(tableForm.coparticipacao),
      buildLivesCode(tableForm.vidasMin, tableForm.vidasMax),
    ].filter(Boolean);

    return tokens.join('-');
  }, [selectedTableProduct, tableForm.coparticipacao, tableForm.modalidade, tableForm.perfilEmpresarial, tableForm.vidasMax, tableForm.vidasMin]);

  const autoGeneratedTableName = useMemo(() => {
    const tokens = [formatTableModalidade(tableForm.modalidade)];

    if (tableForm.perfilEmpresarial !== 'todos') {
      tokens.push(formatPerfilEmpresarial(tableForm.perfilEmpresarial));
    }

    tokens.push(formatCoparticipacao(tableForm.coparticipacao));

    return `${tokens.join(' ')} - ${buildLivesLabel(tableForm.vidasMin, tableForm.vidasMax)}`;
  }, [tableForm.coparticipacao, tableForm.modalidade, tableForm.perfilEmpresarial, tableForm.vidasMax, tableForm.vidasMin]);

  useEffect(() => {
    if (!tableModalOpen || tableNameTouched) {
      return;
    }

    setTableForm((current) => {
      if (current.nome === autoGeneratedTableName) {
        return current;
      }

      return {
        ...current,
        nome: autoGeneratedTableName,
      };
    });
  }, [autoGeneratedTableName, tableModalOpen, tableNameTouched]);

  useEffect(() => {
    if (!tableModalOpen || tableCodeTouched) {
      return;
    }

    setTableForm((current) => {
      if (current.codigo === autoGeneratedTableCode) {
        return current;
      }

      return {
        ...current,
        codigo: autoGeneratedTableCode,
      };
    });
  }, [autoGeneratedTableCode, tableCodeTouched, tableModalOpen]);

  useEffect(() => {
    if (!tableModalOpen || tableModalMode !== 'create' || selectedTableProductAcomodacoes.length <= 1) {
      return;
    }

    setTableForm((current) => {
      const nextPricesByAcomodacao = selectedTableProductAcomodacoes.reduce((accumulator, acomodacao) => {
        accumulator[acomodacao] = cloneTablePrices(
          current.pricesByAcomodacao[acomodacao]
          ?? (hasAnyTablePriceValue(current.pricesByAgeRange) ? current.pricesByAgeRange : undefined),
        );
        return accumulator;
      }, {} as Record<string, Record<CotadorAgeRange, string>>);

      return {
        ...current,
        pricesByAcomodacao: nextPricesByAcomodacao,
      };
    });
  }, [selectedTableProductAcomodacoes, tableModalMode, tableModalOpen]);

  const showMessage = (type: Message['type'], text: string) => {
    setMessage({ type, text });
    if (type === 'success') {
      toast.success(text);
      return;
    }
    toast.error(text);
  };

  const loadCatalogData = async () => {
    setLoading(true);
    setCatalogLoadError(null);

    try {
      const [nextOperadoras, nextAdministradoras, nextEntidades, nextLinhas, nextProdutos, nextTabelas, nextQuotes] = await Promise.all([
        configService.getOperadoras(true),
        cotadorService.getAdministradoras(true),
        cotadorService.getEntidadesClasse(true),
        cotadorService.getLinhas(true),
        cotadorService.getProdutos(true),
        cotadorService.getTabelas(true),
        cotadorService.getQuotes(),
      ]);

      setOperadoras(nextOperadoras);
      setAdministradoras(nextAdministradoras);
      setEntidades(nextEntidades);
      setLinhas(nextLinhas);
      setProdutos(nextProdutos);
      setTabelas(nextTabelas);
      setQuotes(nextQuotes);
    } catch (error) {
      console.error('Error loading Cotador catalog admin data:', error);
      setCatalogLoadError(error instanceof Error ? error.message : 'Nao foi possivel carregar o catalogo do Cotador.');
    } finally {
      setLoading(false);
    }
  };

  const activeImportTemplate = useMemo(() => cotadorImportService.getTemplate('json-completo'), []);

  const handleDownloadImportTemplate = () => {
    const blob = new Blob([activeImportTemplate], { type: 'application/json;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'cotador-import-template.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  const resetImportModal = () => {
    setImportModalOpen(false);
    setImportForm({ file: null });
    setImportPreview(null);
    setImportPreviewError(null);
    setImportPreviewLoading(false);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!importModalOpen || !importForm.file) {
      setImportPreview(null);
      setImportPreviewError(null);
      setImportPreviewLoading(false);
      return;
    }

    let isCancelled = false;
    setImportPreviewLoading(true);
    setImportPreviewError(null);

    void importForm.file.text()
      .then(async (content) => {
        if (isCancelled) return;
        const preview = await cotadorImportService.previewDiffFromText('json-completo', content);
        setImportPreview(preview);
      })
      .catch((error) => {
        if (isCancelled) return;
        setImportPreview(null);
        setImportPreviewError(error instanceof Error ? error.message : 'Não foi possível ler o arquivo selecionado.');
      })
      .finally(() => {
        if (isCancelled) return;
        setImportPreviewLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [importForm.file, importModalOpen]);

  const handleImportSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!importForm.file) {
      showMessage('error', 'Selecione um arquivo para importar.');
      return;
    }

    if (importPreviewError) {
      showMessage('error', importPreviewError);
      return;
    }

    if (importPreview?.actionCounts.conflict) {
      showMessage('error', 'Resolva os conflitos do preview antes de importar o arquivo.');
      return;
    }

    setSubmitting(true);
    try {
      const content = await importForm.file.text();
      const result = await cotadorImportService.importFromText('json-completo', content);
      await loadCatalogData();

      const summaryParts = [];
      if (result.importedProducts > 0) summaryParts.push(`${result.importedProducts} produto(s)`);
      if (result.importedTables > 0) summaryParts.push(`${result.importedTables} tabela(s)`);
      if (result.importedNetworkEntries > 0) summaryParts.push(`${result.importedNetworkEntries} item(ns) de rede`);
      if (result.warnings.length > 0) summaryParts.push(`${result.warnings.length} aviso(s)`);

      if (summaryParts.length === 0) {
        showMessage('error', 'Nenhum item foi importado. Revise o arquivo e tente novamente.');
        return;
      }

      showMessage('success', `Importação concluída${summaryParts.length > 0 ? `: ${summaryParts.join(', ')}` : '.'}`);
      resetImportModal();
    } catch (error) {
      setImportFailureCount((current) => current + 1);
      showMessage('error', error instanceof Error ? error.message : 'Não foi possível importar o arquivo.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetEntityModal = () => {
    setEntityModalKind(null);
    setEntityEditingId(null);
    setEntityForm(DEFAULT_BASE_FORM);
  };

  const resetLineModal = () => {
    setLineModalOpen(false);
    setLineEditingId(null);
    setLineForm(DEFAULT_LINE_FORM);
  };

  const resetProductModal = () => {
    setProductModalOpen(false);
    setProductEditingId(null);
    setProductForm(DEFAULT_PRODUCT_FORM);
  };

  const resetTableModal = () => {
    setTableModalOpen(false);
    setTableModalMode('create');
    setTableEditingId(null);
    setTableEditingRecords([]);
    setTableForm(DEFAULT_TABLE_FORM);
    setTableNameTouched(false);
    setTableCodeTouched(false);
  };

  const openEntityModal = (kind: 'administradoras' | 'entidades', item?: BaseCatalogForm & { id?: string }) => {
    setEntityModalKind(kind);
    setEntityEditingId(item?.id ?? null);
    setEntityForm({
      nome: item?.nome ?? '',
      ativo: item?.ativo ?? true,
      observacoes: item?.observacoes ?? '',
    });
  };

  const openLineModal = (line?: CotadorLineManagerRecord) => {
    setLineEditingId(line?.id ?? null);
    setLineForm({
      operadoraId: line?.operadora_id ?? '',
      nome: line?.nome ?? '',
      ativo: line?.ativo ?? true,
      observacoes: line?.observacoes ?? '',
    });
    setLineModalOpen(true);
  };

  const openProductModal = (product?: CotadorProductManagerRecord) => {
    setProductEditingId(product?.id ?? null);
    setProductForm({
      nome: product?.nome ?? '',
      linhaId: product?.linha_id ?? '',
      administradoraId: product?.administradora_id ?? '',
      modalidade: product?.modalidade ?? '',
      abrangencia: product?.abrangencia ?? '',
      acomodacoes: parseProductAcomodacoes(product?.acomodacao, acomodacaoOptions.map((option) => option.value)),
      entidadeIds: product?.entidadesClasse.map((entity) => entity.id) ?? [],
      comissaoSugerida: product?.comissao_sugerida ?? 0,
      bonusPorVidaValor: product?.bonus_por_vida_valor ?? 0,
      carencias: product?.carencias ?? '',
      documentosNecessarios: product?.documentos_necessarios ?? '',
      reembolso: product?.reembolso ?? '',
      informacoesImportantes: product?.informacoes_importantes ?? '',
      ativo: product?.ativo ?? true,
      observacoes: product?.observacoes ?? '',
    });
    setProductModalOpen(true);
  };

  const openTableModal = (
    tableInput?: CotadorTableManagerRecord | CotadorTableManagerRecord[],
    mode: 'create' | 'edit' | 'duplicate' = tableInput ? 'edit' : 'create',
  ) => {
    const tableRecords = tableInput ? (Array.isArray(tableInput) ? tableInput : [tableInput]) : [];
    const primaryTable = tableRecords[0];
    const priceFields = createEmptyTablePrices();
    COTADOR_AGE_RANGES.forEach((range) => {
      const value = primaryTable?.pricesByAgeRange[range];
      if (typeof value === 'number') {
        priceFields[range] = formatCurrencyFromNumber(value);
      }
    });

    const pricesByAcomodacao = tableRecords.reduce((accumulator, record) => {
      if (record.acomodacao) {
        const formattedPrices = createEmptyTablePrices();
        COTADOR_AGE_RANGES.forEach((range) => {
          const value = record.pricesByAgeRange[range];
          if (typeof value === 'number') {
            formattedPrices[range] = formatCurrencyFromNumber(value);
          }
        });
        accumulator[record.acomodacao] = formattedPrices;
      }
      return accumulator;
    }, {} as Record<string, Record<CotadorAgeRange, string>>);

    const baseName = primaryTable ? stripTableAcomodacaoSuffix(primaryTable.nome, primaryTable.acomodacao) : '';

    setTableModalMode(mode);
    setTableEditingId(mode === 'edit' && tableRecords.length === 1 ? primaryTable?.id ?? null : null);
    setTableEditingRecords(mode === 'edit' ? tableRecords : []);
    setTableForm({
      produtoId: primaryTable?.produto_id ?? '',
      nome: mode === 'duplicate' && baseName ? `${baseName} - copia` : tableRecords.length > 1 ? baseName : primaryTable?.nome ?? '',
      codigo: mode === 'duplicate' ? '' : primaryTable?.codigo ?? '',
      modalidade: primaryTable?.modalidade ?? 'PME',
      perfilEmpresarial: primaryTable?.perfil_empresarial ?? 'todos',
      coparticipacao: primaryTable?.coparticipacao ?? 'sem',
      acomodacao: tableRecords.length === 1 ? primaryTable?.acomodacao ?? primaryTable?.produto?.acomodacao ?? '' : '',
      vidasMin: primaryTable?.vidas_min ? String(primaryTable.vidas_min) : '',
      vidasMax: primaryTable?.vidas_max ? String(primaryTable.vidas_max) : '',
      pricesByAgeRange: priceFields,
      pricesByAcomodacao: pricesByAcomodacao,
      ativo: primaryTable?.ativo ?? true,
      observacoes: primaryTable?.observacoes ?? '',
    });
    setTableNameTouched(mode !== 'create');
    setTableCodeTouched(mode === 'edit' ? Boolean(primaryTable?.codigo) : false);
    setTableModalOpen(true);
  };

  const handleEntitySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!entityModalKind) return;

    setSubmitting(true);
    const result = entityModalKind === 'administradoras'
      ? entityEditingId
        ? await cotadorService.updateAdministradora(entityEditingId, entityForm)
        : await cotadorService.createAdministradora(entityForm)
      : entityEditingId
        ? await cotadorService.updateEntidadeClasse(entityEditingId, entityForm)
        : await cotadorService.createEntidadeClasse(entityForm);

    if (result.error) {
      showMessage('error', 'Erro ao salvar item do catálogo.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Item salvo com sucesso.');
    setSubmitting(false);
    resetEntityModal();
  };

  const handleLineSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!lineForm.operadoraId) {
      showMessage('error', 'Selecione a operadora da linha.');
      return;
    }

    setSubmitting(true);
    const payload = {
      operadora_id: lineForm.operadoraId,
      nome: lineForm.nome,
      ativo: lineForm.ativo,
      observacoes: lineForm.observacoes,
    };
    const result = lineEditingId
      ? await cotadorService.updateLinha(lineEditingId, payload)
      : await cotadorService.createLinha(payload);

    if (result.error) {
      showMessage('error', 'Erro ao salvar linha de produto.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Linha salva com sucesso.');
    setSubmitting(false);
    resetLineModal();
  };

  const handleProductSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!productForm.linhaId) {
      showMessage('error', 'Selecione a linha do produto.');
      return;
    }

    if (acomodacaoOptions.length > 0 && productForm.acomodacoes.length === 0) {
      showMessage('error', 'Defina ao menos uma acomodação para o produto.');
      return;
    }

    const operadoraId = lineOperadoraById.get(productForm.linhaId);
    if (!operadoraId) {
      showMessage('error', 'Não foi possível resolver a operadora desta linha.');
      return;
    }

    const payload: CotadorProductManagerInput = {
      operadora_id: operadoraId,
      linha_id: productForm.linhaId,
      administradora_id: productForm.administradoraId || null,
      nome: productForm.nome,
      modalidade: productForm.modalidade || null,
      abrangencia: productForm.abrangencia || null,
      acomodacao: serializeProductAcomodacoes(productForm.acomodacoes) || null,
      entidadeIds: productForm.entidadeIds,
      comissao_sugerida: productForm.comissaoSugerida,
      bonus_por_vida_valor: productForm.bonusPorVidaValor,
      carencias: productForm.carencias || null,
      documentos_necessarios: productForm.documentosNecessarios || null,
      reembolso: productForm.reembolso || null,
      informacoes_importantes: productForm.informacoesImportantes || null,
      ativo: productForm.ativo,
      observacoes: productForm.observacoes,
    };

    setSubmitting(true);
    const result = productEditingId
      ? await cotadorService.updateProduto(productEditingId, payload)
      : await cotadorService.createProduto(payload);

    if (result.error) {
      showMessage('error', 'Erro ao salvar produto do Cotador.');
      setSubmitting(false);
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Produto salvo com sucesso.');
    setSubmitting(false);
    resetProductModal();
  };

  const handleTableSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tableForm.produtoId) {
      showMessage('error', 'Selecione o produto da tabela.');
      return;
    }

    const pricesByAgeRange = parseTablePricesInput(tableForm.pricesByAgeRange);

    const payload: CotadorTableManagerInput = {
      produto_id: tableForm.produtoId,
      nome: tableForm.nome,
      codigo: tableForm.codigo || null,
      modalidade: tableForm.modalidade,
      perfil_empresarial: tableForm.perfilEmpresarial,
      coparticipacao: tableForm.coparticipacao,
      acomodacao: tableForm.acomodacao || null,
      vidas_min: tableForm.vidasMin ? Number.parseInt(tableForm.vidasMin, 10) : null,
      vidas_max: tableForm.vidasMax ? Number.parseInt(tableForm.vidasMax, 10) : null,
      observacoes: tableForm.observacoes,
      ativo: tableForm.ativo,
      pricesByAgeRange,
    };

    setSubmitting(true);
    if (tableEditingRecords.length > 1) {
      const editingRecordByAcomodacao = new Map(tableEditingRecords.map((record) => [record.acomodacao ?? '', record]));

      for (const acomodacao of tableFormAcomodacoes) {
        const existingRecord = editingRecordByAcomodacao.get(acomodacao);
        if (!existingRecord) {
          continue;
        }

        const result = await cotadorService.updateTabela(existingRecord.id, {
          ...payload,
          nome: tableForm.nome,
          codigo: payload.codigo,
          acomodacao,
          pricesByAgeRange: parseTablePricesInput(tableForm.pricesByAcomodacao[acomodacao] ?? createEmptyTablePrices()),
        });

        if (result.error) {
          showMessage('error', 'Erro ao salvar tabela comercial.');
          setSubmitting(false);
          return;
        }
      }
    } else if (tableEditingId) {
      const result = await cotadorService.updateTabela(tableEditingId, payload);

      if (result.error) {
        showMessage('error', 'Erro ao salvar tabela comercial.');
        setSubmitting(false);
        return;
      }
    } else {
      const targetAcomodacoes = tableModalMode === 'duplicate'
        ? (tableFormAcomodacoes.length > 0 ? tableFormAcomodacoes : [tableForm.acomodacao || null])
        : selectedTableProductAcomodacoes.length > 0
          ? selectedTableProductAcomodacoes
          : [];

      if (tableModalMode === 'create' && acomodacaoOptions.length > 0 && targetAcomodacoes.length === 0) {
        showMessage('error', 'Defina as acomodações no produto antes de criar a tabela.');
        setSubmitting(false);
        return;
      }

      const resolvedAcomodacoes = targetAcomodacoes.length > 0 ? targetAcomodacoes : [null];
      const createdTableIds: string[] = [];

      for (const acomodacao of resolvedAcomodacoes) {
        const shouldSuffix = false;
        const accommodationPrices = useMultiAcomodacaoPricing && acomodacao
          ? parseTablePricesInput(tableForm.pricesByAcomodacao[acomodacao] ?? createEmptyTablePrices())
          : pricesByAgeRange;
        const result = await cotadorService.createTabela({
          ...payload,
          nome: shouldSuffix && acomodacao ? `${tableForm.nome} - ${acomodacao}` : payload.nome,
          codigo: shouldSuffix && acomodacao && payload.codigo
            ? `${payload.codigo}-${normalizeCodeToken(acomodacao, 6)}`
            : payload.codigo,
          acomodacao,
          pricesByAgeRange: accommodationPrices,
        });

        if (result.error || !result.data) {
          if (createdTableIds.length > 0) {
            await Promise.all(createdTableIds.map((id) => cotadorService.deleteTabela(id)));
          }
          showMessage('error', 'Não foi possível salvar todas as tabelas comerciais. Alterações parciais foram revertidas.');
          setSubmitting(false);
          return;
        }

        createdTableIds.push(result.data.id);
      }
    }

    await loadCatalogData();
    showMessage('success', tableEditingRecords.length > 1 || (tableModalMode === 'create' && selectedTableProductAcomodacoes.length > 1) ? 'Tabela salva com sucesso.' : 'Tabela salva com sucesso.');
    setSubmitting(false);
    resetTableModal();
  };

  const handleDelete = async (
    kind: 'administradoras' | 'entidades' | 'linhas' | 'produtos' | 'tabelas',
    id: string,
    title: string,
    description: string,
  ) => {
    const confirmed = await requestConfirmation({
      title,
      description,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result =
      kind === 'administradoras'
        ? await cotadorService.deleteAdministradora(id)
        : kind === 'entidades'
          ? await cotadorService.deleteEntidadeClasse(id)
          : kind === 'linhas'
            ? await cotadorService.deleteLinha(id)
            : kind === 'produtos'
              ? await cotadorService.deleteProduto(id)
              : await cotadorService.deleteTabela(id);

    if (result.error) {
      showMessage('error', 'Erro ao excluir item do catálogo.');
      return;
    }

    await loadCatalogData();
    showMessage('success', 'Item removido com sucesso.');
  };

  const handleDeleteTableGroup = async (entry: GroupedTableEntry) => {
    if (entry.records.length === 1) {
      await handleDelete('tabelas', entry.records[0].id, 'Excluir tabela', 'Essa ação remove a tabela comercial, mas snapshots já usados em cotações permanecem preservados.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Excluir tabela comercial',
      description: 'Essa ação remove as variações de acomodação desta tabela comercial, mas snapshots já usados em cotações permanecem preservados.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    for (const record of entry.records) {
      const result = await cotadorService.deleteTabela(record.id);
      if (result.error) {
        showMessage('error', 'Erro ao excluir tabela comercial.');
        return;
      }
    }

    await loadCatalogData();
    showMessage('success', 'Tabela removida com sucesso.');
  };

  const containerClass = embedded ? 'space-y-6' : 'panel-page-shell space-y-6';

  return (
    <div className={containerClass}>
      <FeedbackBanner message={message} />

      <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">
              <Layers3 className="h-3.5 w-3.5" />
              Catálogo do Cotador
            </div>
            <h3 className="text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Configurações</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeTab === 'linhas' && (
              <Button onClick={() => openLineModal()}>
                <Plus className="h-4 w-4" />
                Nova linha
              </Button>
            )}
            {activeTab === 'produtos' && (
              <Button onClick={() => openProductModal()}>
                <Plus className="h-4 w-4" />
                Novo produto
              </Button>
            )}
            {activeTab === 'tabelas' && (
              <Button onClick={() => openTableModal()}>
                <Plus className="h-4 w-4" />
                Nova tabela
              </Button>
            )}
            {(activeTab === 'administradoras' || activeTab === 'entidades') && (
              <Button onClick={() => openEntityModal(activeTab, undefined)}>
                <Plus className="h-4 w-4" />
                {activeTab === 'administradoras' ? 'Nova administradora' : 'Nova entidade'}
              </Button>
            )}
            {activeTab === 'redes' ? (
              <Button variant="secondary" onClick={() => setNetworkImportModalOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar rede
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            )}
          </div>
        </div>

        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} variant="panel" className="mt-6" />
      </div>

      {!loading && !catalogLoadError && <CotadorCatalogMetricsPanel metrics={catalogMetrics} />}

      {loading ? (
        <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
          <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando catálogo do Cotador...</p>
        </div>
      ) : catalogLoadError ? (
        <ErrorState
          title="Nao foi possivel carregar o catalogo"
          description={catalogLoadError}
          onRetry={() => void loadCatalogData()}
        />
      ) : activeTab === 'operadoras' ? (
        <OperadorasTab embedded />
      ) : activeTab === 'administradoras' ? (
        administradoras.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhuma administradora cadastrada" description="Crie uma administradora." />
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
            <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
              {administradoras.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                    {item.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <Button variant="icon" size="icon" className="h-10 w-10 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openEntityModal('administradoras', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('administradoras', item.id, 'Excluir administradora', 'Essa ação remove a administradora do catálogo do Cotador.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      ) : activeTab === 'entidades' ? (
        entidades.length === 0 ? (
          <EmptyState icon={Sparkles} title="Nenhuma entidade cadastrada" description="Crie uma entidade." />
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
            <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
              {entidades.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{item.nome}</h4>
                    {item.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <Button variant="icon" size="icon" className="h-10 w-10 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openEntityModal('entidades', { ...item, id: item.id, observacoes: item.observacoes ?? '' })}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('entidades', item.id, 'Excluir entidade', 'Essa ação remove a entidade do catálogo do Cotador.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      ) : activeTab === 'linhas' ? (
        linhas.length === 0 ? (
          <EmptyState icon={Network} title="Nenhuma linha cadastrada" description="Crie uma linha." />
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
            <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
              {linhas.map((line) => (
                <article key={line.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{line.nome}</h4>
                      {!line.ativo && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">Inativa</span>}
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Operadora: {line.operadora?.nome ?? 'Não encontrada'}</p>
                    {line.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{line.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <Button variant="icon" size="icon" className="h-10 w-10 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openLineModal(line)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('linhas', line.id, 'Excluir linha', 'Essa ação remove a linha e pode impactar os produtos vinculados.') }><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )
      ) : activeTab === 'produtos' ? (
        produtos.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum produto cadastrado" description="Crie um produto." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Organização de produtos</p>
                  <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Produtos</h4>
                </div>
                <div className="w-full lg:max-w-sm">
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar produto, linha ou operadora"
                    leftIcon={Search}
                    className="[--panel-input-text:#fff8ef] [--panel-placeholder:rgba(255,243,209,0.42)] border-[color:rgba(255,255,255,0.1)] bg-[color:rgba(255,255,255,0.06)] text-[color:#fff8ef] shadow-none placeholder:text-[color:rgba(255,243,209,0.42)] focus:border-[color:rgba(251,191,36,0.28)] focus:ring-[color:rgba(251,191,36,0.26)]"
                  />
                </div>
              </div>
            </div>

            {groupedProducts.length === 0 ? (
              <EmptyState icon={Search} title="Nenhum produto encontrado" description="Ajuste a busca." />
            ) : (
              <div className="space-y-4">
                {groupedProducts.map((group) => (
                  <section key={group.key} className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{group.linhaNome}</h4>
                        <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{group.operadoraNome}</p>
                      </div>
                      <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-1 text-xs font-semibold text-[color:var(--panel-text-soft,#5b4635)]">
                        {group.items.length} produto(s)
                      </span>
                    </div>

                    <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                      {group.items.map((product) => (
                        <article key={product.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            {(() => {
                              const completeness = productCompletenessById.get(product.id);

                              return (
                                <>
                             <div className="flex flex-wrap items-center gap-2">
                               <h5 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{product.nome}</h5>
                               {!product.ativo && (
                                 <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">
                                   Inativo
                                 </span>
                               )}
                               {completeness?.complete && (
                                 <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                                   Completo
                                 </span>
                               )}
                             </div>
                             <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                               {product.modalidade && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.modalidade}</span>}
                               {product.administradora?.nome && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.administradora.nome}</span>}
                       {product.entidadesClasse.length > 0 && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.entidadesClasse.length} entidade(s)</span>}
                               {product.abrangencia && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.abrangencia}</span>}
                               {product.acomodacao && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{formatProductAcomodacoesLabel(parseProductAcomodacoes(product.acomodacao, acomodacaoOptions.map((option) => option.value)))}</span>}
                             </div>
                             {completeness && !completeness.complete && (
                               <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                 {completeness.missingNetwork && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Sem rede</span>}
                                 {completeness.missingPrice && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Sem preco</span>}
                                 {completeness.missingCarencias && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Sem carencia</span>}
                                 {completeness.missingDocuments && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Sem documentos</span>}
                                 {completeness.missingReembolso && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Sem reembolso</span>}
                               </div>
                             )}
                                </>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2 self-end lg:self-auto">
                            <Button variant="icon" size="icon" className="h-10 w-10 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openProductModal(product)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="icon" size="icon" className="h-10 w-10 text-red-600 hover:bg-red-50" onClick={() => void handleDelete('produtos', product.id, 'Excluir produto', 'Essa ação remove o produto do catálogo do Cotador, mas snapshots de cotações permanecem preservados.') }>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )
      ) : activeTab === 'redes' ? (
        networkProducts.length === 0 && networkHospitals.length === 0 && !networkHospitalsLoading ? (
          <EmptyState icon={MapPin} title="Nenhuma rede cadastrada" description="Adicione produtos ao catalogo para comecar a vincular hospitais e atendimentos." />
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Gestao da rede</p>
                    <h4 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">
                      {networkDirectoryMode === 'products' ? 'Produtos e prestadores' : 'Hospitais compartilhados'}
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                    {networkDirectoryMode === 'products' ? (
                      <>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkProducts.length} produto(s)</span>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkProductsWithEntriesCount} com rede</span>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkProducts.length - networkProductsWithEntriesCount} sem rede</span>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkHospitals.length} hospital(is)</span>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkHospitalsWithLinksCount} com vinculos</span>
                        <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-3 py-1">{networkHospitals.reduce((total, hospital) => total + hospital.linkedProducts.length, 0)} plano(s) vinculados</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="inline-flex rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-1">
                  <button
                    type="button"
                    onClick={() => setNetworkDirectoryMode('products')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${networkDirectoryMode === 'products' ? 'bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)] shadow-sm' : 'text-[color:var(--panel-text-soft,#5b4635)] hover:text-[color:var(--panel-text,#1a120d)]'}`}
                  >
                    Por produto
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetworkDirectoryMode('hospitals')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${networkDirectoryMode === 'hospitals' ? 'bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)] shadow-sm' : 'text-[color:var(--panel-text-soft,#5b4635)] hover:text-[color:var(--panel-text,#1a120d)]'}`}
                  >
                    Hospitais
                  </button>
                </div>

                {networkDirectoryMode === 'products' ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_220px_220px]">
                    <Input
                      value={networkListSearch}
                      onChange={(event) => {
                        setNetworkListSearch(event.target.value);
                        setNetworkPage(1);
                      }}
                      placeholder="Buscar produto, hospital, cidade ou linha"
                      leftIcon={Search}
                    />
                    <FilterSingleSelect
                      icon={Building2}
                      options={networkListOperadoraOptions}
                      placeholder="Todas as operadoras"
                      value={networkListOperadoraId}
                      onChange={(value) => {
                        setNetworkListOperadoraId(value);
                        setNetworkPage(1);
                      }}
                    />
                    <FilterSingleSelect
                      icon={Network}
                      options={networkListLineOptions}
                      placeholder="Todas as linhas"
                      value={networkListLineId}
                      onChange={(value) => {
                        setNetworkListLineId(value);
                        setNetworkPage(1);
                      }}
                    />
                    <FilterSingleSelect
                      icon={MapPin}
                      options={networkListCityOptions}
                      placeholder="Todas as cidades"
                      value={networkListCity}
                      onChange={(value) => {
                        setNetworkListCity(value);
                        setNetworkPage(1);
                      }}
                    />
                    <FilterSingleSelect
                      icon={ShieldCheck}
                      options={[
                        { value: 'all', label: 'Todos' },
                        { value: 'with-network', label: 'Com rede' },
                        { value: 'without-network', label: 'Sem rede' },
                      ]}
                      placeholder="Status da rede"
                      value={networkListStatus}
                      onChange={(value) => {
                        setNetworkListStatus((value as NetworkListStatusFilter) || 'all');
                        setNetworkPage(1);
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_220px]">
                      <Input
                        value={networkHospitalSearch}
                        onChange={(event) => {
                          setNetworkHospitalSearch(event.target.value);
                          setNetworkHospitalPage(1);
                        }}
                        placeholder="Buscar hospital, alias, cidade, plano ou operadora"
                        leftIcon={Search}
                      />
                      <FilterSingleSelect
                        icon={AlertCircle}
                        options={[
                          { value: 'all', label: 'Todos os cadastros' },
                          { value: 'missing-bairro', label: 'Sem bairro' },
                          { value: 'missing-regiao', label: 'Sem regiao' },
                          { value: 'missing-any', label: 'Incompletos' },
                          { value: 'suspect-bairro', label: 'Bairro suspeito' },
                          { value: 'complete', label: 'Completos' },
                        ]}
                        placeholder="Qualidade do cadastro"
                        value={networkHospitalDataStatus}
                        onChange={(value) => {
                          setNetworkHospitalDataStatus((value as NetworkHospitalDataStatusFilter) || 'all');
                          setNetworkHospitalPage(1);
                        }}
                      />
                      <FilterSingleSelect
                        icon={MapPin}
                        options={networkHospitalCityOptions}
                        placeholder="Todas as cidades"
                        value={networkHospitalCity}
                        onChange={(value) => {
                          setNetworkHospitalCity(value);
                          setNetworkHospitalPage(1);
                        }}
                      />
                      <FilterSingleSelect
                        icon={Building2}
                        options={networkHospitalOperadoraOptions}
                        placeholder="Todas as operadoras"
                        value={networkHospitalOperadoraId}
                        onChange={(value) => {
                          setNetworkHospitalOperadoraId(value);
                          setNetworkHospitalPage(1);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'missing-bairro', label: 'Sem bairro' },
                        { value: 'missing-regiao', label: 'Sem regiao' },
                        { value: 'missing-any', label: 'Incompletos' },
                        { value: 'suspect-bairro', label: 'Suspeitos' },
                        { value: 'complete', label: 'Completos' },
                      ].map((option) => {
                        const isActive = networkHospitalDataStatus === option.value;
                        const count = networkHospitalQualityCounts[option.value as NetworkHospitalDataStatusFilter];

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNetworkHospitalDataStatus(option.value as NetworkHospitalDataStatusFilter);
                              setNetworkHospitalPage(1);
                            }}
                            className={[
                              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                              isActive
                                ? 'border-[color:var(--panel-border-strong,#9d7f5a)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)]'
                                : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface,#fffdfa)] hover:text-[color:var(--panel-text,#1a120d)]',
                            ].join(' ')}
                          >
                            {option.label} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <CotadorHospitalMergeSuggestionsPanel
                      suggestions={networkHospitalMergeSuggestions}
                      mergingHospitalKey={mergingHospitalKey}
                      onMerge={(suggestion) => void handleMergeNetworkHospitals(suggestion)}
                    />
                  </div>
                )}
              </div>
            </div>

            {networkDirectoryMode === 'products' ? (
              filteredNetworkProducts.length === 0 ? (
                <EmptyState icon={Search} title="Nenhum produto encontrado" description="Ajuste os filtros da aba Redes para localizar o produto ou a cidade desejada." />
              ) : (
                <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
                  <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                    {paginatedNetworkProducts.map((summary) => {
                      const { product, entries, cities } = summary;

                      return (
                        <article key={product.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{product.nome}</h4>
                              <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                {entries.length} prestador(es)
                              </span>
                              <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                {cities.length} cidade(s)
                              </span>
                              {entries.length === 0 && (
                                <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-muted,#876f5c)]">
                                  Sem rede
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                              {product.operadora?.nome ?? 'Operadora'} / {product.linha?.nome ?? 'Linha'}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                              {product.abrangencia && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{product.abrangencia}</span>}
                              {product.acomodacao && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{formatProductAcomodacoesLabel(parseProductAcomodacoes(product.acomodacao, acomodacaoOptions.map((option) => option.value)))}</span>}
                              {cities.slice(0, 4).map((city) => <span key={`${product.id}-${city}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{city}</span>)}
                              {cities.length > 4 && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">+{cities.length - 4} cidade(s)</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end lg:self-auto">
                            <Button variant="secondary" onClick={() => void openNetworkModal(product)}>
                              <MapPin className="h-4 w-4" />
                              Gerenciar rede
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <Pagination
                    currentPage={networkPage}
                    totalPages={totalNetworkPages}
                    itemsPerPage={networkPerPage}
                    totalItems={filteredNetworkProducts.length}
                    onPageChange={setNetworkPage}
                    onItemsPerPageChange={(nextPageSize) => {
                      setNetworkPerPage(nextPageSize);
                      setNetworkPage(1);
                    }}
                  />
                </div>
              )
            ) : networkHospitalsLoading ? (
              <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-6 py-16 text-center shadow-sm">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(212,192,167,0.5)] border-t-[var(--panel-accent-strong,#b85c1f)]" />
                <p className="mt-4 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Carregando hospitais compartilhados...</p>
              </div>
            ) : networkHospitalsError ? (
              <ErrorState
                title="Nao foi possivel carregar os hospitais compartilhados"
                description={networkHospitalsError}
                onRetry={() => void loadNetworkHospitals()}
              />
            ) : filteredNetworkHospitals.length === 0 ? (
              <EmptyState icon={Search} title="Nenhum hospital encontrado" description="Ajuste os filtros da visao global de hospitais para localizar um cadastro compartilhado." />
            ) : (
              <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
                <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                  {paginatedNetworkHospitals.map((hospital) => (
                    <article key={hospital.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{hospital.nome}</h4>
                          <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                            {hospital.linkedProducts.length} plano(s)
                          </span>
                          {hospital.aliases.length > 0 && (
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                              {hospital.aliases.length} alias(es)
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{formatNetworkLocation(hospital)}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                          {hospital.aliases.slice(0, 3).map((alias) => <span key={`${hospital.id}-${alias}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">{alias}</span>)}
                          {hospital.aliases.length > 3 && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">+{hospital.aliases.length - 3} alias(es)</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                          {hospital.linkedProducts.slice(0, 4).map((link) => (
                            <span key={link.link_id} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">
                              {(link.operadora?.nome ?? 'Operadora')} / {(link.linha?.nome ?? 'Linha')} / {link.produto_nome}
                            </span>
                          ))}
                          {hospital.linkedProducts.length > 4 && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2.5 py-1">+{hospital.linkedProducts.length - 4} vinculo(s)</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <Button variant="secondary" onClick={() => openNetworkHospitalModal(hospital)}>
                          <Edit2 className="h-4 w-4" />
                          Gerenciar hospital
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
                <Pagination
                  currentPage={networkHospitalPage}
                  totalPages={totalNetworkHospitalPages}
                  itemsPerPage={networkHospitalPerPage}
                  totalItems={filteredNetworkHospitals.length}
                  onPageChange={setNetworkHospitalPage}
                  onItemsPerPageChange={(nextPageSize) => {
                    setNetworkHospitalPerPage(nextPageSize);
                    setNetworkHospitalPage(1);
                  }}
                />
              </div>
            )}
          </div>
        )
      ) : tabelas.length === 0 ? (
        <EmptyState icon={Table2} title="Nenhuma tabela cadastrada" description="Crie tabelas por produto para separar MEI, não MEI, coparticipação e faixas de vidas como 2 a 2, 3 a 5 ou 6 a 29." />
      ) : (
        <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
          <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
          {paginatedTableEntries.map((entry) => (
            <article key={entry.key} className="px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold leading-tight text-[color:var(--panel-text,#1a120d)]">{entry.baseName}</h4>
                      <p className="mt-0.5 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                        {entry.product?.operadora?.nome ?? 'Operadora'} / {entry.product?.linha?.nome ?? 'Linha'} / {entry.product?.nome ?? 'Produto'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="icon" size="icon" className="h-9 w-9 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openTableModal(entry.records, 'duplicate')} title="Criar cópia">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="icon" size="icon" className="h-9 w-9 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => openTableModal(entry.records, 'edit')} title="Editar tabela">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="icon" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => void handleDeleteTableGroup(entry)} title="Excluir tabela"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--panel-text-soft,#5b4635)]">
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{entry.modalidade}</span>
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{formatPerfilEmpresarial(entry.perfilEmpresarial)}</span>
                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{formatCoparticipacao(entry.coparticipacao)}</span>
                    {entry.records.map((record) => record.acomodacao).filter(Boolean).map((acomodacao) => <span key={`${entry.key}-${acomodacao}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{acomodacao}</span>)}
                    {(entry.vidasMin || entry.vidasMax) && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">Vidas: {entry.vidasMin ?? 1} a {entry.vidasMax ?? '...'}</span>}
                    {!entry.records.every((record) => record.ativo) && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5 font-medium text-[color:var(--panel-text-muted,#876f5c)]">Inativo</span>}
                    {entry.records.some((record) => Object.keys(record.pricesByAgeRange).length === 0) && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Sem preco</span>}
                    {entry.product && !productCompletenessById.get(entry.product.id)?.complete && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">Produto incompleto</span>}
                  </div>
                </div>
              </div>
            </article>
          ))}
          </div>
          <Pagination
            currentPage={tablesPage}
            totalPages={totalTablePages}
            itemsPerPage={tablesPerPage}
            totalItems={groupedTableEntries.length}
            onPageChange={setTablesPage}
            onItemsPerPageChange={(nextPageSize) => {
              setTablesPerPage(nextPageSize);
              setTablesPage(1);
            }}
          />
        </div>
      )}

      <ModalShell
        isOpen={importModalOpen}
        onClose={resetImportModal}
        title="Importar catálogo"
        description="Centralize importações do catálogo a partir de arquivos estruturados, criando operadora, linha e produto quando ainda não existirem."
        size="xl"
      >
        <form onSubmit={handleImportSubmit} className="space-y-5">
          <div className="rounded-3xl border border-[color:var(--panel-border-strong,#9d7f5a)] bg-[var(--panel-surface-soft,#f4ede3)] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:rgba(157,127,90,0.22)] bg-[var(--panel-surface-soft,#f4ede3)] text-[var(--panel-accent-ink,#6f3f16)]">
                <FileJson className="h-5 w-5" />
              </span>
              <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">JSON do catalogo</p>
                  <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Aceita operadora, linha, produto, tabelas, rede hospitalar, administradora e entidades. Se quiser, envie apenas a rede hospitalar.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Arquivo</label>
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_86%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_94%,var(--panel-surface-muted,#f8f2e8)))] p-4 shadow-sm">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => setImportForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                className="sr-only"
              />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:rgba(157,127,90,0.22)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm">
                      <Upload className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                        {importForm.file ? importForm.file.name : 'Nenhum arquivo selecionado'}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                        JSON completo (.json)
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => importFileInputRef.current?.click()}
                  className="w-full md:w-auto"
                >
                  <Upload className="h-4 w-4" />
                  {importForm.file ? 'Trocar arquivo' : 'Escolher arquivo'}
                </Button>
              </div>

              <div className="mt-4 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                {importForm.file
                  ? `Arquivo pronto para importacao: ${importForm.file.name}`
                  : 'Selecione um arquivo compativel com o formato escolhido para continuar.'}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Template</label>
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Modelo base de importação</p>
                  <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Baixe um JSON exemplo para preencher com operadora, linha, produtos, tabelas e rede hospitalar ou use um arquivo focado so na rede.</p>
                </div>
                <Button type="button" variant="secondary" onClick={handleDownloadImportTemplate} className="w-full md:w-auto">
                  <Download className="h-4 w-4" />
                  Baixar template
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Preview da importação</label>
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              {importPreviewLoading ? (
                <div className="space-y-3">
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-surface-soft,#f4ede3)]">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--panel-accent-strong,#b85c1f)]" />
                  </div>
                  <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Lendo e validando o JSON...</p>
                </div>
              ) : importPreviewError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {importPreviewError}
                </div>
              ) : importPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Operadoras</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{importPreview.operadorasCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Linhas</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{importPreview.linhasCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Produtos</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{importPreview.produtosCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Tabelas</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{importPreview.tabelasCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Rede</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{importPreview.networkEntriesCount}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Criar</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-900">{importPreview.actionCounts.create}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Atualizar</p>
                      <p className="mt-1 text-lg font-semibold text-amber-900">{importPreview.actionCounts.update}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">Ignorar</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{importPreview.actionCounts.ignore}</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">Conflitos</p>
                      <p className="mt-1 text-lg font-semibold text-red-900">{importPreview.actionCounts.conflict}</p>
                    </div>
                  </div>

                  {importPreview.actionCounts.conflict > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      O arquivo tem conflitos que precisam ser resolvidos antes da importação. Revise os itens destacados abaixo.
                    </div>
                  )}

                  <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
                    <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-3 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                      Itens encontrados e impacto previsto
                    </div>
                    <div className="max-h-64 divide-y divide-[color:var(--panel-border-subtle,#e7dac8)] overflow-y-auto">
                      {importPreview.items.map((item, index) => (
                        <div key={`${item.operadora}-${item.linha}-${item.produto}-${index}`} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.produto}</p>
                            <span className={[
                              'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
                              item.status === 'create' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : '',
                              item.status === 'update' ? 'border-amber-200 bg-amber-50 text-amber-800' : '',
                              item.status === 'ignore' ? 'border-slate-200 bg-slate-50 text-slate-700' : '',
                              item.status === 'conflict' ? 'border-red-200 bg-red-50 text-red-800' : '',
                            ].join(' ')}>
                              {item.status === 'create' ? 'Criar' : item.status === 'update' ? 'Atualizar' : item.status === 'ignore' ? 'Ignorar' : 'Conflito'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{item.operadora} / {item.linha}{item.modalidadeBase ? ` / ${item.modalidadeBase}` : ''}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1">{item.tabelasCount} tabela(s)</span>
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1">{item.networkEntriesCount} item(ns) de rede</span>
                            {item.acomodacoes.map((acomodacao) => <span key={`${item.produto}-${acomodacao}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1">{acomodacao}</span>)}
                          </div>
                          <div className="mt-3 space-y-2">
                            {item.changes.map((change, changeIndex) => (
                              <div
                                key={`${item.operadora}-${item.linha}-${item.produto}-${change.scope}-${changeIndex}`}
                                className={[
                                  'rounded-2xl border px-3 py-2 text-xs',
                                  change.kind === 'create' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : '',
                                  change.kind === 'update' ? 'border-amber-200 bg-amber-50 text-amber-800' : '',
                                  change.kind === 'ignore' ? 'border-slate-200 bg-slate-50 text-slate-700' : '',
                                  change.kind === 'conflict' ? 'border-red-200 bg-red-50 text-red-800' : '',
                                ].join(' ')}
                              >
                                <p className="font-semibold">
                                  {change.label}
                                  {typeof change.count === 'number' ? ` (${change.count})` : ''}
                                </p>
                                <p className="mt-1">{change.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Selecione um JSON para visualizar um resumo do que será importado.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting} disabled={importPreviewLoading || Boolean(importPreviewError) || (importPreview?.actionCounts.conflict ?? 0) > 0}><Upload className="h-4 w-4" />Importar arquivo</Button>
            <Button type="button" variant="secondary" onClick={resetImportModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={networkImportModalOpen}
        onClose={resetNetworkImportModal}
        title="Importar rede hospitalar"
        description="Use um JSON focado em rede para atualizar prestadores por produto sem misturar tabelas comerciais."
        size="xl"
      >
        <form onSubmit={handleNetworkImportSubmit} className="space-y-5">
          <div className="rounded-3xl border border-[color:var(--panel-border-strong,#9d7f5a)] bg-[var(--panel-surface-soft,#f4ede3)] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:rgba(157,127,90,0.22)] bg-[var(--panel-surface-soft,#f4ede3)] text-[var(--panel-accent-ink,#6f3f16)]">
                <FileJson className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">JSON de rede</p>
                <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Aceita entradas com `redeHospitalar` e pode usar `produtos: [...]` para replicar a mesma rede em mais de um produto.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Arquivo</label>
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_86%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_94%,var(--panel-surface-muted,#f8f2e8)))] p-4 shadow-sm">
              <input
                ref={networkImportFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(event) => setNetworkImportForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                className="sr-only"
              />
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:rgba(157,127,90,0.22)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm">
                      <Upload className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{networkImportForm.file ? networkImportForm.file.name : 'Nenhum arquivo selecionado'}</p>
                      <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">JSON focado em rede (.json)</p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => networkImportFileInputRef.current?.click()}
                  className="w-full md:w-auto"
                >
                  <Upload className="h-4 w-4" />
                  {networkImportForm.file ? 'Trocar arquivo' : 'Escolher arquivo'}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Preview da rede</label>
            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              {networkImportPreviewLoading ? (
                <div className="space-y-3">
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-surface-soft,#f4ede3)]">
                    <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--panel-accent-strong,#b85c1f)]" />
                  </div>
                  <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Lendo e validando o JSON de rede...</p>
                </div>
              ) : networkImportPreviewError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{networkImportPreviewError}</div>
              ) : networkImportPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Produtos com rede</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkImportPreviewItems.length}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Itens de rede</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkImportPreviewEntriesCount}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Tabelas no arquivo</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkImportPreviewTablesCount}</p>
                    </div>
                  </div>

                  {networkImportPreviewTablesCount > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      O arquivo possui tabelas comerciais. Use este modal apenas para JSON focado em rede ou utilize o importador geral do catalogo.
                    </div>
                  )}

                  {networkImportPreviewItems.length === 0 ? (
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                      Nenhum item de rede identificado no arquivo.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
                      <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-3 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Produtos encontrados</div>
                      <div className="max-h-72 divide-y divide-[color:var(--panel-border-subtle,#e7dac8)] overflow-y-auto">
                        {networkImportPreviewItems.map((item, index) => (
                          <div key={`${item.operadora}-${item.linha}-${item.produto}-${index}`} className="px-4 py-3">
                            <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.produto}</p>
                            <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{item.operadora} / {item.linha}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                              <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1">{item.networkEntriesCount} item(ns) de rede</span>
                              {item.acomodacoes.map((acomodacao) => <span key={`${item.produto}-${acomodacao}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1">{acomodacao}</span>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Selecione um JSON para visualizar os produtos e os prestadores que serao atualizados.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting} disabled={networkImportPreviewLoading || Boolean(networkImportPreviewError)}>
              <Upload className="h-4 w-4" />
              Importar rede
            </Button>
            <Button type="button" variant="secondary" onClick={resetNetworkImportModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={networkModalOpen}
        onClose={resetNetworkModal}
        title={selectedNetworkProduct ? `Rede hospitalar · ${selectedNetworkProduct.nome}` : 'Rede hospitalar'}
        description={selectedNetworkProduct ? `${selectedNetworkProduct.operadora?.nome ?? 'Operadora'} / ${selectedNetworkProduct.linha?.nome ?? 'Linha'}` : undefined}
        size="xl"
      >
        {selectedNetworkProduct && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Abrangencia</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{selectedNetworkProduct.abrangencia ?? '-'}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Acomodacoes</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{selectedNetworkProduct.acomodacao ? formatProductAcomodacoesLabel(parseProductAcomodacoes(selectedNetworkProduct.acomodacao, acomodacaoOptions.map((option) => option.value))) : '-'}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">Prestadores</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{networkDraft.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <FilterSingleSelect
                icon={MapPin}
                options={networkProductCityOptions}
                placeholder="Todas as cidades"
                value={networkCity}
                onChange={setNetworkCity}
              />
              <Input
                value={networkSearch}
                onChange={(event) => setNetworkSearch(event.target.value)}
                placeholder="Buscar hospital, cidade, regiao, bairro ou atendimento"
                leftIcon={Search}
              />
            </div>

            <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
              <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-3 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                Prestadores da rede
              </div>

              {networkModalLoading ? (
                <div className="px-4 py-10 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                  Carregando hospitais compartilhados desta rede...
                </div>
              ) : filteredNetworkEntries.length === 0 ? (
                <div className="px-4 py-10 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                  Nenhum prestador encontrado para os filtros atuais.
                </div>
              ) : (
                <div className="max-h-72 divide-y divide-[color:var(--panel-border-subtle,#e7dac8)] overflow-y-auto">
                  {filteredNetworkEntries.map(({ entry, index }) => (
                    <article key={`${entry.hospital}-${index}`} className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{entry.hospital}</p>
                        <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{formatNetworkLocation(entry)}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[color:var(--panel-text-soft,#5b4635)]">
                          {entry.atendimentos.map((service) => (
                            <span key={`${entry.hospital}-${service}-${index}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{service}</span>
                          ))}
                        </div>
                        {entry.aliases.length > 0 && (
                          <p className="mt-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                            Aliases: {entry.aliases.join(', ')}
                          </p>
                        )}
                        {entry.observacoes && <p className="mt-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">{entry.observacoes}</p>}
                      </div>
                      <div className="flex items-center gap-2 self-end lg:self-auto">
                        <Button variant="icon" size="icon" className="h-9 w-9 text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]" onClick={() => startEditingNetworkEntry(entry, index)} title="Editar hospital">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="icon" size="icon" className="h-9 w-9 text-red-600 hover:bg-red-50" onClick={() => handleRemoveNetworkEntry(index)} title="Remover hospital">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                    Cadastro manual de hospital
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Abra um modal dedicado para cadastrar ou editar nome, cidade, regiao, bairro e atendimentos.</p>
                </div>
                <Button type="button" onClick={openNetworkEntryCreateModal}>
                  <Plus className="h-4 w-4" />
                  Adicionar hospital
                </Button>
              </div>
              <p className="mt-3 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                O cadastro passa a reaproveitar hospitais compartilhados e permite guardar aliases para normalizacao manual de importacoes futuras.
              </p>
            </div>

            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Legenda das siglas</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)] md:grid-cols-2">
                {networkLegend.map((item) => <p key={item}>{item}</p>)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" loading={submitting} onClick={() => void handleSaveNetwork()}>
                <Save className="h-4 w-4" />
                Salvar rede
              </Button>
              <Button type="button" variant="secondary" onClick={resetNetworkModal} disabled={submitting}>Cancelar</Button>
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        isOpen={networkEntryModalOpen}
        onClose={resetNetworkEntryForm}
        title={networkEditingIndex === null ? 'Adicionar hospital da rede' : 'Editar hospital da rede'}
        description="Cadastre o hospital manualmente com nome, cidade, regiao, bairro opcional e os atendimentos disponiveis neste plano."
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Hospital *</label>
              <Input value={networkEntryForm.hospital} onChange={(event) => setNetworkEntryForm((current) => ({ ...current, hospital: formatCotadorLocationText(event.target.value) }))} placeholder="Ex: HOSPITAL PASTEUR" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Cidade *</label>
              <Input value={networkEntryForm.cidade} onChange={(event) => setNetworkEntryForm((current) => {
                const cidade = formatCotadorLocationText(event.target.value);
                return { ...current, cidade, regiao: resolveCotadorRegionByCity(cidade) ?? current.regiao };
              })} placeholder="Ex: RIO DE JANEIRO" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Regiao *</label>
              <Input value={networkEntryForm.regiao} onChange={(event) => setNetworkEntryForm((current) => ({ ...current, regiao: formatCotadorLocationText(event.target.value) }))} placeholder="Ex: CAPITAL" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Bairro</label>
              <Input value={networkEntryForm.bairro} onChange={(event) => setNetworkEntryForm((current) => ({ ...current, bairro: formatCotadorLocationText(event.target.value) }))} placeholder="Opcional" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Atendimentos</label>
              <InlineCheckboxGroup
                options={networkServiceOptions.map((option) => ({ value: option.value, label: option.label }))}
                values={networkEntryForm.atendimentos}
                onChange={(values) => setNetworkEntryForm((current) => ({ ...current, atendimentos: values }))}
                emptyMessage="Nenhuma sigla configurada."
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observacoes</label>
              <Textarea value={networkEntryForm.observacoes} onChange={(event) => setNetworkEntryForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} placeholder="Ex: Prestador habilitado apenas na acomodacao QP" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Aliases para normalizacao manual</label>
                <Textarea
                  value={networkEntryForm.aliasesText}
                  onChange={(event) => setNetworkEntryForm((current) => ({ ...current, aliasesText: formatNetworkAliasesTextarea(event.target.value) }))}
                  rows={4}
                  placeholder={"Ex: ASM - HOSPITAL PASTEUR\nHOSPITAL PASTEUR"}
                />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use um alias por linha para vincular nomes alternativos ao mesmo hospital compartilhado.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleNetworkEntrySubmit}>
              <Save className="h-4 w-4" />
              {networkEditingIndex === null ? 'Adicionar hospital' : 'Atualizar hospital'}
            </Button>
            <Button type="button" variant="secondary" onClick={resetNetworkEntryForm}>Cancelar</Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        isOpen={networkHospitalModalOpen}
        onClose={resetNetworkHospitalModal}
        title={selectedNetworkHospital ? `Hospital compartilhado · ${selectedNetworkHospital.nome}` : 'Hospital compartilhado'}
        description={selectedNetworkHospital ? 'Gerencie o cadastro canônico do hospital e revise todos os planos vinculados a ele.' : undefined}
        size="xl"
      >
        {selectedNetworkHospital && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome do hospital *</label>
                <Input value={networkHospitalForm.nome} onChange={(event) => setNetworkHospitalForm((current) => ({ ...current, nome: formatCotadorLocationText(event.target.value) }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Cidade *</label>
                <Input value={networkHospitalForm.cidade} onChange={(event) => setNetworkHospitalForm((current) => {
                  const cidade = formatCotadorLocationText(event.target.value);
                  return { ...current, cidade, regiao: resolveCotadorRegionByCity(cidade) ?? current.regiao };
                })} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Regiao *</label>
                <Input value={networkHospitalForm.regiao} onChange={(event) => setNetworkHospitalForm((current) => ({ ...current, regiao: formatCotadorLocationText(event.target.value) }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Bairro</label>
                <Input value={networkHospitalForm.bairro} onChange={(event) => setNetworkHospitalForm((current) => ({ ...current, bairro: formatCotadorLocationText(event.target.value) }))} placeholder="Opcional" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Aliases para normalizacao manual</label>
                <Textarea value={networkHospitalForm.aliasesText} onChange={(event) => setNetworkHospitalForm((current) => ({ ...current, aliasesText: formatNetworkAliasesTextarea(event.target.value) }))} rows={4} placeholder={"Ex: ASM - HOSPITAL PASTEUR\nHOSPITAL PASTEUR"} />
                <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use um alias por linha para cobrir variacoes de importacao entre operadoras e arquivos.</p>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
              <input type="checkbox" checked={networkHospitalForm.ativo} onChange={(event) => setNetworkHospitalForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
              <div>
                <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Hospital ativo</p>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Hospitais inativos continuam preservados, mas podem ser ocultados em fluxos futuros.</p>
              </div>
            </label>

            <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm">
              <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-3">
                <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Planos vinculados</p>
                <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Todos os produtos que usam este hospital compartilhado na rede.</p>
              </div>
              <div className="max-h-80 divide-y divide-[color:var(--panel-border-subtle,#e7dac8)] overflow-y-auto">
                {selectedNetworkHospital.linkedProducts.map((link) => (
                  <article key={link.link_id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{link.produto_nome}</p>
                        <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{link.operadora?.nome ?? 'Operadora'} / {link.linha?.nome ?? 'Linha'}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--panel-text-soft,#5b4635)]">
                          {link.produto_abrangencia && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{link.produto_abrangencia}</span>}
                          {link.produto_acomodacao && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{link.produto_acomodacao}</span>}
                          {link.atendimentos.map((service) => <span key={`${link.link_id}-${service}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] px-2 py-0.5">{service}</span>)}
                        </div>
                        {link.observacoes && <p className="mt-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">{link.observacoes}</p>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" loading={submitting} onClick={() => void handleNetworkHospitalSubmit()}>
                <Save className="h-4 w-4" />
                Salvar hospital
              </Button>
              <Button type="button" variant="secondary" onClick={resetNetworkHospitalModal} disabled={submitting}>Cancelar</Button>
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        isOpen={entityModalKind !== null}
        onClose={resetEntityModal}
        title={entityEditingId ? 'Editar item institucional' : 'Novo item institucional'}
        description={undefined}
        size="md"
      >
        <form onSubmit={handleEntitySubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome *</label>
            <Input value={entityForm.nome} onChange={(event) => setEntityForm((current) => ({ ...current, nome: event.target.value }))} required />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={entityForm.ativo} onChange={(event) => setEntityForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Registro ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Mantém o registro disponível para uso no catálogo.</p>
            </div>
          </label>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={entityForm.observacoes} onChange={(event) => setEntityForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar</Button>
            <Button type="button" variant="secondary" onClick={resetEntityModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={lineModalOpen}
        onClose={resetLineModal}
        title={lineEditingId ? 'Editar linha de produto' : 'Nova linha de produto'}
        description={undefined}
        size="md"
      >
        <form onSubmit={handleLineSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Operadora *</label>
            <FilterSingleSelect icon={Building2} options={operadoraOptions} placeholder="Selecione a operadora" value={lineForm.operadoraId} onChange={(value) => setLineForm((current) => ({ ...current, operadoraId: value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome da linha *</label>
            <Input value={lineForm.nome} onChange={(event) => setLineForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex: Amil ou Selecionada" required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={lineForm.observacoes} onChange={(event) => setLineForm((current) => ({ ...current, observacoes: event.target.value }))} rows={3} />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={lineForm.ativo} onChange={(event) => setLineForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Linha ativa</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Linhas inativas saem do cadastro de produtos e do seletor do Cotador.</p>
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar linha</Button>
            <Button type="button" variant="secondary" onClick={resetLineModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={productModalOpen}
        onClose={resetProductModal}
        title={productEditingId ? 'Editar produto do Cotador' : 'Novo produto do Cotador'}
        description={undefined}
        size="lg"
      >
        <form onSubmit={handleProductSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Linha *</label>
              <FilterSingleSelect icon={Network} options={lineOptions} placeholder="Selecione a linha" value={productForm.linhaId} onChange={(value) => setProductForm((current) => ({ ...current, linhaId: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Administradora</label>
              <FilterSingleSelect icon={ShieldCheck} options={administradoraOptions} placeholder="Sem administradora" value={productForm.administradoraId} onChange={(value) => setProductForm((current) => ({ ...current, administradoraId: value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome do produto *</label>
              <Input value={productForm.nome} onChange={(event) => setProductForm((current) => ({ ...current, nome: event.target.value }))} placeholder="Ex: Bronze, Bronze Mais, S750 R1" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Modalidade base</label>
              <FilterSingleSelect icon={Layers3} options={modalidadeProductOptions} placeholder="Selecione a modalidade" value={productForm.modalidade} onChange={(value) => setProductForm((current) => ({ ...current, modalidade: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Abrangência</label>
              <FilterSingleSelect icon={MapPin} options={abrangenciaOptions} placeholder="Selecione a abrangência" value={productForm.abrangencia} onChange={(value) => setProductForm((current) => ({ ...current, abrangencia: value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Acomodações do produto *</label>
              <InlineCheckboxGroup
                options={acomodacaoOptions}
                values={productForm.acomodacoes}
                onChange={(values) => setProductForm((current) => ({ ...current, acomodacoes: values }))}
                emptyMessage="Nenhuma acomodação disponível nas configurações gerais."
              />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Se marcar mais de uma acomodação, a criação de tabela gera uma versão separada para cada acomodação selecionada.</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Entidades elegiveis</label>
            <InlineCheckboxGroup
              options={entidadeOptions}
              values={productForm.entidadeIds}
              onChange={(values) => setProductForm((current) => ({ ...current, entidadeIds: values }))}
              emptyMessage="Nenhuma entidade disponível para vínculo."
              scrollable
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Carências</label>
              <Textarea value={productForm.carencias} onChange={(event) => setProductForm((current) => ({ ...current, carencias: event.target.value }))} rows={4} placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Documentos necessários</label>
              <Textarea value={productForm.documentosNecessarios} onChange={(event) => setProductForm((current) => ({ ...current, documentosNecessarios: event.target.value }))} rows={4} placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Reembolso</label>
              <Textarea value={productForm.reembolso} onChange={(event) => setProductForm((current) => ({ ...current, reembolso: event.target.value }))} rows={4} placeholder="Opcional" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Informações importantes</label>
              <Textarea value={productForm.informacoesImportantes} onChange={(event) => setProductForm((current) => ({ ...current, informacoesImportantes: event.target.value }))} rows={4} placeholder="Opcional" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={productForm.observacoes} onChange={(event) => setProductForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={productForm.ativo} onChange={(event) => setProductForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Produto ativo</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Produtos inativos saem da criação de novas tabelas e do seletor.</p>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar produto</Button>
            <Button type="button" variant="secondary" onClick={resetProductModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      <ModalShell
        isOpen={tableModalOpen}
        onClose={resetTableModal}
        title={tableModalMode === 'edit' ? 'Editar tabela comercial' : tableModalMode === 'duplicate' ? 'Criar cópia da tabela' : 'Nova tabela comercial'}
        description="Separe a tabela por modalidade, perfil empresarial, coparticipação e faixa de vidas."
        size="xl"
      >
        <form onSubmit={handleTableSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Produto *</label>
              <FilterSingleSelect icon={Building2} options={productOptions} placeholder="Selecione o produto" value={tableForm.produtoId} onChange={(value) => setTableForm((current) => ({ ...current, produtoId: value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Nome da tabela *</label>
              <Input
                value={tableForm.nome}
                onChange={(event) => {
                  setTableNameTouched(true);
                  setTableForm((current) => ({ ...current, nome: event.target.value }));
                }}
                placeholder="Gerado automaticamente"
                required
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                <span>{autoGeneratedTableName ? `Sugestão: ${autoGeneratedTableName}` : 'Ajuste os campos abaixo para gerar o nome.'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTableNameTouched(false);
                    setTableForm((current) => ({ ...current, nome: autoGeneratedTableName }));
                  }}
                  className="font-semibold text-[var(--panel-accent-ink,#6f3f16)] transition-opacity hover:opacity-80"
                  disabled={!autoGeneratedTableName}
                >
                  Usar nome automático
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Código da tabela</label>
              <Input
                value={tableForm.codigo}
                onChange={(event) => {
                  setTableCodeTouched(true);
                  setTableForm((current) => ({ ...current, codigo: event.target.value }));
                }}
                placeholder="Gerado automaticamente"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                <span>{autoGeneratedTableCode ? `Sugestão: ${autoGeneratedTableCode}` : 'Escolha um produto para gerar o código.'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setTableCodeTouched(false);
                    setTableForm((current) => ({ ...current, codigo: autoGeneratedTableCode }));
                  }}
                  className="font-semibold text-[var(--panel-accent-ink,#6f3f16)] transition-opacity hover:opacity-80"
                  disabled={!autoGeneratedTableCode}
                >
                      Usar código automático
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Modalidade *</label>
              <FilterSingleSelect icon={Layers3} options={[...modalidadeOptions]} placeholder="Selecione a modalidade" value={tableForm.modalidade} onChange={(value) => setTableForm((current) => ({ ...current, modalidade: value as TableFormState['modalidade'] }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Perfil empresarial (opcional)</label>
              <FilterSingleSelect icon={Network} options={[...perfilEmpresarialOptions]} placeholder="Selecione o perfil" value={tableForm.perfilEmpresarial} onChange={(value) => setTableForm((current) => ({ ...current, perfilEmpresarial: value as TableFormState['perfilEmpresarial'] }))} />
              <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Use `Todos` quando a operadora não separar MEI e não MEI nesta tabela.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Coparticipação</label>
              <FilterSingleSelect icon={Sparkles} options={[...coparticipacaoOptions]} placeholder="Selecione a coparticipação" value={tableForm.coparticipacao} onChange={(value) => setTableForm((current) => ({ ...current, coparticipacao: value as TableFormState['coparticipacao'] }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Acomodações herdadas do produto</label>
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                {tableFormAcomodacoes.length > 0 && (tableEditingRecords.length > 0 || tableModalMode === 'duplicate') ? (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {tableFormAcomodacoes.map((acomodacao) => (
                        <span key={acomodacao} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-xs font-semibold text-[color:var(--panel-text,#1a120d)]">{acomodacao}</span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Esta tabela mantém as acomodações já vinculadas.</p>
                  </div>
                ) : selectedTableProduct ? (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTableProductAcomodacoes.length > 0 ? selectedTableProductAcomodacoes.map((acomodacao) => (
                        <span key={acomodacao} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-xs font-semibold text-[color:var(--panel-text,#1a120d)]">{acomodacao}</span>
                      )) : (
                        <span className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Nenhuma acomodação definida no produto.</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--panel-text-muted,#876f5c)]">
                      {selectedTableProductAcomodacoes.length > 1
                        ? 'Ao salvar, o catálogo agrupa essas acomodações como uma única tabela lógica.'
                        : 'A acomodação desta tabela será herdada do produto selecionado.'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--panel-text-soft,#5b4635)]">Escolha um produto para herdar as acomodações.</p>
                )}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Vidas min.</label>
              <Input type="number" min="1" value={tableForm.vidasMin} onChange={(event) => setTableForm((current) => ({ ...current, vidasMin: event.target.value }))} placeholder="Ex: 2" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Vidas max.</label>
              <Input type="number" min="1" value={tableForm.vidasMax} onChange={(event) => setTableForm((current) => ({ ...current, vidasMax: event.target.value }))} placeholder="Ex: 29" />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
              <Table2 className="h-4 w-4" />
              Preços por faixa etária
            </div>
            {useMultiAcomodacaoPricing ? (
              <div className="space-y-4">
                {selectedTableProductAcomodacoes.map((acomodacao) => (
                  <section key={acomodacao} className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{acomodacao}</p>
                        <p className="mt-1 text-xs text-[color:var(--panel-text-muted,#876f5c)]">Valores desta acomodação</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {COTADOR_AGE_RANGES.map((range) => (
                        <div key={`${acomodacao}-${range}`} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{range}</p>
                          <Input
                            type="text"
                            value={tableForm.pricesByAcomodacao[acomodacao]?.[range] ?? ''}
                            onChange={(event) =>
                              setTableForm((current) => ({
                                ...current,
                                pricesByAcomodacao: {
                                  ...current.pricesByAcomodacao,
                                  [acomodacao]: {
                                    ...(current.pricesByAcomodacao[acomodacao] ?? createEmptyTablePrices()),
                                    [range]: event.target.value,
                                  },
                                },
                              }))
                            }
                            autoFormat="currency"
                            className="mt-2"
                            placeholder="0,00"
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {COTADOR_AGE_RANGES.map((range) => (
                  <div key={range} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{range}</p>
                    <Input
                      type="text"
                      value={tableForm.pricesByAgeRange[range]}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          pricesByAgeRange: {
                            ...current.pricesByAgeRange,
                            [range]: event.target.value,
                          },
                        }))
                      }
                      autoFormat="currency"
                      className="mt-2"
                      placeholder="0,00"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">Observações</label>
            <Textarea value={tableForm.observacoes} onChange={(event) => setTableForm((current) => ({ ...current, observacoes: event.target.value }))} rows={4} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <input type="checkbox" checked={tableForm.ativo} onChange={(event) => setTableForm((current) => ({ ...current, ativo: event.target.checked }))} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500" />
            <div>
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Tabela ativa</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Tabelas inativas saem da vitrine do Cotador, mas continuam preservadas no histórico.</p>
            </div>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={submitting}><Save className="h-4 w-4" />Salvar tabela</Button>
            <Button type="button" variant="secondary" onClick={resetTableModal} disabled={submitting}>Cancelar</Button>
          </div>
        </form>
      </ModalShell>

      {ConfirmationDialog}
    </div>
  );
}
