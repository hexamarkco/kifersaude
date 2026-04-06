import { configService } from '../../../lib/configService';
import { supabase, type CotadorAdministradora, type CotadorEntidadeClasse, type CotadorProduto, type CotadorTabela, type Operadora } from '../../../lib/supabase';
import { cotadorService, type CotadorLineManagerRecord, type CotadorPriceRowInput, type CotadorProductManagerInput, type CotadorProductManagerRecord, type CotadorTableManagerInput, type CotadorTableManagerRecord } from './cotadorService';
import type { CotadorHospitalNetworkEntry } from '../shared/cotadorTypes';
import { COTADOR_AGE_RANGES } from '../shared/cotadorConstants';

export type CotadorImportKind = 'json-completo' | 'csv-tabelas' | 'csv-rede';

export type CotadorImportResult = {
  importedProducts: number;
  importedTables: number;
  importedNetworkEntries: number;
  warnings: string[];
};

export type CotadorImportPreviewItem = {
  operadora: string;
  linha: string;
  produto: string;
  modalidadeBase: string | null;
  abrangencia: string | null;
  acomodacoes: string[];
  entidadesElegiveis: string[];
  tabelasCount: number;
  networkEntriesCount: number;
};

export type CotadorImportPreview = {
  operadorasCount: number;
  linhasCount: number;
  produtosCount: number;
  tabelasCount: number;
  networkEntriesCount: number;
  items: CotadorImportPreviewItem[];
};

type ImportLookupContext = {
  operadoras: Operadora[];
  linhas: CotadorLineManagerRecord[];
  administradoras: CotadorAdministradora[];
  entidades: CotadorEntidadeClasse[];
  products: CotadorProductManagerRecord[];
  tables: CotadorTableManagerRecord[];
};

type ProductReference = {
  operadora: string;
  linha: string;
  produto: string;
  administradora?: string | null;
  modalidadeBase?: string | null;
  abrangencia?: string | null;
  acomodacoes?: string[];
  entidadesElegiveis?: string[];
  detalhes?: {
    carencias?: string | null;
    documentosNecessarios?: string | null;
    reembolso?: string | null;
    informacoesImportantes?: string | null;
  };
  redeHospitalar?: CotadorHospitalNetworkEntry[];
};

const DEFAULT_IMPORTED_OPERADORA = {
  comissao_padrao: 8,
  prazo_recebimento_dias: 30,
  bonus_por_vida: false,
  bonus_padrao: 0,
  ativo: true,
  observacoes: undefined,
};

type ImportedTableDefinition = {
  nome: string;
  codigo?: string | null;
  modalidade: 'PF' | 'ADESAO' | 'PME';
  perfilEmpresarial: 'todos' | 'mei' | 'nao_mei';
  coparticipacao: 'sem' | 'parcial' | 'total';
  vidasMin?: number | null;
  vidasMax?: number | null;
  observacoes?: string | null;
  ativo?: boolean;
  precosPorAcomodacao: Record<string, CotadorPriceRowInput>;
};

type ImportedNetworkCsvRow = ProductReference & CotadorHospitalNetworkEntry;

type ImportedJsonPayload = {
  items: Array<ProductReference & { tabelas?: ImportedTableDefinition[] }>;
};

type ResolveProductResult = {
  product: CotadorProductManagerRecord;
  createdOperadoraId: string | null;
  createdLineId: string | null;
  createdProductId: string | null;
};

type UpsertImportedTableResult = {
  createdTableIds: string[];
};

type ImportMutations = {
  createdOperadoraIds: string[];
  createdLineIds: string[];
  createdProductIds: string[];
  createdTableIds: string[];
};

type CsvRow = Record<string, string>;

const TEMPLATE_JSON_COMPLETO = `{
  "version": 1,
  "items": [
    {
      "operadora": "Amil",
      "linha": "Linha Selecionada",
      "produto": "S380",
      "administradora": null,
      "modalidadeBase": "PME",
      "abrangencia": "Nacional",
      "acomodacoes": ["Enfermaria", "Apartamento"],
      "entidadesElegiveis": [],
      "detalhes": {
        "carencias": "Urgencia e emergencia em 24 horas.",
        "documentosNecessarios": "RG, CPF e comprovante de residencia.",
        "reembolso": "Conforme tabela vigente.",
        "informacoesImportantes": "Produto sujeito a analise da operadora."
      },
      "redeHospitalar": [
        {
          "cidade": "Rio de Janeiro",
          "regiao": "Zona Norte",
          "hospital": "Hospital Pasteur - Meier",
          "bairro": "Meier",
          "atendimentos": ["Hospital", "Maternidade"],
          "observacoes": null
        }
      ],
      "tabelas": [
        {
          "nome": "PME Nao MEI Copart. parcial - 2 a 2 vidas",
          "codigo": "AMIL-S380-PME-NMEI-PARC-2A2",
          "modalidade": "PME",
          "perfilEmpresarial": "nao_mei",
          "coparticipacao": "parcial",
          "vidasMin": 2,
          "vidasMax": 2,
          "observacoes": null,
          "ativo": true,
          "precosPorAcomodacao": {
            "Enfermaria": {
              "0-18": 269.69,
              "19-23": 315.54
            },
            "Apartamento": {
              "0-18": 299.36,
              "19-23": 350.25
            }
          }
        }
      ]
    }
  ]
}`;

