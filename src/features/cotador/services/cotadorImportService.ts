import { configService } from '../../../lib/configService';
import type { CotadorAdministradora, CotadorEntidadeClasse, CotadorProduto, CotadorTabela, Operadora } from '../../../lib/supabase';
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
    return existing;
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
  return created;
};

const ensureLinha = async (
  context: ImportLookupContext,
  operadora: Operadora,
  lineName: string,
) => {
  const existing = findLinha(context.linhas, operadora.id, lineName);
  if (existing) {
    return existing;
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
  return created;
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
): Promise<CotadorProductManagerRecord> => {
  const operadora = await ensureOperadora(context, reference.operadora);
  const line = await ensureLinha(context, operadora, reference.linha);

  const existingProduct = findProduto(context.products, line.id, reference.produto);
  const payload = getProductPayloadFromReference(reference, existingProduct, context, operadora, line);

  if (existingProduct) {
    const updateResult = await cotadorService.updateProduto(existingProduct.id, payload);
    if (updateResult.error) {
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
    return nextProduct;
  }

  const createResult = await cotadorService.createProduto(payload);
  if (createResult.error || !createResult.data) {
    throw new Error(`Erro ao criar produto ${reference.produto}: ${createResult.error?.message ?? 'desconhecido'}`);
  }

  const created = createProductRecordFromRaw(createResult.data, context, payload.entidadeIds);
  context.products = [...context.products, created];
  result.importedProducts += 1;
  return created;
};

const buildTableLookupKey = (input: {
  productId: string;
  name: string;
  modalidade: string;
  perfil: string;
  copart: string;
  vidasMin?: number | null;
  vidasMax?: number | null;
  acomodacao?: string | null;
}) => [
  input.productId,
  normalizeText(input.name),
  normalizeText(input.modalidade),
  normalizeText(input.perfil),
  normalizeText(input.copart),
  input.vidasMin ?? '',
  input.vidasMax ?? '',
  normalizeText(input.acomodacao),
].join('|');

const upsertImportedTable = async (
  product: CotadorProductManagerRecord,
  tableDefinition: ImportedTableDefinition,
  context: ImportLookupContext,
  result: CotadorImportResult,
) => {
  const activeAcomodacoes = Object.entries(tableDefinition.precosPorAcomodacao);

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

    const existing = context.tables.find((table) => buildTableLookupKey({
      productId: product.id,
      name: table.nome,
      modalidade: table.modalidade,
      perfil: table.perfil_empresarial,
      copart: table.coparticipacao,
      vidasMin: table.vidas_min ?? null,
      vidasMax: table.vidas_max ?? null,
      acomodacao: table.acomodacao ?? null,
    }) === buildTableLookupKey({
      productId: product.id,
      name: payload.nome,
      modalidade: payload.modalidade,
      perfil: payload.perfil_empresarial,
      copart: payload.coparticipacao,
      vidasMin: payload.vidas_min,
      vidasMax: payload.vidas_max,
      acomodacao: payload.acomodacao,
    }));

    if (existing) {
      const updateResult = await cotadorService.updateTabela(existing.id, payload);
      if (updateResult.error) {
        throw new Error(`Erro ao atualizar tabela ${tableDefinition.nome}: ${updateResult.error.message}`);
      }

      context.tables = context.tables.map((table) => table.id === existing.id ? { ...existing, ...payload, produto: product, pricesByAgeRange } : table);
    } else {
      const createResult = await cotadorService.createTabela(payload);
      if (createResult.error || !createResult.data) {
        throw new Error(`Erro ao criar tabela ${tableDefinition.nome}: ${createResult.error?.message ?? 'desconhecido'}`);
      }

      context.tables = [...context.tables, createTableRecordFromRaw(createResult.data, product, pricesByAgeRange)];
    }

    result.importedTables += 1;
  }
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
      acomodacoes: Array.isArray(item.acomodacoes) ? item.acomodacoes.map((value) => String(value).trim()).filter(Boolean) : [],
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
        const prices = (candidate.precosPorAcomodacao ?? {}) as Record<string, Record<string, unknown>>;
        const parsedPrices = Object.entries(prices).reduce((accumulator, [acomodacao, values]) => {
          accumulator[acomodacao] = COTADOR_AGE_RANGES.reduce((priceAccumulator, range) => {
            const parsedValue = parseNumber(values?.[range] as string | number | null | undefined);
            if (parsedValue !== null) {
              priceAccumulator[range] = parsedValue;
            }
            return priceAccumulator;
          }, {} as CotadorPriceRowInput);
          return accumulator;
        }, {} as Record<string, CotadorPriceRowInput>);

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
  tabelasCount: payload.items.reduce((total, item) => total + (item.tabelas?.length ?? 0), 0),
  networkEntriesCount: payload.items.reduce((total, item) => total + (item.redeHospitalar?.length ?? 0), 0),
  items: payload.items.map((item) => ({
    operadora: item.operadora,
    linha: item.linha,
    produto: item.produto,
    modalidadeBase: item.modalidadeBase ?? null,
    abrangencia: item.abrangencia ?? null,
    acomodacoes: item.acomodacoes ?? [],
    entidadesElegiveis: item.entidadesElegiveis ?? [],
    tabelasCount: item.tabelas?.length ?? 0,
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

  return { operadoras, linhas, administradoras, entidades, products, tables };
};

const importJsonCompleto = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const payload = parseJsonPayload(text);

  for (const item of payload.items) {
    const product = await resolveProduct(item, context, result);
    result.importedNetworkEntries += item.redeHospitalar?.length ?? 0;

    for (const table of item.tabelas ?? []) {
      await upsertImportedTable(product, table, context, result);
    }
  }

  return result;
};

const importCsvTabelas = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const rows = parseCsvTables(text);

  for (const row of rows) {
    const product = await resolveProduct(row.product, context, result);
    await upsertImportedTable(product, row.table, context, result);
  }

  return result;
};

const importCsvRede = async (text: string, context: ImportLookupContext): Promise<CotadorImportResult> => {
  const result: CotadorImportResult = { importedProducts: 0, importedTables: 0, importedNetworkEntries: 0, warnings: [] };
  const rows = parseCsvNetwork(text);
  const grouped = new Map<string, ImportedNetworkCsvRow[]>();

  rows.forEach((row) => {
    const key = [normalizeText(row.operadora), normalizeText(row.linha), normalizeText(row.produto)].join('|');
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  });

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

    const product = await resolveProduct({
      operadora: first.operadora,
      linha: first.linha,
      produto: first.produto,
      administradora: first.administradora,
      modalidadeBase: first.modalidadeBase,
      abrangencia: first.abrangencia,
      acomodacoes: first.acomodacoes,
      redeHospitalar: network,
    }, context, result);

    result.importedNetworkEntries += network.length;
    context.products = context.products.map((item) => item.id === product.id ? { ...item, rede_hospitalar: network } as CotadorProductManagerRecord : item);
  }

  return result;
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
    return buildPreviewFromPayload(payload);
  },

  async importFromText(kind: CotadorImportKind, text: string) {
    const context = await loadImportContext();

    if (kind === 'csv-tabelas') return importCsvTabelas(text, context);
    if (kind === 'csv-rede') return importCsvRede(text, context);
    return importJsonCompleto(text, context);
  },
};