const TEMPLATE_CSV_TABELAS = `operadora,linha,produto,administradora,modalidade_base,abrangencia,acomodacoes,entidades_elegiveis,nome_tabela,codigo_tabela,modalidade_tabela,perfil_empresarial,coparticipacao,vidas_min,vidas_max,acomodacao,observacoes,ativo,preco_0_18,preco_19_23,preco_24_28,preco_29_33,preco_34_38,preco_39_43,preco_44_48,preco_49_53,preco_54_58,preco_59_mais
Amil,Linha Selecionada,S380,,PME,Nacional,Enfermaria|Apartamento,,PME Nao MEI Copart. parcial - 2 a 2 vidas,AMIL-S380-PME-NMEI-PARC-2A2,PME,nao_mei,parcial,2,2,Enfermaria,,true,269.69,315.54,384.96,461.95,485.05,533.56,666.95,733.65,917.06,1604.86
Amil,Linha Selecionada,S380,,PME,Nacional,Enfermaria|Apartamento,,PME Nao MEI Copart. parcial - 2 a 2 vidas,AMIL-S380-PME-NMEI-PARC-2A2,PME,nao_mei,parcial,2,2,Apartamento,,true,299.36,350.25,427.31,512.77,538.41,592.25,740.31,814.34,1017.93,1781.38`;

const TEMPLATE_CSV_REDE = `operadora,linha,produto,administradora,modalidade_base,abrangencia,acomodacoes,cidade,regiao,hospital,bairro,atendimentos,observacoes
Amil,Linha Selecionada,S380,,PME,Nacional,Enfermaria|Apartamento,Rio de Janeiro,Zona Norte,Hospital Pasteur - Meier,Meier,Hospital|Maternidade,
Amil,Linha Selecionada,S380,,PME,Nacional,Enfermaria|Apartamento,Rio de Janeiro,Zona Sul,Memorial Amil Botafogo,Botafogo,Hospital,`;

const normalizeText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeImportedAabrangencia = (value?: string | null) => {
  const cleaned = cleanText(value);
  const normalized = normalizeText(cleaned);
  if (!normalized) return null;
  if (normalized === 'rio de janeiro' || normalized === 'rj') return null;
  return cleaned;
};

const parseBoolean = (value?: string | null, fallback = true) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'no'].includes(normalized)) return false;
  return fallback;
};

const splitList = (value?: string | null) =>
  (value ?? '')
    .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (value?: string | number | null) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = (value ?? '').toString().trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseInteger = (value?: string | number | null) => {
  const parsed = parseNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const getCsvPriceColumn = (range: string) =>
  range === '59+' ? 'preco_59_mais' : `preco_${range.replace(/-/g, '_')}`;

const sanitizeImportText = (text: string) => {
  const trimmed = text.trimStart().replace(/^\uFEFF/, '');
  const jsonStart = Math.min(
    ...['{', '[']
      .map((token) => trimmed.indexOf(token))
      .filter((index) => index >= 0),
  );

  if (Number.isFinite(jsonStart) && jsonStart > 0) {
    return trimmed.slice(jsonStart);
  }

  return trimmed;
};

const IMPORTED_TABLE_MODALITIES = new Set<ImportedTableDefinition['modalidade']>(['PF', 'ADESAO', 'PME']);
const IMPORTED_BUSINESS_PROFILES = new Set<ImportedTableDefinition['perfilEmpresarial']>(['todos', 'mei', 'nao_mei']);
const IMPORTED_COPART_OPTIONS = new Set<ImportedTableDefinition['coparticipacao']>(['sem', 'parcial', 'total']);

const normalizeImportedAcomodacoes = (value?: string[] | null) =>
  Array.from(new Set((value ?? []).map((item) => item.trim()).filter(Boolean)));

const parseImportedPriceRow = (values?: Record<string, unknown> | null) =>
  COTADOR_AGE_RANGES.reduce((accumulator, range) => {
    const parsedValue = parseNumber(values?.[range] as string | number | null | undefined);
    if (parsedValue !== null) {
      accumulator[range] = parsedValue;
    }
    return accumulator;
  }, {} as CotadorPriceRowInput);

const parseImportedPricesByAcomodacao = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, CotadorPriceRowInput>;
  }

  return Object.entries(value as Record<string, Record<string, unknown>>).reduce((accumulator, [acomodacao, prices]) => {
    const normalizedAcomodacao = acomodacao.trim();
    if (!normalizedAcomodacao) {
      return accumulator;
    }

    accumulator[normalizedAcomodacao] = parseImportedPriceRow(prices);
    return accumulator;
  }, {} as Record<string, CotadorPriceRowInput>);
};

const getImportedTableActiveAcomodacoes = (table: ImportedTableDefinition) =>
  Object.entries(table.precosPorAcomodacao).filter(([acomodacao, prices]) => acomodacao.trim().length > 0 && Object.keys(prices).length > 0);

const countImportedTableRows = (table: ImportedTableDefinition) => getImportedTableActiveAcomodacoes(table).length;

const buildImportTargetLabel = (item: Pick<ProductReference, 'operadora' | 'linha' | 'produto'>, table?: Pick<ImportedTableDefinition, 'nome'> | null) =>
  [item.operadora, item.linha, item.produto, table?.nome].filter(Boolean).join(' / ');

const IMPORT_DEBUG_PREFIX = '[CotadorImport]';

const logImportInfo = (message: string, payload?: unknown) => {
  if (payload === undefined) {
    console.log(IMPORT_DEBUG_PREFIX, message);
    return;
  }

  console.log(IMPORT_DEBUG_PREFIX, message, payload);
};

const logImportWarn = (message: string, payload?: unknown) => {
  if (payload === undefined) {
    console.warn(IMPORT_DEBUG_PREFIX, message);
    return;
  }

  console.warn(IMPORT_DEBUG_PREFIX, message, payload);
};

const logImportError = (message: string, payload?: unknown) => {
  if (payload === undefined) {
    console.error(IMPORT_DEBUG_PREFIX, message);
    return;
  }

  console.error(IMPORT_DEBUG_PREFIX, message, payload);
};

const waitForImportConsistency = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const countPersistedTablesForProduct = async (productId: string) => {
  const attempts = 4;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { count, error } = await supabase
      .from('cotador_tabelas')
      .select('id', { count: 'exact', head: true })
      .eq('produto_id', productId);

    if (error) {
      logImportError('Falha ao consultar contagem persistida de tabelas', { productId, attempt, error });
      throw error;
    }

    logImportInfo('Contagem persistida consultada', { productId, attempt, count: count ?? 0 });

    if (attempt === attempts || (count ?? 0) > 0) {
      return count ?? 0;
    }

    await waitForImportConsistency(250 * attempt);
  }

  return 0;
};

const findExistingImportedTable = async (productId: string, payload: CotadorTableManagerInput) => {
  let query = supabase
    .from('cotador_tabelas')
    .select('*')
    .eq('produto_id', productId)
    .eq('nome', payload.nome)
    .eq('modalidade', payload.modalidade)
    .eq('perfil_empresarial', payload.perfil_empresarial)
    .eq('coparticipacao', payload.coparticipacao)
    .limit(1);

  query = payload.acomodacao ? query.eq('acomodacao', payload.acomodacao) : query.is('acomodacao', null);
  query = payload.vidas_min === null || payload.vidas_min === undefined ? query.is('vidas_min', null) : query.eq('vidas_min', payload.vidas_min);
  query = payload.vidas_max === null || payload.vidas_max === undefined ? query.is('vidas_max', null) : query.eq('vidas_max', payload.vidas_max);

  const { data, error } = await query.maybeSingle();
  if (error) {
    logImportError('Falha ao buscar tabela existente para import', {
      productId,
      nome: payload.nome,
      acomodacao: payload.acomodacao ?? null,
      erro: error,
    });
    throw error;
  }

  return (data as CotadorTabela | null) ?? null;
};

const validateImportedPayload = (payload: ImportedJsonPayload) => {
  payload.items.forEach((item) => {
    const productLabel = buildImportTargetLabel(item);
    const normalizedAcomodacoes = normalizeImportedAcomodacoes(item.acomodacoes);

    (item.tabelas ?? []).forEach((table) => {
      const tableLabel = buildImportTargetLabel(item, table);
      const { vidasMin, vidasMax } = table;

      if (!table.nome.trim()) {
        throw new Error(`Tabela sem nome em ${productLabel}.`);
      }

      if (!IMPORTED_TABLE_MODALITIES.has(table.modalidade)) {
        throw new Error(`Modalidade invalida em ${tableLabel}: ${table.modalidade}.`);
      }

      if (!IMPORTED_BUSINESS_PROFILES.has(table.perfilEmpresarial)) {
        throw new Error(`Perfil empresarial invalido em ${tableLabel}: ${table.perfilEmpresarial}.`);
      }

      if (!IMPORTED_COPART_OPTIONS.has(table.coparticipacao)) {
        throw new Error(`Coparticipacao invalida em ${tableLabel}: ${table.coparticipacao}.`);
      }

      if (vidasMin !== null && vidasMin !== undefined && vidasMin < 1) {
        throw new Error(`Faixa de vidas invalida em ${tableLabel}: vidasMin deve ser maior que zero.`);
      }

      if (vidasMax !== null && vidasMax !== undefined && vidasMax < 1) {
        throw new Error(`Faixa de vidas invalida em ${tableLabel}: vidasMax deve ser maior que zero.`);
      }

      if (vidasMin !== null && vidasMin !== undefined && vidasMax !== null && vidasMax !== undefined && vidasMin > vidasMax) {
        throw new Error(`Faixa de vidas invalida em ${tableLabel}: vidasMin nao pode ser maior que vidasMax.`);
      }

      const activeAcomodacoes = getImportedTableActiveAcomodacoes(table);
      if (activeAcomodacoes.length === 0) {
        throw new Error(`Tabela sem precos validos por acomodacao em ${tableLabel}.`);
      }

      if (normalizedAcomodacoes.length > 0) {
        const invalidAcomodacao = activeAcomodacoes.find(([acomodacao]) => !normalizedAcomodacoes.includes(acomodacao));
        if (invalidAcomodacao) {
          throw new Error(`Acomodacao ${invalidAcomodacao[0]} nao esta cadastrada no produto ${productLabel}.`);
        }
      }
    });
  });
};

const parseCsv = (text: string): CsvRow[] => {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentCell = '';
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const header = rows[0].map((cell) => normalizeText(cell));
  return rows.slice(1).map((row) =>
    header.reduce((accumulator, key, index) => {
      accumulator[key] = row[index]?.trim() ?? '';
      return accumulator;
    }, {} as CsvRow),
  );
};

const findByName = <T extends { nome: string }>(items: T[], name?: string | null) => {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  return items.find((item) => normalizeText(item.nome) === normalized) ?? null;
};

const findOperadora = (operadoras: Operadora[], name: string) => {
  const normalized = normalizeText(name);
  return operadoras.find((item) => normalizeText(item.nome) === normalized) ?? null;
};

const findLinha = (linhas: CotadorLineManagerRecord[], operadoraId: string, lineName: string) => {
  const normalized = normalizeText(lineName);
  return linhas.find((item) => item.operadora_id === operadoraId && normalizeText(item.nome) === normalized) ?? null;
};

const buildOperadoraRecord = (operadora: Operadora): Operadora => operadora;

const buildLinhaRecord = (line: CotadorLineManagerRecord, operadora: Operadora): CotadorLineManagerRecord => ({
  ...line,
  operadora,
});

const ensureOperadora = async (
  context: ImportLookupContext,
  operadoraName: string,
) => {
  const existing = findOperadora(context.operadoras, operadoraName);
  if (existing) {
    return { operadora: existing, createdOperadoraId: null };
  }

  const createResult = await configService.createOperadora({
    nome: operadoraName.trim(),
    ...DEFAULT_IMPORTED_OPERADORA,
  });

  if (createResult.error || !createResult.data) {
    throw new Error(`Erro ao criar operadora ${operadoraName}: ${String((createResult.error as { message?: string } | null)?.message ?? 'desconhecido')}`);
  }

  const created = buildOperadoraRecord(createResult.data);
  context.operadoras = [...context.operadoras, created];
  return { operadora: created, createdOperadoraId: created.id };
};

const ensureLinha = async (
  context: ImportLookupContext,
  operadora: Operadora,
  lineName: string,
) => {
  const existing = findLinha(context.linhas, operadora.id, lineName);
  if (existing) {
    return { line: existing, createdLineId: null };
  }

  const createResult = await cotadorService.createLinha({
    operadora_id: operadora.id,
    nome: lineName.trim(),
    ativo: true,
    observacoes: null,
  });

  if (createResult.error || !createResult.data) {
    throw new Error(`Erro ao criar linha ${lineName}: ${String((createResult.error as { message?: string } | null)?.message ?? 'desconhecido')}`);
  }

  const created = buildLinhaRecord({
    ...(createResult.data as CotadorLineManagerRecord),
    operadora,
  }, operadora);

  context.linhas = [...context.linhas, created];
  return { line: created, createdLineId: created.id };
};

const findProduto = (products: CotadorProductManagerRecord[], lineId: string, productName: string) => {
  const normalized = normalizeText(productName);
  return products.find((item) => item.linha_id === lineId && normalizeText(item.nome) === normalized) ?? null;
};

const createProductRecordFromRaw = (
  product: CotadorProduto,
  context: ImportLookupContext,
  entidadeIds: string[],
): CotadorProductManagerRecord => ({
  ...product,
  operadora: context.operadoras.find((item) => item.id === product.operadora_id) ?? null,
  linha: product.linha_id ? context.linhas.find((item) => item.id === product.linha_id) ?? null : null,
  administradora: product.administradora_id ? context.administradoras.find((item) => item.id === product.administradora_id) ?? null : null,
  entidadesClasse: entidadeIds.map((id) => context.entidades.find((item) => item.id === id)).filter((item): item is CotadorEntidadeClasse => item !== undefined),
});

const createTableRecordFromRaw = (
  table: CotadorTabela,
  product: CotadorProductManagerRecord,
  pricesByAgeRange: CotadorPriceRowInput,
): CotadorTableManagerRecord => ({
  ...table,
  produto: product,
  pricesByAgeRange,
});

const getProductPayloadFromReference = (
  reference: ProductReference,
  existingProduct: CotadorProductManagerRecord | null,
  context: ImportLookupContext,
  operadora: Operadora,
  line: CotadorLineManagerRecord,
): CotadorProductManagerInput => {
  const administradora = cleanText(reference.administradora)
    ? findByName(context.administradoras, reference.administradora)
    : existingProduct?.administradora ?? null;

  const entidadeIds = reference.entidadesElegiveis
    ? reference.entidadesElegiveis
        .map((name) => findByName(context.entidades, name))
        .filter((item): item is CotadorEntidadeClasse => item !== null)
        .map((item) => item.id)
    : existingProduct?.entidadesClasse.map((item) => item.id) ?? [];

  return {
    operadora_id: operadora.id,
    linha_id: line.id,
    administradora_id: administradora?.id ?? null,
    nome: reference.produto,
    modalidade: cleanText(reference.modalidadeBase) ?? existingProduct?.modalidade ?? null,
    abrangencia: normalizeImportedAabrangencia(reference.abrangencia) ?? existingProduct?.abrangencia ?? null,
    acomodacao: (reference.acomodacoes && reference.acomodacoes.length > 0 ? reference.acomodacoes.join(' | ') : existingProduct?.acomodacao) ?? null,
    entidadeIds,
    comissao_sugerida: existingProduct?.comissao_sugerida ?? null,
    bonus_por_vida_valor: existingProduct?.bonus_por_vida_valor ?? null,
    carencias: reference.detalhes?.carencias ?? existingProduct?.carencias ?? null,
    documentos_necessarios: reference.detalhes?.documentosNecessarios ?? existingProduct?.documentos_necessarios ?? null,
    reembolso: reference.detalhes?.reembolso ?? existingProduct?.reembolso ?? null,
    informacoes_importantes: reference.detalhes?.informacoesImportantes ?? existingProduct?.informacoes_importantes ?? null,
    rede_hospitalar: reference.redeHospitalar ?? (Array.isArray(existingProduct?.rede_hospitalar) ? existingProduct.rede_hospitalar as CotadorHospitalNetworkEntry[] : []),
    observacoes: existingProduct?.observacoes ?? null,
    ativo: existingProduct?.ativo ?? true,
  };
};

const resolveProduct = async (
  reference: ProductReference,
  context: ImportLookupContext,
  result: CotadorImportResult,
): Promise<ResolveProductResult> => {
  logImportInfo('Resolvendo produto', {
    alvo: buildImportTargetLabel(reference),
    modalidadeBase: reference.modalidadeBase ?? null,
    abrangencia: reference.abrangencia ?? null,
    acomodacoes: reference.acomodacoes ?? [],
  });

  const { operadora, createdOperadoraId } = await ensureOperadora(context, reference.operadora);
  const { line, createdLineId } = await ensureLinha(context, operadora, reference.linha);

  const existingProduct = findProduto(context.products, line.id, reference.produto);
  const payload = getProductPayloadFromReference(reference, existingProduct, context, operadora, line);

  if (existingProduct) {
    logImportInfo('Atualizando produto existente', {
      alvo: buildImportTargetLabel(reference),
      productId: existingProduct.id,
      lineId: line.id,
    });

    const updateResult = await cotadorService.updateProduto(existingProduct.id, payload);
    if (updateResult.error) {
      logImportError('Falha ao atualizar produto', {
        alvo: buildImportTargetLabel(reference),
        productId: existingProduct.id,
        erro: updateResult.error,
      });
      throw new Error(`Erro ao atualizar produto ${reference.produto}: ${updateResult.error.message}`);
    }

    const nextProduct: CotadorProductManagerRecord = {
      ...existingProduct,
      ...payload,
      administradora: payload.administradora_id ? context.administradoras.find((item) => item.id === payload.administradora_id) ?? null : null,
      entidadesClasse: payload.entidadeIds.map((id) => context.entidades.find((item) => item.id === id)).filter((item): item is CotadorEntidadeClasse => item !== undefined),
      linha: line,
      operadora,
      acomodacao: payload.acomodacao ?? null,
      abrangencia: payload.abrangencia ?? null,
      modalidade: payload.modalidade ?? null,
      carencias: payload.carencias ?? null,
      documentos_necessarios: payload.documentos_necessarios ?? null,
      reembolso: payload.reembolso ?? null,
      informacoes_importantes: payload.informacoes_importantes ?? null,
      rede_hospitalar: payload.rede_hospitalar ?? [],
      observacoes: payload.observacoes ?? null,
      ativo: payload.ativo,
    } as CotadorProductManagerRecord;

      context.products = context.products.map((item) => (item.id === existingProduct.id ? nextProduct : item));
      result.importedProducts += 1;
      return {
        product: nextProduct,
        createdOperadoraId,
        createdLineId,
        createdProductId: null,
      };
    }

  const createResult = await cotadorService.createProduto(payload);
  if (createResult.error || !createResult.data) {
    logImportError('Falha ao criar produto', {
      alvo: buildImportTargetLabel(reference),
      erro: createResult.error,
    });
    throw new Error(`Erro ao criar produto ${reference.produto}: ${createResult.error?.message ?? 'desconhecido'}`);
  }

  const created = createProductRecordFromRaw(createResult.data, context, payload.entidadeIds);
  logImportInfo('Produto criado', {
    alvo: buildImportTargetLabel(reference),
    productId: created.id,
    lineId: line.id,
    createdOperadoraId,
    createdLineId,
  });
  context.products = [...context.products, created];
  result.importedProducts += 1;
  return {
    product: created,
    createdOperadoraId,
    createdLineId,
    createdProductId: created.id,
  };
};

const upsertImportedTable = async (
  product: CotadorProductManagerRecord,
  tableDefinition: ImportedTableDefinition,
  context: ImportLookupContext,
  result: CotadorImportResult,
): Promise<UpsertImportedTableResult> => {
  const activeAcomodacoes = getImportedTableActiveAcomodacoes(tableDefinition);
  const createdTableIds: string[] = [];

  logImportInfo('Processando tabela importada', {
    produto: product.nome,
    productId: product.id,
    tabela: tableDefinition.nome,
    acomodacoes: activeAcomodacoes.map(([acomodacao]) => acomodacao),
    expectedRows: activeAcomodacoes.length,
  });

  try {
    for (const [acomodacao, pricesByAgeRange] of activeAcomodacoes) {
      const payload: CotadorTableManagerInput = {
        produto_id: product.id,
        nome: tableDefinition.nome,
        codigo: cleanText(tableDefinition.codigo),
        modalidade: tableDefinition.modalidade,
        perfil_empresarial: tableDefinition.perfilEmpresarial,
        coparticipacao: tableDefinition.coparticipacao,
        acomodacao: cleanText(acomodacao),
        vidas_min: tableDefinition.vidasMin ?? null,
        vidas_max: tableDefinition.vidasMax ?? null,
        observacoes: cleanText(tableDefinition.observacoes),
        ativo: tableDefinition.ativo ?? true,
        pricesByAgeRange,
      };

      const existing = await findExistingImportedTable(product.id, payload);

      if (existing) {
        logImportInfo('Atualizando tabela existente', {
          produto: product.nome,
          productId: product.id,
          tabela: tableDefinition.nome,
          acomodacao,
          tableId: existing.id,
          existingProductId: existing.produto_id,
        });

        const updateResult = await cotadorService.updateTabela(existing.id, payload);
        if (updateResult.error) {
          logImportError('Falha ao atualizar tabela existente', {
            produto: product.nome,
            productId: product.id,
            tabela: tableDefinition.nome,
            acomodacao,
            tableId: existing.id,
            erro: updateResult.error,
          });
          throw new Error(`Erro ao atualizar tabela ${tableDefinition.nome}: ${updateResult.error.message}`);
        }

        const nextRecord = createTableRecordFromRaw({ ...existing, ...payload }, product, pricesByAgeRange);
        context.tables = context.tables.some((table) => table.id === existing.id)
          ? context.tables.map((table) => table.id === existing.id ? nextRecord : table)
          : [...context.tables, nextRecord];
      } else {
        logImportInfo('Criando tabela nova', {
          produto: product.nome,
          productId: product.id,
          tabela: tableDefinition.nome,
          acomodacao,
        });

        const createResult = await cotadorService.createTabela(payload);
        if (createResult.error || !createResult.data) {
          logImportError('Falha ao criar tabela nova', {
            produto: product.nome,
            productId: product.id,
            tabela: tableDefinition.nome,
            acomodacao,
            erro: createResult.error,
          });
          throw new Error(`Erro ao criar tabela ${tableDefinition.nome}: ${createResult.error?.message ?? 'desconhecido'}`);
        }

        createdTableIds.push(createResult.data.id);
        context.tables = [...context.tables, createTableRecordFromRaw(createResult.data, product, pricesByAgeRange)];
      }

      result.importedTables += 1;
    }

    return { createdTableIds };
  } catch (error) {
    if (createdTableIds.length > 0) {
      logImportWarn('Revertendo tabelas criadas parcialmente', {
        produto: product.nome,
        productId: product.id,
        tabela: tableDefinition.nome,
        createdTableIds,
      });
      await Promise.all(createdTableIds.map((id) => cotadorService.deleteTabela(id)));
      context.tables = context.tables.filter((table) => !createdTableIds.includes(table.id));
      result.importedTables = Math.max(0, result.importedTables - createdTableIds.length);
    }

    throw error;
  }
};

const rollbackImportMutations = async (mutations: ImportMutations) => {
  logImportWarn('Iniciando rollback do import', mutations);
  const warnings: string[] = [];
  const uniqueTableIds = Array.from(new Set(mutations.createdTableIds)).reverse();
  const uniqueProductIds = Array.from(new Set(mutations.createdProductIds)).reverse();
  const uniqueLineIds = Array.from(new Set(mutations.createdLineIds)).reverse();
  const uniqueOperadoraIds = Array.from(new Set(mutations.createdOperadoraIds)).reverse();

  for (const tableId of uniqueTableIds) {
    const { error } = await cotadorService.deleteTabela(tableId);
    if (error) warnings.push(`nao foi possivel reverter a tabela ${tableId}`);
  }

  for (const productId of uniqueProductIds) {
    const { error } = await cotadorService.deleteProduto(productId);
    if (error) warnings.push(`nao foi possivel reverter o produto ${productId}`);
  }

  for (const lineId of uniqueLineIds) {
    const { error } = await cotadorService.deleteLinha(lineId);
    if (error) warnings.push(`nao foi possivel reverter a linha ${lineId}`);
  }

  for (const operadoraId of uniqueOperadoraIds) {
    const { error } = await configService.deleteOperadora(operadoraId);
    if (error) warnings.push(`nao foi possivel reverter a operadora ${operadoraId}`);
  }

  return warnings;
};

const parseJsonPayload = (text: string): ImportedJsonPayload => {
  const parsed = JSON.parse(sanitizeImportText(text)) as Record<string, unknown>;
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [parsed];

  const items = rawItems.map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    const details = (item.detalhes ?? {}) as Record<string, unknown>;
    const tabelas = Array.isArray(item.tabelas) ? item.tabelas : [];

    return {
      operadora: String(item.operadora ?? ''),
      linha: String(item.linha ?? ''),
      produto: String(item.produto ?? item.nome ?? ''),
      administradora: cleanText(typeof item.administradora === 'string' ? item.administradora : null),
      modalidadeBase: cleanText(typeof item.modalidadeBase === 'string' ? item.modalidadeBase : typeof item.modalidade_base === 'string' ? item.modalidade_base : null),
      abrangencia: normalizeImportedAabrangencia(typeof item.abrangencia === 'string' ? item.abrangencia : null),
      acomodacoes: normalizeImportedAcomodacoes(Array.isArray(item.acomodacoes) ? item.acomodacoes.map((value) => String(value)) : []),
      entidadesElegiveis: Array.isArray(item.entidadesElegiveis) ? item.entidadesElegiveis.map((value) => String(value).trim()).filter(Boolean) : [],
      detalhes: {
        carencias: cleanText(typeof details.carencias === 'string' ? details.carencias : null),
        documentosNecessarios: cleanText(typeof details.documentosNecessarios === 'string' ? details.documentosNecessarios : null),
        reembolso: cleanText(typeof details.reembolso === 'string' ? details.reembolso : null),
        informacoesImportantes: cleanText(typeof details.informacoesImportantes === 'string' ? details.informacoesImportantes : null),
      },
      redeHospitalar: Array.isArray(item.redeHospitalar) ? item.redeHospitalar as CotadorHospitalNetworkEntry[] : [],
      tabelas: tabelas.map((table) => {
        const candidate = table as Record<string, unknown>;
        const parsedPrices = parseImportedPricesByAcomodacao(candidate.precosPorAcomodacao);

        return {
          nome: String(candidate.nome ?? ''),
          codigo: cleanText(typeof candidate.codigo === 'string' ? candidate.codigo : null),
          modalidade: String(candidate.modalidade ?? 'PME') as ImportedTableDefinition['modalidade'],
          perfilEmpresarial: String(candidate.perfilEmpresarial ?? 'todos') as ImportedTableDefinition['perfilEmpresarial'],
          coparticipacao: String(candidate.coparticipacao ?? 'sem') as ImportedTableDefinition['coparticipacao'],
          vidasMin: parseInteger(candidate.vidasMin as string | number | null),
          vidasMax: parseInteger(candidate.vidasMax as string | number | null),
          observacoes: cleanText(typeof candidate.observacoes === 'string' ? candidate.observacoes : null),
          ativo: typeof candidate.ativo === 'boolean' ? candidate.ativo : true,
          precosPorAcomodacao: parsedPrices,
        };
      }),
    } as ProductReference & { tabelas: ImportedTableDefinition[] };
  }).filter((item) => item.operadora && item.linha && item.produto);

  return { items };
};

const buildPreviewFromPayload = (payload: ImportedJsonPayload): CotadorImportPreview => ({
  operadorasCount: new Set(payload.items.map((item) => normalizeText(item.operadora)).filter(Boolean)).size,
  linhasCount: new Set(payload.items.map((item) => `${normalizeText(item.operadora)}::${normalizeText(item.linha)}`).filter(Boolean)).size,
  produtosCount: payload.items.length,
  tabelasCount: payload.items.reduce((total, item) => total + (item.tabelas?.reduce((tableTotal, table) => tableTotal + countImportedTableRows(table), 0) ?? 0), 0),
  networkEntriesCount: payload.items.reduce((total, item) => total + (item.redeHospitalar?.length ?? 0), 0),
  items: payload.items.map((item) => ({
    operadora: item.operadora,
    linha: item.linha,
    produto: item.produto,
    modalidadeBase: item.modalidadeBase ?? null,
    abrangencia: item.abrangencia ?? null,
    acomodacoes: item.acomodacoes ?? [],
    entidadesElegiveis: item.entidadesElegiveis ?? [],
    tabelasCount: item.tabelas?.reduce((total, table) => total + countImportedTableRows(table), 0) ?? 0,
    networkEntriesCount: item.redeHospitalar?.length ?? 0,
  })),
});

const parseCsvTables = (text: string) => {
  const rows = parseCsv(text);
  return rows.map((row) => {
    const acomodacao = row.acomodacao || row.acomodacao_tabela;
    const prices = COTADOR_AGE_RANGES.reduce((accumulator, range) => {
      const csvKey = getCsvPriceColumn(range);
      const parsedValue = parseNumber(row[csvKey]);
      if (parsedValue !== null) {
        accumulator[range] = parsedValue;
      }
      return accumulator;
    }, {} as CotadorPriceRowInput);

    return {
      product: {
        operadora: row.operadora,
        linha: row.linha,
        produto: row.produto,
        administradora: cleanText(row.administradora),
        modalidadeBase: cleanText(row.modalidade_base),
        abrangencia: cleanText(row.abrangencia),
        acomodacoes: splitList(row.acomodacoes).length > 0 ? splitList(row.acomodacoes) : splitList(acomodacao),
        entidadesElegiveis: splitList(row.entidades_elegiveis),
      } as ProductReference,
      table: {
        nome: row.nome_tabela,
        codigo: cleanText(row.codigo_tabela),
        modalidade: (row.modalidade_tabela || 'PME') as ImportedTableDefinition['modalidade'],
        perfilEmpresarial: (row.perfil_empresarial || 'todos') as ImportedTableDefinition['perfilEmpresarial'],
        coparticipacao: (row.coparticipacao || 'sem') as ImportedTableDefinition['coparticipacao'],
        vidasMin: parseInteger(row.vidas_min),
        vidasMax: parseInteger(row.vidas_max),
        observacoes: cleanText(row.observacoes),
        ativo: parseBoolean(row.ativo, true),
        precosPorAcomodacao: {
          [acomodacao || 'Padrao']: prices,
        },
      } as ImportedTableDefinition,
    };
  }).filter((item) => item.product.operadora && item.product.linha && item.product.produto && item.table.nome);
};

const parseCsvNetwork = (text: string): ImportedNetworkCsvRow[] =>
  parseCsv(text)
    .map((row) => ({
      operadora: row.operadora,
      linha: row.linha,
      produto: row.produto,
      administradora: cleanText(row.administradora),
      modalidadeBase: cleanText(row.modalidade_base),
      abrangencia: cleanText(row.abrangencia),
      acomodacoes: splitList(row.acomodacoes),
      cidade: row.cidade,
      regiao: cleanText(row.regiao),
      hospital: row.hospital,
      bairro: cleanText(row.bairro),
      atendimentos: splitList(row.atendimentos),
      observacoes: cleanText(row.observacoes),
    }))
    .filter((row) => row.operadora && row.linha && row.produto && row.cidade && row.hospital);

const loadImportContext = async (): Promise<ImportLookupContext> => {
  const [operadoras, linhas, administradoras, entidades, products, tables] = await Promise.all([
    configService.getOperadoras(),
    cotadorService.getLinhas(),
    cotadorService.getAdministradoras(),
    cotadorService.getEntidadesClasse(),
    cotadorService.getProdutos(),
    cotadorService.getTabelas(),
  ]);

  logImportInfo('Contexto de import carregado', {
    operadoras: operadoras.length,
    linhas: linhas.length,
    administradoras: administradoras.length,
    entidades: entidades.length,
    produtos: products.length,
    tabelas: tables.length,
  });

  return { operadoras, linhas, administradoras, entidades, products, tables };
};

const importJsonCompleto = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const payload = parseJsonPayload(text);
  const mutations: ImportMutations = {
    createdOperadoraIds: [],
    createdLineIds: [],
    createdProductIds: [],
    createdTableIds: [],
  };

  validateImportedPayload(payload);
  logImportInfo('Iniciando import JSON completo', {
    produtos: payload.items.length,
    tabelas: payload.items.reduce((total, item) => total + (item.tabelas?.reduce((count, table) => count + countImportedTableRows(table), 0) ?? 0), 0),
    rede: payload.items.reduce((total, item) => total + (item.redeHospitalar?.length ?? 0), 0),
  });

  try {
    for (const item of payload.items) {
      logImportInfo('Importando item', {
        alvo: buildImportTargetLabel(item),
        tabelas: item.tabelas?.length ?? 0,
        rowsEsperadas: item.tabelas?.reduce((total, table) => total + countImportedTableRows(table), 0) ?? 0,
      });

      const resolvedProduct = await resolveProduct(item, context, result);
      if (resolvedProduct.createdOperadoraId) mutations.createdOperadoraIds.push(resolvedProduct.createdOperadoraId);
      if (resolvedProduct.createdLineId) mutations.createdLineIds.push(resolvedProduct.createdLineId);
      if (resolvedProduct.createdProductId) mutations.createdProductIds.push(resolvedProduct.createdProductId);
      result.importedNetworkEntries += item.redeHospitalar?.length ?? 0;

      const settledTableResults = await Promise.allSettled((item.tabelas ?? []).map((table) => upsertImportedTable(resolvedProduct.product, table, context, result)));
      const tableError = settledTableResults.find((entry): entry is PromiseRejectedResult => entry.status === 'rejected');

      if (tableError) {
        throw tableError.reason;
      }

      settledTableResults.forEach((entry) => {
        if (entry.status === 'fulfilled') {
          mutations.createdTableIds.push(...entry.value.createdTableIds);
        }
      });
    }

    if (payload.items.length > 0) {
      for (const item of payload.items) {
        const product = context.products.find((candidate) => normalizeText(candidate.nome) === normalizeText(item.produto) && normalizeText(candidate.linha?.nome) === normalizeText(item.linha));
        if (!product) continue;

        const expectedRows = item.tabelas?.reduce((total, table) => total + countImportedTableRows(table), 0) ?? 0;
        const actualRows = await countPersistedTablesForProduct(product.id);

        logImportInfo('Verificacao final do produto importado', {
          alvo: buildImportTargetLabel(item),
          productId: product.id,
          expectedRows,
          actualRows,
        });

        if (actualRows !== expectedRows) {
          logImportError('Importacao inconsistente detectada', {
            alvo: buildImportTargetLabel(item),
            productId: product.id,
            expectedRows,
            actualRows,
          });
          throw new Error(`Importacao inconsistente para ${item.produto}: esperado ${expectedRows} tabela(s), encontrado ${actualRows}.`);
        }
      }
    }

    logImportInfo('Import JSON concluido com sucesso', result);
    return result;
  } catch (error) {
    logImportError('Import JSON falhou', error);
    const rollbackWarnings = await rollbackImportMutations(mutations);
    const message = error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo.';
    if (rollbackWarnings.length > 0) {
      throw new Error(`${message} Rollback parcial: ${rollbackWarnings.join('; ')}.`);
    }
    throw error;
  }
};

const importCsvTabelas = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const rows = parseCsvTables(text);
  const mutations: ImportMutations = {
    createdOperadoraIds: [],
    createdLineIds: [],
    createdProductIds: [],
    createdTableIds: [],
  };

  try {
    for (const row of rows) {
      const resolvedProduct = await resolveProduct(row.product, context, result);
      if (resolvedProduct.createdOperadoraId) mutations.createdOperadoraIds.push(resolvedProduct.createdOperadoraId);
      if (resolvedProduct.createdLineId) mutations.createdLineIds.push(resolvedProduct.createdLineId);
      if (resolvedProduct.createdProductId) mutations.createdProductIds.push(resolvedProduct.createdProductId);

      const tableResult = await upsertImportedTable(resolvedProduct.product, row.table, context, result);
      mutations.createdTableIds.push(...tableResult.createdTableIds);
    }

    return result;
  } catch (error) {
    const rollbackWarnings = await rollbackImportMutations(mutations);
    const message = error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo CSV de tabelas.';
    if (rollbackWarnings.length > 0) {
      throw new Error(`${message} Rollback parcial: ${rollbackWarnings.join('; ')}.`);
    }
    throw error;
  }
};

const importCsvRede = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const rows = parseCsvNetwork(text);
  const mutations: ImportMutations = {
    createdOperadoraIds: [],
    createdLineIds: [],
    createdProductIds: [],
    createdTableIds: [],
  };
  const grouped = new Map<string, ImportedNetworkCsvRow[]>();

  rows.forEach((row) => {
    const key = [normalizeText(row.operadora), normalizeText(row.linha), normalizeText(row.produto)].join('|');
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });

  try {
    for (const groupRows of grouped.values()) {
      const first = groupRows[0];
      const network = groupRows.map((row) => ({
        cidade: row.cidade,
        regiao: row.regiao,
        hospital: row.hospital,
        bairro: row.bairro,
        atendimentos: row.atendimentos,
        observacoes: row.observacoes,
      }));

      const resolvedProduct = await resolveProduct({
        operadora: first.operadora,
        linha: first.linha,
        produto: first.produto,
        administradora: first.administradora,
        modalidadeBase: first.modalidadeBase,
        abrangencia: first.abrangencia,
        acomodacoes: first.acomodacoes,
        redeHospitalar: network,
      }, context, result);

      if (resolvedProduct.createdOperadoraId) mutations.createdOperadoraIds.push(resolvedProduct.createdOperadoraId);
      if (resolvedProduct.createdLineId) mutations.createdLineIds.push(resolvedProduct.createdLineId);
      if (resolvedProduct.createdProductId) mutations.createdProductIds.push(resolvedProduct.createdProductId);

      result.importedNetworkEntries += network.length;
      context.products = context.products.map((item) => item.id === resolvedProduct.product.id ? { ...item, rede_hospitalar: network } as CotadorProductManagerRecord : item);
    }

    return result;
  } catch (error) {
    const rollbackWarnings = await rollbackImportMutations(mutations);
    const message = error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo CSV de rede.';
    if (rollbackWarnings.length > 0) {
      throw new Error(`${message} Rollback parcial: ${rollbackWarnings.join('; ')}.`);
    }
    throw error;
  }
};

export const cotadorImportService = {
  getTemplate(kind: CotadorImportKind) {
    if (kind === 'csv-tabelas') return TEMPLATE_CSV_TABELAS;
    if (kind === 'csv-rede') return TEMPLATE_CSV_REDE;
    return TEMPLATE_JSON_COMPLETO;
  },

  previewFromText(kind: CotadorImportKind, text: string) {
    if (kind !== 'json-completo') {
      throw new Error('Preview disponível apenas para JSON completo.');
    }

    const payload = parseJsonPayload(text);
    validateImportedPayload(payload);
    const preview = buildPreviewFromPayload(payload);
    logImportInfo('Preview de import gerado', preview);
    return preview;
  },

  async importFromText(kind: CotadorImportKind, text: string) {
    const context = await loadImportContext();
    logImportInfo('Disparando importacao', { kind });

    if (kind === 'csv-tabelas') return importCsvTabelas(text, context);
    if (kind === 'csv-rede') return importCsvRede(text, context);
    return importJsonCompleto(text, context);
  },
};
